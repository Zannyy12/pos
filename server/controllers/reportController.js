const { query } = require('../db');

// Sales View Report
const getSalesReport = async (req, res) => {
  const { from_date, to_date, type } = req.query; // type = 'summary' or 'itemwise'

  if (!from_date || !to_date) {
    return res.status(400).json({ message: 'From Date and To Date are required' });
  }

  try {
    const startDate = from_date + ' 00:00:00';
    const endDate = to_date + ' 23:59:59';

    // 1. Fetch Summary Panel Stats
    const saleStats = await query(
      `SELECT COALESCE(SUM(total_price), 0) AS total_sales,
              COUNT(id) AS total_invoices,
              COALESCE(SUM(discount), 0) AS total_discount
       FROM orders 
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );

    const expenseStats = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense 
       FROM expenses 
       WHERE date >= $1 AND date <= $2 AND deleted_at IS NULL`,
      [from_date, to_date]
    );

    const recoveryStats = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_recovery 
       FROM payments_customers 
       WHERE date >= $1 AND date <= $2`,
      [from_date, to_date]
    );

    const vendorPayStats = await query(
      `SELECT COALESCE(SUM(amount), 0) AS vendor_payments 
       FROM payments_vendors 
       WHERE date >= $1 AND date <= $2`,
      [from_date, to_date]
    );

    const purchaseStats = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_purchases 
       FROM purchase_orders 
       WHERE date >= $1 AND date <= $2`,
      [from_date, to_date]
    );

    // Calculate total cost of items sold during period (to compute Gross Profit)
    const costStats = await query(
      `SELECT COALESCE(SUM(p.cost * oi.quantity), 0) AS total_cost
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products p ON oi.product_id = p.id
       WHERE o.created_at >= $1 AND o.created_at <= $2`,
      [startDate, endDate]
    );

    const totalSales = parseFloat(saleStats.rows[0].total_sales);
    const totalInvoices = parseInt(saleStats.rows[0].total_invoices);
    const totalDiscount = parseFloat(saleStats.rows[0].total_discount);
    const totalCost = parseFloat(costStats.rows[0].total_cost);
    const totalExpense = parseFloat(expenseStats.rows[0].total_expense);
    const totalRecovery = parseFloat(recoveryStats.rows[0].total_recovery);
    const vendorPayments = parseFloat(vendorPayStats.rows[0].vendor_payments);
    const totalPurchase = parseFloat(purchaseStats.rows[0].total_purchases);

    // FIX: Correct profit formulas
    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpense;

    // 2. Fetch Detailed Report Rows
    let reportData = [];
    if (type === 'itemwise') {
      const itemwiseRes = await query(
        `SELECT o.id AS order_id, o.created_at AS date, c.name AS customer_name,
                p.name AS product_name, oi.unit_price, oi.quantity, oi.discount, oi.total_price AS total
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN customers c ON o.customer_id = c.id
         JOIN products p ON oi.product_id = p.id
         WHERE o.created_at >= $1 AND o.created_at <= $2
         ORDER BY o.id DESC`,
        [startDate, endDate]
      );
      reportData = itemwiseRes.rows;
    } else {
      // default: summary
      const summaryRes = await query(
        `SELECT o.id AS order_id, o.created_at AS date, c.name AS customer_name,
                o.total_price, o.amount_paid, o.discount, o.status
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         WHERE o.created_at >= $1 AND o.created_at <= $2
         ORDER BY o.id DESC`,
        [startDate, endDate]
      );
      reportData = summaryRes.rows;
    }

    res.json({
      summary: {
        totalSale: totalSales,
        totalInvoice: totalInvoices,
        totalDiscount,
        totalCost,
        totalExpense,
        totalRecovery,
        vendorPayments,
        totalPurchase,
        grossProfit,
        netProfit
      },
      data: reportData
    });
  } catch (err) {
    console.error('Error fetching sales report:', err);
    res.status(500).json({ message: 'Error generating sales report' });
  }
};

// Stock Margin Report
const getStockReport = async (req, res) => {
  try {
    const stockRes = await query(`
      SELECT p.id, p.name AS product, p.barcode, c.name AS category,
             COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id AND deleted_at IS NULL), 0) AS total_qty,
             p.cost, p.price,
             (p.price - p.cost) AS margin_amount,
             CASE 
               WHEN p.price > 0 THEN ROUND(((p.price - p.cost) / p.price) * 100, 2)
               ELSE 0.00
             END AS margin_percent
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.name ASC
    `);

    let totalQty = 0;
    let totalCostVal = 0.00;
    let totalSaleVal = 0.00;

    stockRes.rows.forEach(r => {
      const qty = parseInt(r.total_qty);
      totalQty += qty;
      totalCostVal += qty * parseFloat(r.cost);
      totalSaleVal += qty * parseFloat(r.price);
    });

    res.json({
      data: stockRes.rows,
      totals: {
        totalQty,
        totalCost: totalCostVal,
        totalSale: totalSaleVal,
        totalMargin: totalSaleVal - totalCostVal
      }
    });
  } catch (err) {
    console.error('Error fetching stock report:', err);
    res.status(500).json({ message: 'Error compiling stock report' });
  }
};

// Fetch Audit Logs (Paginated)
const getAuditLogs = async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '15');
  const offset = (page - 1) * limit;

  try {
    const countRes = await query('SELECT COUNT(*) FROM audit_logs');
    const totalItems = parseInt(countRes.rows[0].count);

    const logsRes = await query(
      `SELECT a.*, u.name AS username
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      data: logsRes.rows,
      meta: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
};

module.exports = {
  getSalesReport,
  getStockReport,
  getAuditLogs
};
