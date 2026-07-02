const express = require('express');
const router = express.Router();
const { recordCustomerPayment } = require('../controllers/customerController');
const { recordVendorPayment } = require('../controllers/vendorController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.post('/customer', authenticateToken, requirePermission('customers', 'edit'), recordCustomerPayment);
router.post('/vendor', authenticateToken, requirePermission('vendors', 'edit'), recordVendorPayment);

module.exports = router;
