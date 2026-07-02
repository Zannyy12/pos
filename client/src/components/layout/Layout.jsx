import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import {
  LayoutDashboard, Users, ShoppingBag, Truck, Warehouse,
  Receipt, CreditCard, Wallet, LogOut, Menu, Sun, Moon,
  FileText, Undo2, Landmark, UserSquare2, ShieldCheck, X
} from 'lucide-react';
import { MODULE_ORDER } from '../../config/moduleOrder';

// Icon map keyed by path
const ICON_MAP = {
  '/dashboard':       LayoutDashboard,
  '/invoice':         Receipt,
  '/sales-view':      Wallet,
  '/customers':       Users,
  '/vendors':         Truck,
  '/products':        ShoppingBag,
  '/stock':           Warehouse,
  '/expenses':        CreditCard,
  '/duplicate-bill':  FileText,
  '/refund':          Undo2,
  '/banks':           Landmark,
  '/purchase-return': Undo2,
  '/salesman':        UserSquare2,
  '/admin':           ShieldCheck,
};

const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { user, permissions, logout, darkMode, toggleDarkMode } = useAuthStore();

  // Build sidebar items from MODULE_ORDER — filter by user's flat permissions array
  const filteredMenuItems = MODULE_ORDER.filter(item => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    const perm = (permissions || []).find(p => p.module === item.permModule);
    return perm && perm.can_view === true;
  });


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Sidebar for Desktop */}
      <aside className={`sidebar-container ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-purple">K</div>
            {!collapsed && <span className="logo-text">Khuzdar POS</span>}
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredMenuItems.map((item) => {
            const Icon = ICON_MAP[item.path] || ShieldCheck;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.module}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={20} className="nav-icon" />
                {!collapsed && <span className="nav-label">{item.module}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} className="nav-icon" />
            {!collapsed && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`main-wrapper ${collapsed ? 'expanded' : ''}`}>
        {/* Top Header */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle-btn" onClick={() => setCollapsed(!collapsed)}>
              <Menu size={20} />
            </button>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="page-title-label">
              {MODULE_ORDER.find(m => m.path === location.pathname)?.module || 'Khuzdar POS'}
            </h2>
          </div>

          <div className="topbar-right">
            <button className="theme-toggle-btn" onClick={toggleDarkMode} title="Toggle Theme">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="user-profile-badge">
              <div className="user-avatar">{user?.name?.slice(0, 2).toUpperCase() || 'US'}</div>
              <div className="user-details">
                <span className="user-name">{user?.name}</span>
                <span className="user-role">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content-panel">
          {children}
        </main>
      </div>

      {/* Styled JSX for the Layout Component */}
      <style>{`
        .sidebar-container {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background-color: var(--bg-sidebar);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: width var(--transition-normal);
        }

        .sidebar-container.collapsed {
          width: 80px;
        }

        .sidebar-header {
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-purple {
          width: 38px;
          height: 38px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          font-weight: 700;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
        }

        .logo-text {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.5px;
        }

        .mobile-close {
          display: none;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: var(--radius-md);
          font-weight: 500;
          font-size: 14px;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          background-color: var(--primary-light);
          color: var(--primary);
        }

        .nav-item.active {
          background-color: var(--primary);
          color: white;
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .sidebar-footer {
          padding: 16px 12px;
          border-top: 1px solid var(--border-color);
        }

        .logout-btn {
          width: 100%;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
        }

        .logout-btn:hover {
          background-color: var(--danger-light);
          color: var(--danger);
        }

        .main-wrapper {
          flex: 1;
          margin-left: 260px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          transition: margin-left var(--transition-normal);
        }

        .main-wrapper.expanded {
          margin-left: 80px;
        }

        .topbar {
          height: 70px;
          background-color: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 90;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .menu-toggle-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: var(--radius-sm);
        }

        .menu-toggle-btn:hover {
          background-color: var(--primary-light);
          color: var(--primary);
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .page-title-label {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-main);
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .theme-toggle-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
          transition: all var(--transition-fast);
        }

        .theme-toggle-btn:hover {
          background-color: var(--primary-light);
          color: var(--primary);
          border-color: var(--primary);
        }

        .user-profile-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px 6px 6px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 13px;
        }

        .user-details {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
        }

        .user-role {
          font-size: 11px;
          color: var(--text-muted);
        }

        .main-content-panel {
          padding: 24px;
          flex: 1;
        }

        /* Mobile Layout Modifications */
        @media (max-width: 768px) {
          .sidebar-container {
            transform: translateX(-100%);
            width: 260px !important;
          }

          .sidebar-container.open {
            transform: translateX(0);
          }

          .mobile-close {
            display: block;
          }

          .main-wrapper {
            margin-left: 0 !important;
          }

          .menu-toggle-btn {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          .topbar {
            padding: 0 16px;
          }
          
          .main-content-panel {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
