const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

async function runSetup() {
  console.log('Starting Khuzdar POS Database Setup...');
  
  // 0. Connect to default postgres DB and create khuzdarpos if missing (only if not using DATABASE_URL)
  if (!process.env.DATABASE_URL) {
    const { Client } = require('pg');
    const bootstrapClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres'
    });

    try {
      await bootstrapClient.connect();
      const checkDb = await bootstrapClient.query("SELECT 1 FROM pg_database WHERE datname = 'khuzdarpos'");
      if (checkDb.rowCount === 0) {
        console.log('Database "khuzdarpos" does not exist. Creating database...');
        // CREATE DATABASE cannot run inside a transaction block, so run directly
        await bootstrapClient.query("CREATE DATABASE khuzdarpos");
        console.log('Database "khuzdarpos" created.');
      } else {
        console.log('Database "khuzdarpos" already exists.');
      }
    } catch (err) {
      console.error('Error during database check/creation:', err);
      throw err;
    } finally {
      await bootstrapClient.end();
    }
  } else {
    console.log('DATABASE_URL detected. Skipping database creation bootstrap; using the provided database URL directly.');
  }

  const client = await pool.connect();
  try {
    // 1. Read and execute schema
    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema...');
    await client.query(schemaSql);
    console.log('Schema executed successfully.');

    // 2. Hash passwords
    console.log('Hashing passwords...');
    const saltRounds = 12;
    const adminPasswordHash = await bcrypt.hash('1234', saltRounds);
    const cashierPasswordHash = await bcrypt.hash('1234', saltRounds);
    const tariqPasswordHash = await bcrypt.hash('1122', saltRounds);

    console.log('Seeding initial data...');
    
    // Seed Users
    const userRes = await client.query(`
      INSERT INTO users (name, password_hash, role, phone, cnic, address)
      VALUES 
        ('admin', $1, 'Admin', '03102673651', '42101-1234567-1', 'Reliable Tech Office, Karachi'),
        ('cashier', $2, 'Cashier', '03331234567', '42101-7654321-2', 'DHA Karachi'),
        ('tariq shamim', $3, 'Cashier', '03001234567', '42101-1111111-1', 'Karachi')
      RETURNING id, name, role;
    `, [adminPasswordHash, cashierPasswordHash, tariqPasswordHash]);

    const adminId = userRes.rows.find(u => u.name === 'admin').id;
    const cashierId = userRes.rows.find(u => u.name === 'cashier').id;
    const tariqId = userRes.rows.find(u => u.name === 'tariq shamim').id;

    // Seed User Permissions
    const modules = [
      'dashboard', 'users', 'products', 'categories', 'customers', 
      'vendors', 'stock', 'purchase-return', 'expenses', 'invoice', 
      'duplicate-bill', 'sales-view', 'refund', 'banks', 'salesman'
    ];

    for (const mod of modules) {
      // Admin gets full permissions
      await client.query(`
        INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
        VALUES ($1, $2, true, true, true, true)
      `, [adminId, mod]);

      // Cashier gets partial permissions
      const cashierCanView = ['dashboard', 'customers', 'vendors', 'stock', 'invoice', 'duplicate-bill', 'refund'].includes(mod);
      const cashierCanAdd = ['invoice', 'refund', 'customers'].includes(mod);
      await client.query(`
        INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
        VALUES ($1, $2, $3, $4, false, false)
      `, [cashierId, mod, cashierCanView, cashierCanAdd]);

      await client.query(`
        INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
        VALUES ($1, $2, $3, $4, false, false)
      `, [tariqId, mod, cashierCanView, cashierCanAdd]);
    }

    // Seed Categories
    const catRes = await client.query(`
      INSERT INTO categories (name) 
      VALUES ('Electronics'), ('Grocery'), ('Beverages') 
      RETURNING id, name;
    `);
    const elecCatId = catRes.rows.find(c => c.name === 'Electronics').id;
    const grocCatId = catRes.rows.find(c => c.name === 'Grocery').id;
    const bevCatId = catRes.rows.find(c => c.name === 'Beverages').id;

    // Seed Products
    const prodRes = await client.query(`
      INSERT INTO products (name, price, cost, discount, barcode, category_id, quantity_limit)
      VALUES 
        ('Milk 1L', 150.00, 120.00, 0.00, '1001', $1, 10),
        ('Coca Cola 1.5L', 120.00, 95.00, 5.00, '1002', $2, 15),
        ('USB Charger 18W', 500.00, 350.00, 0.00, '1003', $3, 5),
        ('Keyboard Wireless', 1200.00, 850.00, 50.00, '1004', $3, 3),
        ('Out of Stock Item', 200.00, 150.00, 0.00, '1005', $1, 2)
      RETURNING id, name, barcode;
    `, [grocCatId, bevCatId, elecCatId]);

    const milkId = prodRes.rows.find(p => p.barcode === '1001').id;
    const cokeId = prodRes.rows.find(p => p.barcode === '1002').id;
    const chargerId = prodRes.rows.find(p => p.barcode === '1003').id;
    const keyboardId = prodRes.rows.find(p => p.barcode === '1004').id;
    const oosId = prodRes.rows.find(p => p.barcode === '1005').id;

    // Seed Salesmen
    const saleRes = await client.query(`
      INSERT INTO salesmen (name, phone, address)
      VALUES 
        ('Ali Khan', '03001234567', 'Gulberg, Lahore'),
        ('Muhammad Ahmed', '03217654321', 'Clifton, Karachi')
      RETURNING id, name;
    `);
    const aliId = saleRes.rows[0].id;
    const ahmedId = saleRes.rows[1].id;

    // Seed Customers
    const custRes = await client.query(`
      INSERT INTO customers (name, phone, cnic, address, balance, salesman_id)
      VALUES 
        ('Zain Bashir', '03102673651', '42101-1234567-1', 'DHA Phase 6, Karachi', 5450.00, $1),
        ('Umar Farooq', '03339876543', '42101-9876543-2', 'Gulshan, Karachi', -1500.00, $2),
        ('Walk-in Customer', '03000000000', '00000-0000000-0', 'N/A', 0.00, $1)
      RETURNING id, name;
    `, [aliId, ahmedId]);
    const zainId = custRes.rows.find(c => c.name === 'Zain Bashir').id;
    const umarId = custRes.rows.find(c => c.name === 'Umar Farooq').id;
    const walkinId = custRes.rows.find(c => c.name === 'Walk-in Customer').id;

    // Seed Vendors
    const vendRes = await client.query(`
      INSERT INTO vendors (name, phone, address, balance)
      VALUES 
        ('Nestle Pakistan', '042-111-637853', 'Sheikhupura Road, Punjab', 25000.00),
        ('Unilever Pakistan', '021-111-864538', 'Avari Plaza, Karachi', -10000.00)
      RETURNING id, name;
    `);
    const nestleId = vendRes.rows.find(v => v.name === 'Nestle Pakistan').id;
    const unileverId = vendRes.rows.find(v => v.name === 'Unilever Pakistan').id;

    // Seed Banks
    const bankRes = await client.query(`
      INSERT INTO banks (name, balance)
      VALUES 
        ('Cash in Hand', 50000.00),
        ('Meezan Bank', 150000.00),
        ('HBL', 75000.00)
      RETURNING id, name;
    `);
    const cashBankId = bankRes.rows.find(b => b.name === 'Cash in Hand').id;
    const meezanBankId = bankRes.rows.find(b => b.name === 'Meezan Bank').id;
    const hblBankId = bankRes.rows.find(b => b.name === 'HBL').id;

    // Seed Bank Ledger (Opening balances adjusted for pending payments)
    await client.query(`
      INSERT INTO bank_ledger (bank_id, type, amount, description, date)
      VALUES 
        ($1, 'credit', 49080.00, 'Opening Balance', CURRENT_DATE),
        ($2, 'credit', 158000.00, 'Opening Balance', CURRENT_DATE),
        ($3, 'credit', 75000.00, 'Opening Balance', CURRENT_DATE)
    `, [cashBankId, meezanBankId, hblBankId]);

    // Seed Stock
    await client.query(`
      INSERT INTO stock (vendor_id, product_id, quantity, price, cost, barcode, location)
      VALUES 
        ($1, $3, 50, 150.00, 120.00, '1001', 'Shop'),
        ($1, $3, 100, 150.00, 120.00, '1001', 'Store 1'),
        ($1, $4, 80, 120.00, 95.00, '1002', 'Shop'),
        ($2, $5, 15, 500.00, 350.00, '1003', 'Shop'),
        ($2, $6, 4, 1200.00, 850.00, '1004', 'Store 1'),
        ($1, $7, 0, 200.00, 150.00, '1005', 'Shop')
    `, [nestleId, unileverId, milkId, cokeId, chargerId, keyboardId, oosId]);

    // Seed Expense Types
    const expTypeRes = await client.query(`
      INSERT INTO expense_types (name)
      VALUES ('Rent'), ('Utility'), ('Salaries'), ('Miscellaneous')
      RETURNING id, name;
    `);
    const rentTypeId = expTypeRes.rows.find(t => t.name === 'Rent').id;
    const utilityTypeId = expTypeRes.rows.find(t => t.name === 'Utility').id;

    // Seed Expenses
    await client.query(`
      INSERT INTO expenses (expense_type_id, description, amount, date)
      VALUES 
        ($1, 'Shop Rent June 2026', 30000.00, '2026-06-01'),
        ($2, 'Electricity Bill May 2026', 12500.00, '2026-06-12')
    `, [rentTypeId, utilityTypeId]);

    // Seed Customer Orders to match customer balances:
    // Order 1 (Zain Bashir): total 420, paid 420, due 0 (paid Cash)
    // Order 2 (Umar Farooq): total 1000, paid 500, due 500 (paid Cash)
    // Order 3 (Zain Bashir opening): total 5450, paid 0, due 5450
    const orderRes = await client.query(`
      INSERT INTO orders (customer_id, user_id, total_price, amount_paid, discount, balance_due)
      VALUES 
        ($1, $3, 420.00, 420.00, 30.00, 0.00),
        ($2, $3, 1000.00, 500.00, 0.00, 500.00),
        ($1, $3, 5450.00, 0.00, 0.00, 5450.00)
      RETURNING id;
    `, [zainId, umarId, adminId]);
    
    const order1Id = orderRes.rows[0].id;
    const order2Id = orderRes.rows[1].id;
    const order3Id = orderRes.rows[2].id;

    // Seed Order Items
    await client.query(`
      INSERT INTO order_items (order_id, product_id, unit_price, quantity, discount, total_price)
      VALUES 
        ($1, $4, 150.00, 2, 0.00, 300.00),
        ($1, $5, 120.00, 1, 5.00, 115.00),
        ($2, $6, 500.00, 2, 0.00, 1000.00),
        ($3, $6, 500.00, 11, 0.00, 5500.00) -- Charger 18W: 11 * 500 = 5500 (discount 50 at order level)
    `, [order1Id, order2Id, order3Id, milkId, cokeId, chargerId]);

    // Seed payments for Order 1 & Order 2 in bank ledger
    await client.query(`
      INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
      VALUES 
        ($1, 'credit', 420.00, $2, $3, CURRENT_DATE),
        ($1, 'credit', 500.00, $4, $5, CURRENT_DATE)
    `, [cashBankId, `POS Invoice Payment Recv (Order ID: ${order1Id})`, order1Id, `POS Invoice Payment Recv (Order ID: ${order2Id})`, order2Id]);

    // Seed Customer Payment:
    // Umar Farooq paid 2000.00 to Meezan Bank, bringing his balance to 500 - 2000 = -1500.00
    const paymentCustRes = await client.query(`
      INSERT INTO payments_customers (customer_id, bank_id, amount, note, date)
      VALUES ($1, $2, 2000.00, 'Advance Payment', CURRENT_DATE)
      RETURNING id;
    `, [umarId, meezanBankId]);
    const paymentCustId = paymentCustRes.rows[0].id;

    await client.query(`
      INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
      VALUES ($1, 'credit', 2000.00, 'Recovery payment from customer: Umar Farooq', $2, CURRENT_DATE)
    `, [meezanBankId, paymentCustId]);

    // Seed Vendor Purchase Orders to match Nestle balance (25000.00)
    const poRes = await client.query(`
      INSERT INTO purchase_orders (vendor_id, total_amount, total_qty, date)
      VALUES ($1, 25000.00, 10, CURRENT_DATE)
      RETURNING id;
    `, [nestleId]);
    const poId = poRes.rows[0].id;

    await client.query(`
      INSERT INTO purchase_order_items (purchase_order_id, product_id, cost, quantity, amount)
      VALUES ($1, $2, 2500.00, 10, 25000.00)
    `, [poId, chargerId]);

    // Seed Vendor Payments to match Unilever balance (-10000.00)
    const paymentVendRes = await client.query(`
      INSERT INTO payments_vendors (vendor_id, bank_id, amount, note, date)
      VALUES ($1, $2, 10000.00, 'Advance Payment', CURRENT_DATE)
      RETURNING id;
    `, [unileverId, meezanBankId]);
    const paymentVendId = paymentVendRes.rows[0].id;

    await client.query(`
      INSERT INTO bank_ledger (bank_id, type, amount, description, reference_id, date)
      VALUES ($1, 'debit', 10000.00, 'Payment to vendor: Unilever Pakistan', $2, CURRENT_DATE)
    `, [meezanBankId, paymentVendId]);

    // Seed Audit Logs
    await client.query(`
      INSERT INTO audit_logs (user_id, action, details)
      VALUES ($1, 'Database Seed', 'Successfully populated initial mock database state.')
    `, [adminId]);

    console.log('Database Setup & Seeding Completed successfully!');
  } catch (err) {
    console.error('Error executing database setup script:', err);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSetup().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = runSetup;
