const { query } = require('../db');

// --- EXPENSE TYPES ---

const getExpenseTypes = async (req, res) => {
  try {
    const typesRes = await query('SELECT * FROM expense_types WHERE deleted_at IS NULL ORDER BY name ASC');
    res.json(typesRes.rows);
  } catch (err) {
    console.error('Error fetching expense types:', err);
    res.status(500).json({ message: 'Error fetching expense types' });
  }
};

const createExpenseType = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  try {
    const exists = await query('SELECT id FROM expense_types WHERE name = $1 AND deleted_at IS NULL', [name]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Expense type already exists' });
    }

    const insertRes = await query(
      'INSERT INTO expense_types (name) VALUES ($1) RETURNING *',
      [name]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Expense Type', `Created expense type: ${name}`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating expense type:', err);
    res.status(500).json({ message: 'Error creating expense type' });
  }
};

const updateExpenseType = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  try {
    const checkRes = await query('SELECT name FROM expense_types WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Expense type not found' });
    const oldName = checkRes.rows[0].name;

    const updateRes = await query(
      'UPDATE expense_types SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Update Expense Type', `Renamed expense type from ${oldName} to ${name}`]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating expense type:', err);
    res.status(500).json({ message: 'Error updating expense type' });
  }
};

const deleteExpenseType = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name FROM expense_types WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Expense type not found' });
    const name = checkRes.rows[0].name;

    // Check if expenses are associated
    const expRes = await query('SELECT COUNT(*) FROM expenses WHERE expense_type_id = $1 AND deleted_at IS NULL', [id]);
    if (parseInt(expRes.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete expense type with active expenses linked to it' });
    }

    await query('UPDATE expense_types SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Expense Type', `Soft deleted expense type: ${name} (ID: ${id})`]
    );

    res.json({ message: 'Expense type deleted successfully' });
  } catch (err) {
    console.error('Error deleting expense type:', err);
    res.status(500).json({ message: 'Error deleting expense type' });
  }
};

// --- EXPENSES ---

const getExpenses = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const { from_date, to_date, expense_type_id } = req.query;

  try {
    let queryStr = `
      SELECT e.*, t.name AS expense_type_name
      FROM expenses e
      JOIN expense_types t ON e.expense_type_id = t.id
      WHERE e.deleted_at IS NULL
    `;
    const params = [];
    let paramCounter = 1;

    if (from_date) {
      queryStr += ` AND e.date >= $${paramCounter}`;
      params.push(from_date);
      paramCounter++;
    }

    if (to_date) {
      queryStr += ` AND e.date <= $${paramCounter}`;
      params.push(to_date);
      paramCounter++;
    }

    if (expense_type_id) {
      queryStr += ` AND e.expense_type_id = $${paramCounter}`;
      params.push(parseInt(expense_type_id));
      paramCounter++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY e.date DESC, e.id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const expenseRes = await query(queryStr, params);

    res.json({
      data: expenseRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ message: 'Error fetching expenses' });
  }
};

const createExpense = async (req, res) => {
  const { expense_type_id, description, amount, date } = req.body;
  if (!expense_type_id || !amount || !date) {
    return res.status(400).json({ message: 'Expense type, amount, and date are required' });
  }

  try {
    const insertRes = await query(
      `INSERT INTO expenses (expense_type_id, description, amount, date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [parseInt(expense_type_id), description || null, parseFloat(amount), date]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Expense', `Recorded expense of ${amount} (Type ID: ${expense_type_id})`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ message: 'Error creating expense' });
  }
};

const updateExpense = async (req, res) => {
  const { id } = req.params;
  const { expense_type_id, description, amount, date } = req.body;

  try {
    const checkRes = await query('SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    const oldExp = checkRes.rows[0];

    const updateRes = await query(
      `UPDATE expenses 
       SET expense_type_id = $1, description = $2, amount = $3, date = $4
       WHERE id = $5 RETURNING *`,
      [
        expense_type_id !== undefined ? parseInt(expense_type_id) : oldExp.expense_type_id,
        description !== undefined ? description : oldExp.description,
        amount !== undefined ? parseFloat(amount) : oldExp.amount,
        date !== undefined ? date : oldExp.date,
        id
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Expense',
        `Updated expense record (ID: ${id})`,
        JSON.stringify(oldExp),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ message: 'Error updating expense' });
  }
};

const deleteExpense = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT amount FROM expenses WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    const amt = checkRes.rows[0].amount;

    await query('UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Expense', `Soft deleted expense record of amount: ${amt} (ID: ${id})`]
    );

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ message: 'Error deleting expense' });
  }
};

module.exports = {
  getExpenseTypes,
  createExpenseType,
  updateExpenseType,
  deleteExpenseType,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
