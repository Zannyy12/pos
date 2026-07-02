import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Undo2, Send, RotateCcw } from 'lucide-react';

const Refund = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('Shop');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { addToast } = useAuthStore();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  const fetchInitialData = async () => {
    try {
      const custRes = await axios.get('/api/customers', { params: { limit: 100 } });
      setCustomers(custRes.data.data || []);
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
    
    // Auto fill retail price
    const match = products.find(p => p.id === parseInt(pId));
    if (match) {
      setPrice(match.price);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId || !productId || !quantity || !price || !location || !date) {
      addToast('Please complete all form fields', 'warning');
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      addToast('Refund quantity must be greater than zero', 'warning');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/orders/refund', {
        customer_id: parseInt(customerId),
        product_id: parseInt(productId),
        quantity: qty,
        price: parseFloat(price),
        location,
        date
      });
      addToast('Customer refund recorded and ledger balanced', 'success');
      // Reset Form
      setCustomerId('');
      setProductId('');
      setQuantity('');
      setPrice('');
      setLocation('Shop');
    } catch (err) {
      addToast(err.response?.data?.message || 'Error processing product refund', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="refund-page">
      <div className="header-row" style={{ marginBottom: '24px' }}>
        <h1 className="welcome-headline">Customer Returns & Refund</h1>
        <p>Log items returned by customers, restock inventory, and issue credits</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Form Panel */}
        <div className="glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '16px' }}>
            <RotateCcw size={20} />
            Log Customer Return
          </h3>

          <form onSubmit={handleSubmit} className="refund-form">
            <div className="form-group">
              <label className="form-label">Select Customer / Client *</label>
              <select 
                className="form-input" 
                value={customerId} 
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Choose Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Bal: {formatCurrency(c.balance)})</option>
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
                  <option key={p.id} value={p.id}>{p.name} (Price: {formatCurrency(p.price)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Restock Location *</label>
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
                <label className="form-label">Returned Quantity *</label>
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
                <label className="form-label">Refund Unit Retail Price (PKR) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)}
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
                  Submit Customer Refund
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rules Card */}
        <div className="glass-card info-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '16px' }}>
            <RotateCcw size={20} />
            Refund Ledger Policy
          </h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
            When a customer returns an item:
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8' }}>
            <li>The system adds the items back to the active stock count of the chosen location (Shop or Store 1).</li>
            <li>The customer's ledger accounts are credited: <strong>Customer Balance = Customer Balance - (Refund Qty * Refund Price)</strong>.</li>
            <li>For credit customers, this effectively decreases their outstanding payable debt.</li>
            <li>A transaction record is appended to their customer statement ledger timeline.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Refund;
