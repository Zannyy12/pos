const express = require('express');
const router = express.Router();
const {
  getVendors, createVendor, updateVendor, deleteVendor, getVendorLedger
} = require('../controllers/vendorController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, requirePermission('vendors', 'view'), getVendors);
router.post('/', authenticateToken, requirePermission('vendors', 'add'), createVendor);
router.put('/:id', authenticateToken, requirePermission('vendors', 'edit'), updateVendor);
router.delete('/:id', authenticateToken, requirePermission('vendors', 'delete'), deleteVendor);
router.get('/:id/ledger', authenticateToken, requirePermission('vendors', 'view'), getVendorLedger);

module.exports = router;
