const { query } = require('../db');

// --- CATEGORIES CONTROLLER ---

const getCategories = async (req, res) => {
  try {
    const catRes = await query('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name ASC');
    res.json(catRes.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

const createCategory = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Category name is required' });

  try {
    const exists = await query('SELECT id FROM categories WHERE name = $1 AND deleted_at IS NULL', [name]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    const insertRes = await query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Category', `Created category: ${name}`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Error creating category' });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Category name is required' });

  try {
    const exists = await query('SELECT name FROM categories WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ message: 'Category not found' });

    const oldName = exists.rows[0].name;
    const updateRes = await query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Update Category', `Renamed category from ${oldName} to ${name}`]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Error updating category' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name FROM categories WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Category not found' });

    // Prevent deletion if products are linked
    const prodCount = await query('SELECT COUNT(*) FROM products WHERE category_id = $1 AND deleted_at IS NULL', [id]);
    if (parseInt(prodCount.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete category with active products linked to it' });
    }

    const name = checkRes.rows[0].name;
    await query('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Category', `Soft deleted category: ${name}`]
    );

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Error deleting category' });
  }
};

// --- PRODUCTS CONTROLLER ---

const getProducts = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const categoryId = req.query.category_id || '';

  try {
    let queryStr = `
      SELECT p.*, c.name AS category_name,
             COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id AND deleted_at IS NULL), 0) AS total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
    `;
    const params = [];
    let paramCounter = 1;

    if (search) {
      queryStr += ` AND (p.name ILIKE $${paramCounter} OR p.barcode ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    if (categoryId) {
      queryStr += ` AND p.category_id = $${paramCounter}`;
      params.push(parseInt(categoryId));
      paramCounter++;
    }

    // Get count for pagination
    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY p.id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const productRes = await query(queryStr, params);

    let products = productRes.rows;
    if (req.user.role === 'Cashier') {
      products = products.map(product => {
        const { cost, ...safeProduct } = product;
        return safeProduct;
      });
    }

    res.json({
      data: products,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

const createProduct = async (req, res) => {
  const { name, price, cost, discount, barcode, category_id, quantity_limit } = req.body;

  if (!name || price === undefined || cost === undefined) {
    return res.status(400).json({ message: 'Product name, retail price, and cost are required' });
  }

  const productPrice = parseFloat(price);
  const productCost = parseFloat(cost);

  if (isNaN(productPrice) || productPrice <= 0) {
    return res.status(400).json({ message: 'Product retail price must be a positive number greater than zero' });
  }

  if (isNaN(productCost) || productCost <= 0) {
    return res.status(400).json({ message: 'Product cost must be a positive number greater than zero' });
  }

  // Generate unique barcode if not provided
  let productBarcode = barcode;
  if (!productBarcode) {
    productBarcode = 'BC-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 10);
  }

  try {
    // Check barcode uniqueness
    const exists = await query('SELECT name FROM products WHERE barcode = $1 AND deleted_at IS NULL', [productBarcode]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: `Barcode '${productBarcode}' is already registered to product: ${exists.rows[0].name}` });
    }

    const insertRes = await query(
      `INSERT INTO products (name, price, cost, discount, barcode, category_id, quantity_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        parseFloat(price),
        parseFloat(cost),
        parseFloat(discount || 0),
        productBarcode,
        category_id ? parseInt(category_id) : null,
        parseInt(quantity_limit || 5)
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Product', `Created product: ${name} (Barcode: ${productBarcode})`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Error creating product' });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, cost, discount, barcode, category_id, quantity_limit } = req.body;

  try {
    const checkRes = await query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    const oldProduct = checkRes.rows[0];

    // Check barcode conflict
    if (barcode && barcode !== oldProduct.barcode) {
      const bcRes = await query('SELECT name FROM products WHERE barcode = $1 AND id != $2 AND deleted_at IS NULL', [barcode, id]);
      if (bcRes.rows.length > 0) {
        return res.status(400).json({ message: `Barcode is already in use by product: ${bcRes.rows[0].name}` });
      }
    }

    if (price !== undefined) {
      const productPrice = parseFloat(price);
      if (isNaN(productPrice) || productPrice <= 0) {
        return res.status(400).json({ message: 'Product retail price must be a positive number greater than zero' });
      }
    }

    if (cost !== undefined) {
      const productCost = parseFloat(cost);
      if (isNaN(productCost) || productCost <= 0) {
        return res.status(400).json({ message: 'Product cost must be a positive number greater than zero' });
      }
    }

    const updateRes = await query(
      `UPDATE products 
       SET name = $1, price = $2, cost = $3, discount = $4, barcode = $5, category_id = $6, quantity_limit = $7
       WHERE id = $8 RETURNING *`,
      [
        name || oldProduct.name,
        price !== undefined ? parseFloat(price) : oldProduct.price,
        cost !== undefined ? parseFloat(cost) : oldProduct.cost,
        discount !== undefined ? parseFloat(discount) : oldProduct.discount,
        barcode || oldProduct.barcode,
        category_id !== undefined ? (category_id ? parseInt(category_id) : null) : oldProduct.category_id,
        quantity_limit !== undefined ? parseInt(quantity_limit) : oldProduct.quantity_limit,
        id
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Product',
        `Updated product: ${name} (ID: ${id})`,
        JSON.stringify(oldProduct),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Error updating product' });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    // Block deletion if product has sales history
    const salesCheck = await query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [id]);
    if (salesCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Cannot delete product with active sales history' });
    }

    const name = checkRes.rows[0].name;
    await query('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Set stock items to deleted as well
    await query('UPDATE stock SET deleted_at = CURRENT_TIMESTAMP WHERE product_id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Product', `Soft deleted product: ${name} (ID: ${id})`]
    );

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Error deleting product' });
  }
};

// Export all products for Excel
const exportProducts = async (req, res) => {
  try {
    const prodRes = await query(`
      SELECT p.id, p.name, p.price, p.cost, p.discount, p.barcode, c.name AS category, p.quantity_limit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.id ASC
    `);

    let products = prodRes.rows;
    if (req.user.role === 'Cashier') {
      products = products.map(product => {
        const { cost, ...safeProduct } = product;
        return safeProduct;
      });
    }

    res.json(products);
  } catch (err) {
    console.error('Error exporting products:', err);
    res.status(500).json({ message: 'Error exporting products' });
  }
};

// Bulk import products from Excel parsed JSON data
const importProducts = async (req, res) => {
  const { products } = req.body; // Array of { name, price, cost, discount, barcode, category, quantity_limit }

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'Valid list of products is required' });
  }

  try {
    let importedCount = 0;
    let skippedCount = 0;

    for (const prod of products) {
      const { name, price, cost, discount, barcode, category, quantity_limit } = prod;

      if (!name || !price || !cost || !barcode) {
        skippedCount++;
        continue;
      }

      // Check if category exists, if not create it
      let categoryId = null;
      if (category) {
        const catRes = await query('SELECT id FROM categories WHERE name = $1 AND deleted_at IS NULL', [category]);
        if (catRes.rows.length > 0) {
          categoryId = catRes.rows[0].id;
        } else {
          const insertCat = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category]);
          categoryId = insertCat.rows[0].id;
        }
      }

      // Check if product exists by barcode (including soft deleted, we restore it)
      const prodRes = await query('SELECT id FROM products WHERE barcode = $1', [barcode]);
      
      if (prodRes.rows.length > 0) {
        // Update existing product and restore if deleted
        await query(
          `UPDATE products 
           SET name = $1, price = $2, cost = $3, discount = $4, category_id = $5, quantity_limit = $6, deleted_at = NULL
           WHERE id = $7`,
          [name, parseFloat(price), parseFloat(cost), parseFloat(discount || 0), categoryId, parseInt(quantity_limit || 5), prodRes.rows[0].id]
        );
      } else {
        // Insert new product
        await query(
          `INSERT INTO products (name, price, cost, discount, barcode, category_id, quantity_limit)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [name, parseFloat(price), parseFloat(cost), parseFloat(discount || 0), barcode, categoryId, parseInt(quantity_limit || 5)]
        );
      }
      importedCount++;
    }

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Import Products', `Bulk imported/updated ${importedCount} products, skipped ${skippedCount}`]
    );

    res.json({
      message: 'Bulk import completed',
      importedCount,
      skippedCount
    });
  } catch (err) {
    console.error('Error importing products:', err);
    res.status(500).json({ message: 'Error importing products' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  exportProducts,
  importProducts
};
