import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore, { axios } from './store/useAuthStore';
import Layout from './components/layout/Layout';
import { getRedirectPath } from './utils/getRedirectPath';

// Pages
import Login from './pages/auth/Login';
import NoAccess from './pages/auth/NoAccess';
import Dashboard from './pages/dashboard/Dashboard';
import Invoice from './pages/invoice/Invoice';
import DuplicateBill from './pages/invoice/DuplicateBill';
import Products from './pages/products/Products';
import Customers from './pages/customers/Customers';
import Salesman from './pages/salesman/Salesman';
import Vendors from './pages/vendors/Vendors';
import Stock from './pages/stock/Stock';
import PurchaseReturn from './pages/purchase-return/PurchaseReturn';
import Expenses from './pages/expenses/Expenses';
import Refund from './pages/refund/Refund';
import Banks from './pages/banks/Banks';
import SalesReport from './pages/reports/SalesReport';
import UserManagement from './pages/admin/UserManagement';

// ─── Permission-Aware Route Guard ───────────────────────────────────────────
// Reads token, user, and permissions from localStorage so it works on F5 refresh
// without waiting for an async profile fetch.
const PermissionRoute = ({ permModule, children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');

  // Not logged in → login page
  if (!token || !user) return <Navigate to="/login" replace />;

  // Admin always passes
  if (user.role === 'Admin') return <Layout>{children}</Layout>;

  // No module specified → just check token
  if (!permModule) return <Layout>{children}</Layout>;

  // Check flat permissions array
  const perm = permissions.find(p => p.module === permModule);
  if (perm && perm.can_view === true) return <Layout>{children}</Layout>;

  // No permission → smart redirect to first allowed page (not logout)
  const redirectPath = getRedirectPath(user.role, permissions);
  return <Navigate to={redirectPath} replace />;
};

// ─── Global Toast Portal ────────────────────────────────────────────────────
const ToastContainer = () => {
  const { toasts } = useAuthStore();

  return (
    <div className="toast-portal">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card toast-${t.type}`}>
          <span>{t.message}</span>
        </div>
      ))}
      <style>{`
        .toast-portal {
          position: fixed;
          top: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
          pointer-events: none;
        }

        .toast-card {
          min-width: 280px;
          max-width: 380px;
          padding: 14px 20px;
          border-radius: var(--radius-md);
          color: white;
          font-weight: 500;
          font-size: 14px;
          box-shadow: var(--shadow-lg);
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: auto;
        }

        .toast-success { background-color: var(--success); }
        .toast-error { background-color: var(--danger); }
        .toast-warning { background-color: var(--warning); color: #1e293b; }
        .toast-info { background-color: var(--info); }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Root App ───────────────────────────────────────────────────────────────
function App() {
  const { initTheme, refreshPermissions } = useAuthStore();

  useEffect(() => {
    initTheme();

    // Silently refresh permissions whenever the window regains focus
    // so live permission changes from Admin are picked up without logout
    const handleFocus = () => refreshPermissions();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/no-access" element={<NoAccess />} />

        {/* Protected Module Routes */}
        <Route path="/dashboard" element={
          <PermissionRoute permModule="dashboard">
            <Dashboard />
          </PermissionRoute>
        } />

        <Route path="/invoice" element={
          <PermissionRoute permModule="invoice">
            <Invoice />
          </PermissionRoute>
        } />

        <Route path="/duplicate-bill" element={
          <PermissionRoute permModule="duplicate-bill">
            <DuplicateBill />
          </PermissionRoute>
        } />

        <Route path="/products" element={
          <PermissionRoute permModule="products">
            <Products />
          </PermissionRoute>
        } />

        <Route path="/customers" element={
          <PermissionRoute permModule="customers">
            <Customers />
          </PermissionRoute>
        } />

        <Route path="/salesman" element={
          <PermissionRoute permModule="salesman">
            <Salesman />
          </PermissionRoute>
        } />

        <Route path="/vendors" element={
          <PermissionRoute permModule="vendors">
            <Vendors />
          </PermissionRoute>
        } />

        <Route path="/stock" element={
          <PermissionRoute permModule="stock">
            <Stock />
          </PermissionRoute>
        } />

        <Route path="/purchase-return" element={
          <PermissionRoute permModule="purchase-return">
            <PurchaseReturn />
          </PermissionRoute>
        } />

        <Route path="/expenses" element={
          <PermissionRoute permModule="expenses">
            <Expenses />
          </PermissionRoute>
        } />

        <Route path="/refund" element={
          <PermissionRoute permModule="refund">
            <Refund />
          </PermissionRoute>
        } />

        <Route path="/banks" element={
          <PermissionRoute permModule="banks">
            <Banks />
          </PermissionRoute>
        } />

        <Route path="/sales-view" element={
          <PermissionRoute permModule="sales-view">
            <SalesReport />
          </PermissionRoute>
        } />

        <Route path="/admin" element={
          <PermissionRoute permModule="users">
            <UserManagement />
          </PermissionRoute>
        } />

        {/* Fallback: redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Global Toast Portal */}
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
