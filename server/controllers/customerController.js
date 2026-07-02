const { query, pool } = require('../db');

// Get all customers (paginated, filterable, non-deleted)
const getCustomers = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const salesmanId = req.query.salesman_id || '';

  try {
    let queryStr = `
      SELECT c.*, s.name AS salesman_name 
      FROM customers c
      LEFT JOIN salesmen s ON c.salesman_id = s.id
      WHERE c.deleted_at IS NULL
    `;
    const params = [];
    let paramCounter = 1;

    if (search) {
      queryStr += ` AND (c.name ILIKE $${paramCounter} OR c.phone ILIKE $${paramCounter} OR c.cnic ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    if (salesmanId) {
      queryStr += ` AND c.salesman_id = $${paramCounter}`;
      params.push(parseInt(salesmanId));
      paramCounter++;
    }

    // Get count for pagination
    const countRes = await query(`SELECT COUNT(*) FROM (${queryStr}) AS temp`, params);
    const totalItems = parseInt(countRes.rows[0].count);

    // Get total outstanding market balance
    const totalBalanceRes = await query(`SELECT SUM(balance) AS total FROM customers WHERE deleted_at IS NULL`);
    const totalMarketBalance = parseFloat(totalBalanceRes.rows[0].total || 0);

    queryStr += ` ORDER BY c.id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const customersRes = await query(queryStr, params);

    res.json({
      data: customersRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit,
        totalMarketBalance
      }
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Error fetching customers' });
  }
};

// Create customer
const createCustomer = async (req, res) => {
  const { name, phone, cnic, address, balance, salesman_id } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Customer name is required' });
  }

  try {
    const insertRes = await query(
      `INSERT INTO customers (name, phone, cnic, address, balance, salesman_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        phone || null,
        cnic || null,
        address || null,
        parseFloat(balance || 0),
        salesman_id ? parseInt(salesman_id) : null
      ]
    );

    const customer = insertRes.rows[0];

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create Customer', `Created customer: ${name} (Balance: ${balance || 0})`]
    );

    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ message: 'Error creating customer' });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, cnic, address, balance, salesman_id } = req.body;

  try {
    const checkRes = await query('SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    const oldCust = checkRes.rows[0];

    const updateRes = await query(
      `UPDATE customers 
       SET name = $1, phone = $2, cnic = $3, address = $4, balance = $5, salesman_id = $6
       WHERE id = $7 RETURNING *`,
      [
        name || oldCust.name,
        phone !== undefined ? phone : oldCust.phone,
        cnic !== undefined ? cnic : oldCust.cnic,
        address !== undefined ? address : oldCust.address,
        balance !== undefined ? parseFloat(balance) : oldCust.balance,
        salesman_id !== undefined ? (salesman_id ? parseInt(salesman_id) : null) : oldCust.salesman_id,
        id
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update Customer',
        `Updated customer: ${name} (ID: ${id})`,
        JSON.stringify(oldCust),
        JSON.stringify(updateRes.rows[0])
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ message: 'Error updating customer' });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT name, balance FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    const cust = checkRes.rows[0];

    if (Math.abs(parseFloat(cust.balance)) > 0.01) {
      return res.status(400).json({ message: `Cannot delete customer with non-zero outstanding balance of: ${cust.balance}` });
    }

    await query('UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete Customer', `Soft deleted customer: ${cust.name} (ID: ${id})`]
    );

    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: 'Error deleting customer' });
  }
};

// Record payment from customer
const recordCustomerPayment = async (req, res) => {
  const { customer_id, bank_id, amount, note, date } = req.body;

  if (!customer_id || !bank_id || !amount || !date) {
    return res.status(400).json({ message: 'Customer ID, Bank ID, Amount, and Date are required' });
  }

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ message: 'Payment amount must be a positive number greater than zero' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Customer details
    const custRes = await client.query('SELECT name FROM customers WHERE id = $1 AND deleted_at IS NULL', [customer_id]);
    if (custRes.rows.length === 0) throw new Error('Customer not found');
    const customerName = custRes.rows[0].name;

    // 2. Fetch Bank details
    const bankRes = await client.query('SELECT name FROM banks WHERE id = $1 AND deleted_at IS NULL', [bank_id]);
    if (bankRes.rows.length === 0) throw new Error('Bank not found');
    const bankName = bankRes.rows[0].name;

    // 3. Insert Customer Payment Record
    const payRes = await client.query(
      `INSERT INTO payments_customers (customer_id, bank_id, amount, note, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [customer_id, bank_id, paymentAmount, note || null, date]
    );
    const paymentId = payRes.rows[0].id;

    // 4. Update Customer Balance: reduces customer's receivable balance (they pay us)
    await client.query(
      'UPDATE customers SET balance = balance - $1 WHERE id = $2',
      [paymentAmount, customer_id]
    );

    // 5. Update Bank Balance: increases company cash/bank balance
    await client.query(
      'UPDATE banks SET balance = balance + $1 WHERE id = $2',
      [paymentAmount, bank_id]
    );

    // 6. Insert Bank Ledger credit entry (debit/credit relative to the bank)
    // Credit means incoming funds in banking ledger context (or debit depending on perspective, the schema indicates ENUM['credit', 'debit']. Credit usually means money added here).
    await client.query(
      `INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
       VALUES ($1, 'credit', $2, $3, $4, $5)`,
      [
        bank_id,
        paymentAmount,
        `Recovery payment from customer: ${customerName} (Payment ID: ${paymentId}) ${note ? '- ' + note : ''}`,
        paymentId,
        date
      ]
    );

    // 7. Insert Audit Log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [
        req.user.id,
        'Customer Payment',
        `Recorded payment of ${paymentAmount} from customer ${customerName} to bank ${bankName}`
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Payment recorded successfully', paymentId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording customer payment:', err);
    res.status(500).json({ message: err.message || 'Error recording customer payment' });
  } finally {
    client.release();
  }
};

