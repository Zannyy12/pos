import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Search, Calendar, Landmark, ArrowUpDown, Wallet } from 'lucide-react';

const SalesReport = () => {
  const [orders, setOrders] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Stats
  const [totals, setTotals] = useState({ netSales: 0, totalDiscount: 0, totalOutstanding: 0 });

  const { addToast } = useAuthStore();

  const fetchSalesmen = async () => {
    try {
      const res = await axios.get('/api/salesman', { params: { limit: 100 } });
      setSalesmen(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/orders/report/sales-ledger', {
        params: {
          search,
          salesman_id: salesmanId,
          from_date: fromDate,
          to_date: toDate,
          sort_field: sortField,
          sort_order: sortOrder
        }
      });
      setOrders(res.data.orders || []);
      setTotals(res.data.totals || { netSales: 0, totalDiscount: 0, totalOutstanding: 0 });
    } catch (err) {
      console.error(err);
      addToast('Failed to load sales report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [search, salesmanId, fromDate, toDate, sortField, sortOrder]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="sales-report-page">
      <div className="header-row" style={{ marginBottom: '24px' }}>
        <h1 className="welcome-headline">Sales Reports & Ledgers</h1>
        <p>Analyze transaction logs, profit yields, discounts, and receivables</p>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-3 stats-grid" style={{ marginBottom: '20px' }}>
        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Net Sales Volume</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(totals.netSales)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Discounts Given</span>
            <span className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(totals.totalDiscount)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Added Receivables</span>
            <span className="stat-value" style={{ color: 'var(--warning)' }}>{formatCurrency(totals.totalOutstanding)}</span>
          </div>
        </div>
      </div>

      {/* Filters Box */}
      <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div className="grid grid-4" style={{ gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Client</label>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search className="search-icon" size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Customer or Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter Salesman</label>
            <select className="form-input" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
              <option value="">All Salesmen</option>
              {salesmen.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="flex" style={{ justifyContent: 'flex-end', marginTop: '14px', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setSalesmanId(''); setFromDate(''); setToDate(''); }}>
            Reset Filters
          </button>
        </div>
      </div>

      {/* Report Table */}
      {loading ? (
        <div className="flex-center" style={{ height: '30vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>
                  <div className="flex" style={{ gap: '6px' }}>Invoice ID <ArrowUpDown size={14} /></div>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                  <div className="flex" style={{ gap: '6px' }}>Date <ArrowUpDown size={14} /></div>
                </th>
                <th>Customer</th>
                <th>Salesman</th>
                <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('total')}>
                  <div className="flex" style={{ justifyContent: 'flex-end', gap: '6px' }}>Net Total <ArrowUpDown size={14} /></div>
                </th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Debt Balance</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const debt = parseFloat(o.total) - parseFloat(o.amount_paid);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.id}</td>
                    <td>{new Date(o.date).toLocaleDateString()}</td>
                    <td>{o.customer_name || 'Walk-in Customer'}</td>
                    <td>{o.salesman_name || 'None'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(o.total)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(o.amount_paid)}</td>
                    <td style={{ textAlign: 'right', color: debt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {debt > 0 ? formatCurrency(debt) : '-'}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No reports match the selected filters</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
