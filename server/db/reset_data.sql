-- Khuzdar POS — Full Data Reset
-- Wipes ALL records, keeps only admin user (id=1) with existing password hash.

BEGIN;

-- Disable FK triggers temporarily for clean deletion
SET session_replication_role = 'replica';

-- Clear all tables (child tables first, then parent tables)
DELETE FROM audit_logs;
DELETE FROM bank_ledger;
DELETE FROM refund_items;
DELETE FROM refunds;
DELETE FROM purchase_returns;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM payments_vendors;
DELETE FROM payments_customers;
DELETE FROM expenses;
DELETE FROM expense_types;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM stock;
DELETE FROM banks;
DELETE FROM vendors;
DELETE FROM customers;
DELETE FROM salesmen;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM user_permissions;

-- Delete all users EXCEPT admin (id=1)
DELETE FROM users WHERE id != 1;

-- Also clear the admin's deleted_at in case it was soft-deleted
UPDATE users SET deleted_at = NULL WHERE id = 1;

-- Re-enable FK triggers
SET session_replication_role = 'origin';

-- Reset all auto-increment sequences so new IDs start from 1 (or 2 for users)
SELECT setval('audit_logs_id_seq', 1, false);
SELECT setval('user_permissions_id_seq', 1, false);
SELECT setval('bank_ledger_id_seq', 1, false);
SELECT setval('refund_items_id_seq', 1, false);
SELECT setval('refunds_id_seq', 1, false);
SELECT setval('purchase_returns_id_seq', 1, false);
SELECT setval('purchase_order_items_id_seq', 1, false);
SELECT setval('purchase_orders_id_seq', 1, false);
SELECT setval('payments_vendors_id_seq', 1, false);
SELECT setval('payments_customers_id_seq', 1, false);
SELECT setval('expenses_id_seq', 1, false);
SELECT setval('expense_types_id_seq', 1, false);
SELECT setval('order_items_id_seq', 1, false);
SELECT setval('orders_id_seq', 1, false);
SELECT setval('stock_id_seq', 1, false);
SELECT setval('banks_id_seq', 1, false);
SELECT setval('vendors_id_seq', 1, false);
SELECT setval('customers_id_seq', 1, false);
SELECT setval('salesmen_id_seq', 1, false);
SELECT setval('products_id_seq', 1, false);
SELECT setval('categories_id_seq', 1, false);
SELECT setval('users_id_seq', 2, false);

COMMIT;
