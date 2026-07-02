const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing or invalid' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'khuzdarpos_secret_key_1234567890_super_secure_token', (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Token is expired or invalid' });
    }
    req.user = user;
    next();
  });
};

// Middleware to enforce specific roles (e.g. Admin)
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

// Middleware to check specific module permissions in user_permissions
const requirePermission = (module, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Admins have bypass permission (all permissions are allowed)
    if (req.user.role === 'Admin') {
      return next();
    }

    try {
      // Map actions to permission column names
      let permissionColumn = 'can_view';
      if (action === 'add') permissionColumn = 'can_add';
      if (action === 'edit') permissionColumn = 'can_edit';
      if (action === 'delete') permissionColumn = 'can_delete';

      const permRes = await query(
        `SELECT ${permissionColumn} AS allowed 
         FROM user_permissions 
         WHERE user_id = $1 AND module = $2`,
        [req.user.id, module]
      );

      if (permRes.rows.length === 0 || !permRes.rows[0].allowed) {
        return res.status(403).json({ 
          message: `Access denied: you do not have permission to ${action} in module '${module}'` 
        });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ message: 'Internal server error during permission check' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission
};
