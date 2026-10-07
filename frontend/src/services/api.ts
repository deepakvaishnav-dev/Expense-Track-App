import axios from 'axios';
import { Platform, NativeModules } from 'react-native';
import { useAuthStore } from '../store/authStore';

declare const window: any;

// Determine the API base URL dynamically depending on the platform/host
const getApiBaseUrl = () => {
  // 1. Check if configured via .env (using standard Expo EXPO_PUBLIC_ prefix)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    // On Android Emulator, map localhost / 127.0.0.1 to 10.0.2.2 for loopback access
    if (Platform.OS === 'android' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return envUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    return envUrl;
  }

  // 2. If running in a web browser, connect to the hostname of the current page
  if (Platform.OS === 'web') {
    const globalWindow = typeof window !== 'undefined' ? (window as any) : null;
    const hostname = globalWindow && globalWindow.location ? globalWindow.location.hostname : 'localhost';
    return `http://${hostname}:8000/api`;
  }

  // 3. Check if we can determine the bundle loading URL (useful for physical devices / expo)
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1]) {
        const host = match[1];
        // If host is localhost/127.0.0.1 on Android, map to the Android emulator host loopback
        if ((host === 'localhost' || host === '127.0.0.1') && Platform.OS === 'android') {
          return 'http://10.0.2.2:8000/api';
        }
        return `http://${host}:8000/api`;
      }
    }
  } catch (e) {
    console.warn('Failed to parse scriptURL for API_BASE_URL:', e);
  }

  // 4. Fallback defaults
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api'; // Android Emulator default
  }
  return 'http://localhost:8000/api'; // iOS Simulator / Web default
};

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Access Token if present
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401 errors and handle JWT Token Refreshing
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 Unauthorized and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        // Attempt to request a new access token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: new_refresh_token } = response.data;

        // Save new tokens to Zustand store
        useAuthStore.getState().setTokens(access_token, new_refresh_token);

        // Retry failed queue
        processQueue(null, access_token);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log user out immediately
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
