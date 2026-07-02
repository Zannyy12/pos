const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors');
const paymentRoutes = require('./routes/payments');
const salesmanRoutes = require('./routes/salesman');
const bankRoutes = require('./routes/banks');
const expenseRoutes = require('./routes/expenses');
const stockRoutes = require('./routes/stock');
const orderRoutes = require('./routes/orders');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const posRoutes = require('./routes/pos');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for headers
app.use(cors({
  origin: '*', // Allow all origins for dev simplicity, can restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Express Middlewares
app.use(express.json({ limit: '10mb' })); // Support JSON inputs (higher limit for Excel imports)
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Dev API logging

// Serve static uploads for payment proofs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register API Routes
app.use('/api', require('./routes/index'));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/salesman', salesmanRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pos', posRoutes);   // No module-permission guard — needed by all cashiers

// Base route / status check
app.get('/', (req, res) => {
  res.json({ name: 'Khuzdar POS API Server', status: 'healthy', version: '2.0.0' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    message: err.message || 'Internal server error occurred on the API backend.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` Khuzdar POS API Server Running`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`========================================`);
});
