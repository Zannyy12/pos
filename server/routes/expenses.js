const express = require('express');
const router = express.Router();
const {
  getExpenseTypes, createExpenseType, updateExpenseType, deleteExpenseType,
  getExpenses, createExpense, updateExpense, deleteExpense
} = require('../controllers/expenseController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Expense Types Routes
router.get('/types', authenticateToken, requirePermission('expenses', 'view'), getExpenseTypes);
router.post('/types', authenticateToken, requirePermission('expenses', 'add'), createExpenseType);
router.put('/types/:id', authenticateToken, requirePermission('expenses', 'edit'), updateExpenseType);
router.delete('/types/:id', authenticateToken, requirePermission('expenses', 'delete'), deleteExpenseType);

// Expenses Routes
router.get('/', authenticateToken, requirePermission('expenses', 'view'), getExpenses);
router.post('/', authenticateToken, requirePermission('expenses', 'add'), createExpense);
router.put('/:id', authenticateToken, requirePermission('expenses', 'edit'), updateExpense);
router.delete('/:id', authenticateToken, requirePermission('expenses', 'delete'), deleteExpense);

module.exports = router;
