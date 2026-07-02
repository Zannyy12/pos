import React, { useEffect, useState, useRef } from 'react';
import { axios } from '../../store/useAuthStore';
import useAuthStore from '../../store/useAuthStore';
import { Plus, Edit2, Trash2, Search, FileUp, FileDown, Barcode, X, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import { useDelete } from '../../hooks/useDelete';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

// Barcode rendering subcomponent
const BarcodeRenderer = ({ value }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 2
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [value]);

  return <svg ref={svgRef}></svg>;
};

const Products = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);

  // Data lists
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, totalPages: 1 });

  // Filters & Search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals & Drawer states
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Product Form states
  const [prodName, setProdName] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodLimit, setProdLimit] = useState('');

  // Category Form states
  const [catName, setCatName] = useState('');

  const { addToast, hasPermission, user } = useAuthStore();
  const isCashier = user?.role === 'Cashier';
  const fileInputRef = useRef(null);

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/products/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      addToast('Error loading categories', 'error');
    }
  };

  // Fetch Products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/products', {
        params: {
          page,
          search,
          category_id: categoryFilter,
          limit: 10
        }
      });
      setProducts(Array.isArray(res.data?.data) ? res.data.data : []);
      setMeta(res.data?.meta || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      console.error(err);
      addToast('Error loading products list', 'error');
    } finally {
      setLoading(false);
    }
  };

  // useDelete hooks — declared AFTER the fetch functions to avoid TDZ reference errors
  const {
    isOpen: deleteProductOpen,
    selectedName: deleteProductName,
    loading: deleteProductLoading,
    triggerDelete: triggerDeleteProduct,
    confirmDelete: confirmDeleteProduct,
    cancelDelete: cancelDeleteProduct
  } = useDelete({
    endpoint: '/api/products',
    label: 'Product',
    onSuccess: () => fetchProducts()
  });

  const {
    isOpen: deleteCategoryOpen,
    selectedName: deleteCategoryName,
    loading: deleteCategoryLoading,
    triggerDelete: triggerDeleteCategory,
    confirmDelete: confirmDeleteCategory,
    cancelDelete: cancelDeleteCategory
  } = useDelete({
    endpoint: '/api/products/categories',
    label: 'Category',
    onSuccess: () => fetchCategories()
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    }
  }, [page, search, categoryFilter, activeTab]);

  // Handle Category Save
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      addToast('Category name cannot be empty', 'warning');
      return;
    }

    try {
      if (selectedCategory) {
        await axios.put(`/api/products/categories/${selectedCategory.id}`, { name: catName });
        addToast('Category updated successfully', 'success');
      } else {
        await axios.post('/api/products/categories', { name: catName });
        addToast('New category added', 'success');
      }
      setCategoryModalOpen(false);
      setCatName('');
      fetchCategories();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving category', 'error');
    }
  };

  // Handle Category Delete
  const handleDeleteCategory = (id, name) => {
    triggerDeleteCategory(id, name);
  };

  // Open Product Modal
  const openProductModal = (product = null) => {
    if (product) {
      setSelectedProduct(product);
      setProdName(product.name);
      setProdBarcode(product.barcode);
      setProdCategoryId(product.category_id || '');
      setProdCost(product.cost);
      setProdPrice(product.price);
      setProdLimit(product.quantity_limit);
    } else {
      setSelectedProduct(null);
      setProdName('');
      setProdBarcode('');
      setProdCategoryId(categories[0]?.id || '');
      setProdCost('0.00');
      setProdPrice('0.00');
      setProdLimit('10');
    }
    setProductModalOpen(true);
  };

  // Handle Product Save
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName.trim()) {
      addToast('Product name is required', 'warning');
      return;
    }

    const payload = {
      name: prodName,
      barcode: prodBarcode || undefined, // Backend will auto generate if empty
      category_id: prodCategoryId ? parseInt(prodCategoryId) : null,
      cost: parseFloat(prodCost),
      price: parseFloat(prodPrice),
      quantity_limit: parseInt(prodLimit || 5)
    };

    try {
      if (selectedProduct) {
        await axios.put(`/api/products/${selectedProduct.id}`, payload);
        addToast('Product profile updated', 'success');
      } else {
        await axios.post('/api/products', payload);
        addToast('New product registered', 'success');
      }
      setProductModalOpen(false);
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving product details', 'error');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PKR' }).format(val);
  };

  // Handle Product Delete
  const handleDeleteProduct = (id, name) => {
    triggerDeleteProduct(id, name);
  };

  // Export to Excel Helper
  const handleExportExcel = async () => {
    try {
      addToast('Exporting products...', 'info');
      const res = await axios.get('/api/products/export-excel');
      const data = res.data;

      // Create sheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

      // Save
      XLSX.writeFile(workbook, 'KhuzdarPOS_Products_List.xlsx');
      addToast('Excel export downloaded successfully', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error exporting products lists', 'error');
    }
  };

  // Import from Excel Helper
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryStr = evt.target.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse rows
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (rows.length === 0) {
          addToast('Excel sheet is empty or contains invalid rows', 'warning');
          return;
        }

        // Send to backend bulk API
        addToast('Importing rows, please wait...', 'info');
        await axios.post('/api/products/import-excel', { products: rows });
        addToast(`Successfully imported ${rows.length} product(s)`, 'success');
        fetchProducts();
      } catch (err) {
        console.error(err);
        addToast(err.response?.data?.message || 'Excel layout parsing error', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset input
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="products-page">
      {/* Top Header Row */}
      <div className="flex-between header-row" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="welcome-headline">Inventory Profiles</h1>
          <p>Configure product codes, prices, barcodes, and categories</p>
        </div>

        <div className="flex action-buttons">
          {hasPermission('products', 'add') && (
            <>
              <button className="btn btn-secondary" onClick={triggerFileInput} title="Import Excel Sheet">
                <FileUp size={18} />
                Import Excel
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
                onChange={handleImportExcel}
              />
            </>
          )}

          {hasPermission('products', 'view') && (
            <button className="btn btn-secondary" onClick={handleExportExcel} title="Export Excel Sheet">
              <FileDown size={18} />
              Export Excel
            </button>
          )}

          {activeTab === 'products' && hasPermission('products', 'add') && (
            <button className="btn btn-primary" onClick={() => openProductModal(null)}>
              <Plus size={18} />
              Add Product
            </button>
          )}

          {activeTab === 'categories' && hasPermission('categories', 'add') && (
            <button className="btn btn-primary" onClick={() => { setSelectedCategory(null); setCatName(''); setCategoryModalOpen(true); }}>
              <Plus size={18} />
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs Controller */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products List
        </button>
        <button
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Category Configuration
        </button>
      </div>

      {activeTab === 'products' ? (
        <>
          {/* Filters Panel */}
          <div className="glass-card filters-panel">
            <div className="grid grid-3" style={{ gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Search Products</label>
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search name or barcode..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Filter Category</label>
                <select
                  className="form-input"
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex" style={{ alignSelf: 'flex-end', height: '42px', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSearch(''); setCategoryFilter(''); setPage(1); }}>
                  Clear Filter
                </button>
              </div>
            </div>
          </div>

          {/* Products Table */}
          {loading ? (
            <div className="flex-center" style={{ height: '30vh' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)' }}></div>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    {!isCashier && <th style={{ textAlign: 'right' }}>Cost Price</th>}
                    <th style={{ textAlign: 'right' }}>Retail Price</th>
                    <th style={{ textAlign: 'center' }}>Limit</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="barcode-cell" title={p.barcode}>
                          <BarcodeRenderer value={p.barcode} />
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.category_name || 'N/A'}</td>
                      {!isCashier && <td style={{ textAlign: 'right' }}>{formatCurrency(p.cost)}</td>}
                      <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{formatCurrency(p.price)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-warning">{p.quantity_limit}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openProductModal(p)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProduct(p.id, p.name)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={isCashier ? "6" : "7"} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No products registered matching criteria</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {meta.totalPages > 1 && (
                <div className="flex-between pagination-row" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {meta.currentPage} of {meta.totalPages}</span>
                  <div className="flex" style={{ gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
                    <button className="btn btn-secondary btn-sm" disabled={page === meta.totalPages} onClick={() => setPage(page + 1)}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Categories Table */
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="table-container" style={{ marginTop: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category Name</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedCategory(c); setCatName(c.name); setCategoryModalOpen(true); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id, c.name)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card instructions-card">
            <h3>Category Rules</h3>
            <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6' }}>
              Product Categories organize inventory profiles. Creating detailed categories improves the accuracy of report sales graphs.
            </p>
            <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.6', color: 'var(--danger)' }}>
              Note: Categories cannot be deleted if products are currently linked. First reassign those products.
            </p>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {productModalOpen && (
        <div className="modal-overlay" onClick={() => setProductModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedProduct ? 'Edit Product Profile' : 'Register New Product'}</h3>
              <button className="theme-toggle-btn" onClick={() => setProductModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Lipton Yellow Label Tea 200g"
                  required
                />
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Barcode Value</label>
                  <input
                    type="text"
                    className="form-input"
                    value={prodBarcode}
                    onChange={(e) => setProdBarcode(e.target.value)}
                    placeholder="Auto generated if left empty"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={isCashier ? "grid grid-2" : "grid grid-3"}>
                {!isCashier && (
                  <div className="form-group">
                    <label className="form-label">Cost Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={prodCost}
                      onChange={(e) => setProdCost(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Retail Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Warning Limit</label>
                  <input
                    type="number"
                    className="form-input"
                    value={prodLimit}
                    onChange={(e) => setProdLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {categoryModalOpen && (
        <div className="modal-overlay" onClick={() => setCategoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3>{selectedCategory ? 'Edit Category' : 'Register New Category'}</h3>
              <button className="theme-toggle-btn" onClick={() => setCategoryModalOpen(false)} style={{ border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Groceries"
                  required
                />
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCategoryModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .tabs-container {
          display: flex;
          gap: 8px;
          border-bottom: 2px solid var(--border-color);
          margin-bottom: 20px;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 12px 20px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
        }

        .tab-btn:hover {
          color: var(--primary);
        }

        .tab-btn.active {
          color: var(--primary);
        }

        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: var(--primary);
        }

        .filters-panel {
          padding: 18px 24px;
          margin-bottom: 20px;
        }

        .search-input-wrapper {
          position: relative;
        }

        .search-input-wrapper .form-input {
          padding-left: 38px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .barcode-cell {
          height: 40px;
          display: flex;
          align-items: center;
        }

        .instructions-card {
          padding: 24px;
          background: var(--bg-card);
        }
      `}</style>

      <DeleteConfirmModal
        isOpen={deleteProductOpen}
        onClose={cancelDeleteProduct}
        onConfirm={confirmDeleteProduct}
        itemName={deleteProductName}
        title="Delete Product"
        message={"Are you sure you want to delete \"" + deleteProductName + "\"? This will soft-delete the product profile and hide it from catalogs."}
        loading={deleteProductLoading}
      />

      <DeleteConfirmModal
        isOpen={deleteCategoryOpen}
        onClose={cancelDeleteCategory}
        onConfirm={confirmDeleteCategory}
        itemName={deleteCategoryName}
        title="Delete Category"
        message={"Are you sure you want to delete category \"" + deleteCategoryName + "\"?"}
        loading={deleteCategoryLoading}
      />
    </div>
  );
};

export default Products;
