import axios from 'axios';

const backendOrigin =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://zf-yqpy.onrender.com');

const apiBaseUrl = `${backendOrigin.replace(/\/$/, '')}/api/v1`;

let refreshPromise: Promise<void> | null = null;

type AuthAwareRequestConfig = {
  _retry?: boolean;
  skipAuthRedirect?: boolean;
  url?: string;
};

export const axiosPublic = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const axiosPrivate = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

axiosPrivate.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config ?? {}) as AuthAwareRequestConfig;
    const isAuthPage =
      typeof window !== 'undefined' &&
      ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].some((path) =>
        window.location.pathname.startsWith(path),
      );

    if (error?.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axiosPublic.post('/auth/refresh').then(() => undefined).finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return axiosPrivate(originalRequest);
      } catch {
        await axiosPublic.post('/auth/clear-session').catch(() => undefined);
        if (!originalRequest.skipAuthRedirect && !isAuthPage) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export function getOAuthUrl(provider: 'google' | 'github') {
  return `${apiBaseUrl}/auth/${provider}`;
}

export async function logoutSession() {
  try {
    await axiosPrivate.post('/auth/logout');
  } finally {
    await axiosPublic.post('/auth/clear-session').catch(() => undefined);
  }
}
