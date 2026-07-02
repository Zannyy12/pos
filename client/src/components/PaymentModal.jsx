import React, { useEffect, useState } from 'react';
import useAuthStore, { axios } from '../store/useAuthStore';
import { X, Check, Upload, HelpCircle, FileText, Landmark, Wallet } from 'lucide-react';

const PaymentModal = ({
  isOpen,
  onClose,
  cartItems,
  subtotal,
  invoiceDiscount,
  netTotal,
  customer,
  cartLocation,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [amountPaid, setAmountPaid] = useState(netTotal);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  // Load banks on modal open
  useEffect(() => {
    if (isOpen) {
      loadBanks();
      setAmountPaid(netTotal);
      setProofFile(null);
      setProofPreview(null);
      setPaymentNote('');
      setError(null);
    }
  }, [isOpen, netTotal]);

  const loadBanks = async () => {
    try {
      const res = await axios.get('/api/banks');
      const raw = res.data;

      // Handle all possible response shapes safely
      const bankList =
        Array.isArray(raw) ? raw :
        Array.isArray(raw?.banks) ? raw.banks :
        Array.isArray(raw?.data) ? raw.data :
        [];

      if (bankList.length === 0) {
        setError('No payment methods found');
        return;
      }

      setBanks(bankList);
      
      // Auto-select Cash in Hand if exists, otherwise first bank
      const cash = bankList.find(b => b.name.toLowerCase().includes('cash'));
      setSelectedBank(cash || bankList[0] || null);
      setError(null);
    } catch (err) {
      console.error('Failed to load banks:', err);
      setError('Failed to load payment options.');
    }
  };

  // Determine if proof is required
  const isCashPayment = selectedBank?.name?.toLowerCase().includes('cash');
  const proofRequired = !isCashPayment;
  const proofMissing = proofRequired && !proofFile;

  // Calculate change / outstanding balance
  const paid = parseFloat(amountPaid) || 0;
  const total = parseFloat(netTotal) || 0;
  const changeDue = Math.max(0, paid - total);
  const outstanding = Math.max(0, total - paid);

  // Handle file validation and preview
  const handleFileChange = (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, PNG, PDF files accepted');
      return;
    }

    setProofFile(file);
    setError(null);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setProofPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setProofPreview('pdf');
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFileChange(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleConfirm = async () => {
    if (!selectedBank) {
      setError('Please select a payment method');
      return;
    }
    if (proofMissing) {
      setError('Proof of payment is required for bank transfers');
      return;
    }
    if (paid < 0) {
      setError('Amount paid cannot be negative');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('customerId', customer?.id || 'walkin');
      formData.append('cartItems', JSON.stringify(cartItems));
      formData.append('subtotal', subtotal);
      formData.append('invoiceDiscount', invoiceDiscount);
      formData.append('netTotal', netTotal);
      formData.append('amountPaid', amountPaid);
      formData.append('bankId', selectedBank.id);
      formData.append('paymentNote', paymentNote);
      formData.append('cartLocation', cartLocation);
      if (proofFile) formData.append('proof', proofFile);

      const res = await axios.post('/api/orders/checkout', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        onSuccess({
          orderId: res.data.orderId,
          changeDue: res.data.changeDue,
          balanceDue: res.data.balanceDue,
          bankName: selectedBank.name,
          amountPaid: paid,
          netTotal: total,
          subtotal,
          discount: parseFloat(invoiceDiscount) || 0,
          items: cartItems
        });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Payment checkout process failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content payment-modal-content" style={{ maxWidth: '580px', padding: 0 }}>
        {/* Header decoration */}
        <div style={{
          height: '6px',
          background: 'linear-gradient(90deg, #7C3AED 0%, #A78BFA 100%)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)'
        }} />

        {/* Modal Header */}
        <div className="modal-header-payment flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-main)' }}>
            <Landmark size={22} style={{ color: '#7C3AED' }} />
            Complete Checkout & Payment
          </h2>
          <button 
            onClick={onClose}
            className="hover-bg-mute"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: '75vh', overflowY: 'auto', padding: '24px' }} className="modal-body-scroll">
          {/* Order Summary Card */}
          <div className="order-summary-box" style={{
            backgroundColor: 'var(--bg-card-hover)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <div className="flex-between" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span>Items in Cart: {cartItems?.length || 0}</span>
              <span>Subtotal: PKR {subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {parseFloat(invoiceDiscount) > 0 && (
              <div className="flex-between" style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '8px' }}>
                <span>Invoice Discount</span>
                <span>- PKR {parseFloat(invoiceDiscount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex-between" style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Net Payable Total</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#7C3AED' }}>
                PKR {netTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              Select Payment Method <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            
            {banks.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No payment methods available. Please seed/create bank accounts.
              </div>
            ) : (
              <div className="bank-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {banks.map(bank => {
                  const isSelected = selectedBank?.id === bank.id;
                  const isCashAcc = bank.name.toLowerCase().includes('cash');
                  return (
                    <div
                      key={bank.id}
                      onClick={() => {
                        setSelectedBank(bank);
                        setProofFile(null);
                        setProofPreview(null);
                        setError(null);
                      }}
                      className={`bank-payment-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2.5px solid #7C3AED' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div className="flex-between">
                        {isCashAcc ? (
                          <Wallet size={20} style={{ color: isSelected ? '#7C3AED' : 'var(--text-muted)' }} />
                        ) : (
                          <Landmark size={20} style={{ color: isSelected ? '#7C3AED' : 'var(--text-muted)' }} />
                        )}
                        {isSelected && (
                          <span style={{
                            backgroundColor: '#7C3AED',
                            color: '#white',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>✓</span>
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', marginTop: '4px' }}>
                        {bank.name}
                      </span>
                      {isAdmin && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          PKR {parseFloat(bank.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount Paid Field */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px' }}>
              Amount Paid (PKR) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              className="form-input"
              style={{ fontSize: '18px', fontWeight: 700, padding: '10px 14px', color: '#10B981' }}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              min="0"
              step="0.01"
            />
            
            {/* Real-time outstanding/change indicators */}
            <div style={{ marginTop: '8px' }}>
              {changeDue > 0 && (
                <div style={{ color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                  <span>💵</span> Return to customer: PKR {changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              )}
              {outstanding > 0 && (
                <div style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                  <span>⚠️</span> Outstanding Balance: PKR {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              )}
              {paid === total && paid > 0 && (
                <div style={{ color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                  <span>✅</span> Fully Paid
                </div>
              )}
            </div>
          </div>

          {/* Proof of Payment Upload */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '8px' }}>
              <span>
                Proof of Payment
                {proofRequired ? (
                  <span style={{ color: 'var(--danger)' }}> * Required for bank transfer</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}> (Optional for Cash)</span>
                )}
              </span>
            </label>

            {!proofFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('proof-file-picker').click()}
                className={`dropzone-area ${dragging ? 'dragging' : ''} ${proofRequired ? 'required-zone' : ''}`}
                style={{
                  border: dragging ? '2px dashed #7C3AED' : '2px dashed var(--border-color)',
                  backgroundColor: dragging ? 'rgba(124, 58, 237, 0.04)' : 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  id="proof-file-picker"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
                <Upload size={28} style={{ color: dragging ? '#7C3AED' : 'var(--text-muted)', margin: '0 auto 8px auto' }} />
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Click to upload or drag & drop proof
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  JPG, JPEG, PNG, or PDF up to 5MB
                </p>
              </div>
            ) : (
              <div className="upload-preview-box" style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {proofPreview === 'pdf' ? (
                    <FileText size={28} style={{ color: '#EF4444' }} />
                  ) : (
                    <img 
                      src={proofPreview} 
                      alt="Proof preview" 
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                      {proofFile.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setProofFile(null);
                    setProofPreview(null);
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            )}
          </div>

          {/* Payment Note (Optional) */}
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px' }}>
              Payment Note (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="e.g. Transaction ID, Bank transfer reference"
            />
          </div>

          {/* Error Message Panel */}
          {error && (
            <div className="error-alert" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#EF4444',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 500,
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer-payment flex-between" style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card-hover)',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
            style={{ flex: 1, padding: '10px' }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirm}
            className="btn btn-primary"
            disabled={loading || proofMissing || !selectedBank}
            style={{
              flex: 1.5,
              padding: '10px',
              opacity: (proofMissing || !selectedBank) ? 0.6 : 1,
              cursor: (proofMissing || !selectedBank) ? 'not-allowed' : 'pointer',
              backgroundColor: '#7C3AED',
              color: '#white',
              fontWeight: 'bold'
            }}
          >
            {loading ? (
              <span className="flex-center" style={{ gap: '8px' }}>
                <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#ffffff', margin: 0 }} />
                Processing...
              </span>
            ) : (
              <span className="flex-center" style={{ gap: '6px' }}>
                <Check size={16} /> Confirm Checkout
              </span>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .bank-payment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .dropzone-area:hover {
          border-color: #7C3AED !important;
          background-color: rgba(124, 58, 237, 0.02) !important;
        }
        .required-zone {
          border-color: rgba(239, 68, 68, 0.4) !important;
        }
        .modal-body-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .modal-body-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-body-scroll::-webkit-scrollbar-thumb {
          background-color: var(--border-color);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default PaymentModal;
