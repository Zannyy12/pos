import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Search, Wallet, Landmark, Eye, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1, totalVendorBalance: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals & Drawers
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Vendor Form states
  const [vendName, setVendName] = useState('');
  const [vendPhone, setVendPhone] = useState('');
  const [vendAddress, setVendAddress] = useState('');
  const [vendBalance, setVendBalance] = useState('0.00');

  // Payment Form states
  const [payBankId, setPayBankId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Ledger History states
  const [ledgerData, setLedgerData] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const { addToast } = useAuthStore();

  const fetchBanks = async () => {
    try {
      const res = await axios.get('/api/banks');
      setBanks(res.data.banks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/vendors', {
        params: { page, search, limit: 10 }
      });
      setVendors(res.data.data || []);
      setMeta(res.data.meta || { currentPage: 1, totalPages: 1, totalVendorBalance: 0 });
    } catch (err) {
      console.error(err);
      addToast('Failed to load vendors list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteVendor,
    confirmDelete: confirmDeleteVendor,
    cancelDelete: cancelDeleteVendor
  } = useDelete({
    endpoint: '/api/vendors',
    label: 'Vendor',
    onSuccess: () => fetchVendors()
  });

  useEffect(() => {
    fetchBanks();
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [page, search]);

  const openAddModal = () => {
    setSelectedVendor(null);
    setVendName('');
    setVendPhone('');
    setVendAddress('');
    setVendBalance('0.00');
    setModalOpen(true);
  };

  const openEditModal = (v) => {
    setSelectedVendor(v);
    setVendName(v.name);
    setVendPhone(v.phone || '');
    setVendAddress(v.address || '');
    setVendBalance(v.balance);
    setModalOpen(true);
  };

  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!vendName.trim()) {
      addToast('Vendor name is required', 'warning');
      return;
    }

    const payload = {
      name: vendName,
      phone: vendPhone || null,
      address: vendAddress || null,
      balance: parseFloat(vendBalance)
    };

    try {
      if (selectedVendor) {
        await axios.put(`/api/vendors/${selectedVendor.id}`, payload);
        addToast('Vendor profile updated', 'success');
      } else {
        await axios.post('/api/vendors', payload);
        addToast('New vendor profile created', 'success');
      }
      setModalOpen(false);
      fetchVendors();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving vendor details', 'error');
    }
  };

  const handleDeleteVendor = (id, name) => {
    triggerDeleteVendor(id, name);
  };

  const openPaymentDrawer = (v) => {
    setSelectedVendor(v);
    setPayBankId(banks[0]?.id || '');
    setPayAmount('');
    setPayNote('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPaymentOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payBankId || !payAmount || parseFloat(payAmount) <= 0) {
      addToast('Please select bank and enter a valid amount', 'warning');
      return;
    }

    try {
      await axios.post('/api/payments/vendor', {
        vendor_id: selectedVendor.id,
        bank_id: parseInt(payBankId),
        amount: parseFloat(payAmount),
        note: payNote,
        date: payDate
      });
      addToast('Vendor payment logged successfully', 'success');
      setPaymentOpen(false);
      fetchVendors();
      fetchBanks();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error recording vendor payment', 'error');
    }
  };

  const openLedgerDrawer = async (v) => {
    setSelectedVendor(v);
    setLoadingLedger(true);
    setLedgerOpen(true);
    try {
      const res = await axios.get(`/api/vendors/${v.id}/ledger`);
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
    <div className="vendors-page">
      {/* Header Row */}
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Suppliers & Payables</h1>
          <p>Register distributors and track purchase payouts</p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add Vendor
        </button>
      </div>

      {/* Stats Box */}
      <div className="grid alert-row" style={{ gridTemplateColumns: '1fr', marginBottom: '20px' }}>
        <div className="glass-card flex-between" style={{ padding: '20px 24px' }}>
          <div>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>Total Outstanding Vendor Payables</h3>
            <h2 style={{ fontSize: '28px', color: 'var(--danger)', fontWeight: 700, marginTop: '4px' }}>
              {formatCurrency(meta.totalVendorBalance)}
            </h2>
          </div>
          <div className="alert-icon-wrapper danger-bg">
            <Wallet size={24} className="danger-color" />
          </div>
        </div>
      </div>

      {/* Filters Box */}
      <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div className="grid grid-2" style={{ gap: '16px', maxWidth: '800px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Vendor</label>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search className="search-icon" size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Search vendor name, phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="flex" style={{ alignSelf: 'flex-end', height: '42px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSearch(''); setPage(1); }}>
              Reset Filters
            </button>
          </div>
        </div>
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
                <th>Vendor ID</th>
                <th>Supplier Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Outstanding Debt</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td>{v.phone || 'N/A'}</td>
                  <td>{v.address || 'N/A'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: parseFloat(v.balance) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatCurrency(v.balance)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openLedgerDrawer(v)} title="View statement ledger">
                        <Eye size={14} />
                        Ledger
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => openPaymentDrawer(v)} title="Log Payout">
                        <Landmark size={14} />
                        Pay
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(v)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteVendor(v.id, v.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No vendors profile found</td>
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

      {/* Vendor Profile Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedVendor ? 'Edit Supplier Details' : 'Register Supplier / Vendor'}</h3>
              <button className="theme-toggle-btn" onClick={() => setModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Vendor / Company Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={vendName}
                  onChange={(e) => setVendName(e.target.value)}
                  placeholder="e.g. Nestle Pakistan Ltd."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={vendPhone}
                  onChange={(e) => setVendPhone(e.target.value)}
                  placeholder="e.g. 021-3111222"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Office Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={vendAddress}
                  onChange={(e) => setVendAddress(e.target.value)}
                  placeholder="e.g. Plot # 45, Korangi Industrial Area, Karachi"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Opening Balance (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={vendBalance}
                  onChange={(e) => setVendBalance(e.target.value)}
                  disabled={!!selectedVendor}
                />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payout Drawer */}
      {paymentOpen && (
        <div className="drawer-overlay" onClick={() => setPaymentOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between drawer-header">
              <div>
                <h3>Record Supplier Payout</h3>
                <p style={{ fontSize: '13px' }}>Supplier: {selectedVendor?.name}</p>
              </div>
              <button className="theme-toggle-btn" onClick={() => setPaymentOpen(false)} style={{ border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Withdraw From Account *</label>
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
                <label className="form-label">Payment Amount *</label>
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
                  placeholder="Bank transfer receipt ID, check number..."
                />
              </div>

              <div className="flex" style={{ marginTop: 'auto', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Payout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Statement Drawer */}
      {ledgerOpen && (
        <div className="drawer-overlay" onClick={() => setLedgerOpen(false)}>
          <div className="drawer-content" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between drawer-header">
              <div>
                <h3>Supplier Ledger Report</h3>
                <p style={{ fontSize: '13px' }}>Statement history: {selectedVendor?.name}</p>
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
                        <th style={{ textAlign: 'right' }}>Debit (Paid)</th>
                        <th style={{ textAlign: 'right' }}>Credit (Purchase)</th>
                        <th style={{ textAlign: 'right' }}>Running Bal</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.map((item, idx) => (
                        <tr key={idx}>
                          <td>{new Date(item.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${item.type.startsWith('Purchase') ? 'badge-info' : item.type.startsWith('Return') ? 'badge-warning' : 'badge-success'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: item.debit > 0 ? 'var(--success)' : 'transparent' }}>
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: item.credit > 0 ? 'var(--text-main)' : 'transparent' }}>
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

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={cancelDeleteVendor}
        onConfirm={confirmDeleteVendor}
        itemName={deleteName}
        title="Delete Vendor Profile"
        message={`Are you sure you want to delete vendor "${deleteName}"? This will soft-delete their profile.`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Vendors;
