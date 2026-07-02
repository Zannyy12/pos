const express = require('express');
const router = express.Router();
const {
  getCategories, createCategory, updateCategory, deleteCategory,
  getProducts, createProduct, updateProduct, deleteProduct,
  exportProducts, importProducts
} = require('../controllers/productController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Categories Routes
router.get('/categories', authenticateToken, requirePermission('categories', 'view'), getCategories);
router.post('/categories', authenticateToken, requirePermission('categories', 'add'), createCategory);
router.put('/categories/:id', authenticateToken, requirePermission('categories', 'edit'), updateCategory);
router.delete('/categories/:id', authenticateToken, requirePermission('categories', 'delete'), deleteCategory);

// Products Routes
router.get('/export-excel', authenticateToken, requirePermission('products', 'view'), exportProducts);
router.post('/import-excel', authenticateToken, requirePermission('products', 'add'), importProducts);

router.get('/', authenticateToken, requirePermission('products', 'view'), getProducts);
router.post('/', authenticateToken, requirePermission('products', 'add'), createProduct);
router.put('/:id', authenticateToken, requirePermission('products', 'edit'), updateProduct);
router.delete('/:id', authenticateToken, requirePermission('products', 'delete'), deleteProduct);

module.exports = router;
