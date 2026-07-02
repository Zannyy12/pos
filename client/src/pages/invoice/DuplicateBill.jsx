import React, { useEffect, useState, useRef } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Search, Printer, Eye, X, Calendar } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { ReceiptPrintTemplate } from '../invoice/Invoice';

const DuplicateBill = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1 });

  // Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

  const printRef = useRef(null);
  const { addToast } = useAuthStore();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/orders', {
        params: {
          page,
          search,
          from_date: fromDate,
          to_date: toDate,
          limit: 10
        }
      });
      setOrders(res.data.data || []);
      setMeta(res.data.meta || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      console.error(err);
      addToast('Error loading invoices history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, fromDate, toDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleReset = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const openReprintReceipt = (order) => {
    setSelectedOrder(order);
    setReceiptOpen(true);
  };

  const openViewDetails = (order) => {
    setSelectedOrder(order);
    setViewDetailsOpen(true);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  // Convert order format to match receipt template expectance
  const getReceiptOrderData = () => {
    if (!selectedOrder) return null;
    return {
      orderId: selectedOrder.id,
      subtotal: parseFloat(selectedOrder.total_price) + parseFloat(selectedOrder.discount),
      discount: parseFloat(selectedOrder.discount),
      total: parseFloat(selectedOrder.total_price),
      amount_paid: parseFloat(selectedOrder.amount_paid),
      change: parseFloat(selectedOrder.amount_paid) - parseFloat(selectedOrder.total_price)
    };
  };

  return (
    <div className="duplicate-bill-page">
      <div className="header-row" style={{ marginBottom: '24px' }}>
        <h1 className="welcome-headline">Duplicate Invoices & Reprint</h1>
        <p>Browse past sales bills, view item break-downs, and print duplicates</p>
      </div>

      {/* Filter panel */}
      <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} className="grid grid-4" style={{ gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Keyword</label>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search className="search-icon" size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Invoice ID or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="flex" style={{ gap: '10px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }}>Filter</button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset}>Reset</button>
          </div>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex-center" style={{ height: '30vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const balanceDue = parseFloat(o.total_price) - parseFloat(o.amount_paid);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>#{o.id}</td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>{o.customer_name || 'Walk-in Customer'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(o.total_price)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(o.amount_paid)}</td>
                    <td style={{ textAlign: 'right', color: balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {balanceDue > 0 ? formatCurrency(balanceDue) : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openViewDetails(o)} title="View Items list">
                          <Eye size={14} />
                          Details
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => openReprintReceipt(o)} title="Reprint 80mm Receipt">
                          <Printer size={14} />
                          Reprint
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No invoices found matching criteria</td>
                </tr>
              )}
            </tbody>
          </table>

          {meta.totalPages > 1 && (
            <div className="flex-between pagination-row" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {meta.currentPage} of {meta.totalPages}</span>
              <div className="flex" style={{ gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
                <button className="btn btn-secondary btn-sm" disabled={page === meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Items Details Modal */}
      {viewDetailsOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setViewDetailsOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Invoice Items (Bill #{selectedOrder.id})</h3>
              <button className="theme-toggle-btn" onClick={() => setViewDetailsOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <table className="custom-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right' }}>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(item.discount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency((parseFloat(item.unit_price) - parseFloat(item.discount)) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setViewDetailsOpen(false)}>Close Window</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Thermal Receipt Modal */}
      {receiptOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setReceiptOpen(false)}>
          <div className="modal-content" style={{ width: 'auto', maxWidth: '90mm', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>Reprint Invoice #{selectedOrder.id}</h3>
              <button className="theme-toggle-btn" onClick={() => setReceiptOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <div className="receipt-preview-box" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: '#fff', maxHeight: '60vh', overflowY: 'auto' }}>
              <ReceiptPrintTemplate
                ref={printRef}
                order={getReceiptOrderData()}
                items={selectedOrder.items || []}
                customer={{ name: selectedOrder.customer_name }}
                cashier="Reprint Service"
              />
            </div>

            <div className="flex" style={{ marginTop: '16px', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReceiptOpen(false)}>
                Close Panel
              </button>
              <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={handlePrint}>
                <Printer size={16} />
                Print Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicateBill;
