import React, { useEffect, useState, useRef, useCallback } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Check, X, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PaymentModal from '../../components/PaymentModal';

// Print template wrapper
const ReceiptPrintTemplate = React.forwardRef(({ order, items, customer, cashier }, ref) => {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  if (!order) return null;

  return (
    <div ref={ref} className="receipt-print-wrapper">
      <div className="receipt-header">
        <h2 className="receipt-title">KHUZDAR POS</h2>
        <p className="receipt-meta">Main Market, Gulshan-e-Iqbal, Karachi</p>
        <p className="receipt-meta">Phone: +92 320 0256793</p>
        <div style={{ margin: '10px 0', borderBottom: '1px dashed #000' }}></div>
        <table style={{ width: '100%', fontSize: '11px', textAlign: 'left' }}>
          <tbody>
            <tr>
              <td><strong>Invoice #:</strong> {order.orderId || 'NEW'}</td>
              <td style={{ textAlign: 'right' }}><strong>Date:</strong> {new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Cashier:</strong> {cashier || 'Admin'}</td>
              <td style={{ textAlign: 'right' }}><strong>Customer:</strong> {customer?.name || 'Walk-in'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Item Description</th>
            <th style={{ textAlign: 'center' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td>{item.name}</td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price - item.discount)}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency((item.unit_price - item.discount) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>

      <div className="receipt-totals" style={{ fontSize: '12px', lineHeight: '1.6' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'right' }}>Subtotal:</td>
              <td style={{ textAlign: 'right', width: '90px' }}>{formatCurrency(order.subtotal)}</td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td style={{ textAlign: 'right' }}>Inv Discount:</td>
                <td style={{ textAlign: 'right' }}>-{formatCurrency(order.discount)}</td>
              </tr>
            )}
            <tr style={{ fontWeight: 'bold', fontSize: '13px' }}>
              <td style={{ textAlign: 'right' }}>Net Total:</td>
              <td style={{ textAlign: 'right' }}>PKR {formatCurrency(order.total)}</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right' }}>Amount Paid:</td>
              <td style={{ textAlign: 'right' }}>PKR {formatCurrency(order.amount_paid)}</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'right' }}>{order.change >= 0 ? 'Change Return:' : 'Outstanding Debt:'}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                PKR {formatCurrency(Math.abs(order.change))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '12px 0' }}></div>
      <div style={{ textAlign: 'center', fontSize: '11px' }}>
        <p>Software Designed By Zain Bashir</p>
        <p>Thank you for your business!</p>
      </div>

      <style>{`
        .receipt-print-wrapper {
          width: 80mm;
          padding: 8px;
          background: white;
          color: black;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
        }
        .receipt-header {
          text-align: center;
        }
        .receipt-title {
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .receipt-meta {
          margin: 0;
          font-size: 10px;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .receipt-table th {
          border-bottom: 1px solid black;
          padding-bottom: 4px;
          font-weight: bold;
        }
        .receipt-table td {
          padding: 4px 0;
          vertical-align: top;
        }
      `}</style>
    </div>
  );
});

