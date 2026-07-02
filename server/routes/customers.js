const express = require('express');
const router = express.Router();
const {
  getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerLedger
} = require('../controllers/customerController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, requirePermission('customers', 'view'), getCustomers);
router.post('/', authenticateToken, requirePermission('customers', 'add'), createCustomer);
router.put('/:id', authenticateToken, requirePermission('customers', 'edit'), updateCustomer);
router.delete('/:id', authenticateToken, requirePermission('customers', 'delete'), deleteCustomer);
router.get('/:id/ledger', authenticateToken, requirePermission('customers', 'view'), getCustomerLedger);

module.exports = router;
