const express = require('express');
const router = Router = express.Router();
const {
  getBanks, createBank, updateBank, deleteBank, getBankLedger
} = require('../controllers/bankController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, getBanks);
router.post('/', authenticateToken, requirePermission('banks', 'add'), createBank);
router.put('/:id', authenticateToken, requirePermission('banks', 'edit'), updateBank);
router.delete('/:id', authenticateToken, requirePermission('banks', 'delete'), deleteBank);
router.get('/:id/ledger', authenticateToken, requirePermission('banks', 'view'), getBankLedger);

module.exports = router;
