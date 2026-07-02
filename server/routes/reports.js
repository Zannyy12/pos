const express = require('express');
const router = express.Router();
const { getSalesReport, getStockReport, getAuditLogs } = require('../controllers/reportController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/sales-view', authenticateToken, requirePermission('sales-view', 'view'), getSalesReport);
router.get('/stock', authenticateToken, requirePermission('stock', 'view'), getStockReport);
router.get('/audit', authenticateToken, requirePermission('users', 'view'), getAuditLogs);

module.exports = router;
