const { query } = require('../db');

// Get all salesmen
const getSalesmen = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    let queryStr = `SELECT * FROM salesmen WHERE deleted_at IS NULL`;
    const params = [];
    let paramCounter = 1;

    if (search) {
      queryStr += ` AND (name ILIKE $${paramCounter} OR phone ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const salesmenRes = await query(queryStr, params);

    res.json({
      data: salesmenRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching salesmen:', err);
    res.status(500).json({ message: 'Error fetching salesmen' });
  }
};

// Create salesman
const createSalesman = async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ message: 'Salesman name is required' });

  try {
    const insertRes = await query(
      `INSERT INTO salesmen (name, phone, address)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, phone || null, address || null]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Salesman', `Created salesman: ${name}`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating salesman:', err);
    res.status(500).json({ message: 'Error creating salesman' });
  }
};

// Update salesman
const updateSalesman = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;

  try {
    const checkRes = await query('SELECT * FROM salesmen WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Salesman not found' });
    const oldSale = checkRes.rows[0];

    const updateRes = await query(
      `UPDATE salesmen 
       SET name = $1, phone = $2, address = $3
       WHERE id = $4 RETURNING *`,
      [
        name || oldSale.name,
        phone !== undefined ? phone : oldSale.phone,
        address !== undefined ? address : oldSale.address,
        id
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Salesman',
        `Updated salesman: ${name} (ID: ${id})`,
        JSON.stringify(oldSale),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating salesman:', err);
    res.status(500).json({ message: 'Error updating salesman' });
  }
};

// Delete salesman
const deleteSalesman = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name FROM salesmen WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Salesman not found' });
    
    // Check if customers are associated
    const custRes = await query('SELECT COUNT(*) FROM customers WHERE salesman_id = $1 AND deleted_at IS NULL', [id]);
    if (parseInt(custRes.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete salesman because they have active customers linked to them' });
    }

    const name = checkRes.rows[0].name;
    await query('UPDATE salesmen SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Salesman', `Soft deleted salesman: ${name} (ID: ${id})`]
    );

    res.json({ message: 'Salesman deleted successfully' });
  } catch (err) {
    console.error('Error deleting salesman:', err);
    res.status(500).json({ message: 'Error deleting salesman' });
  }
};

// Salesman Commission Report
const getSalesmanCommissionReport = async (req, res) => {
  try {
    const reportRes = await query(`
      SELECT s.id, s.name, s.phone,
             COALESCE(COUNT(DISTINCT c.id), 0) AS total_customers,
             COALESCE(SUM(o.total_price - o.discount), 0) AS total_sales
      FROM salesmen s
      LEFT JOIN customers c ON c.salesman_id = s.id AND c.deleted_at IS NULL
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY total_sales DESC
    `);
    res.json(reportRes.rows);
  } catch (err) {
    console.error('Error compiling salesman commission report:', err);
    res.status(500).json({ message: 'Error compiling salesman commission report' });
  }
};

module.exports = {
  getSalesmen,
  createSalesman,
  updateSalesman,
  deleteSalesman,
  getSalesmanCommissionReport
};
