import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { getRedirectPath } from '../../utils/getRedirectPath';
import { Shield, Lock, User, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login, token, user, permissions, addToast } = useAuthStore();

  // If already logged in, redirect to correct page
  useEffect(() => {
    if (token && user) {
      navigate(getRedirectPath(user.role, permissions), { replace: true });
    }
  }, [token, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('Please enter both username and password', 'error');
      return;
    }

    setLoading(true);
    const result = await login(username, password, role);
    setLoading(false);

    if (result.success) {
      navigate(result.redirectPath, { replace: true });
    }
  };

  // Helper autofills for testing convenience
  const autofillUser = (selectedRole) => {
    setRole(selectedRole);
    setUsername(selectedRole.toLowerCase());
    setPassword('1234');
  };

  return (
    <div className="login-page">
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="login-logo">K</div>
          <h1 className="login-title">Khuzdar POS</h1>
          <p className="login-subtitle">Sign in to manage your point of sale</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Select Role</label>
            <div className="role-selector-wrapper">
              <Shield className="input-icon" size={18} />
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                className="form-input"
              >
                <option value="Admin">Admin</option>
                <option value="Cashier">Cashier</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                autoComplete="current-password"
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Sign In'}
          </button>
        </form>

        <div className="quick-access-panel">
          <span className="quick-label">Quick Access:</span>
          <div className="quick-buttons">
            <button onClick={() => autofillUser('Admin')} className="btn btn-secondary btn-sm">Admin</button>
            <button onClick={() => autofillUser('Cashier')} className="btn btn-secondary btn-sm">Cashier</button>
          </div>
        </div>

        <div className="login-footer">
          <p>Designed and Developed By Zain Bashir</p>
          <p className="contact-info">Contact/Whatsapp: +92 320 0256793</p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 10% 20%, rgba(124, 58, 237, 0.15) 0%, transparent 45%),
                      radial-gradient(circle at 90% 80%, rgba(167, 139, 250, 0.1) 0%, transparent 45%),
                      var(--bg-main);
          padding: 20px;
          transition: background-color var(--transition-normal);
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          padding: 40px 32px;
          background: var(--bg-card);
          box-shadow: var(--shadow-lg);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          width: 54px;
          height: 54px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          font-weight: 700;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-lg);
          margin: 0 auto 16px auto;
          box-shadow: 0 8px 16px rgba(124, 58, 237, 0.3);
        }

        .login-title {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 6px;
        }

        .login-subtitle {
          font-size: 14px;
          color: var(--text-muted);
        }

        .login-form {
          margin-bottom: 24px;
        }

        .input-wrapper, .role-selector-wrapper {
          position: relative;
        }

        .input-wrapper .form-input, .role-selector-wrapper .form-input {
          padding-left: 44px;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .password-toggle:hover {
          color: var(--primary);
        }

        .login-btn {
          width: 100%;
          padding: 12px;
          font-weight: 600;
          margin-top: 10px;
          border-radius: var(--radius-md);
        }

        .quick-access-panel {
          border-top: 1px solid var(--border-color);
          padding-top: 20px;
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .quick-label {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .quick-buttons {
          display: flex;
          gap: 10px;
        }

        .login-footer {
          text-align: center;
          margin-top: 32px;
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .contact-info {
          font-weight: 500;
          color: var(--primary);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
};

export default Login;
