/**
 * Utility helper functions for formatting, validation, and transformations.
 */

/**
 * Format numeric value to local currency string.
 * Defaults to Indian Rupee (INR).
 */
export const formatCurrency = (amount: number | string | null | undefined, currency: string = 'INR'): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
};

/**
 * Format ISO date string into human-readable date.
 */
export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export const formatRelativeTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  return formatDate(date);
};

/**
 * Extract clean, user-friendly error message from API response or JavaScript exception.
 */
export const extractErrorMessage = (error: any, fallback: string = 'An unexpected error occurred'): string => {
  if (!error) return fallback;
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0].msg || JSON.stringify(detail[0]);
    }
  }
  if (error.message) return error.message;
  return fallback;
};

/**
 * Capitalize first character of string.
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};
