const express = require('express');
const router = express.Router();
const { posSearch, getPosProducts } = require('../controllers/posController');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/pos/search?barcode=xxx   → single product by barcode
// ── GET /api/pos/search?name=xxx      → up to 10 products by name (partial match)
//
// IMPORTANT: No requirePermission() here on purpose.
// All authenticated cashiers need to search products for billing,
// regardless of which modules they have 'view' permission on.
router.get('/search', authenticateToken, posSearch);
router.get('/products', authenticateToken, getPosProducts);

module.exports = router;
