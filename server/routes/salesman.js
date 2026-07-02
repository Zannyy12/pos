const express = require('express');
const router = express.Router();
const {
  getSalesmen, createSalesman, updateSalesman, deleteSalesman, getSalesmanCommissionReport
} = require('../controllers/salesmanController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/report/commission', authenticateToken, requirePermission('salesman', 'view'), getSalesmanCommissionReport);

router.get('/', authenticateToken, requirePermission('salesman', 'view'), getSalesmen);
router.post('/', authenticateToken, requirePermission('salesman', 'add'), createSalesman);
router.put('/:id', authenticateToken, requirePermission('salesman', 'edit'), updateSalesman);
router.delete('/:id', authenticateToken, requirePermission('salesman', 'delete'), deleteSalesman);

module.exports = router;
