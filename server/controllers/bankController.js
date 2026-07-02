const { query } = require('../db');

// Get all banks
const getBanks = async (req, res) => {
  try {
    const bankRes = await query('SELECT * FROM banks WHERE deleted_at IS NULL ORDER BY name ASC');

    let banks = bankRes.rows;

    if (req.user.role === 'Admin') {
      // Total balance card info
      const totalRes = await query('SELECT SUM(balance) AS total FROM banks WHERE deleted_at IS NULL');
      const totalBalance = parseFloat(totalRes.rows[0].total || 0);

      res.json({
        banks,
        totalBalance
      });
    } else {
      // Non-admins (e.g. Cashiers) only get bank names and ids, excluding the balance
      const safeBanks = banks.map(bank => ({
        id: bank.id,
        name: bank.name
      }));

      res.json({
        banks: safeBanks
      });
    }
  } catch (err) {
    console.error('Error fetching banks:', err);
    res.status(500).json({ message: 'Error fetching banks' });
  }
};

// Create bank
const createBank = async (req, res) => {
  const { name, balance } = req.body;
  if (!name) return res.status(400).json({ message: 'Bank name is required' });

  try {
    const exists = await query('SELECT id FROM banks WHERE name = $1 AND deleted_at IS NULL', [name]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Bank name already exists' });
    }

    const insertRes = await query(
      `INSERT INTO banks (name, balance)
       VALUES ($1, $2) RETURNING *`,
      [name, parseFloat(balance || 0)]
    );
    const newBank = insertRes.rows[0];

    // Seed transaction ledger if opening balance is > 0
    if (parseFloat(balance) > 0) {
      await query(
        `INSERT INTO bank_ledger (bank_id, type, amount, description, date)
         VALUES ($1, 'credit', $2, $3, CURRENT_DATE)`,
        [newBank.id, parseFloat(balance), 'Opening Balance Setup']
      );
    }

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Bank', `Created bank: ${name} (Opening Balance: ${balance || 0})`]
    );

    res.status(201).json(newBank);
  } catch (err) {
    console.error('Error creating bank:', err);
    res.status(500).json({ message: 'Error creating bank' });
  }
};

// Update bank
const updateBank = async (req, res) => {
  const { id } = req.params;
  const { name, balance } = req.body;

  try {
    const checkRes = await query('SELECT * FROM banks WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Bank not found' });
    const oldBank = checkRes.rows[0];

    const updateRes = await query(
      `UPDATE banks SET name = $1, balance = $2 WHERE id = $3 RETURNING *`,
      [name || oldBank.name, balance !== undefined ? parseFloat(balance) : oldBank.balance, id]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Bank',
        `Updated bank: ${name} (ID: ${id})`,
        JSON.stringify(oldBank),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating bank:', err);
    res.status(500).json({ message: 'Error updating bank' });
  }
};

// Delete bank
const deleteBank = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name, balance FROM banks WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Bank not found' });
    const bank = checkRes.rows[0];

    // Block if bank has transaction history
    const ledgerCheck = await query('SELECT 1 FROM bank_ledger WHERE bank_id = $1 LIMIT 1', [id]);
    if (ledgerCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Cannot delete bank account with active transaction history' });
    }

    // Check if balance is non-zero
    if (Math.abs(parseFloat(bank.balance)) > 0.01) {
      return res.status(400).json({ message: `Cannot delete bank account with outstanding balance of: ${bank.balance}` });
    }

    await query('UPDATE banks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Bank', `Soft deleted bank: ${bank.name} (ID: ${id})`]
    );

    res.json({ message: 'Bank deleted successfully' });
  } catch (err) {
    console.error('Error deleting bank:', err);
    res.status(500).json({ message: 'Error deleting bank' });
  }
};

// Get Bank Ledger
const getBankLedger = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '20');
  const offset = (page - 1) * limit;

  try {
    const bankRes = await query('SELECT * FROM banks WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (bankRes.rows.length === 0) return res.status(404).json({ message: 'Bank account not found' });

    const countRes = await query('SELECT COUNT(*) FROM bank_ledger WHERE bank_id = $1', [id]);
    const totalItems = parseInt(countRes.rows[0].count);

    const ledgerRes = await query(
      `SELECT * FROM bank_ledger 
       WHERE bank_id = $1 
       ORDER BY date DESC, id DESC 
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      bank: bankRes.rows[0],
      data: ledgerRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching bank ledger:', err);
    res.status(500).json({ message: 'Error fetching bank ledger' });
  }
};

module.exports = {
  getBanks,
  createBank,
  updateBank,
  deleteBank,
  getBankLedger
};
