import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import {
  TrendingUp, CreditCard, ShoppingBag, Users, Landmark,
  ArrowDownRight, RefreshCw, AlertTriangle, PackageX
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartType, setChartType] = useState('Area');

  const fetchStats = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await axios.get('/api/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchStats(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        <p style={{ marginTop: '16px' }}>Loading business dashboard stats...</p>
      </div>
    );
  }

  const statCards = [
    { title: "Today's Sales", value: stats?.todaySales || 0, icon: TrendingUp, color: 'var(--primary)', isCurrency: true },
    { title: "Today's Expenses", value: stats?.todayExpenses || 0, icon: CreditCard, color: 'var(--danger)', isCurrency: true },
    { title: "Today's Purchases", value: stats?.todayPurchases || 0, icon: ShoppingBag, color: 'var(--info)', isCurrency: true },
    { title: "Today's Invoices", value: stats?.todayInvoices || 0, icon: RefreshCw, color: 'var(--success)', isCurrency: false },
    { title: "Today's Recovery", value: stats?.recovery || 0, icon: ArrowDownRight, color: 'var(--success)', isCurrency: true },
    { title: "Market Receivables", value: stats?.customerBalanceTotal || 0, icon: Users, color: 'var(--warning)', isCurrency: true },
    { title: "Vendor Payables", value: stats?.vendorBalanceTotal || 0, icon: Landmark, color: 'var(--danger)', isCurrency: true },
    { title: "Active Staff Profiles", value: stats?.activeUsers || 0, icon: Users, color: 'var(--primary)', isCurrency: false },
  ];

  return (
    <div className="dashboard-page">
      {/* Top action row */}
      <div className="flex-between dashboard-header-row">
        <div>
          <h1 className="welcome-headline">Sales Dashboard</h1>
          <p>Real-time updates of Khuzdar POS operations</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchStats(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
          {refreshing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Warning Row for low stock & out of stock */}
      <div className="grid grid-2 alert-row">
        <div className="glass-card stock-alert-card short-stock">
          <div className="alert-icon-wrapper warning-bg">
            <AlertTriangle size={24} className="warning-color" />
          </div>
          <div>
            <h3>Low Stock Products</h3>
            <p className="alert-count">{stats?.shortStockCount} items under limits</p>
          </div>
        </div>

        <div className="glass-card stock-alert-card out-of-stock">
          <div className="alert-icon-wrapper danger-bg">
            <PackageX size={24} className="danger-color" />
          </div>
          <div>
            <h3>Out of Stock Products</h3>
            <p className="alert-count red-count">{stats?.outOfStockCount} items empty</p>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-4 stats-grid">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-card stat-card interactive">
              <div className="stat-icon-container" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                <Icon size={22} />
              </div>
              <div className="stat-content">
                <span className="stat-title">{card.title}</span>
                <span className="stat-value">
                  {card.isCurrency ? formatCurrency(card.value) : card.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts & Analytics */}
      <div className="grid chart-section" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Sales Overview Chart */}
        <div className="glass-card chart-card">
          <div className="flex-between chart-header">
            <h3>Sales Overview</h3>
            <div className="chart-controls">
              <button 
                className={`chart-btn ${chartType === 'Area' ? 'active' : ''}`}
                onClick={() => setChartType('Area')}
              >
                Area
              </button>
              <button 
                className={`chart-btn ${chartType === 'Bar' ? 'active' : ''}`}
                onClick={() => setChartType('Bar')}
              >
                Bar
              </button>
            </div>
          </div>
          
          <div className="chart-container" style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'Area' ? (
                <AreaChart data={stats?.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)', borderRadius: '12px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="var(--primary)" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                </AreaChart>
              ) : (
                <BarChart data={stats?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)', borderRadius: '12px' }} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="var(--info)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Selling Products */}
        <div className="glass-card products-leaderboard-card">
          <h3>Most Selling Products</h3>
          <div className="mini-table-container">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Sold</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topProducts?.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{p.qty_sold}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
                {(!stats?.topProducts || stats.topProducts.length === 0) && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No sales recorded today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Customers and Top Vendors Row */}
      <div className="grid grid-2 dashboard-bottom-row">
        {/* Top Customers */}
        <div className="glass-card">
          <h3>Top Customers</h3>
          <div className="mini-table-container">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th style={{ textAlign: 'right' }}>Total Spent</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topCustomers?.map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(c.total_spent)}</td>
                    <td style={{ textAlign: 'right', color: parseFloat(c.balance) < 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {formatCurrency(c.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Vendors */}
        <div className="glass-card">
          <h3>Top Vendors</h3>
          <div className="mini-table-container">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th style={{ textAlign: 'right' }}>Purchased Value</th>
                  <th style={{ textAlign: 'right' }}>Our Balance</th>
                </tr>
              </thead>
              <tbody>
                {stats?.topVendors?.map((v, i) => (
                  <tr key={i}>
                    <td>{v.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(v.total_purchased)}</td>
                    <td style={{ textAlign: 'right', color: parseFloat(v.balance) < 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {formatCurrency(v.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-header-row {
          margin-bottom: 24px;
        }

        .welcome-headline {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.5px;
        }

        .alert-row {
          margin-bottom: 24px;
        }

        .stock-alert-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 24px;
        }

        .alert-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .warning-bg { background-color: var(--warning-light); }
        .danger-bg { background-color: var(--danger-light); }
        
        .warning-color { color: var(--warning); }
        .danger-color { color: var(--danger); }

        .alert-count {
          font-size: 22px;
          font-weight: 700;
          color: var(--warning);
          margin-top: 2px;
        }

        .red-count {
          color: var(--danger);
        }

        .stats-grid {
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
        }

        .stat-icon-container {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .stat-title {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .stat-value {
          font-size: clamp(14px, 1.4vw, 18px);
          font-weight: 700;
          color: var(--text-main);
          word-break: break-all;
          margin-top: 2px;
        }

        .chart-section {
          margin-bottom: 24px;
        }

        .chart-header {
          margin-bottom: 20px;
        }

        .chart-controls {
          display: flex;
          background-color: var(--border-color);
          padding: 3px;
          border-radius: var(--radius-sm);
        }

        .chart-btn {
          background: none;
          border: none;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-muted);
        }

        .chart-btn.active {
          background-color: var(--bg-sidebar);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .spin-animation {
          animation: spin 1.2s linear infinite;
        }

        .mini-table-container {
          overflow-x: auto;
          margin-top: 16px;
        }

        .mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .mini-table th {
          padding: 10px 12px;
          text-align: left;
          color: var(--primary);
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
        }

        .mini-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-main);
        }

        .mini-table tbody tr:hover {
          background-color: var(--primary-light);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
