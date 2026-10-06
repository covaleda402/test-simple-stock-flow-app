import React, { useState, useEffect } from 'react';
import {
  api,
  setAuthToken,
  ProductView,
  Category,
  SalesReport,
} from './services/api';

export default function App() {
  const [user, setUser] = useState<{ username: string; role: 'admin' | 'seller' } | null>(() => {
    const saved = localStorage.getItem('ssf_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'catalog' | 'cart' | 'reports' | 'sellers'>('catalog');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin@stockflow.local');
  const [loginPassword, setLoginPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);

  // Catalog state
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Cart state
  const [cart, setCart] = useState<{ [productId: string]: { product: ProductView; quantity: number } }>({});

  // Product Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductView | null>(null);
  const [productForm, setProductForm] = useState({ name: '', price: 0, stock: 0, categoryId: '' });

  // Seller Form state
  const [sellerUsername, setSellerUsername] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [sellerSuccess, setSellerSuccess] = useState<string | null>(null);

  // Reports state
  const [reportFrom, setReportFrom] = useState('2026-01-01T00:00:00Z');
  const [reportTo, setReportTo] = useState('2026-12-31T23:59:59Z');
  const [reportData, setReportData] = useState<SalesReport | null>(null);

  useEffect(() => {
    if (user) {
      loadCategories();
      loadProducts(1);
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await api.login(loginUsername, loginPassword);
      setAuthToken(res.accessToken);
      const userData = { username: res.username, role: res.role };
      setUser(userData);
      localStorage.setItem('ssf_user', JSON.stringify(userData));
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('ssf_user');
  };

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
      if (data.length > 0 && !productForm.categoryId) {
        setProductForm((prev) => ({ ...prev, categoryId: data[0].id }));
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadProducts = async (page = 1) => {
    try {
      const res = await api.getProducts(page, 20, search || undefined, selectedCategory || undefined);
      setProducts(res.items);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages);
      setTotalProducts(res.total);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(1);
  };

  // Cart operations
  const addToCart = (product: ProductView) => {
    setCart((prev) => {
      const existing = prev[product.id];
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty + 1 > product.stock) {
        alert(`Stock insuficiente para ${product.name}`);
        return prev;
      }
      return {
        ...prev,
        [product.id]: { product, quantity: currentQty + 1 },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handlePlaceSale = async () => {
    setErrorMessage(null);
    const lines = Object.values(cart).map((c) => ({
      productId: c.product.id,
      quantity: c.quantity,
    }));

    if (lines.length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    try {
      const res = await api.placeSale(lines);
      alert(`¡Venta registrada con éxito! ID: ${res.id}`);
      setCart({});
      setActiveTab('catalog');
      loadProducts(currentPage);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Product CRUD
  const openCreateModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: 1000,
      stock: 10,
      categoryId: categories.length > 0 ? categories[0].id : '',
    });
    setIsProductModalOpen(true);
  };

  const openEditModal = (p: ProductView) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      price: p.price,
      stock: p.stock,
      categoryId: p.categoryId,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productForm);
      } else {
        await api.createProduct(productForm);
      }
      setIsProductModalOpen(false);
      loadProducts(currentPage);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Seguro que deseas dar de baja este producto?')) return;
    try {
      await api.deleteProduct(id);
      loadProducts(currentPage);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Register seller
  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSellerSuccess(null);
    try {
      const res = await api.registerSeller(sellerUsername, sellerPassword);
      setSellerSuccess(`Vendedor registrado exitosamente con ID: ${res.id}`);
      setSellerUsername('');
      setSellerPassword('');
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Load report
  const handleLoadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const res = await api.getSalesReport(reportFrom, reportTo);
      setReportData(res);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  if (!user) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#60a5fa' }}>
            Simple Stock Flow
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Inicia sesión para gestionar el inventario y las ventas.
          </p>

          {errorMessage && <div className="alert-error">{errorMessage}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Correo / Usuario</label>
              <input
                className="form-control"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-control"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((acc, c) => acc + c.product.price * c.quantity, 0);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-badge">
          <span className="logo-title">Simple Stock Flow</span>
        </div>
        <div className="user-info">
          <span>{user.username}</span>
          <span className={`badge badge-${user.role}`}>{user.role}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          📦 Catálogo de Productos
        </button>
        <button
          className={`tab-btn ${activeTab === 'cart' ? 'active' : ''}`}
          onClick={() => setActiveTab('cart')}
        >
          🛒 Carrito de Venta {cartItems.length > 0 && `(${cartItems.length})`}
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📊 Reporte de Ventas
        </button>
        {user.role === 'admin' && (
          <button
            className={`tab-btn ${activeTab === 'sellers' ? 'active' : ''}`}
            onClick={() => setActiveTab('sellers')}
          >
            👥 Alta de Vendedores
          </button>
        )}
      </div>

      {errorMessage && <div className="alert-error">{errorMessage}</div>}

      {/* TAB: CATALOG */}
      {activeTab === 'catalog' && (
        <div>
          <div className="card">
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre..."
                style={{ flex: 1, minWidth: '200px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: '200px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary">
                Buscar
              </button>
              {user.role === 'admin' && (
                <button type="button" onClick={openCreateModal} className="btn btn-primary" style={{ background: '#059669' }}>
                  + Nuevo Producto
                </button>
              )}
            </form>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              <span>Total de productos: {totalProducts}</span>
              <span>Página {currentPage} de {totalPages}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio (COP)</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron productos.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.categoryName}</td>
                      <td>${p.price.toLocaleString('es-CO')}</td>
                      <td>
                        <span style={{ color: p.stock > 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                          {p.stock}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => addToCart(p)}
                            disabled={p.stock <= 0}
                            className="btn btn-primary btn-sm"
                          >
                            + Vender
                          </button>
                          {user.role === 'admin' && (
                            <>
                              <button onClick={() => openEditModal(p)} className="btn btn-secondary btn-sm">
                                Editar
                              </button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-danger btn-sm">
                                Baja
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => loadProducts(currentPage - 1)}
                >
                  Anterior
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => loadProducts(currentPage + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CART */}
      {activeTab === 'cart' && (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Carrito de Venta</h3>
          {cartItems.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>El carrito de venta está vacío.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio Unitario</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((c) => (
                    <tr key={c.product.id}>
                      <td>{c.product.name}</td>
                      <td>${c.product.price.toLocaleString('es-CO')}</td>
                      <td>{c.quantity}</td>
                      <td>${(c.product.price * c.quantity).toLocaleString('es-CO')}</td>
                      <td>
                        <button onClick={() => removeFromCart(c.product.id)} className="btn btn-danger btn-sm">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                <h3>Total: ${cartTotal.toLocaleString('es-CO')} COP</h3>
                <button onClick={handlePlaceSale} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                  Confirmar Venta
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: REPORTS */}
      {activeTab === 'reports' && (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Reporte de Ventas por Período</h3>
            <form onSubmit={handleLoadReport} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Desde (ISO 8601)</label>
                <input
                  type="text"
                  className="form-control"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Hasta (ISO 8601)</label>
                <input
                  type="text"
                  className="form-control"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Generar Reporte
              </button>
            </form>
          </div>

          {reportData && (
            <div className="card">
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                <div>
                  <span className="form-label">Ventas Registradas</span>
                  <h2>{reportData.salesCount}</h2>
                </div>
                <div>
                  <span className="form-label">Total Facturado</span>
                  <h2 style={{ color: '#34d399' }}>${reportData.grandTotal.toLocaleString('es-CO')} COP</h2>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Unidades Vendidas</th>
                    <th>Ingresos (COP)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hubo ventas en este período.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.productName}</td>
                        <td>{row.categoryName}</td>
                        <td>{row.unitsSold}</td>
                        <td>${row.revenue.toLocaleString('es-CO')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: SELLERS (Admin only) */}
      {activeTab === 'sellers' && user.role === 'admin' && (
        <div className="card" style={{ maxWidth: '500px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Dar de Alta Nuevo Vendedor</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Como administrador, puedes crear cuentas exclusivas para vendedores de mostrador (DP-04).
          </p>

          {sellerSuccess && <div style={{ color: '#34d399', marginBottom: '1rem' }}>{sellerSuccess}</div>}

          <form onSubmit={handleRegisterSeller}>
            <div className="form-group">
              <label className="form-label">Nombre de Usuario</label>
              <input
                type="text"
                className="form-control"
                value={sellerUsername}
                onChange={(e) => setSellerUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-control"
                value={sellerPassword}
                onChange={(e) => setSellerPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Registrar Vendedor
            </button>
          </form>
        </div>
      )}

      {/* MODAL: PRODUCT FORM */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '1.5rem' }}>
              {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
            </h3>
            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label className="form-label">Nombre del Producto</label>
                <input
                  type="text"
                  className="form-control"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select
                  className="form-control"
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Precio (COP)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Inicial</label>
                  <input
                    type="number"
                    className="form-control"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value, 10) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
