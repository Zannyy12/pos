const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getUserPermissions, updateUserPermissions } = require('../controllers/userController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

router.get('/', authenticateToken, requirePermission('users', 'view'), getUsers);
router.post('/', authenticateToken, requireRole(['Admin']), requirePermission('users', 'add'), createUser);
router.put('/:id', authenticateToken, requireRole(['Admin']), requirePermission('users', 'edit'), updateUser);
router.delete('/:id', authenticateToken, requireRole(['Admin']), requirePermission('users', 'delete'), deleteUser);

router.get('/:id/permissions', authenticateToken, requirePermission('users', 'view'), getUserPermissions);
router.put('/:id/permissions', authenticateToken, requireRole(['Admin']), requirePermission('users', 'edit'), updateUserPermissions);

module.exports = router;
