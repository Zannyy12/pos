const { pool } = require('./index');

async function migrate() {
  console.log('Running database migrations to add payment columns...');
  const client = await pool.connect();
  try {
    // Start migration
    await client.query('BEGIN');

    // 1. Add payment_method_id column referencing banks
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS payment_method_id INTEGER REFERENCES banks(id) ON DELETE SET NULL
    `);
    console.log('- Verified/added payment_method_id column');

    // 2. Add proof_of_payment column
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS proof_of_payment VARCHAR(500)
    `);
    console.log('- Verified/added proof_of_payment column');

    // 3. Add payment_note column
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS payment_note TEXT
    `);
    console.log('- Verified/added payment_note column');

    // 4. Add change_due column
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS change_due NUMERIC(15,2) DEFAULT 0
    `);
    console.log('- Verified/added change_due column');

    await client.query('COMMIT');
    console.log('Database migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0));
