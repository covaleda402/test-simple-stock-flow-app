// API Client para Simple Stock Flow
// Cumple estrictamente con el contrato definido en test-simple-stock-flow-docs

export interface AuthResult {
  accessToken: string;
  expiresAt: string;
  username: string;
  role: 'admin' | 'seller';
}

export interface Category {
  id: string;
  name: string;
}

export interface ProductView {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface SaleItemView {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleView {
  id: string;
  soldAt: string;
  soldBy: string;
  total: number;
  currency: string;
  items: SaleItemView[];
}

export interface SalesReportRow {
  productId: string;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
}

export interface SalesReport {
  from: string;
  to: string;
  salesCount: number;
  grandTotal: number;
  currency: string;
  rows: SalesReportRow[];
}

let currentToken: string | null = localStorage.getItem('ssf_token');

export const setAuthToken = (token: string | null) => {
  currentToken = token;
  if (token) {
    localStorage.setItem('ssf_token', token);
  } else {
    localStorage.removeItem('ssf_token');
  }
};

export const getAuthToken = () => currentToken;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    if (response.status === 401) {
      setAuthToken(null);
      throw new Error('Sesión no autorizada o expirada. Por favor, inicia sesión.');
    }
    if (response.status === 403) {
      throw new Error('No tienes permisos para realizar esta acción.');
    }
    if (response.status === 404) {
      throw new Error('El recurso solicitado no existe.');
    }

    try {
      const errorJson = await response.json();
      throw new Error(errorJson.detail || errorJson.title || 'Error en la petición.');
    } catch (e: any) {
      throw new Error(e.message || `Error del servidor (${response.status})`);
    }
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  registerSeller: (username: string, password: string) =>
    request<{ id: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role: 'seller' }),
    }),

  // Categories
  getCategories: () => request<Category[]>('/api/categories'),

  // Products
  getProducts: (page = 1, size = 20, search?: string, categoryId?: string) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    return request<PagedResult<ProductView>>(`/api/products?${params.toString()}`);
  },

  getProduct: (id: string) => request<ProductView>(`/api/products/${id}`),

  createProduct: (data: { name: string; price: number; stock: number; categoryId: string }) =>
    request<{ id: string }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: { name: string; price: number; stock: number; categoryId: string }) =>
    request<void>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    request<void>(`/api/products/${id}`, {
      method: 'DELETE',
    }),

  uploadProductImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string }>(`/api/products/${id}/image`, {
      method: 'POST',
      body: formData,
    });
  },

  // Sales
  placeSale: (lines: { productId: string; quantity: number }[]) =>
    request<{ id: string }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify({ lines }),
    }),

  getSales: (from: string, to: string, page = 1, size = 20) => {
    const params = new URLSearchParams({ from, to, page: String(page), size: String(size) });
    return request<PagedResult<SaleView>>(`/api/sales?${params.toString()}`);
  },

  getSale: (id: string) => request<SaleView>(`/api/sales/${id}`),

  // Reports
  getSalesReport: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return request<SalesReport>(`/api/reports/sales?${params.toString()}`);
  },
};
