const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Helper to generate access token
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET || 'khuzdarpos_secret_key_1234567890_super_secure_token',
    { expiresIn: '8h' }
  );
};

// Login user
const login = async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  try {
    // 1. Fetch user by username (not deleted)
    const userRes = await query(
      'SELECT * FROM users WHERE name = $1 AND deleted_at IS NULL',
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userRes.rows[0];

    // 2. Validate role
    if (user.role !== role) {
      return res.status(401).json({ message: 'Role mismatch' });
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Create failure audit log
      await query(
        'INSERT INTO audit_logs (action, details) VALUES ($1, $2)',
        ['Login Failure', `Failed login attempt for username: ${username} with role: ${role}`]
      );
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 4. Create token
    const token = generateAccessToken(user);

    // 5. Fetch user permissions
    const permRes = await query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = $1',
      [user.id]
    );
    const permissions = {};
    permRes.rows.forEach(p => {
      permissions[p.module] = {
        view: p.can_view,
        add: p.can_add,
        edit: p.can_edit,
        delete: p.can_delete
      };
    });

    // 6. Log success audit
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'User Login', `Successfully logged in from IP: ${req.ip}`]
    );

    const permissionsArray = permRes.rows.map(p => ({
      module: p.module,
      can_view: p.can_view,
      can_add: p.can_add,
      can_edit: p.can_edit,
      can_delete: p.can_delete
    }));

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        cnic: user.cnic,
        address: user.address,
        permissions
      },
      permissions: permissionsArray
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login' });
  }
};

// Get current profile
const getProfile = async (req, res) => {
  try {
    const userRes = await query(
      'SELECT id, name, role, phone, cnic, address FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userRes.rows[0];

    // Fetch user permissions
    const permRes = await query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = $1',
      [user.id]
    );
    
    const permissions = {};
    permRes.rows.forEach(p => {
      permissions[p.module] = {
        view: p.can_view,
        add: p.can_add,
        edit: p.can_edit,
        delete: p.can_delete
      };
    });

    res.json({
      user: {
        ...user,
        permissions
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Internal server error during profile retrieval' });
  }
};

// Get fresh permissions for me endpoint
const getMe = async (req, res) => {
  try {
    const permRes = await query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = $1',
      [req.user.id]
    );
    res.json({
      user: { id: req.user.id, name: req.user.name, role: req.user.role },
      permissions: permRes.rows
    });
  } catch (err) {
    console.error('Error fetching fresh permissions:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  login,
  getProfile,
  getMe
};
