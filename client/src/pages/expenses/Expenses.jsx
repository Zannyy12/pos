import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Search, X, Calendar } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Expenses = () => {
  const [activeTab, setActiveTab] = useState('expenses');
  const [loading, setLoading] = useState(true);

  const {
    isOpen: deleteExpenseOpen,
    selectedName: deleteExpenseName,
    loading: deleteExpenseLoading,
    triggerDelete: triggerDeleteExpense,
    confirmDelete: confirmDeleteExpense,
    cancelDelete: cancelDeleteExpense
  } = useDelete({
    endpoint: '/api/expenses',
    label: 'Expense',
    onSuccess: () => fetchExpenses()
  });

  const {
    isOpen: deleteTypeOpen,
    selectedName: deleteTypeName,
    loading: deleteTypeLoading,
    triggerDelete: triggerDeleteType,
    confirmDelete: confirmDeleteType,
    cancelDelete: cancelDeleteType
  } = useDelete({
    endpoint: '/api/expenses/types',
    label: 'Expense Type',
    onSuccess: () => fetchTypes()
  });

  // Lists
  const [expenses, setExpenses] = useState([]);
  const [types, setTypes] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1 });

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Expense Form
  const [expTypeId, setExpTypeId] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Type Form
  const [typeName, setTypeName] = useState('');

  const { addToast } = useAuthStore();

  const fetchTypes = async () => {
    try {
      const res = await axios.get('/api/expenses/types');
      setTypes(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/expenses', {
        params: {
          page,
          from_date: fromDate,
          to_date: toDate,
          expense_type_id: typeFilter,
          limit: 10
        }
      });
      setExpenses(res.data.data || []);
      setMeta(res.data.meta || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      console.error(err);
      addToast('Error loading expenses list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchExpenses();
    }
  }, [page, fromDate, toDate, typeFilter, activeTab]);

  // Save Expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expTypeId || !expAmount || !expDate) {
      addToast('Please complete required fields', 'warning');
      return;
    }

    const payload = {
      expense_type_id: parseInt(expTypeId),
      description: expDesc || null,
      amount: parseFloat(expAmount),
      date: expDate
    };

    try {
      if (selectedExpense) {
        await axios.put(`/api/expenses/${selectedExpense.id}`, payload);
        addToast('Expense updated successfully', 'success');
      } else {
        await axios.post('/api/expenses', payload);
        addToast('New expense logged', 'success');
      }
      setExpenseModalOpen(false);
      fetchExpenses();
    } catch (err) {
      addToast('Error saving expense details', 'error');
    }
  };

  // Delete Expense
  const handleDeleteExpense = (id, description) => {
    triggerDeleteExpense(id, description || `Expense #${id}`);
  };

  // Save Type
  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!typeName.trim()) return;

    try {
      if (selectedType) {
        await axios.put(`/api/expenses/types/${selectedType.id}`, { name: typeName });
        addToast('Expense type renamed', 'success');
      } else {
        await axios.post('/api/expenses/types', { name: typeName });
        addToast('New expense type added', 'success');
      }
      setTypeModalOpen(false);
      setTypeName('');
      fetchTypes();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving type', 'error');
    }
  };

  // Delete Type
  const handleDeleteType = (id, name) => {
    triggerDeleteType(id, name);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="expenses-page">
      {/* Header Row */}
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Expense Logs</h1>
          <p>Record business operating expenditures like bills, salaries, rents</p>
        </div>

        <div className="flex">
          {activeTab === 'expenses' ? (
            <button className="btn btn-primary" onClick={() => { setSelectedExpense(null); setExpTypeId(types[0]?.id || ''); setExpDesc(''); setExpAmount(''); setExpDate(new Date().toISOString().split('T')[0]); setExpenseModalOpen(true); }}>
              <Plus size={18} />
              Log Expense
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setSelectedType(null); setTypeName(''); setTypeModalOpen(true); }}>
              <Plus size={18} />
              Add Expense Type
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '20px' }}>
        <button className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
          Expenses List
        </button>
        <button className={`tab-btn ${activeTab === 'types' ? 'active' : ''}`} onClick={() => setActiveTab('types')}>
          Expense Types
        </button>
      </div>

      {activeTab === 'expenses' ? (
        <>
          {/* Filters */}
          <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
            <div className="grid grid-4" style={{ gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Date</label>
                <div style={{ position: 'relative' }}>
                  <input type="date" className="form-input" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To Date</label>
                <div style={{ position: 'relative' }}>
                  <input type="date" className="form-input" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filter Category</label>
                <select className="form-input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                  <option value="">All Categories</option>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex" style={{ alignSelf: 'flex-end', height: '42px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setFromDate(''); setToDate(''); setTypeFilter(''); setPage(1); }}>
                  Clear Filters
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
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{e.expense_type_name}</td>
                      <td>{e.description || 'No description'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                        {formatCurrency(e.amount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedExpense(e); setExpTypeId(e.expense_type_id); setExpDesc(e.description || ''); setExpAmount(e.amount); setExpDate(e.date.split('T')[0]); setExpenseModalOpen(true); }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExpense(e.id, e.description)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No expense logs matching filters</td>
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
        /* Types Table */
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="table-container" style={{ marginTop: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category Name</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map(t => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedType(t); setTypeName(t.name); setTypeModalOpen(true); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteType(t.id, t.name)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card instructions-card" style={{ padding: '24px' }}>
            <h3>Operational Types</h3>
            <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6' }}>
              Setting up descriptive expense categories helps track utility bills, salaries, rents, and other operations.
            </p>
            <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6', color: 'var(--danger)' }}>
              Note: Categories cannot be deleted if active expense logs are currently linked to them.
            </p>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {expenseModalOpen && (
        <div className="modal-overlay" onClick={() => setExpenseModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedExpense ? 'Edit Expense Log' : 'Log Business Expense'}</h3>
              <button className="theme-toggle-btn" onClick={() => setExpenseModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Expense Category *</label>
                <select className="form-input" value={expTypeId} onChange={(e) => setExpTypeId(e.target.value)} required>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Amount (PKR) *</label>
                  <input type="number" step="0.01" className="form-input" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" required />
                </div>

                <div className="form-group">
                  <label className="form-label">Expense Date</label>
                  <input type="date" className="form-input" value={expDate} onChange={(e) => setExpDate(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Memo / Description</label>
                <input type="text" className="form-input" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="e.g. Paid shop electricity bill for June" />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExpenseModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type Modal */}
      {typeModalOpen && (
        <div className="modal-overlay" onClick={() => setTypeModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedType ? 'Edit Type' : 'Create Expense Type'}</h3>
              <button className="theme-toggle-btn" onClick={() => setTypeModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveType} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Type Name *</label>
                <input type="text" className="form-input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Electricity Bill" required />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTypeModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .tabs-container .tab-btn {
          background: none; border: none; padding: 12px 20px; font-size: 15px; font-weight: 600;
          color: var(--text-muted); cursor: pointer; position: relative; transition: all var(--transition-fast);
        }
        .tabs-container .tab-btn:hover { color: var(--primary); }
        .tabs-container .tab-btn.active { color: var(--primary); }
        .tabs-container .tab-btn.active::after {
          content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background-color: var(--primary);
        }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteExpenseOpen}
        onClose={cancelDeleteExpense}
        onConfirm={confirmDeleteExpense}
        itemName={deleteExpenseName}
        title="Delete Expense Record"
        message={`Are you sure you want to permanently delete this expense record?`}
        loading={deleteExpenseLoading}
      />

      <DeleteConfirmModal
        isOpen={deleteTypeOpen}
        onClose={cancelDeleteType}
        onConfirm={confirmDeleteType}
        itemName={deleteTypeName}
        title="Delete Expense Type"
        message={`Are you sure you want to delete expense type "${deleteTypeName}"? This will fail if expenses are linked to it.`}
        loading={deleteTypeLoading}
      />
    </div>
  );
};

export default Expenses;
