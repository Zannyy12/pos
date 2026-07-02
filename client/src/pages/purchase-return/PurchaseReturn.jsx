import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Undo2, Send, CornerUpLeft } from 'lucide-react';

const PurchaseReturn = () => {
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [vendorId, setVendorId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [location, setLocation] = useState('Shop');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { addToast } = useAuthStore();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  const fetchInitialData = async () => {
    try {
      const vendRes = await axios.get('/api/vendors', { params: { limit: 100 } });
      setVendors(vendRes.data.data || []);
      const prodRes = await axios.get('/api/products', { params: { limit: 100 } });
      setProducts(prodRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setProductId(pId);
    
    // Auto fill cost
    const match = products.find(p => p.id === parseInt(pId));
    if (match) {
      setCost(match.cost);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId || !productId || !quantity || !cost || !location || !date) {
      addToast('Please fill all form fields', 'warning');
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      addToast('Quantity must be greater than zero', 'warning');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/stock/purchase-return', {
        vendor_id: parseInt(vendorId),
        product_id: parseInt(productId),
        quantity: qty,
        cost: parseFloat(cost),
        location,
        date
      });
      addToast('Purchase return logged and balance adjusted', 'success');
      // Reset Form
      setVendorId('');
      setProductId('');
      setQuantity('');
      setCost('');
      setLocation('Shop');
    } catch (err) {
      addToast(err.response?.data?.message || 'Error processing purchase return', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="purchase-return-page">
      <div className="header-row" style={{ marginBottom: '24px' }}>
        <h1 className="welcome-headline">Supplier Stock Return</h1>
        <p>Return defective or excess inventory to vendor and adjust credits</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Form panel */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '16px' }}>
            <Undo2 size={20} />
            Log Purchase Return
          </h3>

          <form onSubmit={handleSubmit} className="return-form">
            <div className="form-group">
              <label className="form-label">Select Supplier / Vendor *</label>
              <select 
                className="form-input" 
                value={vendorId} 
                onChange={(e) => setVendorId(e.target.value)}
                required
              >
                <option value="">Choose Supplier</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} (Bal: {formatCurrency(v.balance)})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Select Product *</label>
              <select 
                className="form-input" 
                value={productId} 
                onChange={handleProductChange}
                required
              >
                <option value="">Choose Product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Cost: {formatCurrency(p.cost)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Return Location *</label>
                <select 
                  className="form-input" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  required
                >
                  <option value="Shop">Shop</option>
                  <option value="Store 1">Store 1</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Return Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Return Quantity *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Return Unit Cost (PKR) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={cost} 
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '16px', borderRadius: 'var(--radius-md)' }}
              disabled={loading}
            >
              {loading ? <div className="spinner"></div> : (
                <>
                  <Send size={16} />
                  Submit Stock Return
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info panel */}
        <div className="glass-card info-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '16px' }}>
            <CornerUpLeft size={20} />
            Return Ledger Rules
          </h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
            When a stock item is returned to a vendor:
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            <li>The system verifies if the quantity is physically available in the selected location (Shop or Store 1).</li>
            <li>The system decreases the stock count at that location.</li>
            <li>The outstanding balance that you owe to the vendor is reduced: <strong>Vendor Balance = Vendor Balance - (Return Qty * Return Cost)</strong>.</li>
            <li>A log of this operation is recorded in the supplier statement ledger.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PurchaseReturn;
