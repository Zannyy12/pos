const { query, pool } = require('../db');

// Get stock list (paginated and filterable)
const getStock = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const { product_id, vendor_id, category_id, location, search } = req.query;

  try {
    let queryStr = `
      SELECT s.*, p.name AS product_name, p.quantity_limit,
             v.name AS vendor_name, c.name AS category_name,
             (s.price - s.cost) AS margin_amount,
             CASE 
               WHEN s.price > 0 THEN ROUND(((s.price - s.cost) / s.price) * 100, 2)
               ELSE 0.00
             END AS margin_percent
      FROM stock s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.deleted_at IS NULL AND p.deleted_at IS NULL
    `;
    const params = [];
    let paramCounter = 1;

    if (product_id) {
      queryStr += ` AND s.product_id = $${paramCounter}`;
      params.push(parseInt(product_id));
      paramCounter++;
    }

    if (vendor_id) {
      queryStr += ` AND s.vendor_id = $${paramCounter}`;
      params.push(parseInt(vendor_id));
      paramCounter++;
    }

    if (category_id) {
      queryStr += ` AND p.category_id = $${paramCounter}`;
      params.push(parseInt(category_id));
      paramCounter++;
    }

    if (location) {
      queryStr += ` AND s.location = $${paramCounter}`;
      params.push(location);
      paramCounter++;
    }

    if (search) {
      queryStr += ` AND (p.name ILIKE $${paramCounter} OR p.barcode ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Totals calculations
    const totalsRes = await query(`
      SELECT COALESCE(SUM(s.quantity), 0) AS total_qty,
             COALESCE(SUM(s.quantity * s.cost), 0) AS total_cost_value,
             COALESCE(SUM(s.quantity * s.price), 0) AS total_price_value
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.deleted_at IS NULL AND p.deleted_at IS NULL
      ${product_id ? ` AND s.product_id = ${parseInt(product_id)}` : ''}
      ${vendor_id ? ` AND s.vendor_id = ${parseInt(vendor_id)}` : ''}
      ${location ? ` AND s.location = '${location}'` : ''}
    `);

    const totals = totalsRes.rows[0];
    const totalQty = parseInt(totals.total_qty);
    const totalCostValue = parseFloat(totals.total_cost_value);
    const totalPriceValue = parseFloat(totals.total_price_value);
    const totalMargin = totalPriceValue - totalCostValue;

    // Pagination Count
    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY s.id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const stockRes = await query(queryStr, params);

    res.json({
      data: stockRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit,
        totals: {
          totalQty,
          totalCostValue,
          totalPriceValue,
          totalMargin
        }
      }
    });
  } catch (err) {
    console.error('Error fetching stock:', err);
    res.status(500).json({ message: 'Error fetching stock' });
  }
};

// Adjust and transfer stock
const adjustStock = async (req, res) => {
  const { stock_id, type, quantity, location, note } = req.body;

  if (!stock_id || !type || quantity === undefined) {
    return res.status(400).json({ message: 'Stock ID, Adjustment Type, and Quantity are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current stock item
    const stockRes = await client.query(`
      SELECT s.*, p.name AS product_name 
      FROM stock s 
      JOIN products p ON s.product_id = p.id 
      WHERE s.id = $1 AND s.deleted_at IS NULL`, 
      [stock_id]
    );

    if (stockRes.rows.length === 0) throw new Error('Stock item not found');
    const currentStock = stockRes.rows[0];

    if (type === 'adjust') {
      const newQty = parseInt(quantity);
      if (newQty < 0) throw new Error('Quantity cannot be negative');

      await client.query(
        'UPDATE stock SET quantity = $1 WHERE id = $2',
        [newQty, stock_id]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, action, details, old_value, new_value)
         VALUES ($1, 'Stock Adjust', $2, $3, $4)`,
        [
          req.user.id,
          `Adjusted stock quantity of product: ${currentStock.product_name} at ${currentStock.location}`,
          JSON.stringify({ quantity: currentStock.quantity }),
          JSON.stringify({ quantity: newQty, note })
        ]
      );
    } else if (type === 'transfer') {
      const transferQty = parseInt(quantity);
      if (transferQty <= 0) throw new Error('Transfer quantity must be greater than zero');
      if (currentStock.quantity < transferQty) {
        throw new Error(`Insufficient stock to transfer. Available: ${currentStock.quantity}, Requested: ${transferQty}`);
      }
      if (!location) throw new Error('Target location is required for transfer');
      if (location === currentStock.location) throw new Error('Source and destination locations must be different');

      // Decrement source stock
      await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE id = $2',
        [transferQty, stock_id]
      );

      // Check if target stock row exists (same product, vendor, cost, price, location)
      const targetRes = await client.query(
        `SELECT id, quantity FROM stock 
         WHERE product_id = $1 AND vendor_id = $2 AND cost = $3 AND price = $4 AND location = $5 AND deleted_at IS NULL`,
        [currentStock.product_id, currentStock.vendor_id, currentStock.cost, currentStock.price, location]
      );

      if (targetRes.rows.length > 0) {
        // Update target
        await client.query(
          'UPDATE stock SET quantity = quantity + $1 WHERE id = $2',
          [transferQty, targetRes.rows[0].id]
        );
      } else {
        // Insert new stock row
        await client.query(
          `INSERT INTO stock (vendor_id, product_id, quantity, price, cost, barcode, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [currentStock.vendor_id, currentStock.product_id, transferQty, currentStock.price, currentStock.cost, currentStock.barcode, location]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, action, details)
         VALUES ($1, 'Stock Transfer', $2)`,
        [
          req.user.id,
          `Transferred ${transferQty} unit(s) of ${currentStock.product_name} from ${currentStock.location} to ${location}`
        ]
      );
    } else {
      throw new Error('Invalid stock action type');
    }

    await client.query('COMMIT');
    res.json({ message: 'Stock updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating stock:', err);
    res.status(500).json({ message: err.message || 'Error updating stock' });
  } finally {
    client.release();
  }
};

