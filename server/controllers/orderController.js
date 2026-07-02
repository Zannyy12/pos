const { query, pool } = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure upload directory and multer
const uploadDir = path.join(__dirname, '..', 'uploads', 'payment-proofs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `proof_temp_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, PDF files accepted'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Create sales order (POS Invoice)
const createOrder = async (req, res) => {
  const { customer_id, discount, amount_paid, items } = req.body; // items = Array of { product_id, quantity, unit_price, discount, location }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one item is required to check out' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve customer
    let resolvedCustomerId = customer_id;
    if (!resolvedCustomerId) {
      // Find or default to Walk-in Customer
      const walkinRes = await client.query("SELECT id FROM customers WHERE name = 'Walk-in Customer' AND deleted_at IS NULL LIMIT 1");
      if (walkinRes.rows.length > 0) {
        resolvedCustomerId = walkinRes.rows[0].id;
      } else {
        throw new Error('Default Walk-in Customer profile not found. Please create a customer first.');
      }
    }

    const customerRes = await client.query('SELECT name, balance FROM customers WHERE id = $1 AND deleted_at IS NULL', [resolvedCustomerId]);
    if (customerRes.rows.length === 0) throw new Error('Customer not found');
    const customer = customerRes.rows[0];
    const isWalkin = customer.name === 'Walk-in Customer';

    let invoiceSubtotal = 0.00;
    const validatedItems = [];

    // 2. Validate inventory and check pricing
    for (const item of items) {
      const { product_id, quantity, unit_price, discount: itemDiscount, location } = item;
      const qty = parseInt(quantity);
      const disc = parseFloat(itemDiscount || 0);
      const price = parseFloat(unit_price);

      if (!product_id || qty <= 0 || price < 0 || !location) {
        throw new Error('Invalid item fields provided in checkout list');
      }

      // Fetch product name and barcode
      const prodRes = await client.query('SELECT name, barcode FROM products WHERE id = $1 AND deleted_at IS NULL', [product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product with ID ${product_id} not found`);
      const productName = prodRes.rows[0].name;
      const barcode = prodRes.rows[0].barcode;

      // Check stock availability at location
      const stockRes = await client.query(
        `SELECT SUM(quantity) AS total_qty FROM stock 
         WHERE product_id = $1 AND location = $2 AND deleted_at IS NULL`,
        [product_id, location]
      );

      const availableQty = parseInt(stockRes.rows[0].total_qty || 0);
      if (availableQty < qty) {
        throw new Error(`Insufficient stock for '${productName}' at '${location}'. Available: ${availableQty}, Requested: ${qty}`);
      }

      // Calculate total for this item
      const itemSubtotal = (price - disc) * qty;
      invoiceSubtotal += itemSubtotal;

      validatedItems.push({
        product_id,
        name: productName,
        barcode,
        quantity: qty,
        unit_price: price,
        discount: disc,
        total_price: itemSubtotal,
        location
      });
    }

    const invoiceDiscount = parseFloat(discount || 0);
    const invoiceTotal = Math.max(0, invoiceSubtotal - invoiceDiscount);
    const paidAmount = parseFloat(amount_paid || 0);
    const balanceImpact = invoiceTotal - paidAmount;

    // Walk-in customer validation (cannot carry credit balance)
    if (isWalkin && Math.abs(balanceImpact) > 0.01) {
      throw new Error(`Walk-in Customer cannot carry outstanding balance. Total: ${invoiceTotal}, Paid: ${paidAmount}`);
    }

    // 3. Create Order
    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, user_id, total_price, amount_paid, discount, balance_due, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed') RETURNING id`,
      [resolvedCustomerId, req.user.id, invoiceTotal, paidAmount, invoiceDiscount, balanceImpact]
    );
    const orderId = orderRes.rows[0].id;

    // 4. Create Order Items and Deduct Stock
    for (const item of validatedItems) {
      // Insert Order Item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, unit_price, quantity, discount, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.product_id, item.unit_price, item.quantity, item.discount, item.total_price]
      );

      // Deduct from stock rows (FIFO style or descending quantity rows)
      let remainingToDeduct = item.quantity;
      const stockRows = await client.query(
        `SELECT id, quantity, vendor_id, cost, price FROM stock 
         WHERE product_id = $1 AND location = $2 AND quantity > 0 AND deleted_at IS NULL 
         ORDER BY quantity DESC`,
        [item.product_id, item.location]
      );

      for (const row of stockRows.rows) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(row.quantity, remainingToDeduct);
        
        await client.query(
          'UPDATE stock SET quantity = quantity - $1 WHERE id = $2',
          [deduct, row.id]
        );
        remainingToDeduct -= deduct;
      }

      if (remainingToDeduct > 0) {
        throw new Error(`Critical error: stock levels shifted during processing for product: ${item.name}`);
      }
    }

    // 5. Update Customer Balance (unless walkin)
    if (!isWalkin) {
      await client.query(
        'UPDATE customers SET balance = balance + $1 WHERE id = $2',
        [balanceImpact, resolvedCustomerId]
      );
    }

    // 6. Record Payment in Bank Ledger if cash/bank received immediately
    if (paidAmount > 0) {
      // Find standard Cash bank
      const cashBankRes = await client.query("SELECT id FROM banks WHERE name = 'Cash in Hand' AND deleted_at IS NULL LIMIT 1");
      if (cashBankRes.rows.length === 0) {
        throw new Error('Default Bank account "Cash in Hand" not found');
      }
      const cashBankId = cashBankRes.rows[0].id;

      // Update bank balance
      await client.query('UPDATE banks SET balance = balance + $1 WHERE id = $2', [paidAmount, cashBankId]);

      // Add to bank ledger
      await client.query(
        `INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
         VALUES ($1, 'credit', $2, $3, $4, CURRENT_DATE)`,
        [
          cashBankId,
          paidAmount,
          `POS Invoice Payment Recv (Order ID: ${orderId}) from Customer ID: ${resolvedCustomerId}`,
          orderId
        ]
      );
    }

    // 7. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Create Invoice', $2)`,
      [req.user.id, `POS Sale Invoice ID: ${orderId} created for Customer: ${customer.name}. Subtotal: ${invoiceSubtotal}, Total: ${invoiceTotal}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Order created successfully', orderId, total: invoiceTotal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POS Checkout error:', err);
    res.status(400).json({ message: err.message || 'Error checking out' });
  } finally {
    client.release();
  }
};

// Fetch sales orders list (filterable + paginated)
const getOrders = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const { from_date, to_date, customer_id, order_id, search } = req.query;

  try {
    let queryStr = `
      SELECT o.*, c.name AS customer_name, u.name AS cashier_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCounter = 1;

    if (from_date) {
      queryStr += ` AND o.created_at >= $${paramCounter}`;
      params.push(from_date + ' 00:00:00');
      paramCounter++;
    }

    if (to_date) {
      queryStr += ` AND o.created_at <= $${paramCounter}`;
      params.push(to_date + ' 23:59:59');
      paramCounter++;
    }

    if (customer_id) {
      queryStr += ` AND o.customer_id = $${paramCounter}`;
      params.push(parseInt(customer_id));
      paramCounter++;
    }

    if (order_id) {
      queryStr += ` AND o.id = $${paramCounter}`;
      params.push(parseInt(order_id));
      paramCounter++;
    }

    if (search) {
      queryStr += ` AND (c.name ILIKE $${paramCounter} OR c.phone ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Count for pagination
    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY o.id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const ordersRes = await query(queryStr, params);

    res.json({
      data: ordersRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

// Get order items by order ID (including refund history details)
const getOrderItems = async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Fetch order details
    const orderRes = await query(`
      SELECT o.*, c.name AS customer_name, c.phone AS customer_phone 
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.id = $1`, [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // 2. Fetch order items
    const itemsRes = await query(`
      SELECT oi.*, p.name AS product_name, p.barcode,
             COALESCE((SELECT SUM(ri.quantity) FROM refund_items ri JOIN refunds r ON ri.refund_id = r.id WHERE r.order_id = $1 AND ri.product_id = oi.product_id), 0) AS quantity_refunded
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1`, [id]
    );

    res.json({
      order: orderRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    console.error('Error fetching order items:', err);
    res.status(500).json({ message: 'Error fetching order details' });
  }
};

// Process invoice refund (itemwise or full bill refund)
const refundOrder = async (req, res) => {
  const { id } = req.params; // Order ID
  const { type, items } = req.body; // type = 'bill' or 'itemwise'. If itemwise, items = Array of { product_id, quantity }

  if (!type || !['bill', 'itemwise'].includes(type)) {
    return res.status(400).json({ message: 'Valid refund type (bill or itemwise) is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch original order
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    if (order.status === 'refunded') {
      throw new Error('This invoice has already been fully refunded');
    }

    // Resolve customer info
    const customerRes = await client.query('SELECT name, balance FROM customers WHERE id = $1', [order.customer_id]);
    const customer = customerRes.rows[0];
    const isWalkin = customer.name === 'Walk-in Customer';

    let totalRefundedAmount = 0.00;
    const validatedRefundItems = [];

    // 2. Process Refund logic
    if (type === 'bill') {
      // Full Bill Refund
      const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
      
      for (const item of itemsRes.rows) {
        // Fetch already refunded quantity
        const refundRes = await client.query(
          `SELECT COALESCE(SUM(ri.quantity), 0) AS refunded
           FROM refund_items ri 
           JOIN refunds r ON ri.refund_id = r.id 
           WHERE r.order_id = $1 AND ri.product_id = $2`,
          [id, item.product_id]
        );
        const alreadyRefunded = parseInt(refundRes.rows[0].refunded);
        const remainingToRefund = item.quantity - alreadyRefunded;

        if (remainingToRefund > 0) {
          totalRefundedAmount += (parseFloat(item.unit_price) - parseFloat(item.discount)) * remainingToRefund;
          validatedRefundItems.push({
            product_id: item.product_id,
            quantity: remainingToRefund,
            unit_price: parseFloat(item.unit_price),
            total: (parseFloat(item.unit_price) - parseFloat(item.discount)) * remainingToRefund
          });
        }
      }

      // Deduct order level discount from refund amount
      totalRefundedAmount = Math.max(0, totalRefundedAmount - parseFloat(order.discount));

      // Update order status to refunded
      await client.query("UPDATE orders SET status = 'refunded' WHERE id = $1", [id]);

    } else {
      // Itemwise Refund
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('At least one item is required for itemwise refund');
      }

      for (const refItem of items) {
        const { product_id, quantity } = refItem;
        const refundQty = parseInt(quantity);
        if (!product_id || refundQty <= 0) throw new Error('Invalid item fields for refund');

        // Fetch original item purchase details
        const itemRes = await client.query(
          'SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2',
          [id, product_id]
        );

        if (itemRes.rows.length === 0) {
          throw new Error(`Product not found in original order items list`);
        }
        const originalItem = itemRes.rows[0];

        // Check if already refunded
        const alreadyRes = await client.query(
          `SELECT COALESCE(SUM(ri.quantity), 0) AS refunded
           FROM refund_items ri 
           JOIN refunds r ON ri.refund_id = r.id 
           WHERE r.order_id = $1 AND ri.product_id = $2`,
          [id, product_id]
        );
        const alreadyRefunded = parseInt(alreadyRes.rows[0].refunded);

        if (alreadyRefunded + refundQty > originalItem.quantity) {
          throw new Error(`Cannot refund more than purchased. Purchased: ${originalItem.quantity}, Refunded: ${alreadyRefunded}, Attempting: ${refundQty}`);
        }

        const refundTotal = (parseFloat(originalItem.unit_price) - parseFloat(originalItem.discount)) * refundQty;
        totalRefundedAmount += refundTotal;

        validatedRefundItems.push({
          product_id,
          quantity: refundQty,
          unit_price: parseFloat(originalItem.unit_price),
          total: refundTotal
        });
      }

      // Update order status to partially_refunded
      await client.query("UPDATE orders SET status = 'partially_refunded' WHERE id = $1", [id]);
    }

    if (totalRefundedAmount <= 0) {
      throw new Error('No items remaining to be refunded on this invoice');
    }

    // 3. Create Refund record
    const refundRes = await client.query(
      `INSERT INTO refunds (order_id, customer_id, type, total_refunded, date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
      [id, order.customer_id, type, totalRefundedAmount]
    );
    const refundId = refundRes.rows[0].id;

    // 4. Create Refund Items and Restore Stock
    for (const refItem of validatedRefundItems) {
      await client.query(
        `INSERT INTO refund_items (refund_id, product_id, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5)`,
        [refundId, refItem.product_id, refItem.quantity, refItem.unit_price, refItem.total]
      );

      // Restore Stock (increment Shop stock or default stock)
      // Check if stock row exists for this product in Shop
      const stockCheck = await client.query(
        `SELECT id FROM stock 
         WHERE product_id = $1 AND location = 'Shop' AND deleted_at IS NULL LIMIT 1`,
        [refItem.product_id]
      );

      if (stockCheck.rows.length > 0) {
        await client.query(
          'UPDATE stock SET quantity = quantity + $1 WHERE id = $2',
          [refItem.quantity, stockCheck.rows[0].id]
        );
      } else {
        // Find cost and vendor from product or original stock to create new entry
        const productRes = await client.query('SELECT cost, barcode FROM products WHERE id = $1', [refItem.product_id]);
        const cost = parseFloat(productRes.rows[0].cost);
        const barcode = productRes.rows[0].barcode;
        
        await client.query(
          `INSERT INTO stock (vendor_id, product_id, quantity, price, cost, barcode, location)
           VALUES (NULL, $1, $2, $3, $4, $5, 'Shop')`,
          [refItem.product_id, refItem.quantity, refItem.unit_price, cost, barcode]
        );
      }
    }

    // 5. Update Customer Balance
    // A refund decreases the outstanding balance (reduces what customer owes us)
    if (!isWalkin) {
      await client.query(
        'UPDATE customers SET balance = balance - $1 WHERE id = $2',
        [totalRefundedAmount, order.customer_id]
      );
    } else {
      // For walk-in customer, we must refund cash out of Cash bank
      const cashBankRes = await client.query("SELECT id, balance FROM banks WHERE name = 'Cash in Hand' AND deleted_at IS NULL LIMIT 1");
      if (cashBankRes.rows.length > 0) {
        const cashBankId = cashBankRes.rows[0].id;
        
        // Update bank balance
        await client.query('UPDATE banks SET balance = balance - $1 WHERE id = $2', [totalRefundedAmount, cashBankId]);
        
        // Add to bank ledger
        await client.query(
          `INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
           VALUES ($1, 'debit', $2, $3, $4, CURRENT_DATE)`,
          [
            cashBankId,
            totalRefundedAmount,
            `POS Refund Cash Payout (Refund ID: ${refundId}) for Walk-in Customer`,
            refundId
          ]
        );
      }
    }

    // 6. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Refund Invoice', $2)`,
      [req.user.id, `Refund ID: ${refundId} created for Invoice ID: ${id}. Amount Refunded: ${totalRefundedAmount}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Refund completed successfully', refundId, totalRefundedAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refund processing error:', err);
    res.status(400).json({ message: err.message || 'Error processing refund' });
  } finally {
    client.release();
  }
};
const getSalesLedgerReport = async (req, res) => {
  const { search, salesman_id, from_date, to_date, sort_field, sort_order } = req.query;

  try {
    let queryStr = `
      SELECT o.id, o.created_at AS date, o.created_at, o.total_price AS total, o.total_price, o.amount_paid, o.discount, o.balance_due,
             c.name AS customer_name, s.name AS salesman_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN salesmen s ON c.salesman_id = s.id
      WHERE o.deleted_at IS NULL
    `;
    const params = [];
    let paramCounter = 1;

    if (from_date) {
      queryStr += ` AND o.created_at >= $${paramCounter}`;
      params.push(from_date + ' 00:00:00');
      paramCounter++;
    }

    if (to_date) {
      queryStr += ` AND o.created_at <= $${paramCounter}`;
      params.push(to_date + ' 23:59:59');
      paramCounter++;
    }

    if (salesman_id) {
      queryStr += ` AND c.salesman_id = $${paramCounter}`;
      params.push(parseInt(salesman_id));
      paramCounter++;
    }

    if (search) {
      queryStr += ` AND (c.name ILIKE $${paramCounter} OR CAST(o.id AS TEXT) ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Apply sorting
    let orderBy = 'o.id';
    if (sort_field === 'date') orderBy = 'o.created_at';
    else if (sort_field === 'total') orderBy = 'o.total_price';
    else if (sort_field === 'id') orderBy = 'o.id';

    const direction = sort_order === 'asc' ? 'ASC' : 'DESC';
    queryStr += ` ORDER BY ${orderBy} ${direction}`;

    const ordersRes = await query(queryStr, params);

    // Calculate totals based on the filtered results
    let netSales = 0;
    let totalDiscount = 0;
    let totalOutstanding = 0;

    ordersRes.rows.forEach(o => {
      netSales += parseFloat(o.total_price || 0);
      totalDiscount += parseFloat(o.discount || 0);
      totalOutstanding += parseFloat(o.balance_due || 0);
    });

    res.json({
      orders: ordersRes.rows,
      totals: {
        netSales,
        totalDiscount,
        totalOutstanding
      }
    });
  } catch (err) {
    console.error('Error fetching sales ledger report:', err);
    res.status(500).json({ message: 'Error fetching sales ledger report' });
  }
};

const directCustomerRefund = async (req, res) => {
  const { customer_id, product_id, quantity, price, location, date } = req.body;

  if (!customer_id || !product_id || !quantity || !price || !location) {
    return res.status(400).json({ message: 'All fields (Customer, Product, Quantity, Price, Location) are required' });
  }

  const qty = parseInt(quantity);
  const refundPrice = parseFloat(price);
  const refundTotal = qty * refundPrice;

  if (qty <= 0) {
    return res.status(400).json({ message: 'Quantity must be greater than zero' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch customer details
    const customerRes = await client.query('SELECT name FROM customers WHERE id = $1 AND deleted_at IS NULL', [customer_id]);
    if (customerRes.rows.length === 0) throw new Error('Customer not found');
    const customer = customerRes.rows[0];
    const isWalkin = customer.name === 'Walk-in Customer';

    // 2. Fetch product details
    const productRes = await client.query('SELECT cost, barcode FROM products WHERE id = $1 AND deleted_at IS NULL', [product_id]);
    if (productRes.rows.length === 0) throw new Error('Product not found');
    const product = productRes.rows[0];

    // 3. Create Refund record
    const refundRes = await client.query(
      `INSERT INTO refunds (order_id, customer_id, type, total_refunded, date)
       VALUES (NULL, $1, 'itemwise', $2, $3) RETURNING id`,
      [customer_id, refundTotal, date || new Date()]
    );
    const refundId = refundRes.rows[0].id;

    // 4. Create Refund Item
    await client.query(
      `INSERT INTO refund_items (refund_id, product_id, quantity, unit_price, total)
       VALUES ($1, $2, $3, $4, $5)`,
      [refundId, product_id, qty, refundPrice, refundTotal]
    );

    // 5. Restore stock
    const stockCheck = await client.query(
      `SELECT id FROM stock 
       WHERE product_id = $1 AND location = $2 AND deleted_at IS NULL LIMIT 1`,
      [product_id, location]
    );

    if (stockCheck.rows.length > 0) {
      await client.query(
        'UPDATE stock SET quantity = quantity + $1 WHERE id = $2',
        [qty, stockCheck.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO stock (vendor_id, product_id, quantity, price, cost, barcode, location)
         VALUES (NULL, $1, $2, $3, $4, $5, $6)`,
        [product_id, qty, refundPrice, parseFloat(product.cost), product.barcode, location]
      );
    }

    // 6. Update Customer Balance or Bank
    if (!isWalkin) {
      await client.query(
        'UPDATE customers SET balance = balance - $1 WHERE id = $2',
        [refundTotal, customer_id]
      );
    } else {
      // Find standard Cash bank
      const cashBankRes = await client.query("SELECT id FROM banks WHERE name = 'Cash in Hand' AND deleted_at IS NULL LIMIT 1");
      if (cashBankRes.rows.length === 0) {
        throw new Error('Default Bank account "Cash in Hand" not found');
      }
      const cashBankId = cashBankRes.rows[0].id;

      // Update bank balance
      await client.query('UPDATE banks SET balance = balance - $1 WHERE id = $2', [refundTotal, cashBankId]);

      // Add to bank ledger
      await client.query(
        `INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
         VALUES ($1, 'debit', $2, $3, $4, $5)`,
        [
          cashBankId,
          refundTotal,
          `Direct Customer Return Refund (Refund ID: ${refundId}) for Walk-in Customer`,
          refundId,
          date || new Date()
        ]
      );
    }

    // 7. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Refund Product', $2)`,
      [req.user.id, `Direct Customer Refund ID: ${refundId} created. Customer ID: ${customer_id}, Product ID: ${product_id}, Qty: ${qty}, Amount: ${refundTotal}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Refund processed successfully', refundId, totalRefundedAmount: refundTotal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Direct Customer Refund processing error:', err);
    res.status(400).json({ message: err.message || 'Error processing refund' });
  } finally {
    client.release();
  }
};

const checkoutOrder = async (req, res) => {
  const {
    customerId,
    cartItems,
    subtotal,
    invoiceDiscount,
    netTotal,
    amountPaid,
    bankId,
    paymentNote,
    cartLocation
  } = req.body;

  const tempFilePath = req.file ? req.file.path : null;
  const tempFilename = req.file ? req.file.filename : null;

  // Validate bank
  if (!bankId) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    return res.status(400).json({ success: false, message: 'Please select a payment method' });
  }

  const bankRes = await pool.query('SELECT * FROM banks WHERE id = $1 AND deleted_at IS NULL', [parseInt(bankId)]);
  if (bankRes.rows.length === 0) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    return res.status(400).json({ success: false, message: 'Invalid payment bank selected' });
  }
  const bank = bankRes.rows[0];
  const isCash = bank.name.toLowerCase().includes('cash');

  if (!isCash && !tempFilePath) {
    return res.status(400).json({
      success: false,
      message: 'Proof of payment is required for bank transfers'
    });
  }

  if (!cartItems) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    return res.status(400).json({ success: false, message: 'Billing cart is empty' });
  }

  const parsedItems = typeof cartItems === 'string' ? JSON.parse(cartItems) : cartItems;
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    return res.status(400).json({ success: false, message: 'Billing cart is empty' });
  }

  const client = await pool.connect();
  let finalFilePath = null;
  try {
    await client.query('BEGIN');

    // 1. Resolve customer
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId || resolvedCustomerId === 'walkin') {
      const walkinRes = await client.query("SELECT id FROM customers WHERE name = 'Walk-in Customer' AND deleted_at IS NULL LIMIT 1");
      if (walkinRes.rows.length > 0) {
        resolvedCustomerId = walkinRes.rows[0].id;
      } else {
        throw new Error('Default Walk-in Customer profile not found. Please create a customer first.');
      }
    }

    const customerRes = await client.query('SELECT name, balance FROM customers WHERE id = $1 AND deleted_at IS NULL', [resolvedCustomerId]);
    if (customerRes.rows.length === 0) throw new Error('Customer not found');
    const customer = customerRes.rows[0];
    const isWalkin = customer.name === 'Walk-in Customer';

    const paid = parseFloat(amountPaid) || 0;
    const total = parseFloat(netTotal) || 0;
    const balanceDue = Math.max(0, total - paid);
    const changeDue = Math.max(0, paid - total);

    // Walk-in customer validation
    if (isWalkin && Math.abs(total - paid) > 0.01) {
      throw new Error(`Walk-in Customer cannot carry outstanding balance. Total: ${total}, Paid: ${paid}`);
    }

    // Step 1 — Create order
    const orderResult = await client.query(`
      INSERT INTO orders (
        customer_id, user_id, total_price, amount_paid,
        discount, balance_due, change_due,
        payment_method_id, proof_of_payment,
        payment_note, status, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',NOW())
      RETURNING id
    `, [
      resolvedCustomerId, req.user.id, total, paid,
      parseFloat(invoiceDiscount) || 0,
      balanceDue, changeDue,
      parseInt(bankId), null, paymentNote || null
    ]);

    const orderId = orderResult.rows[0].id;

    // Step 2 & 6 — Save order items & Deduct stock
    for (const item of parsedItems) {
      const productId = item.productId || item.product_id;
      const qty = parseInt(item.qty || item.quantity);
      const price = parseFloat(item.price || item.unit_price);
      const disc = parseFloat(item.discount || 0);
      const itemLocation = item.location || cartLocation || 'Shop';
      const itemTotalPrice = (price - disc) * qty;

      if (!productId || qty <= 0 || price < 0) {
        throw new Error('Invalid item fields provided in checkout list');
      }

      // Check stock availability at location
      const stockRes = await client.query(
        `SELECT SUM(quantity) AS total_qty FROM stock 
         WHERE product_id = $1 AND location = $2 AND deleted_at IS NULL`,
        [productId, itemLocation]
      );
      const availableQty = parseInt(stockRes.rows[0].total_qty || 0);
      if (availableQty < qty) {
        // Fetch product name for better error
        const prodNameRes = await client.query('SELECT name FROM products WHERE id = $1', [productId]);
        const productName = prodNameRes.rows[0]?.name || `Product ID ${productId}`;
        throw new Error(`Insufficient stock for '${productName}' at '${itemLocation}'. Available: ${availableQty}, Requested: ${qty}`);
      }

      await client.query(`
        INSERT INTO order_items
          (order_id, product_id, unit_price, quantity, discount, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        orderId,
        productId,
        price,
        qty,
        disc,
        itemTotalPrice
      ]);

      // Deduct stock (reusing robust logic)
      let remainingToDeduct = qty;
      const stockRows = await client.query(`
        SELECT id, quantity FROM stock 
        WHERE product_id = $1 AND location = $2 AND quantity > 0 AND deleted_at IS NULL 
        ORDER BY quantity DESC
      `, [productId, itemLocation]);

      for (const row of stockRows.rows) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(row.quantity, remainingToDeduct);
        
        await client.query(
          'UPDATE stock SET quantity = quantity - $1 WHERE id = $2',
          [deduct, row.id]
        );
        remainingToDeduct -= deduct;
      }

      if (remainingToDeduct > 0) {
        throw new Error(`Critical error: stock levels shifted during processing for product ID: ${productId}`);
      }
    }

    // Handle file rename format: proof_orderID_timestamp.jpg
    let proofFilePath = null;
    if (tempFilePath) {
      const ext = path.extname(tempFilename);
      const newFilename = `proof_${orderId}_${Date.now()}${ext}`;
      const newFilePath = path.join(uploadDir, newFilename);
      fs.renameSync(tempFilePath, newFilePath);
      finalFilePath = newFilePath;
      proofFilePath = `/uploads/payment-proofs/${newFilename}`;
      
      // Update order with proof_of_payment
      await client.query(`
        UPDATE orders SET proof_of_payment = $1 WHERE id = $2
      `, [proofFilePath, orderId]);
    }

    // Step 3 — Update bank balance
    await client.query(`
      UPDATE banks SET balance = balance + $1 WHERE id = $2
    `, [paid, parseInt(bankId)]);

    // Step 4 — Bank ledger entry
    await client.query(`
      INSERT INTO bank_ledger
        (bank_id, type, amount, description, reference_id, date)
      VALUES ($1, 'credit', $2, $3, $4, NOW())
    `, [
      parseInt(bankId),
      paid,
      `Sale Invoice #${orderId}`,
      orderId
    ]);

    // Step 5 — Update customer balance
    if (resolvedCustomerId && !isWalkin) {
      await client.query(`
        UPDATE customers
        SET balance = balance + $1
        WHERE id = $2
      `, [balanceDue, resolvedCustomerId]);
    }

    // Step 7 — Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, 'Create Invoice', $2)`,
      [req.user.id, `POS Sale Invoice ID: ${orderId} checked out for Customer: ${customer.name}. Total: ${total}, Paid: ${paid}`]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      orderId,
      message: 'Payment completed successfully',
      changeDue,
      balanceDue
    });

  } catch (err) {
    await client.query('ROLLBACK');
    // Cleanup uploaded file on failure
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
    if (finalFilePath && fs.existsSync(finalFilePath)) {
      try { fs.unlinkSync(finalFilePath); } catch (e) {}
    }
    console.error('Checkout error:', err);
    res.status(500).json({
      success: false,
      message: 'Checkout failed: ' + err.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderItems,
  refundOrder,
  getSalesLedgerReport,
  directCustomerRefund,
  checkoutOrder,
  upload
};

