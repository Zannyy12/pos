const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, requirePermission('dashboard', 'view'), getDashboardStats);

module.exports = router;
