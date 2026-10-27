import React, { useEffect, useMemo, useState } from 'react';
import {
  PawPrint, Search, Filter, Package, Plus, Edit3, Archive, X, CheckCircle2,
  AlertTriangle, LogIn, LogOut, RefreshCw, ShoppingCart, Printer, Copy, Minus
} from 'lucide-react';
import { api } from './api.js';

const money = value => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const emptyProduct = { brand: '', name: '', price: '', stock: '' };

export default function App() {
  const [page, setPage] = useState('catalog');
  const [adminSection, setAdminSection] = useState('inventory');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [password, setPassword] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [customer, setCustomer] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [cart, setCart] = useState([]);

  const refreshProducts = async () => {
    setLoading(true);
    setError('');
    try {
      setProducts(await api.products());
    } catch (requestError) {
      setError(`${requestError.message} Verifica que el backend esté iniciado.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshProducts(); }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(editing?.image || '');
      return undefined;
    }
    const preview = URL.createObjectURL(imageFile);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [editing, imageFile]);

  const brands = useMemo(
    () => [...new Set(products.map(product => product.brand))].sort(),
    [products]
  );
  const availableProducts = products.filter(product =>
    product.stock > 0 &&
    `${product.brand} ${product.name}`.toLowerCase().includes(search.toLowerCase()) &&
    (!brand || product.brand === brand)
  );
  const filteredInventory = products.filter(product =>
    `${product.brand} ${product.name}`.toLowerCase().includes(search.toLowerCase())
  );
  const quoteTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);

  const openAdmin = async () => {
    setError('');
    try {
      const session = await api.checkAdmin();
      api.setAdminCsrfToken(session.csrfToken);
      setPage('admin');
      await refreshProducts();
    } catch (requestError) {
      if (requestError.status === 401) {
        api.setAdminCsrfToken('');
        setPage('login');
      } else {
        setError(requestError.message);
      }
    }
  };

  const login = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { csrfToken } = await api.login(password);
      api.setAdminCsrfToken(csrfToken);
      setPassword('');
      setPage('admin');
      await refreshProducts();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    let message = 'Sesión de administrador cerrada';
    try {
      await api.logout();
    } catch (requestError) {
      message = `Se cerró la sesión en este navegador, pero no se pudo revocar en el servidor: ${requestError.message}`;
    }
    api.setAdminCsrfToken('');
    setCart([]);
    setPage('catalog');
    setNotice(message);
  };

  const openNewProduct = () => {
    setEditing(null);
    setForm(emptyProduct);
    setImageFile(null);
    setModal(true);
  };

  const openEditProduct = product => {
    setEditing(product);
    setForm({
      brand: product.brand,
      name: product.name,
      price: product.price,
      stock: product.stock
    });
    setImageFile(null);
    setModal(true);
  };

  const saveProduct = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const productData = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock)
      };
      let product = editing
        ? await api.updateProduct(editing.id, productData)
        : await api.createProduct(productData);
      if (imageFile) {
        try {
          product = await api.uploadProductImage(product.id, imageFile);
        } catch (imageError) {
          if (!editing) setEditing(product);
          await refreshProducts();
          setNotice(`Producto guardado, pero no se pudo cargar la imagen: ${imageError.message}`);
          if (imageError.status === 401) logout();
          return;
        }
      }
      setModal(false);
      setImageFile(null);
      setNotice(editing ? 'Producto actualizado' : 'Producto agregado');
      await refreshProducts();
    } catch (requestError) {
      setNotice(requestError.message);
      if (requestError.status === 401) logout();
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async product => {
    if (!confirm(`¿Archivar ${product.brand} ${product.name}?`)) return;
    try {
      await api.archiveProduct(product.id);
      setNotice('Producto archivado');
      await refreshProducts();
    } catch (requestError) {
      setNotice(requestError.message);
      if (requestError.status === 401) logout();
    }
  };

  const updateQuantity = (product, delta) => {
    setCart(current => {
      const found = current.find(item => item.id === product.id);
      const quantity = (found?.quantity || 0) + delta;
      if (quantity <= 0) return current.filter(item => item.id !== product.id);
      if (quantity > product.stock) {
        setNotice(`Stock disponible para ${product.name}: ${product.stock}`);
        return current;
      }
      if (found) return current.map(item => item.id === product.id ? { ...item, quantity } : item);
      return [...current, { ...product, quantity }];
    });
  };

  const quoteText = () => [
    'PA LA MASCOTA · COTIZACIÓN',
    `Fecha: ${new Date().toLocaleDateString('es-CL')}`,
    `Cliente: ${customer.trim() || 'Sin especificar'}`,
    '',
    ...cart.map(item => `${item.brand} ${item.name} x${item.quantity} — ${money(item.price * item.quantity)}`),
    '',
    `TOTAL: ${money(quoteTotal)}`,
    ...(quoteNotes.trim() ? ['', `Observaciones: ${quoteNotes.trim()}`] : [])
  ].join('\n');

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(quoteText());
      setNotice('Cotización copiada');
    } catch {
      setNotice('No se pudo copiar. Revisa los permisos del navegador.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setPage('catalog')} aria-label="Ir al catálogo">
          <span className="logo"><PawPrint size={25} /></span>
          <span><strong>Pa la <em>mascota</em></strong><small>Productos para sus mejores amigos</small></span>
        </button>
        <div className="top-actions">
          {page === 'admin' ? (
            <button className="btn header-btn" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>
          ) : page === 'login' ? (
            <button className="btn header-btn" onClick={() => setPage('catalog')}>Volver al catálogo</button>
          ) : (
            <button className="btn header-btn" onClick={openAdmin}><LogIn size={16} /> Administrador</button>
          )}
        </div>
      </header>

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
            {page === 'catalog' && <button onClick={refreshProducts}>Reintentar</button>}
          </div>
        )}

        {page === 'login' && (
          <section className="login-card">
            <span className="login-icon"><PawPrint size={24} /></span>
            <p className="eyebrow">ACCESO PRIVADO</p>
            <h1>Administración</h1>
            <p className="subheading">Ingresa tu contraseña para administrar el inventario y preparar cotizaciones.</p>
            <form onSubmit={login}>
              <label className="field-label">Contraseña de administrador
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoFocus
                />
              </label>
              <button className="btn primary full" disabled={saving}>
                {saving ? 'Ingresando…' : <><LogIn size={16} /> Ingresar</>}
              </button>
            </form>
          </section>
        )}

        {page === 'catalog' && (
          <>
            <div className="page-heading public-heading">
              <div>
                <p className="eyebrow">CATÁLOGO DE PRODUCTOS</p>
                <h1>Todo para tu mascota</h1>
                <p className="subheading">Revisa nuestros productos disponibles y sus precios.</p>
              </div>
              <button className="btn secondary" onClick={refreshProducts} title="Actualizar catálogo">
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
            <div className="filters public-filters">
              <label className="search-box"><Search size={17} />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar producto o marca…" />
              </label>
              <label className="select-box"><Filter size={16} />
                <select value={brand} onChange={event => setBrand(event.target.value)}>
                  <option value="">Todas las marcas</option>
                  {brands.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="catalog-meta">
              <span>{loading ? 'Cargando productos…' : `${availableProducts.length} productos disponibles`}</span>
              {(search || brand) && <button className="text-btn" onClick={() => { setSearch(''); setBrand(''); }}>Limpiar filtros</button>}
            </div>
            {loading && products.length === 0 ? (
              <div className="empty-state"><Package size={32} /><p>Cargando catálogo…</p></div>
            ) : availableProducts.length ? (
              <div className="product-grid">
                {availableProducts.map(product => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="empty-state"><Package size={35} /><h2>No hay productos disponibles</h2><p>Prueba con otra búsqueda o vuelve a revisar más tarde.</p></div>
            )}
          </>
        )}

        {page === 'admin' && (
          <>
            <div className="page-heading admin-heading">
              <div>
                <p className="eyebrow">PANEL DE ADMINISTRACIÓN</p>
                <h1>Gestión de la tienda</h1>
                <p className="subheading">Administra tus productos y prepara cotizaciones sin descontar stock.</p>
              </div>
            </div>
            <nav className="admin-tabs" aria-label="Secciones de administración">
              <button className={adminSection === 'inventory' ? 'active' : ''} onClick={() => setAdminSection('inventory')}>
                <Package size={17} /> Inventario
              </button>
              <button className={adminSection === 'quotes' ? 'active' : ''} onClick={() => setAdminSection('quotes')}>
                <ShoppingCart size={17} /> Cotizaciones
                {cart.length > 0 && <span className="nav-count">{cart.length}</span>}
              </button>
            </nav>

            {adminSection === 'inventory' && (
              <section className="panel">
                <div className="panel-heading inventory-heading">
                  <div><h2>Inventario</h2><p>Agrega productos o actualiza su precio y stock.</p></div>
                  <div className="inventory-actions">
                    <label className="search-box compact"><Search size={16} />
                      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar…" />
                    </label>
                    <button className="btn primary" onClick={openNewProduct}><Plus size={16} /> Agregar producto</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Producto</th><th>Marca</th><th>Precio</th><th>Stock actual</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {filteredInventory.map(product => (
                        <tr key={product.id}>
                          <td className="strong">{product.name}</td>
                          <td>{product.brand}</td>
                          <td>{money(product.price)}</td>
                          <td>{product.stock}</td>
                          <td><StockBadge stock={product.stock} /></td>
                          <td><div className="row-actions">
                            <button className="action-btn" title="Editar producto" onClick={() => openEditProduct(product)}><Edit3 size={16} /></button>
                            <button className="action-btn danger" title="Archivar producto" onClick={() => archiveProduct(product)}><Archive size={16} /></button>
                          </div></td>
                        </tr>
                      ))}
                      {!filteredInventory.length && <tr><td colSpan="6" className="empty">No hay productos que coincidan con la búsqueda.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminSection === 'quotes' && (
              <div className="quote-workspace">
                <section className="quote-products">
                  <div className="panel-heading quote-products-heading">
                    <div><h2>Productos disponibles</h2><p>Agrega artículos a la cotización.</p></div>
                    <label className="search-box compact"><Search size={16} />
                      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar…" />
                    </label>
                  </div>
                  <div className="quote-product-list">
                    {filteredInventory.filter(product => product.stock > 0).map(product => {
                      const quantity = cart.find(item => item.id === product.id)?.quantity || 0;
                      return (
                        <article className="quote-product-row" key={product.id}>
                          <div><span className="product-brand">{product.brand}</span><strong>{product.name}</strong><small>{money(product.price)} · {product.stock} en stock</small></div>
                          <div className="quote-add-control">
                            {quantity > 0 && <span>{quantity}</span>}
                            <button className="add-btn" disabled={quantity >= product.stock} onClick={() => updateQuantity(product, 1)} aria-label={`Agregar ${product.name}`}><Plus size={16} /> Agregar</button>
                          </div>
                        </article>
                      );
                    })}
                    {!filteredInventory.some(product => product.stock > 0 && `${product.brand} ${product.name}`.toLowerCase().includes(search.toLowerCase())) &&
                      <p className="empty">No hay productos disponibles para agregar.</p>}
                  </div>
                </section>

                <section className="quote-sheet">
                  <div className="quote-sheet-heading"><span className="quote-icon"><ShoppingCart size={19} /></span><div><h2>Cotización</h2><p>{cart.length} productos seleccionados</p></div></div>
                  <label className="field-label">Nombre del cliente
                    <input value={customer} onChange={event => setCustomer(event.target.value)} placeholder="Cliente" />
                  </label>
                  <div className="quote-line-items">
                    {cart.map(item => (
                      <div className="quote-item" key={item.id}>
                        <div className="quote-item-main"><strong>{item.brand} {item.name}</strong><span>{money(item.price)} c/u</span></div>
                        <div className="mini-qty">
                          <button aria-label="Quitar una unidad" onClick={() => updateQuantity(item, -1)}><Minus size={13} /></button>
                          <span>{item.quantity}</span>
                          <button aria-label="Agregar una unidad" disabled={item.quantity >= item.stock} onClick={() => updateQuantity(item, 1)}><Plus size={13} /></button>
                        </div>
                        <strong className="quote-subtotal">{money(item.price * item.quantity)}</strong>
                      </div>
                    ))}
                    {!cart.length && <div className="quote-empty"><ShoppingCart size={26} /><strong>Tu cotización está vacía</strong><p>Agrega productos para calcular el total.</p></div>}
                  </div>
                  <label className="field-label">Observaciones
                    <textarea rows="2" value={quoteNotes} onChange={event => setQuoteNotes(event.target.value)} placeholder="Opcional" />
                  </label>
                  <div className="quote-total"><span>Total estimado</span><strong>{money(quoteTotal)}</strong></div>
                  <div className="quote-actions">
                    <button className="btn secondary" disabled={!cart.length} onClick={copyQuote}><Copy size={15} /> Copiar</button>
                    <button className="btn primary" disabled={!cart.length} onClick={() => window.print()}><Printer size={15} /> Imprimir / Guardar PDF</button>
                  </div>
                  <p className="quote-disclaimer">Preparar una cotización no descuenta productos del inventario.</p>
                </section>
              </div>
            )}
          </>
        )}

        <footer className="main-footer no-print"><span>© {new Date().getFullYear()} Pa la mascota</span><span>Catálogo de productos y precios</span></footer>
      </main>

      {notice && <div className="toast"><CheckCircle2 size={18} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15} /></button></div>}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">{editing ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}</p><h2>{editing ? 'Actualizar producto' : 'Agregar producto'}</h2></div><button className="icon-btn" onClick={() => setModal(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <form onSubmit={saveProduct} className="product-form">
              <label className="field-label">Marca<input required maxLength="100" value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} /></label>
              <label className="field-label">Nombre del producto<input required maxLength="160" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
              <div className="form-row">
                <label className="field-label">Precio (CLP)<input required type="number" min="0" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>
                <label className="field-label">Stock actual<input required type="number" min="0" step="1" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} /></label>
              </div>
              <label className="field-label">Imagen del producto
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={event => setImageFile(event.target.files?.[0] || null)}
                />
                <small className="form-note">JPG, PNG o WebP. Máximo 5 MB.</small>
              </label>
              {imagePreview && <img className="product-image-preview" src={imagePreview} alt="Vista previa del producto" />}
              <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</button></div>
              <p className="form-note">Los cambios de stock quedan registrados en el historial.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <article className="product-card">
      <div className="product-visual">
        {product.image
          ? <img src={product.image} alt={product.name} loading="lazy" />
          : <div className="product-placeholder"><PawPrint size={34} /><span>{product.brand}</span></div>}
        <span className={`stock-pill ${product.stock <= 5 ? 'low' : ''}`}>{product.stock} en stock</span>
      </div>
      <div className="product-info">
        <span className="product-brand">{product.brand}</span>
        <h2>{product.name}</h2>
        <strong className="product-price">{money(product.price)}</strong>
      </div>
    </article>
  );
}

function StockBadge({ stock }) {
  const tone = stock === 0 ? 'red' : stock <= 5 ? 'orange' : 'green';
  const label = stock === 0 ? 'Agotado' : stock <= 5 ? 'Stock bajo' : 'Disponible';
  return <span className={`status-badge ${tone}`}>{label}</span>;
}
