import axios, { type AxiosRequestConfig } from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

// Request deduplication cache - stores the promise for in-flight GET requests
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(config: AxiosRequestConfig): string {
  const method = config.method?.toUpperCase() ?? 'GET';
  const url = config.url ?? '';
  const params = config.params ? JSON.stringify(config.params) : '';
  const data = config.data ? JSON.stringify(config.data) : '';
  return `${method}:${url}:${params}:${data}`;
}

const api = axios.create({
  baseURL: configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : '/api',
});

// Add auth header to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Request deduplication wrapper - call this instead of api.get() directly for GET requests
// to enable deduplication. For other methods, use api directly.
// Returns the full axios response (with .data) to maintain compatibility with existing code.
export async function deduplicatedGet<T>(url: string, config?: AxiosRequestConfig): Promise<import('axios').AxiosResponse<T>> {
  const key = `GET:${url}:${config?.params ? JSON.stringify(config.params) : ''}`;
  
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<import('axios').AxiosResponse<T>>;
  }
  
  const promise = api.get<T>(url, config).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

export async function deduplicatedRequest<T>(config: AxiosRequestConfig): Promise<import('axios').AxiosResponse<T>> {
  const key = getRequestKey(config);
  
  if (config.method?.toUpperCase() === 'GET') {
    const existing = pendingRequests.get(key);
    if (existing) {
      return existing as Promise<import('axios').AxiosResponse<T>>;
    }
  }
  
  const promise = api.request<T>(config).finally(() => {
    if (config.method?.toUpperCase() === 'GET') {
      pendingRequests.delete(key);
    }
  });
  
  if (config.method?.toUpperCase() === 'GET') {
    pendingRequests.set(key, promise);
  }
  
  return promise;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const requestUrl: string = error.config?.url ?? '';
    // The active-context switch handles 403/423 locally (see AuthContext.switchContext)
    // so it must not trigger the global session-wipe/redirect below.
    const isActiveContextRequest = requestUrl.includes('/me/active-context');

    if ((status === 423 || code === 'condominium_inactive') && !isActiveContextRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/condominium-inactive') {
        window.location.href = '/condominium-inactive';
      }
      return Promise.reject(error);
    }

    // Global RGPD/GDPR consent gate (HTTP 451). The user must stay authenticated
    // to POST their acceptance, so we redirect WITHOUT wiping the token. The
    // consent GET/POST endpoints are allow-listed and never return 451.
    const isConsentRequest = requestUrl.includes('/me/consents');
    if ((status === 451 || code === 'consent_required') && !isConsentRequest) {
      if (window.location.pathname !== '/consent-required') {
        window.location.href = '/consent-required';
      }
      return Promise.reject(error);
    }

    if (status === 401 && !isActiveContextRequest) {      // Login/2FA requests are handled by LoginPage, which already shows a
      // localized error. Wiping the session and hard-redirecting here would
      // flash the error and immediately refresh the page, making it unreadable.
      const pathname = window.location.pathname;
      const isAuthRequest = requestUrl.includes('/platform/auth/');
      if (pathname === '/login' || isAuthRequest) {
        return Promise.reject(error);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
