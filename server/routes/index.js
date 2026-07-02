const express = require('express');
const router = express.Router();
const {
  deleteUser, deleteProduct, deleteCustomer,
  deleteVendor, deleteSalesman, deleteBank,
  deleteExpense, deleteStock
} = require('../controllers/deleteController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

router.delete('/users/:id',     authenticateToken, requireRole(['Admin']), requirePermission('users', 'delete'), deleteUser);
router.delete('/products/:id',  authenticateToken, requirePermission('products', 'delete'), deleteProduct);
router.delete('/customers/:id', authenticateToken, requirePermission('customers', 'delete'), deleteCustomer);
router.delete('/vendors/:id',   authenticateToken, requirePermission('vendors', 'delete'), deleteVendor);
router.delete('/salesman/:id',  authenticateToken, requirePermission('salesman', 'delete'), deleteSalesman);
router.delete('/banks/:id',     authenticateToken, requireRole(['Admin']), requirePermission('banks', 'delete'), deleteBank);
router.delete('/expenses/:id',  authenticateToken, requirePermission('expenses', 'delete'), deleteExpense);
router.delete('/stock/:id',     authenticateToken, requireRole(['Admin']), requirePermission('stock', 'delete'), deleteStock);

module.exports = router;
