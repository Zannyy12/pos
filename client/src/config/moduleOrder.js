// config/moduleOrder.js
// Priority order: the first module where user has can_view=true becomes their landing page.
export const MODULE_ORDER = [
  { module: 'Dashboard',        path: '/dashboard',        permModule: 'dashboard' },
  { module: 'Invoice',          path: '/invoice',          permModule: 'invoice' },
  { module: 'Sales View',       path: '/sales-view',       permModule: 'sales-view' },
  { module: 'Customers',        path: '/customers',        permModule: 'customers' },
  { module: 'Vendors',          path: '/vendors',          permModule: 'vendors' },
  { module: 'Products',         path: '/products',         permModule: 'products' },
  { module: 'Stock',            path: '/stock',            permModule: 'stock' },
  { module: 'Expenses',         path: '/expenses',         permModule: 'expenses' },
  { module: 'Duplicate Bill',   path: '/duplicate-bill',   permModule: 'duplicate-bill' },
  { module: 'Itemwise Refund',  path: '/refund',           permModule: 'refund' },
  { module: 'Banks',            path: '/banks',            permModule: 'banks' },
  { module: 'Purchase Return',  path: '/purchase-return',  permModule: 'purchase-return' },
  { module: 'Salesman',         path: '/salesman',         permModule: 'salesman' },
  { module: 'Administration',   path: '/admin',            permModule: 'users' },
];
