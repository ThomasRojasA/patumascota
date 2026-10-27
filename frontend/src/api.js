const defaultApiUrl = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';
const BASE = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '');
let adminCsrfToken = '';

function logDesktopEvent(event) {
  const desktop = window.palaMascotaDesktop;
  if (!desktop) return;
  desktop.logApiEvent(event).catch(error => {
    window.dispatchEvent(new CustomEvent('desktop-log-error', { detail: error.message }));
  });
}

if (window.palaMascotaDesktop) {
  window.addEventListener('online', () => logDesktopEvent({ type: 'connection', connection: 'online' }));
  window.addEventListener('offline', () => logDesktopEvent({ type: 'connection', connection: 'offline' }));
  logDesktopEvent({
    type: 'connection',
    connection: navigator.onLine ? 'online' : 'offline'
  });
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = options.method || 'GET';
  const requestUrl = new URL(`${BASE}${path}`, window.location.href);
  const startedAt = performance.now();
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(adminCsrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)
      ? { 'X-CSRF-Token': adminCsrfToken }
      : {}),
    ...(options.headers || {})
  };
  let response;
  try {
    response = await fetch(requestUrl, { ...options, headers, credentials: 'include' });
  } catch (error) {
    logDesktopEvent({
      type: 'api',
      method,
      path: requestUrl.pathname,
      status: null,
      durationMs: performance.now() - startedAt,
      error: error.message,
      connection: navigator.onLine ? 'online' : 'offline'
    });
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  logDesktopEvent({
    type: 'api',
    method,
    path: requestUrl.pathname,
    status: response.status,
    durationMs: performance.now() - startedAt,
    response: data
  });
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  setAdminCsrfToken: token => { adminCsrfToken = token || ''; },
  login: password => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  checkAdmin: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  products: () => request('/products'),
  createProduct: product => request('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, product) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  sales: () => request('/sales'),
  uploadProductImage: (id, file) => {
    const body = new FormData();
    body.append('image', file);
    return request(`/products/${id}/image`, { method: 'POST', body });
  },
  archiveProduct: id => request(`/products/${id}`, { method: 'DELETE' })
};
