const express = require('express');
const router = express.Router();
const {
  createOrder, getOrders, getOrderItems, refundOrder, getSalesLedgerReport, directCustomerRefund, checkoutOrder, upload
} = require('../controllers/orderController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.post('/', authenticateToken, requirePermission('invoice', 'add'), createOrder);
router.post('/checkout', authenticateToken, requirePermission('invoice', 'add'), upload.single('proof'), checkoutOrder);
router.post('/refund', authenticateToken, requirePermission('refund', 'add'), directCustomerRefund);
router.get('/report/sales-ledger', authenticateToken, requirePermission('sales-view', 'view'), getSalesLedgerReport);
router.get('/', authenticateToken, requirePermission('duplicate-bill', 'view'), getOrders);
router.get('/:id', authenticateToken, requirePermission('duplicate-bill', 'view'), getOrderItems);
router.post('/:id/refund', authenticateToken, requirePermission('refund', 'add'), refundOrder);

module.exports = router;
