const defaultApiUrl = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';
const BASE = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '');
let adminCsrfToken = '';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(adminCsrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(options.method || 'GET')
      ? { 'X-CSRF-Token': adminCsrfToken }
      : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
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
  uploadProductImage: (id, file) => {
    const body = new FormData();
    body.append('image', file);
    return request(`/products/${id}/image`, { method: 'POST', body });
  },
  archiveProduct: id => request(`/products/${id}`, { method: 'DELETE' })
};
