import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Landmark, Eye, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Banks = () => {
  const [banks, setBanks] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteBank,
    confirmDelete: confirmDeleteBank,
    cancelDelete: cancelDeleteBank
  } = useDelete({
    endpoint: '/api/banks',
    label: 'Bank Account',
    onSuccess: () => fetchBanks()
  });

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);

  // Bank Form
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0.00');

  // Ledger state
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerMeta, setLedgerMeta] = useState({ currentPage: 1, totalPages: 1 });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const { addToast, user } = useAuthStore();

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/banks');
      setBanks(res.data.banks || []);
      setTotalBalance(res.data.totalBalance || 0);
    } catch (err) {
      addToast('Error loading bank accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const openAddModal = () => {
    setSelectedBank(null);
    setName('');
    setBalance('0.00');
    setModalOpen(true);
  };

  const openEditModal = (b) => {
    setSelectedBank(b);
    setName(b.name);
    setBalance(b.balance);
    setModalOpen(true);
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (selectedBank) {
        await axios.put(`/api/banks/${selectedBank.id}`, { name, balance: parseFloat(balance) });
        addToast('Bank account updated', 'success');
      } else {
        await axios.post('/api/banks', { name, balance: parseFloat(balance) });
        addToast('New bank account created', 'success');
      }
      setModalOpen(false);
      fetchBanks();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving bank account', 'error');
    }
  };

  const handleDeleteBank = (id, name) => {
    triggerDeleteBank(id, name);
  };

  const openLedgerDrawer = async (b, pageNum = 1) => {
    setSelectedBank(b);
    setLoadingLedger(true);
    setLedgerOpen(true);
    setLedgerPage(pageNum);
    try {
      const res = await axios.get(`/api/banks/${b.id}/ledger`, {
        params: { page: pageNum, limit: 15 }
      });
      setLedgerData(res.data.data || []);
      setLedgerMeta(res.data.meta || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      addToast('Error loading bank transaction history', 'error');
    } finally {
      setLoadingLedger(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="banks-page">
      {/* Header */}
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Financial Accounts</h1>
          <p>Configure bank accounts, cash drawers, and track ledger statements</p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Create Account
        </button>
      </div>

      {/* Summary Stat */}
      <div className="grid alert-row" style={{ gridTemplateColumns: '1fr', marginBottom: '24px' }}>
        <div className="glass-card flex-between" style={{ padding: '20px 24px' }}>
          <div>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>Total Consolidated Financial Balance</h3>
            <h2 style={{ fontSize: '28px', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
              {formatCurrency(totalBalance)}
            </h2>
          </div>
          <div className="alert-icon-wrapper warning-bg" style={{ backgroundColor: 'var(--primary-light)' }}>
            <Landmark size={24} style={{ color: 'var(--primary)' }} />
          </div>
        </div>
      </div>

      {/* Grid of Bank Cards */}
      {loading ? (
        <div className="flex-center" style={{ height: '30vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="grid grid-3 banks-cards-grid">
          {banks.map((b) => (
            <div key={b.id} className="glass-card stat-card interactive" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
              <div className="flex-between">
                <div className="flex" style={{ gap: '10px' }}>
                  <div className="stat-icon-container" style={{ width: '38px', height: '38px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                    <Landmark size={18} />
                  </div>
                  <h3 style={{ fontSize: '16px' }}>{b.name}</h3>
                </div>
                <span className="badge badge-success">Active</span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Account Balance</span>
                <h2 style={{ color: parseFloat(b.balance) < 0 ? 'var(--danger)' : 'var(--text-main)', fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>
                  {formatCurrency(b.balance)}
                </h2>
              </div>

              <div className="flex" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openLedgerDrawer(b, 1)}>
                  <Eye size={12} />
                  Statement
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(b)}>
                  <Edit2 size={12} />
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBank(b.id, b.name)} disabled={b.name === 'Cash in Hand'}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {banks.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', gridColumn: 'span 3', padding: '24px 0' }}>No bank accounts registered</p>
          )}
        </div>
      )}

      {/* Bank Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedBank ? 'Edit Account' : 'Setup Bank / Cash Account'}</h3>
              <button className="theme-toggle-btn" onClick={() => setModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBank} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Account Title Name *</label>
                <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Allied Bank (Main)" required />
              </div>

              <div className="form-group">
                <label className="form-label">Opening Balance (PKR) *</label>
                <input type="number" step="0.01" className="form-input" value={balance} onChange={(e) => setBalance(e.target.value)} required disabled={!!selectedBank && user?.role !== 'Admin'} />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Account</button>
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
                <h3>Bank Statement Ledger</h3>
                <p style={{ fontSize: '13px' }}>Account: {selectedBank?.name}</p>
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
                <>
                  <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 0 }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ref ID</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.map((item, idx) => (
                          <tr key={idx}>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td>{item.reference_id || '-'}</td>
                            <td>
                              <span className={`badge ${item.type === 'credit' ? 'badge-success' : 'badge-danger'}`}>
                                {item.type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>{item.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: item.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                        {ledgerData.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No transactions registered on this account</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {ledgerMeta.totalPages > 1 && (
                    <div className="flex-between" style={{ marginTop: '16px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {ledgerMeta.currentPage} of {ledgerMeta.totalPages}</span>
                      <div className="flex" style={{ gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" disabled={ledgerPage === 1} onClick={() => openLedgerDrawer(selectedBank, ledgerPage - 1)}>Prev</button>
                        <button className="btn btn-secondary btn-sm" disabled={ledgerPage === ledgerMeta.totalPages} onClick={() => openLedgerDrawer(selectedBank, ledgerPage + 1)}>Next</button>
                      </div>
                    </div>
                  )}
                </>
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
        onClose={cancelDeleteBank}
        onConfirm={confirmDeleteBank}
        itemName={deleteName}
        title="Delete Bank Account"
        message={`Are you sure you want to delete bank account "${deleteName}"?`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Banks;
