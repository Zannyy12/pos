import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, ArrowLeftRight, SlidersHorizontal, Search, Trash2, ArrowUpDown, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const Stock = () => {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);



  // Filters
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1, totals: { totalQty: 0, totalCostValue: 0, totalPriceValue: 0, totalMargin: 0 } });

  // Modals
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  // Form states - Adjust
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');

  // Form states - Transfer
  const [transQty, setTransQty] = useState('');
  const [transLocation, setTransLocation] = useState('Store 1');

  // Form states - Purchase Stock
  const [purVendorId, setPurVendorId] = useState('');
  const [purDate, setPurDate] = useState(new Date().toISOString().split('T')[0]);
  const [purItems, setPurItems] = useState([{ product_id: '', quantity: '', cost: '0.00', price: '0.00', location: 'Shop' }]);

  const { addToast } = useAuthStore();

  const fetchFiltersData = async () => {
    try {
      const prodRes = await axios.get('/api/products', { params: { limit: 100 } });
      setProducts(prodRes.data.data || []);
      const vendRes = await axios.get('/api/vendors', { params: { limit: 100 } });
      setVendors(vendRes.data.data || []);
      const catRes = await axios.get('/api/products/categories');
      setCategories(catRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/stock', {
        params: {
          page,
          search,
          vendor_id: vendorFilter,
          category_id: categoryFilter,
          location: locationFilter,
          limit: 10
        }
      });
      setStock(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      console.error(err);
      addToast('Failed to fetch stock list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteStock,
    confirmDelete: confirmDeleteStock,
    cancelDelete: cancelDeleteStock
  } = useDelete({
    endpoint: '/api/stock',
    label: 'Stock entry',
    onSuccess: () => fetchStock()
  });

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchStock();
  }, [page, search, vendorFilter, categoryFilter, locationFilter]);

  // Adjust handler
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (adjQty === '' || parseInt(adjQty) < 0) {
      addToast('Please enter a valid quantity', 'warning');
      return;
    }

    try {
      await axios.post('/api/stock/adjust', {
        stock_id: selectedStock.id,
        type: 'adjust',
        quantity: parseInt(adjQty),
        note: adjNote
      });
      addToast('Stock level adjusted successfully', 'success');
      setAdjustModalOpen(false);
      fetchStock();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error adjusting stock', 'error');
    }
  };

  // Transfer handler
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(transQty);
    if (!qty || qty <= 0) {
      addToast('Please enter a valid transfer quantity', 'warning');
      return;
    }
    if (qty > selectedStock.quantity) {
      addToast('Requested quantity exceeds available stock', 'warning');
      return;
    }

    try {
      await axios.post('/api/stock/adjust', {
        stock_id: selectedStock.id,
        type: 'transfer',
        quantity: qty,
        location: transLocation
      });
      addToast('Stock transferred successfully', 'success');
      setTransferModalOpen(false);
      fetchStock();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error transferring stock', 'error');
    }
  };

  // Purchase items modifications
  const addPurItem = () => {
    setPurItems([...purItems, { product_id: '', quantity: '', cost: '0.00', price: '0.00', location: 'Shop' }]);
  };

  const removePurItem = (idx) => {
    setPurItems(purItems.filter((_, i) => i !== idx));
  };

  const handlePurItemChange = (idx, field, value) => {
    const nextItems = [...purItems];
    nextItems[idx][field] = value;

    // Auto populate default cost & retail price if product is selected
    if (field === 'product_id') {
      const match = products.find(p => p.id === parseInt(value));
      if (match) {
        nextItems[idx].cost = match.cost;
        nextItems[idx].price = match.price;
      }
    }
    setPurItems(nextItems);
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!purVendorId) {
      addToast('Please select a supplier', 'warning');
      return;
    }

    const invalid = purItems.some(item => !item.product_id || !item.quantity || parseInt(item.quantity) <= 0);
    if (invalid) {
      addToast('Please complete all item fields with positive quantities', 'warning');
      return;
    }

    try {
      await axios.post('/api/stock/purchase', {
        vendor_id: parseInt(purVendorId),
        date: purDate,
        items: purItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          cost: parseFloat(item.cost),
          price: parseFloat(item.price),
          location: item.location
        }))
      });
      addToast('Purchase logged and stock updated', 'success');
      setPurchaseModalOpen(false);
      fetchStock();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error recording purchase order', 'error');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  return (
    <div className="stock-page">
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Inventory Control</h1>
          <p>Analyze multi-location stock levels, margins, and transfer allocations</p>
        </div>

        <div className="flex">
          <button className="btn btn-secondary" onClick={() => { setPurVendorId(vendors[0]?.id || ''); setPurItems([{ product_id: '', quantity: '', cost: '0.00', price: '0.00', location: 'Shop' }]); setPurchaseModalOpen(true); }}>
            <Plus size={18} />
            Purchase Stock
          </button>
        </div>
      </div>

      {/* Totals panel widgets */}
      <div className="grid grid-4 stats-grid" style={{ marginBottom: '20px' }}>
        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Units in Stock</span>
            <span className="stat-value">{meta.totals?.totalQty || 0}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Cost Value</span>
            <span className="stat-value">{formatCurrency(meta.totals?.totalCostValue || 0)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Total Retail Value</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(meta.totals?.totalPriceValue || 0)}</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-content">
            <span className="stat-title">Expected Margin</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(meta.totals?.totalMargin || 0)}</span>
          </div>
        </div>
      </div>

      {/* Filters Box */}
      <div className="glass-card filters-panel" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div className="grid grid-4" style={{ gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Product</label>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search className="search-icon" size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Product name, barcode..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter Supplier</label>
            <select className="form-input" value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}>
              <option value="">All Suppliers</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter Location</label>
            <select className="form-input" value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}>
              <option value="">All Locations</option>
              <option value="Shop">Shop</option>
              <option value="Store 1">Store 1</option>
            </select>
          </div>

          <div className="flex" style={{ alignSelf: 'flex-end', height: '42px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSearch(''); setVendorFilter(''); setCategoryFilter(''); setLocationFilter(''); setPage(1); }}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      {loading ? (
        <div className="flex-center" style={{ height: '30vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Supplier</th>
                <th>Location</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Margin</th>
                <th style={{ textAlign: 'right' }}>Margin %</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => {
                const isOOS = s.quantity === 0;
                const isLow = !isOOS && s.quantity <= s.quantity_limit;
                const isNegMargin = parseFloat(s.cost) >= parseFloat(s.price);
                return (
                  <tr key={s.id} className={`${isOOS ? 'oos-row' : isLow ? 'low-stock-row' : ''} ${isNegMargin ? 'neg-margin-row' : ''}`}>
                    <td style={{ fontWeight: 600 }}>{s.product_name}</td>
                    <td>{s.vendor_name || 'N/A'}</td>
                    <td>
                      <span className={`badge ${s.location === 'Shop' ? 'badge-success' : 'badge-info'}`}>
                        {s.location}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: isOOS ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text-main)' }}>
                      {s.quantity}
                      {isOOS && <span style={{ fontSize: '10px', display: 'block', fontWeight: 600, color: 'var(--danger)' }}>OUT</span>}
                      {isLow && !isOOS && <span style={{ fontSize: '10px', display: 'block', fontWeight: 500 }}>(Limit: {s.quantity_limit})</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(s.cost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.price)}</td>
                    <td style={{ textAlign: 'right', color: isNegMargin ? 'var(--danger)' : 'var(--success)' }}>
                      {formatCurrency(s.margin_amount)}
                    </td>
                    <td style={{ textAlign: 'right', color: isNegMargin ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                      {s.margin_percent}%
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedStock(s); setTransQty(''); setTransLocation(s.location === 'Shop' ? 'Store 1' : 'Shop'); setTransferModalOpen(true); }} title="Transfer Stock">
                          <ArrowLeftRight size={14} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedStock(s); setAdjQty(s.quantity); setAdjNote(''); setAdjustModalOpen(true); }} title="Adjust Stock">
                          <SlidersHorizontal size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => triggerDeleteStock(s.id, `${s.product_name} @ ${s.location}`)}
                          title="Delete Stock Entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stock.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No stock levels recorded</td>
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

      {/* Modal - Adjust Stock */}
      {adjustModalOpen && (
        <div className="modal-overlay" onClick={() => setAdjustModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Adjust Stock Level</h3>
              <button className="theme-toggle-btn" onClick={() => setAdjustModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                Product: <strong>{selectedStock?.product_name}</strong> at <strong>{selectedStock?.location}</strong>
              </p>

              <div className="form-group">
                <label className="form-label">Set Quantity *</label>
                <input
                  type="number"
                  className="form-input"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Adjustment Reason / Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="Damage, stock audit discrepancy..."
                />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Transfer Stock */}
      {transferModalOpen && (
        <div className="modal-overlay" onClick={() => setTransferModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Internal Stock Transfer</h3>
              <button className="theme-toggle-btn" onClick={() => setTransferModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                Item: <strong>{selectedStock?.product_name}</strong><br />
                Originating Location: <strong>{selectedStock?.location}</strong> (Available: {selectedStock?.quantity})
              </p>

              <div className="form-group">
                <label className="form-label">Transfer Quantity *</label>
                <input
                  type="number"
                  className="form-input"
                  value={transQty}
                  onChange={(e) => setTransQty(e.target.value)}
                  placeholder="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Location *</label>
                <select
                  className="form-input"
                  value={transLocation}
                  onChange={(e) => setTransLocation(e.target.value)}
                  required
                >
                  <option value="Shop">Shop</option>
                  <option value="Store 1">Store 1</option>
                </select>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTransferModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Execute Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Purchase Stock */}
      {purchaseModalOpen && (
        <div className="modal-overlay" onClick={() => setPurchaseModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Record Supplier Purchase Order</h3>
              <button className="theme-toggle-btn" onClick={() => setPurchaseModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} style={{ padding: '20px' }}>
              <div className="grid grid-2" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplier / Vendor *</label>
                  <select className="form-input" value={purVendorId} onChange={(e) => setPurVendorId(e.target.value)} required>
                    <option value="">Select supplier</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Purchase Date</label>
                  <input type="date" className="form-input" value={purDate} onChange={(e) => setPurDate(e.target.value)} required />
                </div>
              </div>

              {/* Purchase items list */}
              <div className="purchase-items-box">
                <h4 style={{ color: 'var(--primary)', marginBottom: '12px' }}>Items Purchase Checklist</h4>

                {purItems.map((item, idx) => (
                  <div key={idx} className="purchase-item-row flex">
                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                      <select
                        className="form-input"
                        value={item.product_id}
                        onChange={(e) => handlePurItemChange(idx, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handlePurItemChange(idx, 'quantity', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        placeholder="Cost"
                        value={item.cost}
                        onChange={(e) => handlePurItemChange(idx, 'cost', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        placeholder="Retail"
                        value={item.price}
                        onChange={(e) => handlePurItemChange(idx, 'price', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                      <select
                        className="form-input"
                        value={item.location}
                        onChange={(e) => handlePurItemChange(idx, 'location', e.target.value)}
                        required
                      >
                        <option value="Shop">Shop</option>
                        <option value="Store 1">Store 1</option>
                      </select>
                    </div>

                    {purItems.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removePurItem(idx)} style={{ padding: '10px' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                <button type="button" className="btn btn-secondary btn-sm" onClick={addPurItem} style={{ marginTop: '12px' }}>
                  + Add Item Row
                </button>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPurchaseModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Process Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .oos-row {
          background-color: rgba(239, 68, 68, 0.08) !important;
        }
        .low-stock-row {
          background-color: rgba(245, 158, 11, 0.05) !important;
        }
        .neg-margin-row {
          background-color: rgba(239, 68, 68, 0.05) !important;
        }
        .purchase-items-box {
          border: 1px solid var(--border-color);
          padding: 16px;
          border-radius: var(--radius-md);
          margin-top: 16px;
          max-height: 240px;
          overflow-y: auto;
        }
        .purchase-item-row {
          gap: 8px;
          margin-bottom: 8px;
        }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={cancelDeleteStock}
        onConfirm={confirmDeleteStock}
        itemName={deleteName}
        title="Delete Stock Entry"
        message={`Are you sure you want to delete stock entry "${deleteName}"? Only entries with zero quantity can be deleted.`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default Stock;
