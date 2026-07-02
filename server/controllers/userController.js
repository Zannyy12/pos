const bcrypt = require('bcryptjs');
const { query, pool } = require('../db');

// Get all users (paginated, non-deleted)
const getUsers = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '10');
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    const countRes = await query(
      `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND (name ILIKE $1 OR phone ILIKE $1)`,
      [`%${search}%`]
    );
    const totalItems = parseInt(countRes.rows[0].count);

    const userRes = await query(
      `SELECT id, name, role, phone, cnic, address, created_at 
       FROM users 
       WHERE deleted_at IS NULL AND (name ILIKE $1 OR phone ILIKE $1)
       ORDER BY id DESC 
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    res.json({
      data: userRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// Create a new user
const createUser = async (req, res) => {
  const { name, password, role, phone, cnic, address } = req.body;

  if (!name || !password || !role) {
    return res.status(400).json({ message: 'Name, password, and role are required' });
  }

  try {
    // Check if name exists
    const checkRes = await query('SELECT id FROM users WHERE name = $1 AND deleted_at IS NULL', [name]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertRes = await query(
      `INSERT INTO users (name, password_hash, role, phone, cnic, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, role, phone, cnic, address`,
      [name, password_hash, role, phone, cnic, address]
    );

    const newUser = insertRes.rows[0];

    // Seed default permissions
    const modules = [
      'dashboard', 'users', 'products', 'categories', 'customers', 
      'vendors', 'stock', 'expenses', 'invoice', 'duplicate-bill', 
      'sales-view', 'refund', 'banks', 'salesman'
    ];

    for (const mod of modules) {
      // If Admin, full permission, otherwise false
      const isAdmin = role === 'Admin';
      await query(
        `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
         VALUES ($1, $2, $3, $3, $3, $3)`,
        [newUser.id, mod, isAdmin]
      );
    }

    // Log action
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Create User', `Created user ${name} with role ${role}`]
    );

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Error creating user' });
  }
};

// Update user details
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, password, role, phone, cnic, address } = req.body;

  try {
    // Check user existence
    const userRes = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldUser = userRes.rows[0];

    let queryStr = '';
    let params = [];

    if (password) {
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);
      queryStr = `UPDATE users 
                  SET name = $1, password_hash = $2, role = $3, phone = $4, cnic = $5, address = $6
                  WHERE id = $7 RETURNING id, name, role, phone, cnic, address`;
      params = [name, password_hash, role, phone, cnic, address, id];
    } else {
      queryStr = `UPDATE users 
                  SET name = $1, role = $2, phone = $3, cnic = $4, address = $5
                  WHERE id = $6 RETURNING id, name, role, phone, cnic, address`;
      params = [name, role, phone, cnic, address, id];
    }

    const updateRes = await query(queryStr, params);

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        'Update User',
        `Updated user account ${name} (ID: ${id})`,
        JSON.stringify({ name: oldUser.name, role: oldUser.role, phone: oldUser.phone }),
        JSON.stringify({ name, role, phone })
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Error updating user' });
  }
};

// Delete user (soft delete)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own active session account' });
  }

  try {
    const checkRes = await query('SELECT name FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const name = checkRes.rows[0].name;

    await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Audit Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Delete User', `Soft deleted user ${name} (ID: ${id})`]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

// Get permissions list for a user
const getUserPermissions = async (req, res) => {
  const { id } = req.params;
  try {
    const permRes = await query(
      `SELECT module, can_view, can_add, can_edit, can_delete 
       FROM user_permissions 
       WHERE user_id = $1`,
      [id]
    );
    res.json(permRes.rows);
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    res.status(500).json({ message: 'Error fetching permissions' });
  }
};

// Update user permissions
const updateUserPermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; // Array of { module, can_view, can_add, can_edit, can_delete }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Permissions must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const perm of permissions) {
      const { module, can_view, can_add, can_edit, can_delete } = perm;
      await client.query(
        `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, module) 
         DO UPDATE SET can_view = $3, can_add = $4, can_edit = $5, can_delete = $6`,
        [
          parseInt(id),
          module,
          Boolean(can_view),
          Boolean(can_add),
          Boolean(can_edit),
          Boolean(can_delete)
        ]
      );
    }

    // Audit Log
    await client.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'Update Permissions', `Updated module permissions checklist for user ID: ${id}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Permissions updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user permissions:', err);
    res.status(500).json({ message: 'Error updating permissions' });
  } finally {
    client.release();
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserPermissions,
  updateUserPermissions
};
