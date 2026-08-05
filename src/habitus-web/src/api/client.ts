import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const api = axios.create({
  baseURL: configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
