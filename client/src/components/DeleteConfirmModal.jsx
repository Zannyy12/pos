import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName, title, message, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-content delete-modal" style={{ maxWidth: '440px', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* Header visual cue */}
        <div style={{
          height: '6px',
          background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)'
        }} />

        <div style={{ padding: '24px' }}>
          <div className="flex" style={{ gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              padding: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={24} />
            </div>
            
            <div style={{ flex: 1 }}>
              <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  {title || 'Confirm Deletion'}
                </h3>
                <button 
                  onClick={onClose} 
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover-bg-mute"
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ 
                marginTop: '12px', 
                fontSize: '14px', 
                color: 'var(--text-muted)', 
                lineHeight: '1.5',
                margin: '12px 0 0 0'
              }}>
                {message || `Are you sure you want to delete "${itemName || 'this item'}"? This action cannot be undone and may affect associated records.`}
              </p>
            </div>
          </div>

          <div className="flex" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
              style={{ minWidth: '80px' }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-danger flex-center" 
              onClick={onConfirm}
              disabled={loading}
              style={{ 
                minWidth: '100px',
                gap: '6px',
                backgroundColor: '#ef4444',
                color: '#ffffff'
              }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#ffffff', margin: 0 }} />
              ) : (
                <>
                  <Trash2 size={14} />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
