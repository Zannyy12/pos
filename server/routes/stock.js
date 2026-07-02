const express = require('express');
const router = express.Router();
const {
  getStock, adjustStock, addPurchase, addPurchaseReturn
} = require('../controllers/stockController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, requirePermission('stock', 'view'), getStock);
router.post('/adjust', authenticateToken, requirePermission('stock', 'edit'), adjustStock);
router.post('/purchase', authenticateToken, requirePermission('stock', 'add'), addPurchase);
router.post('/purchase-return', authenticateToken, requirePermission('stock', 'add'), addPurchaseReturn);

module.exports = router;
