import React, { useEffect, useState } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Key, ShieldAlert, X } from 'lucide-react';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const {
    isOpen: deleteOpen,
    selectedName: deleteName,
    loading: deleteLoading,
    triggerDelete: triggerDeleteUser,
    confirmDelete: confirmDeleteUser,
    cancelDelete: cancelDeleteUser
  } = useDelete({
    endpoint: '/api/users',
    label: 'User',
    onSuccess: () => fetchUsers()
  });
  
  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Cashier');
  
  // Permissions checkbox states
  const [userPermissions, setUserPermissions] = useState({});

  const modulesList = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'invoice', label: 'POS Invoice (Billing)' },
    { key: 'duplicate-bill', label: 'Duplicate Bills & Invoices' },
    { key: 'products', label: 'Products Profile' },
    { key: 'categories', label: 'Product Categories' },
    { key: 'customers', label: 'Customer Management' },
    { key: 'salesman', label: 'Salesman Management' },
    { key: 'vendors', label: 'Vendor Management' },
    { key: 'stock', label: 'Stock / Purchase Adjustments' },
    { key: 'purchase-return', label: 'Purchase Returns' },
    { key: 'expenses', label: 'Expense Tracking' },
    { key: 'refund', label: 'POS Invoices Refunds' },
    { key: 'banks', label: 'Banks & Cash Ledger' },
    { key: 'sales-view', label: 'Sales LEDGER Report' }
  ];

  const actionsList = ['view', 'add', 'edit', 'delete'];

  const { addToast, user: loggedUser } = useAuthStore();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error(err);
      addToast('Failed to fetch user list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setSelectedUser(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('Cashier');
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setName(user.name);
    setUsername(user.username);
    setPassword(''); // Leave blank to not change password
    setRole(user.role);
    setModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!name || !username) {
      addToast('Please enter both name and username', 'warning');
      return;
    }

    try {
      if (selectedUser) {
        // Edit mode
        await axios.put(`/api/users/${selectedUser.id}`, { name, username, password: password || undefined, role });
        addToast('User updated successfully', 'success');
      } else {
        // Create mode
        if (!password) {
          addToast('Password is required for new users', 'warning');
          return;
        }
        await axios.post('/api/users', { name, username, password, role });
        addToast('New user account created', 'success');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Error saving user', 'error');
    }
  };

  const handleDeleteUser = (user) => {
    if (user.id === loggedUser.id) {
      addToast('Cannot delete your own logged-in user profile', 'error');
      return;
    }
    triggerDeleteUser(user.id, user.name);
  };

  const openPermissionDrawer = async (user) => {
    setSelectedUser(user);
    setUserPermissions({});
    try {
      const res = await axios.get(`/api/users/${user.id}/permissions`);
      const permsObj = {};
      res.data.forEach(p => {
        permsObj[p.module] = {
          view: Boolean(p.can_view),
          add: Boolean(p.can_add),
          edit: Boolean(p.can_edit),
          delete: Boolean(p.can_delete)
        };
      });
      setUserPermissions(permsObj);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      addToast('Failed to load user permissions', 'error');
    }
    setPermissionDrawerOpen(true);
  };

  const handlePermissionChange = (moduleKey, actionKey, checked) => {
    setUserPermissions(prev => {
      const modulePerms = prev[moduleKey] || { view: false, add: false, edit: false, delete: false };
      return {
        ...prev,
        [moduleKey]: {
          ...modulePerms,
          [actionKey]: checked
        }
      };
    });
  };

  const handleSavePermissions = async () => {
    const permissionsArray = Object.entries(userPermissions).map(([module, perms]) => ({
      module,
      can_view: Boolean(perms.view),
      can_add: Boolean(perms.add),
      can_edit: Boolean(perms.edit),
      can_delete: Boolean(perms.delete)
    }));

    try {
      await axios.put(`/api/users/${selectedUser.id}/permissions`, { permissions: permissionsArray });
      addToast(`Permissions updated for ${selectedUser.name}`, 'success');
      setPermissionDrawerOpen(false);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error(err);
      addToast('Failed to update permission configurations', 'error');
    }
  };

  return (
    <div className="user-management-page">
      <div className="flex-between header-row">
        <div>
          <h1 className="welcome-headline">Staff Administration</h1>
          <p>Configure cashier profiles and module level permissions</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role Type</th>
                <th>Password</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td>{user.username}</td>
                  <td>
                    <span className={`badge ${user.role === 'Admin' ? 'badge-success' : 'badge-info'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ letterSpacing: '3px', color: 'var(--text-muted)' }}>••••••</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                      {user.role !== 'Admin' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openPermissionDrawer(user)}
                          title="Edit Permissions"
                        >
                          <Key size={14} />
                          Rights
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(user)}
                        title="Edit User Info"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={user.id === loggedUser.id}
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedUser ? 'Edit User' : 'Create Staff Profile'}</h3>
              <button className="theme-toggle-btn" onClick={() => setModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zain Bashir"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. zain"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password {selectedUser && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required={!selectedUser}
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Admin">Admin (Full Access Override)</option>
                  <option value="Cashier">Cashier (Role restricted by Rights)</option>
                </select>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', marginTop: '24px', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions side drawer */}
      {permissionDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setPermissionDrawerOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between drawer-header">
              <div>
                <h3>Configure Rights</h3>
                <p style={{ fontSize: '13px' }}>Module access for: {selectedUser?.name}</p>
              </div>
              <button className="theme-toggle-btn" onClick={() => setPermissionDrawerOpen(false)} style={{ border: 'none' }}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="admin-bypass-alert">
                <ShieldAlert size={18} className="warning-color" />
                <span>Selected rights are automatically applied. Unchecked options deny API queries.</span>
              </div>

              <div className="permissions-matrix">
                {modulesList.map((m) => {
                  const currentModuleRights = userPermissions[m.key] || { view: false, add: false, edit: false, delete: false };
                  return (
                    <div key={m.key} className="permission-module-row">
                      <h4 className="module-title-label">{m.label}</h4>
                      <div className="checkbox-actions-row">
                        {actionsList.map((action) => (
                          <label key={action} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={!!currentModuleRights[action]}
                              onChange={(e) => handlePermissionChange(m.key, action, e.target.checked)}
                            />
                            <span className="checkbox-text">{action.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn btn-secondary" onClick={() => setPermissionDrawerOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePermissions}>Apply Permissions</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .header-row {
          margin-bottom: 24px;
        }

        .drawer-header {
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .admin-bypass-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: var(--radius-md);
          background-color: var(--warning-light);
          color: var(--text-main);
          font-size: 12px;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .permissions-matrix {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .permission-module-row {
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 14px;
        }

        .module-title-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary);
          margin-bottom: 8px;
        }

        .checkbox-actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        .checkbox-label input {
          width: 16px;
          height: 16px;
          accent-color: var(--primary);
        }

        .checkbox-text {
          color: var(--text-main);
        }

        .drawer-footer {
          padding: 24px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={cancelDeleteUser}
        onConfirm={confirmDeleteUser}
        itemName={deleteName}
        title="Delete User Account"
        message={`Are you sure you want to delete user "${deleteName}"? This will restrict their access to Khuzdar POS.`}
        loading={deleteLoading}
      />
    </div>
  );
};

export default UserManagement;
