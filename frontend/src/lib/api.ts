const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getHeaders = (): HeadersInit => {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('cf_token');
  const orgSlug = localStorage.getItem('cf_org_slug');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgSlug ? { 'X-Org-Slug': orgSlug } : {}),
  };
};

const handleResponse = async (res: Response) => {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_refresh_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
};

export const api = {
  get: (path: string) =>
    fetch(`${API_URL}${path}`, { headers: getHeaders() }).then(handleResponse),

  post: (path: string, body?: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then(handleResponse),

  put: (path: string, body?: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then(handleResponse),

  patch: (path: string, body?: unknown) =>
    fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then(handleResponse),

  delete: (path: string) =>
    fetch(`${API_URL}${path}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),
};

export const setAuthData = (token: string, refreshToken: string, orgSlug: string) => {
  localStorage.setItem('cf_token', token);
  localStorage.setItem('cf_refresh_token', refreshToken);
  localStorage.setItem('cf_org_slug', orgSlug);
};

export const clearAuthData = () => {
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_refresh_token');
  localStorage.removeItem('cf_org_slug');
  localStorage.removeItem('cf_user');
};

export const isAuthenticated = () =>
  typeof window !== 'undefined' && !!localStorage.getItem('cf_token');