const Invoice = () => {
  const [customers, setCustomers] = useState([]);
  
  // Cart & Invoice states
  const [cart, setCart] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState('0.00');
  const [amountPaid, setAmountPaid] = useState('0.00');
  const [checkoutLocation, setCheckoutLocation] = useState('Shop');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  
  // Checkout Result for Receipt Modal
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const barcodeInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const printRef = useRef(null);
  // Debounce timer ref
  const debounceRef = useRef(null);
  
  const { addToast, user } = useAuthStore();

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const loadAllProducts = async () => {
    setDropdownLoading(true);
    try {
      const res = await axios.get('/api/pos/products');
      const raw = res.data;
      const list =
        Array.isArray(raw) ? raw :
        Array.isArray(raw?.products) ? raw.products :
        Array.isArray(raw?.data) ? raw.data :
        [];

      // Sort: in-stock first, then out-of-stock, then by name
      const sorted = list.sort((a, b) => {
        const aStock = a.quantity > 0;
        const bStock = b.quantity > 0;
        if (aStock && !bStock) return -1;
        if (!aStock && bStock) return 1;
        return a.name.localeCompare(b.name);
      });

      setAllProducts(sorted);
      setFilteredProducts(sorted);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setDropdownLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const custRes = await axios.get('/api/customers', { params: { limit: 100 } });
      setCustomers(custRes.data.data || []);
      
      // Default set Walk-in Customer
      const walkin = custRes.data.data?.find(c => c.name === 'Walk-in Customer');
      if (walkin) setSelectedCustomerId(walkin.id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    loadAllProducts();
  }, []);

  // Click outside → close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        barcodeInputRef.current &&
        !barcodeInputRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search focus
  const handleSearchFocus = () => {
    setShowDropdown(true);
    if (!searchQuery) {
      setFilteredProducts(allProducts);
    }
  };

  // Handle typing in the search box
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowDropdown(true);

    if (!query.trim()) {
      setFilteredProducts(allProducts);
      return;
    }

    // Filter by name OR barcode — case insensitive
    const filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode?.toString().includes(query.trim())
    );

    setFilteredProducts(filtered);
  };

  // Handle Enter key and keyboard navigation
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchQuery.replace(/[^a-zA-Z0-9\-]/g, '').trim();
      if (!query) return;

      // Try exact barcode match first
      const exactMatch = allProducts.find(p =>
        p.barcode?.replace(/[^a-zA-Z0-9\-]/g, '').trim() === query
      );

      if (exactMatch) {
        handleProductSelect(exactMatch);
        return;
      }

      // If only one result → auto-select it
      if (filteredProducts.length === 1) {
        handleProductSelect(filteredProducts[0]);
        return;
      }

      addToast('No product matches this barcode', 'warning');
    }

    // Arrow key navigation in dropdown
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const firstItem = dropdownRef.current?.querySelector('.dropdown-item');
      firstItem?.focus();
    }

    // Escape closes dropdown
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  // When product is selected from dropdown
  const handleProductSelect = (product) => {
    // Close dropdown and clear search immediately
    setShowDropdown(false);
    setSearchQuery('');
    setFilteredProducts(allProducts);

    // Check if out of stock
    if (product.quantity <= 0) {
      addToast(`⚠️ "${product.name}" is out of stock`, 'warning');
      return;
    }

    // Add to cart
    addToCart(product);

    // Refocus search bar for next product
    setTimeout(() => {
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, 50);
  };

  const addToCart = (product) => {
    if (product.quantity <= 0) {
      addToast(`⚠️ "${product.name}" is out of stock`, 'warning');
      return;
    }

    // Check if product is already in cart
    const existingIdx = cart.findIndex(item => item.product_id === product.id && item.location === checkoutLocation);
    
    if (existingIdx > -1) {
      const nextCart = [...cart];
      if (nextCart[existingIdx].quantity + 1 > product.quantity) {
        addToast(`⚠️ Only ${product.quantity} units available`, 'warning');
        return;
      }
      nextCart[existingIdx].quantity += 1;
      setCart(nextCart);
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unit_price: parseFloat(product.price),
        discount: parseFloat(product.discount || 0),
        location: checkoutLocation
      }]);
    }
    addToast(`✅ "${product.name}" added to cart`, 'success');
  };

  const updateCartQty = (idx, amount) => {
    const nextCart = [...cart];
    const newQty = nextCart[idx].quantity + amount;
    if (newQty <= 0) {
      nextCart.splice(idx, 1);
    } else {
      nextCart[idx].quantity = newQty;
    }
    setCart(nextCart);
  };

  const updateCartDiscount = (idx, value) => {
    const nextCart = [...cart];
    nextCart[idx].discount = parseFloat(value || 0);
    setCart(nextCart);
  };

  const removeFromCart = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + ((item.unit_price - item.discount) * item.quantity), 0);
  const discountVal = parseFloat(invoiceDiscount || 0);
  const netTotal = Math.max(0, subtotal - discountVal);
  const paidVal = parseFloat(amountPaid || 0);
  const balance = netTotal - paidVal; // Positive means debt, negative means change

  const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));
  const isWalkin = selectedCustomer?.name === 'Walk-in Customer';

  // Checkout submit - opens the payment modal
  const handleCheckout = () => {
    if (cart.length === 0) {
      addToast('Billing cart is empty', 'warning');
      return;
    }
    setPaymentModalOpen(true);
  };

  // Called on successful payment checkout from PaymentModal
  const handlePaymentSuccess = (paymentDetails) => {
    setPaymentModalOpen(false);
    
    // Prepare receipt template dataset
    setCheckoutResult({
      orderId: paymentDetails.orderId,
      subtotal: paymentDetails.subtotal,
      discount: paymentDetails.discount,
      total: paymentDetails.netTotal,
      amount_paid: paymentDetails.amountPaid,
      change: paymentDetails.changeDue,
      items: paymentDetails.items
    });

    addToast('Payment completed successfully', 'success');
    setReceiptOpen(true);

    // Reset Billing Panel
    setCart([]);
    setInvoiceDiscount('0.00');
    setAmountPaid('0.00');
    
    // Reset customer back to Walk-in & reload
    fetchInitialData();
  };

  // react-to-print setup
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  return (
    <div className="invoice-page">
      <div className="grid invoice-main-grid" style={{ gridTemplateColumns: '2.5fr 1fr', alignItems: 'stretch' }}>
        
        {/* Left billing cart panel */}
        <div className="glass-card flex-col" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Autocomplete Search input */}
          <div className="form-group search-container-box" style={{ position: 'relative', marginBottom: '20px' }}>
            <label className="form-label">Scan Barcode / Search Product</label>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <Search className="search-icon" size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: dropdownLoading ? 'var(--primary)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-input"
                style={{ paddingLeft: '44px', paddingRight: '44px', height: '48px', fontSize: '15px' }}
                placeholder="Scan barcode directly or type product name... [Press ENTER to quick-scan]"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '16px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    zIndex: 5
                  }}
                  onClick={() => {
                    setSearchQuery('');
                    setFilteredProducts(allProducts);
                    if (barcodeInputRef.current) barcodeInputRef.current.focus();
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown — shows on focus */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="products-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}
              >
                {/* Dropdown Header */}
                <div style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontWeight: '600',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-sidebar)',
                  zIndex: 1,
                  textAlign: 'left'
                }}>
                  {dropdownLoading ? (
                    'Loading products...'
                  ) : searchQuery ? (
                    `Results for "${searchQuery}" (${filteredProducts.length})`
                  ) : (
                    `All Products (${filteredProducts.length})`
                  )}
                </div>

                {/* Loading State */}
                {dropdownLoading && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 8px auto' }} />
                    <p style={{ fontSize: '13px' }}>Loading products...</p>
                  </div>
                )}

                {/* No Results */}
                {!dropdownLoading && filteredProducts.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                    <p style={{ fontWeight: '500' }}>
                      No products match "{searchQuery}"
                    </p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>
                      Try a different name or scan the barcode
                    </p>
                  </div>
                )}

                {/* Product List */}
                {!dropdownLoading && filteredProducts.map((product, index) => {
                  const inStock = product.quantity > 0;
                  const lowStock = product.quantity > 0 && product.quantity <= (product.quantity_limit || 5);

                  return (
                    <div
                      key={product.id}
                      className="dropdown-item"
                      tabIndex={0}
                      onClick={() => handleProductSelect(product)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleProductSelect(product);
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const items = dropdownRef.current?.querySelectorAll('.dropdown-item');
                          items?.[index + 1]?.focus();
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (index === 0) {
                            barcodeInputRef.current?.focus();
                          } else {
                            const items = dropdownRef.current?.querySelectorAll('.dropdown-item');
                            items?.[index - 1]?.focus();
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 16px',
                        cursor: inStock ? 'pointer' : 'not-allowed',
                        borderBottom: '1px solid var(--border-color)',
                        background: inStock ? 'var(--bg-sidebar)' : 'var(--bg-card-hover)',
                        opacity: inStock ? 1 : 0.6,
                        gap: '12px',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => {
                        if (inStock) e.currentTarget.style.background = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = inStock ? 'var(--bg-sidebar)' : 'var(--bg-card-hover)';
                      }}
                    >
                      {/* Stock Status Dot */}
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: inStock
                          ? (lowStock ? '#F59E0B' : '#10B981')
                          : '#EF4444'
                      }} />

                      {/* Product Name + Category */}
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{
                          fontWeight: '500',
                          fontSize: '14px',
                          color: inStock ? 'var(--text-main)' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {product.name}
                          {!inStock && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              color: '#EF4444',
                              fontWeight: '600'
                            }}>
                              OUT OF STOCK
                            </span>
                          )}
                          {lowStock && inStock && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              color: '#F59E0B',
                              fontWeight: '600'
                            }}>
                              LOW STOCK
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '2px'
                        }}>
                          {product.category} • Barcode: {product.barcode}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div style={{
                        fontSize: '12px',
                        color: inStock ? 'var(--text-muted)' : '#EF4444',
                        textAlign: 'center',
                        minWidth: '60px'
                      }}>
                        <div style={{ fontWeight: '600' }}>
                          {product.quantity}
                        </div>
                        <div>in stock</div>
                      </div>

                      {/* Price */}
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        minWidth: '80px',
                        textAlign: 'right'
                      }}>
                        PKR {parseFloat(product.price).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="table-container" style={{ flex: 1, overflowY: 'auto', minHeight: '380px', marginTop: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>S.No</th>
                  <th>Product Details</th>
                  <th style={{ width: '120px' }}>Location</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Quantity</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Retail</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Disc/Unit</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: '50px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <span style={{ fontWeight: 600, display: 'block' }}>{item.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Code: {item.barcode}</span>
                    </td>
                    <td>
                      <select 
                        className="form-input btn-sm" 
                        style={{ padding: '4px 8px' }}
                        value={item.location}
                        onChange={(e) => {
                          const nextCart = [...cart];
                          nextCart[idx].location = e.target.value;
                          setCart(nextCart);
                        }}
                      >
                        <option value="Shop">Shop</option>
                        <option value="Store 1">Store 1</option>
                      </select>
                    </td>
                    <td>
                      <div className="qty-control flex-center">
                        <button className="btn btn-secondary btn-sm qty-btn" onClick={() => updateCartQty(idx, -1)}>
                          <Minus size={12} />
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button className="btn btn-secondary btn-sm qty-btn" onClick={() => updateCartQty(idx, 1)}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input btn-sm"
                        style={{ textAlign: 'right', padding: '6px' }}
                        value={item.discount}
                        onChange={(e) => updateCartDiscount(idx, e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency((item.unit_price - item.discount) * item.quantity)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(idx)} style={{ padding: '6px' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      <ShoppingCart size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                      Billing cart is empty. Scan barcodes or search products to build invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right billing summary panel */}
        <div className="glass-card flex-col checkout-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3>Checkout Invoice</h3>

          {/* Customer Selection */}
          <div className="form-group">
            <label className="form-label">Client / Customer</label>
            <select
              className="form-input"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {parseFloat(c.balance) > 0 ? `(Owes: ${formatCurrency(c.balance)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Cart Default Location</label>
            <select
              className="form-input"
              value={checkoutLocation}
              onChange={(e) => {
                setCheckoutLocation(e.target.value);
                // Also update existing cart rows
                setCart(cart.map(item => ({ ...item, location: e.target.value })));
              }}
            >
              <option value="Shop">Shop</option>
              <option value="Store 1">Store 1</option>
            </select>
          </div>

          <div style={{ borderBottom: '1px solid var(--border-color)', margin: '10px 0' }}></div>

          {/* Totals Summary */}
          <div className="totals-summary-list">
            <div className="flex-between total-row">
              <span className="total-label">Subtotal</span>
              <span className="total-val">{formatCurrency(subtotal)}</span>
            </div>

            <div className="form-group" style={{ margin: '10px 0 0 0' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Invoice Flat Discount (PKR)</label>
              <input
                type="number"
                className="form-input"
                value={invoiceDiscount}
                onChange={(e) => setInvoiceDiscount(e.target.value || '0.00')}
              />
            </div>

            <div className="flex-between total-row net-row" style={{ marginTop: '14px' }}>
              <span className="total-label" style={{ fontWeight: 700, fontSize: '15px' }}>Net Total</span>
              <span className="total-val" style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)' }}>
                PKR {formatCurrency(netTotal)}
              </span>
            </div>

            <div className="form-group" style={{ margin: '14px 0 0 0' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Amount Paid (PKR)</label>
              <input
                type="number"
                className="form-input"
                style={{ fontSize: '15px', fontWeight: 600, color: 'var(--success)' }}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value || '0.00')}
              />
            </div>

            {/* Change / Outstanding calculation */}
            <div className="flex-between total-row" style={{ marginTop: '14px' }}>
              <span className="total-label">{balance >= 0 ? 'Outstanding Receivable' : 'Change Return'}</span>
              <span className={`total-val ${balance >= 0 ? 'danger-color' : 'success-color'}`} style={{ fontWeight: 700 }}>
                PKR {formatCurrency(Math.abs(balance))}
              </span>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '16px', fontWeight: 600, marginTop: 'auto' }}
            onClick={handleCheckout}
            disabled={cart.length === 0}
          >
            <Check size={20} />
            Complete Checkout
          </button>
        </div>
      </div>

      {/* Thermal Receipt Print Modal */}
      {receiptOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 'auto', maxWidth: '90mm', padding: '16px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>Checkout Complete</h3>
              <button className="theme-toggle-btn" onClick={() => setReceiptOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            {/* Receipt Preview box */}
            <div className="receipt-preview-box" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: '#fff', maxHeight: '60vh', overflowY: 'auto' }}>
              <ReceiptPrintTemplate
                ref={printRef}
                order={checkoutResult}
                items={checkoutResult ? checkoutResult.items : []}
                customer={selectedCustomer}
                cashier={user?.name}
              />
            </div>

            <div className="flex" style={{ marginTop: '16px', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReceiptOpen(false)}>
                Close Panel
              </button>
              <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={handlePrint}>
                <Printer size={16} />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Selection Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        cartItems={cart}
        subtotal={subtotal}
        invoiceDiscount={invoiceDiscount}
        netTotal={netTotal}
        customer={selectedCustomer}
        cartLocation={checkoutLocation}
        onSuccess={handlePaymentSuccess}
      />

      {/* Styled JSX for Billing Cart Autocomplete */}
      <style>{`
        .products-dropdown {
          scrollbar-width: thin;
          scrollbar-color: var(--border-color) transparent;
        }
        .products-dropdown::-webkit-scrollbar {
          width: 6px;
        }
        .products-dropdown::-webkit-scrollbar-track {
          background: transparent;
        }
        .products-dropdown::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 3px;
        }
        .dropdown-item:focus {
          outline: none;
          background: var(--bg-card-hover) !important;
        }

        .search-results-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background-color: var(--bg-sidebar);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 120;
          margin-top: 6px;
          overflow: hidden;
        }

        .search-result-item {
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-color);
          transition: background-color var(--transition-fast);
        }

        .search-result-item:hover {
          background-color: var(--primary-light);
        }

        .search-result-item:last-child {
          border-bottom: none;
        }

        .res-prod-name {
          font-weight: 600;
          display: block;
          color: var(--text-main);
        }

        .res-prod-barcode {
          font-size: 11px;
          color: var(--text-muted);
        }

        .res-prod-price {
          font-weight: 700;
          color: var(--primary);
        }

        .qty-control {
          gap: 12px;
        }

        .qty-btn {
          width: 26px;
          height: 26px;
          padding: 0 !important;
          border-radius: var(--radius-sm);
        }

        .qty-value {
          font-weight: 700;
          font-size: 15px;
        }

        .totals-summary-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .total-row {
          font-size: 14px;
        }

        .net-row {
          border-top: 1px solid var(--border-color);
          padding-top: 14px;
        }

        .success-color {
          color: var(--success);
        }

        .danger-color {
          color: var(--danger);
        }

        /* Out-of-stock items in dropdown */
        .oos-item {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .oos-item:hover {
          background-color: rgba(239, 68, 68, 0.06) !important;
        }

        .oos-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 1px 6px;
          font-size: 10px;
          font-weight: 600;
          background-color: var(--danger);
          color: white;
          border-radius: 4px;
          vertical-align: middle;
          letter-spacing: 0.3px;
        }
      `}</style>
    </div>
  );
};

export default Invoice;
export { ReceiptPrintTemplate };
