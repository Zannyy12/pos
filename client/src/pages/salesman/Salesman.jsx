import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Search, Wallet, BarChart3, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Salesman = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1 });



  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const { addToast } = useAuthStore();

  const fetchSalesmen = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/salesman', {
        params: { page, search, limit: 10 }
      });
      setSalesmen(res.data.data || []);
      setMeta(res.data.meta || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      addToast('Error fetching salesmen list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteSalesman,
    confirmDelete: confirmDeleteSalesman,
    cancelDelete: cancelDeleteSalesman
  } = useDelete({
    endpoint: '/api/salesman',
    label: 'Salesman',
    onSuccess: () => fetchSalesmen()
  });

  const fetchCommissionReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/salesman/report/commission');
      setReportData(res.data || []);
    } catch (err) {
      addToast('Error compiling commission reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchSalesmen();
    } else {
      fetchCommissionReport();
    }
  }, [page, search, activeTab]);

  const openAddModal = () => {
    setSelectedSalesman(null);
    setName('');
    setPhone('');
    setAddress('');
    setModalOpen(true);
  };

  const openEditModal = (s) => {
    setSelectedSalesman(s);
    setName(s.name);
    setPhone(s.phone || '');
    setAddress(s.address || '');
    setModalOpen(true);
  };

  const handleSaveSalesman = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Salesman name is required', 'warning');
      return;
    }

    try {
      if (selectedSalesman) {
        await axios.put(`/api/salesman/${selectedSalesman.id}`, { name, phone, address });
        addToast('Salesman profile updated', 'success');
      } else {
        await axios.post('/api/salesman', { name, phone, address });
        addToast('New salesman registered successfully', 'success');
      }
      setModalOpen(false);
      fetchSalesmen();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving salesman details', 'error');
    }
  };

  const handleDeleteSalesman = (id, name) => {
    triggerDeleteSalesman(id, name);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="salesman-page">
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Sales Staff</h1>
          <p>Register recovery recovery agents and review commission progress</p>
        </div>

        {activeTab === 'list' && (
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            Add Salesman
          </button>
        )}
      </div>

      <div className="tabs-container" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Salesmen Profiles
        </button>
        <button
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Commission Reports
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* Search Box */}
          <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: '400px' }}>
              <label className="form-label">Search Salesman</label>
              <div className="search-input-wrapper" style={{ position: 'relative' }}>
                <Search className="search-icon" size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  placeholder="Search name or contact..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
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
                    <th>ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salesmen.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.phone || 'N/A'}</td>
                      <td>{s.address || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(s)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSalesman(s.id, s.name)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {salesmen.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No salesmen profiles found</td>
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
        </>
      ) : (
        /* Commission Report */
        <>
          {loading ? (
            <div className="flex-center" style={{ height: '30vh' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
            </div>
          ) : (
            <div className="table-container" style={{ marginTop: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Salesman ID</th>
                    <th>Salesman Name</th>
                    <th>Contact Phone</th>
                    <th style={{ textAlign: 'center' }}>Total Clients Linked</th>
                    <th style={{ textAlign: 'right' }}>Accumulated Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>{row.phone || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{row.total_customers}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(row.total_sales)}
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No statistics recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedSalesman ? 'Edit Salesman Profile' : 'Register Sales Staff'}</h3>
              <button className="theme-toggle-btn" onClick={() => setModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSalesman} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asif Raza"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 03219876543"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Gulshan-e-Iqbal, Karachi"
                />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Salesman</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .tabs-container .tab-btn {
          background: none;
          border: none;
          padding: 12px 20px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
        }
        .tabs-container .tab-btn:hover { color: var(--primary); }
        .tabs-container .tab-btn.active { color: var(--primary); }
        .tabs-container .tab-btn.active::after {
          content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background-color: var(--primary);
        }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={cancelDeleteSalesman}
        onConfirm={confirmDeleteSalesman}
        itemName={deleteName}
        title="Delete Salesman Profile"
        message={`Are you sure you want to delete salesman "${deleteName}"? This will soft-delete their profile.`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Salesman;
