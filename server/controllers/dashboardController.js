const { query } = require('../db');

const getDashboardStats = async (req, res) => {
  try {
    // 1. Basic Stats
    const salesRes = await query(`
      SELECT COALESCE(SUM(total_price), 0) AS total 
      FROM orders 
      WHERE created_at >= CURRENT_DATE`
    );
    const todaySales = parseFloat(salesRes.rows[0].total);

    const expenseRes = await query(`
      SELECT COALESCE(SUM(amount), 0) AS total 
      FROM expenses 
      WHERE date = CURRENT_DATE AND deleted_at IS NULL`
    );
    const todayExpenses = parseFloat(expenseRes.rows[0].total);

    const purchaseRes = await query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total 
      FROM purchase_orders 
      WHERE date = CURRENT_DATE`
    );
    const todayPurchases = parseFloat(purchaseRes.rows[0].total);

    const usersRes = await query(`SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`);
    const activeUsers = parseInt(usersRes.rows[0].count);

    const custBalRes = await query(`SELECT COALESCE(SUM(balance), 0) AS total FROM customers WHERE deleted_at IS NULL`);
    const customerBalanceTotal = parseFloat(custBalRes.rows[0].total);

    const vendBalRes = await query(`SELECT COALESCE(SUM(balance), 0) AS total FROM vendors WHERE deleted_at IS NULL`);
    const vendorBalanceTotal = parseFloat(vendBalRes.rows[0].total);

    const invoicesRes = await query(`SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE`);
    const todayInvoices = parseInt(invoicesRes.rows[0].count);

    const recoveryRes = await query(`
      SELECT COALESCE(SUM(amount), 0) AS total 
      FROM payments_customers 
      WHERE date = CURRENT_DATE`
    );
    const recovery = parseFloat(recoveryRes.rows[0].total);

    // 2. Stock levels (Short stock vs Out of stock)
    // Short stock: sum of quantities at all locations is between 1 and quantity_limit
    const stockStatsRes = await query(`
      SELECT 
        COUNT(CASE WHEN total_stock = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN total_stock > 0 AND total_stock <= quantity_limit THEN 1 END) AS short_stock
      FROM (
        SELECT p.id, p.quantity_limit,
               COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id AND deleted_at IS NULL), 0) AS total_stock
        FROM products p
        WHERE p.deleted_at IS NULL
      ) AS prod_stock
    `);
    const outOfStockCount = parseInt(stockStatsRes.rows[0].out_of_stock || 0);
    const shortStockCount = parseInt(stockStatsRes.rows[0].short_stock || 0);

    // 3. Most Selling Products (Top 5)
    const topProductsRes = await query(`
      SELECT p.name, SUM(oi.quantity) AS qty_sold, SUM(oi.total_price) AS revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.id, p.name
      ORDER BY qty_sold DESC
      LIMIT 5
    `);

    // 4. Top Customers (Top 5 by sale value)
    const topCustomersRes = await query(`
      SELECT c.name, COALESCE(SUM(o.total_price), 0) AS total_spent, c.balance
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      GROUP BY c.id, c.name, c.balance
      ORDER BY total_spent DESC
      LIMIT 5
    `);

    // 5. Top Vendors (Top 5 by purchase value)
    const topVendorsRes = await query(`
      SELECT v.name, COALESCE(SUM(po.total_amount), 0) AS total_purchased, v.balance
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      GROUP BY v.id, v.name, v.balance
      ORDER BY total_purchased DESC
      LIMIT 5
    `);

    // 6. Sales Chart Data (aggregated by day for the last 7 days)
    const chartRes = await query(`
      SELECT TO_CHAR(d, 'YYYY-MM-DD') AS date,
             COALESCE((SELECT SUM(total_price) FROM orders WHERE created_at::date = d::date), 0) AS sales,
             COALESCE((SELECT SUM(amount) FROM expenses WHERE date = d::date AND deleted_at IS NULL), 0) AS expenses,
             COALESCE((SELECT SUM(total_amount) FROM purchase_orders WHERE date = d::date), 0) AS purchases
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d
      ORDER BY date ASC
    `);

    res.json({
      todaySales,
      todayExpenses,
      todayPurchases,
      activeUsers,
      customerBalanceTotal,
      vendorBalanceTotal,
      todayInvoices,
      recovery,
      shortStockCount,
      outOfStockCount,
      topProducts: topProductsRes.rows,
      topCustomers: topCustomersRes.rows,
      topVendors: topVendorsRes.rows,
      chartData: chartRes.rows
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Error compiling dashboard statistics' });
  }
};

module.exports = {
  getDashboardStats
};