// Purchase stock (add stock from vendor)
const addPurchase = async (req, res) => {
  const { vendor_id, date, items } = req.body; // items = Array of { product_id, quantity, cost, price, location }

  if (!vendor_id || !date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Vendor, Date, and at least one purchase item are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Calculate totals
    let totalQty = 0;
    let totalAmount = 0.00;

    for (const item of items) {
      if (!item.product_id || item.quantity === undefined || item.cost === undefined || item.price === undefined || !item.location) {
        throw new Error('Each purchase item must have a Product, Quantity, Cost, Price, and Location');
      }
      const qty = parseInt(item.quantity);
      const cst = parseFloat(item.cost);
      const prc = parseFloat(item.price);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Purchase quantity must be a positive integer greater than zero');
      }
      if (isNaN(cst) || cst <= 0) {
        throw new Error('Purchase cost must be a positive number greater than zero');
      }
      if (isNaN(prc) || prc <= 0) {
        throw new Error('Retail price must be a positive number greater than zero');
      }
      totalQty += qty;
      totalAmount += cst * qty;
    }

    // 2. Create Purchase Order
    const poRes = await client.query(
      `INSERT INTO purchase_orders (vendor_id, total_amount, total_qty, date)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [vendor_id, totalAmount, totalQty, date]
    );
    const purchaseOrderId = poRes.rows[0].id;

    // 3. Process items
    for (const item of items) {
      const { product_id, quantity, cost, price, location } = item;
      const qty = parseInt(quantity);
      const cst = parseFloat(cost);
      const prc = parseFloat(price);
      const itemAmount = cst * qty;

      // Insert Purchase Order Item
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, cost, quantity, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseOrderId, product_id, cst, qty, itemAmount]
      );

      // Fetch barcode from product profile
      const prodRes = await client.query('SELECT barcode, name FROM products WHERE id = $1', [product_id]);
      if (prodRes.rows.length === 0) throw new Error('Product not found');
      const { barcode, name } = prodRes.rows[0];

      // Insert or Update stock at location (checking product, cost, price, and location)
      const stockCheck = await client.query(
        `SELECT id, quantity FROM stock 
         WHERE product_id = $1 AND location = $2 AND cost = $3 AND price = $4 AND deleted_at IS NULL`,
        [product_id, location, cst, prc]
      );

      if (stockCheck.rows.length > 0) {
        // Add to existing stock row
        await client.query(
          'UPDATE stock SET quantity = quantity + $1 WHERE id = $2',
          [qty, stockCheck.rows[0].id]
        );
      } else {
        // Insert new stock row
        await client.query(
          `INSERT INTO stock (vendor_id, product_id, quantity, price, cost, barcode, location)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [vendor_id, product_id, qty, prc, cst, barcode, location]
        );
      }

      // Update product retail price and cost in product profile
      await client.query(
        'UPDATE products SET cost = $1, price = $2 WHERE id = $3',
        [cst, prc, product_id]
      );
    }

    // 4. Update Vendor balance (Increases what we owe them since we purchased stock on account)
    await client.query(
      'UPDATE vendors SET balance = balance + $1 WHERE id = $2',
      [totalAmount, vendor_id]
    );

    // 5. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Purchase Stock', $2)`,
      [req.user.id, `Stock Purchase Order ID: ${purchaseOrderId} created from Vendor ID: ${vendor_id} for ${totalAmount}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Purchase recorded successfully', purchaseOrderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding purchase:', err);
    res.status(500).json({ message: err.message || 'Error recording purchase order' });
  } finally {
    client.release();
  }
};

// Purchase return (returning stock to vendors)
const addPurchaseReturn = async (req, res) => {
  const { vendor_id, product_id, quantity, cost, location, date } = req.body;

  if (!vendor_id || !product_id || !quantity || !cost || !location || !date) {
    return res.status(400).json({ message: 'All purchase return fields are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const qtyToReturn = parseInt(quantity);
    const cst = parseFloat(cost);
    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
      throw new Error('Return quantity must be a positive integer greater than zero');
    }
    if (isNaN(cst) || cst <= 0) {
      throw new Error('Cost must be a positive number greater than zero');
    }
    const amount = qtyToReturn * cst;

    // 1. Check stock level at location
    const stockRes = await client.query(
      `SELECT id, quantity, price, cost FROM stock 
       WHERE product_id = $1 AND location = $2 AND vendor_id = $3 AND deleted_at IS NULL 
       ORDER BY quantity DESC`,
      [product_id, location, vendor_id]
    );

    if (stockRes.rows.length === 0) {
      throw new Error(`No stock found for this product, vendor, and location`);
    }

    let remainingToDeduct = qtyToReturn;
    for (const row of stockRes.rows) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(row.quantity, remainingToDeduct);
      await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE id = $2',
        [deduct, row.id]
      );
      remainingToDeduct -= deduct;
    }

    if (remainingToDeduct > 0) {
      throw new Error(`Insufficient stock available at '${location}' to complete the return. Remaining to deduct: ${remainingToDeduct}`);
    }

    // 2. Insert Purchase Return record
    await client.query(
      `INSERT INTO purchase_returns (vendor_id, product_id, quantity, cost, amount, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [vendor_id, product_id, qtyToReturn, cst, amount, date]
    );

    // 3. Update Vendor Balance (reduces what we owe them)
    await client.query(
      'UPDATE vendors SET balance = balance - $1 WHERE id = $2',
      [amount, vendor_id]
    );

    // 4. Audit log
    const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [product_id]);
    const prodName = prodRes.rows[0]?.name || 'Product';
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Purchase Return', $2)`,
      [req.user.id, `Returned ${qtyToReturn} units of ${prodName} to vendor ID: ${vendor_id} (Value: ${amount})`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Purchase return completed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during purchase return:', err);
    res.status(500).json({ message: err.message || 'Error recording purchase return' });
  } finally {
    client.release();
  }
};

module.exports = {
  getStock,
  adjustStock,
  addPurchase,
  addPurchaseReturn
};
