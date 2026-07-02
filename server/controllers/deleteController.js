const db = require('../db');

// Generic safe delete with dependency checks
const safeDelete = async (req, res, config) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }

  try {
    // Check if record exists first
    const existsRes = await db.query(`SELECT * FROM ${config.table} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (existsRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `${config.label} not found` });
    }
    const record = existsRes.rows[0];
    const recordName = record.name || record.description || `ID ${id}`;

    // Run all dependency checks
    for (const check of config.checks) {
      const result = await db.query(check.query, [id]);
      if (parseInt(result.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          message: check.message
        });
      }
    }

    // Safe to delete
    await db.query(
      `UPDATE ${config.table} SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]
    );

    // If it's a product, also mark its stock entries as soft deleted
    if (config.table === 'products') {
      await db.query(`UPDATE stock SET deleted_at = CURRENT_TIMESTAMP WHERE product_id = $1`, [id]);
    }

    // Write audit log
    if (req.user && req.user.id) {
      const details = `Soft deleted ${config.label.toLowerCase()}: ${recordName} (ID: ${id})`;
      await db.query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, `Delete ${config.label}`, details]
      );
    }

    res.json({
      success: true,
      message: `${config.label} deleted successfully`
    });

  } catch (err) {
    console.error(`Delete ${config.table} error:`, err);
    res.status(500).json({
      success: false,
      message: 'Delete failed: ' + err.message
    });
  }
};

// USERS
exports.deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account'
    });
  }

  try {
    // Check if deleting last admin
    const userRes = await db.query("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL", [id]);
    if (userRes.rows.length > 0 && userRes.rows[0].role === 'Admin') {
      const adminCountRes = await db.query("SELECT COUNT(*) FROM users WHERE role = 'Admin' AND deleted_at IS NULL");
      if (parseInt(adminCountRes.rows[0].count) <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin account'
        });
      }
    }
  } catch (err) {
    console.error('Error checking admin count:', err);
  }

  await safeDelete(req, res, {
    table: 'users',
    label: 'User',
    checks: []
  });
};

// PRODUCTS
exports.deleteProduct = (req, res) => safeDelete(req, res, {
  table: 'products',
  label: 'Product',
  checks: [
    {
      query: 'SELECT COUNT(*) FROM order_items WHERE product_id=$1 AND deleted_at IS NULL',
      message: 'Cannot delete — product has sales history'
    },
    {
      query: 'SELECT COUNT(*) FROM stock WHERE product_id=$1 AND deleted_at IS NULL',
      message: 'Cannot delete — product has stock records. Remove stock first.'
    }
  ]
});

// CUSTOMERS
exports.deleteCustomer = (req, res) => safeDelete(req, res, {
  table: 'customers',
  label: 'Customer',
  checks: [
    {
      query: 'SELECT COUNT(*) FROM orders WHERE customer_id=$1 AND deleted_at IS NULL',
      message: 'Cannot delete — customer has order history'
    },
    {
      query: `SELECT COUNT(*) FROM customers
              WHERE id=$1 AND balance != 0 AND deleted_at IS NULL`,
      message: 'Cannot delete — customer has outstanding balance'
    }
  ]
});

// VENDORS
exports.deleteVendor = (req, res) => safeDelete(req, res, {
  table: 'vendors',
  label: 'Vendor',
  checks: [
    {
      query: 'SELECT COUNT(*) FROM stock WHERE vendor_id=$1 AND deleted_at IS NULL',
      message: 'Cannot delete — vendor has stock purchase history'
    },
    {
      query: `SELECT COUNT(*) FROM vendors
              WHERE id=$1 AND balance != 0 AND deleted_at IS NULL`,
      message: 'Cannot delete — vendor has outstanding balance'
    }
  ]
});

// SALESMEN
exports.deleteSalesman = (req, res) => safeDelete(req, res, {
  table: 'salesmen',
  label: 'Salesman',
  checks: [
    {
      query: 'SELECT COUNT(*) FROM customers WHERE salesman_id=$1 AND deleted_at IS NULL',
      message: 'Cannot delete — salesman has customers assigned'
    }
  ]
});

// BANKS
exports.deleteBank = (req, res) => safeDelete(req, res, {
  table: 'banks',
  label: 'Bank',
  checks: [
    {
      query: 'SELECT COUNT(*) FROM payments_customers WHERE bank_id=$1',
      message: 'Cannot delete — bank has customer payment history'
    },
    {
      query: 'SELECT COUNT(*) FROM payments_vendors WHERE bank_id=$1',
      message: 'Cannot delete — bank has vendor payment history'
    },
    {
      query: `SELECT COUNT(*) FROM banks
              WHERE id=$1 AND balance != 0 AND deleted_at IS NULL`,
      message: 'Cannot delete — bank has remaining balance'
    }
  ]
});

// EXPENSES
exports.deleteExpense = (req, res) => safeDelete(req, res, {
  table: 'expenses',
  label: 'Expense',
  checks: []
});

// STOCK ENTRIES
exports.deleteStock = (req, res) => safeDelete(req, res, {
  table: 'stock',
  label: 'Stock entry',
  checks: [
    {
      query: `SELECT COUNT(*) FROM stock
              WHERE id=$1 AND quantity > 0 AND deleted_at IS NULL`,
      message: 'Cannot delete — stock entry still has quantity'
    }
  ]
});
