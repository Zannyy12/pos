import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Search, Wallet, Landmark, Eye, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1, totalMarketBalance: 0 });

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteCustomer,
    confirmDelete: confirmDeleteCustomer,
    cancelDelete: cancelDeleteCustomer
  } = useDelete({
    endpoint: '/api/customers',
    label: 'Customer',
    onSuccess: () => fetchCustomers()
  });

  // Filters
  const [search, setSearch] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals & Drawers
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Customer Form states
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCnic, setCustCnic] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custBalance, setCustBalance] = useState('0.00');
  const [custSalesmanId, setCustSalesmanId] = useState('');

  // Payment Form states
  const [payBankId, setPayBankId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Ledger History states
  const [ledgerData, setLedgerData] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const { addToast } = useAuthStore();

  const fetchSalesmen = async () => {
    try {
      const res = await axios.get('/api/salesman', { params: { limit: 100 } });
      setSalesmen(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await axios.get('/api/banks');
      setBanks(res.data.banks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/customers', {
        params: {
          page,
          search,
          salesman_id: salesmanFilter,
          limit: 10
        }
      });
      setCustomers(res.data.data || []);
      setMeta(res.data.meta || { currentPage: 1, totalPages: 1, totalMarketBalance: 0 });
    } catch (err) {
      console.error(err);
      addToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
    fetchBanks();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [page, search, salesmanFilter]);

  const openAddModal = () => {
    setSelectedCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustCnic('');
    setCustAddress('');
    setCustBalance('0.00');
    setCustSalesmanId(salesmen[0]?.id || '');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setSelectedCustomer(c);
    setCustName(c.name);
    setCustPhone(c.phone || '');
    setCustCnic(c.cnic || '');
    setCustAddress(c.address || '');
    setCustBalance(c.balance);
    setCustSalesmanId(c.salesman_id || '');
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!custName.trim()) {
      addToast('Customer Name is required', 'warning');
      return;
    }

    const payload = {
      name: custName,
      phone: custPhone || null,
      cnic: custCnic || null,
      address: custAddress || null,
      balance: parseFloat(custBalance),
      salesman_id: custSalesmanId ? parseInt(custSalesmanId) : null
    };

    try {
      if (selectedCustomer) {
        await axios.put(`/api/customers/${selectedCustomer.id}`, payload);
        addToast('Customer profile updated', 'success');
      } else {
        await axios.post('/api/customers', payload);
        addToast('New customer added', 'success');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving customer', 'error');
    }
  };

  const handleDeleteCustomer = (id, name) => {
    triggerDeleteCustomer(id, name);
  };

  const openPaymentDrawer = (c) => {
    setSelectedCustomer(c);
    setPayBankId(banks[0]?.id || '');
    setPayAmount('');
    setPayNote('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPaymentOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payBankId || !payAmount || parseFloat(payAmount) <= 0) {
      addToast('Please choose bank and valid amount', 'warning');
      return;
    }

    try {
      await axios.post('/api/payments/customer', {
        customer_id: selectedCustomer.id,
        bank_id: parseInt(payBankId),
        amount: parseFloat(payAmount),
        note: payNote,
        date: payDate
      });
      addToast('Customer recovery payment recorded', 'success');
      setPaymentOpen(false);
      fetchCustomers();
      fetchBanks(); // Update bank balances
    } catch (err) {
      addToast(err.response?.data?.message || 'Error recording payment', 'error');
    }
  };

  const openLedgerDrawer = async (c) => {
    setSelectedCustomer(c);
    setLoadingLedger(true);
    setLedgerOpen(true);
    try {
      const res = await axios.get(`/api/customers/${c.id}/ledger`);
      setLedgerData(res.data.ledger || []);
    } catch (err) {
      addToast('Error loading ledger records', 'error');
    } finally {
      setLoadingLedger(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="customers-page">
      {/* Header Row */}
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Customers & Receivables</h1>
          <p>Register credit clients and track payment receipts</p>
        </div>
        
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* Stats Summary Box */}
      <div className="grid alert-row" style={{ gridTemplateColumns: '1fr', marginBottom: '20px' }}>
        <div className="glass-card flex-between" style={{ padding: '20px 24px' }}>
          <div>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>Total Outstanding Market Receivables</h3>
            <h2 style={{ fontSize: '28px', color: 'var(--danger)', fontWeight: 700, marginTop: '4px' }}>
              {formatCurrency(meta.totalMarketBalance)}
            </h2>
          </div>
          <div className="alert-icon-wrapper danger-bg">
            <Wallet size={24} className="danger-color" />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div className="grid grid-3" style={{ gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Client</label>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="form-input"
                placeholder="Search name, phone, CNIC..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter Salesman</label>
            <select
              className="form-input"
              value={salesmanFilter}
              onChange={(e) => { setSalesmanFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Salesmen</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex" style={{ alignSelf: 'flex-end', height: '42px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSearch(''); setSalesmanFilter(''); setPage(1); }}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="flex-center" style={{ height: '30vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Salesman</th>
                <th style={{ textAlign: 'right' }}>Outstanding Balance</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.phone || 'N/A'}</td>
                  <td>{c.address || 'N/A'}</td>
                  <td>{c.salesman_name || 'None'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: parseFloat(c.balance) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatCurrency(c.balance)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openLedgerDrawer(c)} title="View Ledger Report">
                        <Eye size={14} />
                        Ledger
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => openPaymentDrawer(c)} title="Record Payment">
                        <Landmark size={14} />
                        Pay
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(c)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCustomer(c.id, c.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No customers found</td>
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

      {/* Customer profile modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedCustomer ? 'Edit Client Details' : 'Register Credit Client'}</h3>
              <button className="theme-toggle-btn" onClick={() => setModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Al-Madina Super Store"
                  required
                />
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="e.g. 03001234567"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CNIC (ID Card)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={custCnic}
                    onChange={(e) => setCustCnic(e.target.value)}
                    placeholder="e.g. 42101-1234567-1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="e.g. Shop # 2, Tariq Road, Karachi"
                />
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={custBalance}
                    onChange={(e) => setCustBalance(e.target.value)}
                    disabled={!!selectedCustomer} // Opening balance can only be set initially
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Linked Salesman</label>
                  <select
                    className="form-input"
                    value={custSalesmanId}
                    onChange={(e) => setCustSalesmanId(e.target.value)}
                  >
                    <option value="">No Salesman</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Drawer */}
      {paymentOpen && (
        <div className="drawer-overlay" onClick={() => setPaymentOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between drawer-header">
              <div>
                <h3>Record Recovery Payment</h3>
                <p style={{ fontSize: '13px' }}>Client: {selectedCustomer?.name}</p>
              </div>
              <button className="theme-toggle-btn" onClick={() => setPaymentOpen(false)} style={{ border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Deposit To Account *</label>
                <select
                  className="form-input"
                  value={payBankId}
                  onChange={(e) => setPayBankId(e.target.value)}
                  required
                >
                  <option value="">Select bank account</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} (Bal: {formatCurrency(b.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Received Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Memo / Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Cheque details, online reference, etc."
                />
              </div>

              <div className="flex" style={{ marginTop: 'auto', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Recovery</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Drawer */}
      {ledgerOpen && (
        <div className="drawer-overlay" onClick={() => setLedgerOpen(false)}>
          <div className="drawer-content" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between drawer-header">
              <div>
                <h3>Client Ledger Report</h3>
                <p style={{ fontSize: '13px' }}>Statement history for: {selectedCustomer?.name}</p>
              </div>
              <button className="theme-toggle-btn" onClick={() => setLedgerOpen(false)} style={{ border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body" style={{ padding: '20px' }}>
              {loadingLedger ? (
                <div className="flex-center" style={{ height: '50vh' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '70vh', overflowY: 'auto', marginTop: 0 }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Debit (Invoice)</th>
                        <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                        <th style={{ textAlign: 'right' }}>Running Bal</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${item.type.startsWith('Invoice') ? 'badge-info' : item.type.startsWith('Refund') ? 'badge-warning' : 'badge-success'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: item.debit > 0 ? 'var(--text-main)' : 'transparent' }}>
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: item.credit > 0 ? 'var(--success)' : 'transparent' }}>
                            {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: item.running_balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {formatCurrency(item.running_balance)}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.details}</td>
                        </tr>
                      ))}
                      {ledgerData.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No statement history registered</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <button className="btn btn-secondary" onClick={() => setLedgerOpen(false)}>Close Statement</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .search-input-wrapper { position: relative; }
        .search-input-wrapper .form-input { padding-left: 38px; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={cancelDeleteCustomer}
        onConfirm={confirmDeleteCustomer}
        itemName={deleteName}
        title="Delete Customer Profile"
        message={`Are you sure you want to delete customer "${deleteName}"? This will soft-delete their profile.`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Customers;
