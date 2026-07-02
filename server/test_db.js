const { pool } = require('./db/index');

async function runAudit() {
  console.log('Connecting to database:', process.env.DB_NAME || 'khuzdarpos');
  const client = await pool.connect();
  try {
    console.log('--- 1. Checking Customer Balances vs Order/Payment History ---');
    const custRes = await client.query(`
      SELECT c.id, c.name, c.balance,
        COALESCE((
          SELECT SUM(o.total_price - o.amount_paid) 
          FROM orders o 
          WHERE o.customer_id = c.id AND o.deleted_at IS NULL
        ), 0) - COALESCE((
          SELECT SUM(p.amount) 
          FROM payments_customers p 
          WHERE p.customer_id = c.id AND p.deleted_at IS NULL
        ), 0) AS calculated_balance
      FROM customers c
      WHERE c.deleted_at IS NULL
    `);
    
    let custInconsistencies = 0;
    custRes.rows.forEach(row => {
      const diff = Math.abs(parseFloat(row.balance) - parseFloat(row.calculated_balance));
      if (diff > 0.01) {
        console.warn(`Inconsistency found: Customer "${row.name}" (ID: ${row.id}) has balance ${row.balance}, calculated balance is ${row.calculated_balance} (Diff: ${diff})`);
        custInconsistencies++;
      }
    });
    if (custInconsistencies === 0) {
      console.log('✅ All customer balances match order/payment history!');
    }

    console.log('--- 2. Checking Vendor Balances vs Purchase/Payment History ---');
    const vendRes = await client.query(`
      SELECT v.id, v.name, v.balance,
        COALESCE((
          SELECT SUM(po.total_amount)
          FROM purchase_orders po
          WHERE po.vendor_id = v.id AND po.deleted_at IS NULL
        ), 0) - COALESCE((
          SELECT SUM(pv.amount)
          FROM payments_vendors pv
          WHERE pv.vendor_id = v.id AND pv.deleted_at IS NULL
        ), 0) AS calculated_balance
      FROM vendors v
      WHERE v.deleted_at IS NULL
    `);

    let vendInconsistencies = 0;
    vendRes.rows.forEach(row => {
      const diff = Math.abs(parseFloat(row.balance) - parseFloat(row.calculated_balance));
      if (diff > 0.01) {
        console.warn(`Inconsistency found: Vendor "${row.name}" (ID: ${row.id}) has balance ${row.balance}, calculated balance is ${row.calculated_balance} (Diff: ${diff})`);
        vendInconsistencies++;
      }
    });
    if (vendInconsistencies === 0) {
      console.log('✅ All vendor balances match purchase/payment history!');
    }

    console.log('--- 3. Checking Bank Balances vs Ledger ---');
    const bankRes = await client.query(`
      SELECT b.id, b.name, b.balance,
        COALESCE((
          SELECT SUM(amount)
          FROM bank_ledger bl
          WHERE bl.bank_id = b.id AND bl.type = 'credit' AND bl.deleted_at IS NULL
        ), 0) - COALESCE((
          SELECT SUM(amount)
          FROM bank_ledger bl
          WHERE bl.bank_id = b.id AND bl.type = 'debit' AND bl.deleted_at IS NULL
        ), 0) AS ledger_balance
      FROM banks b
      WHERE b.deleted_at IS NULL
    `);

    let bankInconsistencies = 0;
    bankRes.rows.forEach(row => {
      const diff = Math.abs(parseFloat(row.balance) - parseFloat(row.ledger_balance));
      if (diff > 0.01) {
        console.warn(`Inconsistency found: Bank "${row.name}" (ID: ${row.id}) has balance ${row.balance}, ledger balance is ${row.ledger_balance} (Diff: ${diff})`);
        bankInconsistencies++;
      }
    });
    if (bankInconsistencies === 0) {
      console.log('✅ All bank balances match ledger history!');
    }

    console.log('--- 4. Checking Orphaned Records ---');
    const orphanedOrderItems = await client.query('SELECT COUNT(*) FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)');
    const orphanedStock = await client.query('SELECT COUNT(*) FROM stock WHERE product_id NOT IN (SELECT id FROM products)');
    const orphanedPayments = await client.query('SELECT COUNT(*) FROM payments_customers WHERE customer_id NOT IN (SELECT id FROM customers)');

    console.log(`Orphaned order items: ${orphanedOrderItems.rows[0].count}`);
    console.log(`Orphaned stock: ${orphanedStock.rows[0].count}`);
    console.log(`Orphaned customer payments: ${orphanedPayments.rows[0].count}`);
    
    if (parseInt(orphanedOrderItems.rows[0].count) === 0 && 
        parseInt(orphanedStock.rows[0].count) === 0 && 
        parseInt(orphanedPayments.rows[0].count) === 0) {
      console.log('✅ No orphaned records found!');
    }

  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
