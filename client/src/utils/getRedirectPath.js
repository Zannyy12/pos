import { MODULE_ORDER } from '../config/moduleOrder';

export const getRedirectPath = (role, permissions) => {
  // Admin always goes to Dashboard
  if (role === 'Admin') return '/dashboard';

  // If no permissions, return no-access
  if (!permissions) return '/no-access';

  // For any other role, find first module with can_view = true
  for (const item of MODULE_ORDER) {
    if (Array.isArray(permissions)) {
      const perm = permissions.find(p => p.module === item.permModule);
      if (perm && (perm.can_view === true || perm.can_view === 'true')) {
        return item.path;
      }
    } else {
      // Support object structure
      const perm = permissions[item.permModule];
      if (perm && (perm.view === true || perm.view === 'true')) {
        return item.path;
      }
    }
  }

  // No permissions at all → No Access page
  return '/no-access';
};
