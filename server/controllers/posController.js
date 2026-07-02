const { query } = require('../db');

// ─── POS Product Search ───────────────────────────────────────────────────────
// Accessible to ALL authenticated users (verifyToken only, no module permission check).
// This is intentional: even a cashier with only "Invoice" permission must be able
// to search products for billing.
const posSearch = async (req, res) => {
  const { barcode, name } = req.query;

  if (!barcode && !name) {
    return res.status(400).json({
      found: false,
      message: 'Provide barcode or name to search',
    });
  }

  try {
    // ── Barcode Search ──────────────────────────────────────────────────────
    if (barcode) {
      // Clean input — strip whitespace / scanner CR-LF artifacts
      const cleanBarcode = barcode.replace(/\s/g, '').trim();

      // Cast both sides to text to avoid any integer/varchar type mismatch.
      // LEFT JOIN stock so we still return the product even if stock qty = 0.
      // SUM aggregates quantities across multiple warehouse locations.
      const result = await query(
        `SELECT
           p.id,
           p.name,
           p.price,
           p.cost,
           p.discount,
           p.barcode,
           p.quantity_limit,
           p.category_id,
           c.name AS category,
           COALESCE(SUM(s.quantity), 0)::int AS quantity
         FROM products p
         LEFT JOIN stock s
           ON s.product_id = p.id
           AND s.deleted_at IS NULL
         LEFT JOIN categories c
           ON c.id = p.category_id
         WHERE p.deleted_at IS NULL
           AND (
             p.barcode::text = $1::text
             OR s.barcode::text = $1::text
           )
         GROUP BY p.id, p.name, p.price, p.cost,
                  p.discount, p.barcode, p.quantity_limit,
                  p.category_id, c.name
         LIMIT 1`,
        [cleanBarcode]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          found: false,
          message: 'No product matches this barcode',
        });
      }

      const product = result.rows[0];
      const qty = parseInt(product.quantity) || 0;

      return res.json({
        found: true,
        product: {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price),
          cost: parseFloat(product.cost),
          discount: parseFloat(product.discount || 0),
          barcode: product.barcode,
          category: product.category || '',
          quantity: qty,
          // Returns product even when out-of-stock — caller decides whether to proceed
          outOfStock: qty <= 0,
        },
      });
    }

    // ── Name Search ─────────────────────────────────────────────────────────
    if (name) {
      const cleanName = name.trim();
      if (cleanName.length < 1) {
        return res.json({ found: false, products: [] });
      }

      const result = await query(
        `SELECT
           p.id,
           p.name,
           p.price,
           p.cost,
           p.discount,
           p.barcode,
           p.category_id,
           c.name AS category,
           COALESCE(SUM(s.quantity), 0)::int AS quantity
         FROM products p
         LEFT JOIN stock s
           ON s.product_id = p.id
           AND s.deleted_at IS NULL
         LEFT JOIN categories c
           ON c.id = p.category_id
         WHERE p.deleted_at IS NULL
           AND (
             LOWER(p.name) LIKE LOWER($1)
             OR p.barcode ILIKE $1
           )
         GROUP BY p.id, p.name, p.price, p.cost,
                  p.discount, p.barcode, p.category_id, c.name
         ORDER BY p.name ASC
         LIMIT 10`,
        [`%${cleanName}%`]
      );

      if (result.rows.length === 0) {
        return res.json({ found: false, products: [] });
      }

      return res.json({
        found: true,
        products: result.rows.map((p) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price),
          cost: parseFloat(p.cost),
          discount: parseFloat(p.discount || 0),
          barcode: p.barcode,
          category: p.category || '',
          quantity: parseInt(p.quantity) || 0,
          outOfStock: (parseInt(p.quantity) || 0) <= 0,
        })),
      });
    }
  } catch (err) {
    console.error('POS search error:', err);
    res.status(500).json({
      found: false,
      message: 'Search failed: ' + err.message,
    });
  }
};

const getPosProducts = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.price,
         p.cost,
         p.discount,
         p.barcode,
         p.quantity_limit,
         p.category_id,
         c.name AS category,
         COALESCE(SUM(s.quantity), 0)::int AS quantity
       FROM products p
       LEFT JOIN stock s
         ON s.product_id = p.id
         AND s.deleted_at IS NULL
       LEFT JOIN categories c
         ON c.id = p.category_id
       WHERE p.deleted_at IS NULL
       GROUP BY p.id, p.name, p.price, p.cost,
                p.discount, p.barcode, p.quantity_limit,
                p.category_id, c.name
       ORDER BY p.name ASC`
    );

    res.json(
      result.rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price),
        cost: parseFloat(p.cost),
        discount: parseFloat(p.discount || 0),
        barcode: p.barcode,
        category: p.category || '',
        quantity: parseInt(p.quantity) || 0,
        quantity_limit: parseInt(p.quantity_limit) || 5,
        outOfStock: (parseInt(p.quantity) || 0) <= 0,
      }))
    );
  } catch (err) {
    console.error('Error fetching POS products:', err);
    res.status(500).json({ message: 'Error fetching POS products' });
  }
};

module.exports = { posSearch, getPosProducts };
