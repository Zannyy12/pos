import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

const NoAccess = () => {
  const navigate = useNavigate();

  const handleBackToLogin = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="no-access-page">
      <div className="no-access-card">
        <div className="icon-ring">
          <ShieldX size={48} />
        </div>
        <h1 className="no-access-title">No Access</h1>
        <p className="no-access-body">
          Your account has no modules assigned yet.<br />
          Please contact your <strong>Administrator</strong> to grant you access.
        </p>
        <button className="back-btn" onClick={handleBackToLogin}>
          <ArrowLeft size={16} />
          Back to Login
        </button>
      </div>

      <style>{`
        .no-access-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 30% 40%, rgba(239,68,68,0.1) 0%, transparent 50%),
                      var(--bg-main);
          padding: 24px;
        }

        .no-access-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 56px 48px;
          text-align: center;
          max-width: 440px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }

        .icon-ring {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: rgba(239,68,68,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 28px auto;
          color: var(--danger);
          border: 2px solid rgba(239,68,68,0.25);
        }

        .no-access-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 14px;
        }

        .no-access-body {
          font-size: 15px;
          color: var(--text-muted);
          line-height: 1.7;
          margin-bottom: 36px;
        }

        .no-access-body strong {
          color: var(--primary);
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 28px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .back-btn:hover {
          opacity: 0.88;
        }
      `}</style>
    </div>
  );
};

export default NoAccess;
