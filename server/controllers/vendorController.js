const { query, pool } = require('../db');

// Get all vendors
const getVendors = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    let queryStr = `SELECT * FROM vendors WHERE deleted_at IS NULL`;
    const params = [];
    let paramCounter = 1;

    if (search) {
      queryStr += ` AND (name ILIKE $${paramCounter} OR phone ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Total outstanding balance
    const totalBalanceRes = await query('SELECT SUM(balance) AS total FROM vendors WHERE deleted_at IS NULL');
    const totalVendorBalance = parseFloat(totalBalanceRes.rows[0].total || 0);

    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    queryStr += ` ORDER BY id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const vendorsRes = await query(queryStr, params);

    res.json({
      data: vendorsRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit,
        totalVendorBalance
      }
    });
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ message: 'Error fetching vendors' });
  }
};

// Create vendor
const createVendor = async (req, res) => {
  const { name, phone, address, balance } = req.body;
  if (!name) return res.status(400).json({ message: 'Vendor name is required' });

  try {
    const insertRes = await query(
      `INSERT INTO vendors (name, phone, address, balance)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, phone || null, address || null, parseFloat(balance || 0)]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Vendor', `Created vendor: ${name} (Balance: ${balance || 0})`]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ message: 'Error creating vendor' });
  }
};

// Update vendor — balance is NOT editable here; only name/phone/address
const updateVendor = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;

  try {
    const checkRes = await query('SELECT * FROM vendors WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Vendor not found' });
    const oldVend = checkRes.rows[0];

    const updateRes = await query(
      `UPDATE vendors 
       SET name = $1, phone = $2, address = $3
       WHERE id = $4 RETURNING *`,
      [
        name || oldVend.name,
        phone !== undefined ? phone : oldVend.phone,
        address !== undefined ? address : oldVend.address,
        id
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Vendor',
        `Updated vendor: ${name} (ID: ${id})`,
        JSON.stringify(oldVend),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ message: 'Error updating vendor' });
  }
};

// Delete vendor
const deleteVendor = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name, balance FROM vendors WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Vendor not found' });
    const vendor = checkRes.rows[0];

    if (Math.abs(parseFloat(vendor.balance)) > 0.01) {
      return res.status(400).json({ message: `Cannot delete vendor with non-zero outstanding balance of: ${vendor.balance}` });
    }

    await query('UPDATE vendors SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Vendor', `Soft deleted vendor: ${vendor.name} (ID: ${id})`]
    );

    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ message: 'Error deleting vendor' });
  }
};

// Record payment to vendor
const recordVendorPayment = async (req, res) => {
  const { vendor_id, bank_id, amount, note, date } = req.body;

  if (!vendor_id || !bank_id || !amount || !date) {
    return res.status(400).json({ message: 'Vendor ID, Bank ID, Amount, and Date are required' });
  }

  const payAmount = parseFloat(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    return res.status(400).json({ message: 'Payment amount must be a positive number greater than zero' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Vendor
    const vendRes = await client.query('SELECT name, balance FROM vendors WHERE id = $1 AND deleted_at IS NULL', [vendor_id]);
    if (vendRes.rows.length === 0) throw new Error('Vendor not found');
    const vendorName = vendRes.rows[0].name;

    // 2. Fetch Bank
    const bankRes = await client.query('SELECT name, balance FROM banks WHERE id = $1 AND deleted_at IS NULL', [bank_id]);
    if (bankRes.rows.length === 0) throw new Error('Bank not found');
    const bankName = bankRes.rows[0].name;
    
    // Check if bank has enough balance (prevent negative bank balance if needed, or allow it)
    if (parseFloat(bankRes.rows[0].balance) < payAmount) {
      throw new Error(`Insufficient funds in bank '${bankName}'. Current balance: ${bankRes.rows[0].balance}`);
    }

    // 3. Insert Payment
    const payRes = await client.query(
      `INSERT INTO payments_vendors (vendor_id, bank_id, amount, note, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [vendor_id, bank_id, payAmount, note || null, date]
    );
    const paymentId = payRes.rows[0].id;

    // 4. Update Vendor Balance: reduces what we owe them
    await client.query(
      'UPDATE vendors SET balance = balance - $1 WHERE id = $2',
      [payAmount, vendor_id]
    );

    // 5. Update Bank Balance: reduces our cash/bank
    await client.query(
      'UPDATE banks SET balance = balance - $1 WHERE id = $2',
      [payAmount, bank_id]
    );

    // 6. Insert Bank Ledger debit entry (money leaving bank)
    await client.query(
      `INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
       VALUES ($1, 'debit', $2, $3, $4, $5)`,
      [
        bank_id,
        payAmount,
        `Payment to vendor: ${vendorName} (Payment ID: ${paymentId}) ${note ? '- ' + note : ''}`,
        paymentId,
        date
      ]
    );

    // 7. Insert Audit Log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [req.user.id, 'Vendor Payment', `Recorded payment of ${payAmount} to vendor ${vendorName} from bank ${bankName}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Vendor payment recorded successfully', paymentId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording vendor payment:', err);
    res.status(500).json({ message: err.message || 'Error recording vendor payment' });
  } finally {
    client.release();
  }
};

// Get Vendor Ledger Report
const getVendorLedger = async (req, res) => {
  const { id } = req.params;

  try {
    const vendRes = await query('SELECT * FROM vendors WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (vendRes.rows.length === 0) return res.status(404).json({ message: 'Vendor not found' });
    const vendor = vendRes.rows[0];

    // Purchase Orders (We bought stock, increasing vendor balance)
    const purchasesRes = await query(
      `SELECT id, total_amount, total_qty, date, 'Purchase Order' AS type
       FROM purchase_orders 
       WHERE vendor_id = $1 
       ORDER BY date ASC`,
      [id]
    );

    // Payments to vendors (We paid them, reducing vendor balance)
    const paymentsRes = await query(
      `SELECT pv.id, pv.amount, pv.note, pv.date, b.name AS bank_name, 'Payment Sent' AS type
       FROM payments_vendors pv
       LEFT JOIN banks b ON pv.bank_id = b.id
       WHERE pv.vendor_id = $1
       ORDER BY pv.date ASC`,
      [id]
    );

    // Purchase returns (We returned stock, reducing what we owe)
    const returnsRes = await query(
      `SELECT id, amount, quantity, cost, date, 'Purchase Return' AS type
       FROM purchase_returns
       WHERE vendor_id = $1
       ORDER BY date ASC`,
      [id]
    );

    const ledger = [];

    purchasesRes.rows.forEach(p => {
      ledger.push({
        id: p.id,
        date: p.date,
        type: 'Purchase #' + p.id,
        debit: 0,
        credit: parseFloat(p.total_amount), // Credit: We owe them more money
        balance_impact: parseFloat(p.total_amount),
        details: `Qty bought: ${p.total_qty}`
      });
    });

    paymentsRes.rows.forEach(pay => {
      ledger.push({
        id: pay.id,
        date: pay.date,
        type: 'Payment Out',
        debit: parseFloat(pay.amount), // Debit: We paid them, decreasing our debt to them
        credit: 0,
        balance_impact: -parseFloat(pay.amount),
        details: `Paid from: ${pay.bank_name} ${pay.note ? '(' + pay.note + ')' : ''}`
      });
    });

    returnsRes.rows.forEach(r => {
      ledger.push({
        id: r.id,
        date: r.date,
        type: 'Return #' + r.id,
        debit: parseFloat(r.amount), // Debit: We returned stock, decreasing our debt
        credit: 0,
        balance_impact: -parseFloat(r.amount),
        details: `Cost: ${r.cost}, Qty: ${r.quantity}`
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const ledgerWithRunning = ledger.map(item => {
      runningBalance += item.balance_impact;
      return {
        ...item,
        running_balance: runningBalance
      };
    });

    res.json({
      vendor,
      ledger: ledgerWithRunning
    });
  } catch (err) {
    console.error('Error fetching vendor ledger:', err);
    res.status(500).json({ message: 'Error fetching vendor ledger' });
  }
};

module.exports = {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  recordVendorPayment,
  getVendorLedger
};