// Get Customer Ledger Report (Full transaction history)
const getCustomerLedger = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch Customer info
    const custRes = await query('SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (custRes.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    const customer = custRes.rows[0];

    // 2. Fetch sales orders
    const ordersRes = await query(
      `SELECT id, total_price, amount_paid, discount, created_at AS date, 'Sale Invoice' AS type
       FROM orders 
       WHERE customer_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    // 3. Fetch customer payments
    const paymentsRes = await query(
      `SELECT pc.id, pc.amount, pc.note, pc.date, b.name AS bank_name, 'Recovery Payment' AS type
       FROM payments_customers pc
       LEFT JOIN banks b ON pc.bank_id = b.id
       WHERE pc.customer_id = $1
       ORDER BY pc.date ASC`,
      [id]
    );

    // 4. Fetch refunds
    const refundsRes = await query(
      `SELECT r.id, r.total_refunded AS amount, r.date, 'Refund' AS type
       FROM refunds r
       WHERE r.customer_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.date ASC`,
      [id]
    );

    // Compile and sort ledger chronologically
    const ledger = [];

    // Push starting balance if any
    // Wait, the current balance represents the accumulated state.
    // Let's list all elements, format them, and sort.
    ordersRes.rows.forEach(o => {
      // For sales: customer owes us `total_price - discount`
      // They paid `amount_paid` at the spot.
      // Net added to ledger balance: `total_price - discount - amount_paid`
      const netAmount = parseFloat(o.total_price) - parseFloat(o.discount);
      ledger.push({
        id: o.id,
        date: o.date,
        type: 'Invoice #' + o.id,
        debit: netAmount, // Debit: money they owe us
        credit: parseFloat(o.amount_paid), // Credit: money they paid on spot
        balance_impact: netAmount - parseFloat(o.amount_paid),
        details: `Total: ${o.total_price}, Disc: ${o.discount}, Paid: ${o.amount_paid}`
      });
    });

    paymentsRes.rows.forEach(p => {
      ledger.push({
        id: p.id,
        date: p.date,
        type: 'Payment Recv',
        debit: 0,
        credit: parseFloat(p.amount), // Credit: they paid us later
        balance_impact: -parseFloat(p.amount),
        details: `Paid via: ${p.bank_name} ${p.note ? '(' + p.note + ')' : ''}`
      });
    });

    refundsRes.rows.forEach(r => {
      ledger.push({
        id: r.id,
        date: r.date,
        type: 'Refund #' + r.id,
        debit: 0,
        credit: parseFloat(r.amount), // Credit: we refund them, reducing their debt (or increasing what we owe them)
        balance_impact: -parseFloat(r.amount),
        details: `Refunded amount`
      });
    });

    // Sort ledger by date
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithRunning = ledger.map(item => {
      runningBalance += item.balance_impact;
      return {
        ...item,
        running_balance: runningBalance
      };
    });

    res.json({
      customer,
      ledger: ledgerWithRunning
    });

  } catch (err) {
    console.error('Error fetching customer ledger:', err);
    res.status(500).json({ message: 'Error fetching customer ledger' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  recordCustomerPayment,
  getCustomerLedger
};
