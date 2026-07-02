const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const isLocalhost = (process.env.DB_HOST && process.env.DB_HOST.includes('localhost')) || 
                    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')) ||
                    (!process.env.DB_HOST && !process.env.DATABASE_URL);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalhost ? false : { rejectUnauthorized: false }
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'khuzdarpos',
      port: parseInt(process.env.DB_PORT || '5432'),
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
