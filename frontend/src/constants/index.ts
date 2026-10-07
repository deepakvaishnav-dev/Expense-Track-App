/**
 * Application Constants
 */

export const COLORS = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  accent: {
    green: '#10b981',
    red: '#ef4444',
    purple: '#8b5cf6',
    orange: '#f59e0b',
    teal: '#14b8a6',
  },
  dark: {
    bg: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    text: '#f8fafc',
    subtext: '#94a3b8',
  },
  light: {
    bg: '#ffffff',
    card: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    subtext: '#64748b',
  },
};

export const STORAGE_KEYS = {
  USER: 'user',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  THEME: 'theme',
  ONBOARDING_SEEN: 'onboarding_seen',
};

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/password-reset/request',
    RESET_PASSWORD: '/auth/password-reset/confirm',
  },
  TRANSACTIONS: '/transactions',
  ACCOUNTS: '/accounts',
  CATEGORIES: '/categories',
  BUDGETS: '/budgets',
  SAVINGS_GOALS: '/savings-goals',
  SUBSCRIPTIONS: '/subscriptions',
  NOTIFICATIONS: '/notifications',
  ANALYTICS: {
    SUMMARY: '/analytics/summary',
    CATEGORIES: '/analytics/categories',
    MONTHLY: '/analytics/monthly-comparison',
  },
  AI: {
    CHAT: '/ai/chat',
    PARSE_SMS: '/ai/parse-sms',
    OCR_RECEIPT: '/ai/receipt-ocr',
  },
  REPORTS: {
    CSV: '/reports/export/csv',
    PDF: '/reports/export/pdf',
  },
};
