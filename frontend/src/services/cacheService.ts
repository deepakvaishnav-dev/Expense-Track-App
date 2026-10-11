import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  TRANSACTIONS: '@cache_transactions_list_v2',
  CATEGORIES: '@cache_categories_list_v2',
  DASHBOARD: '@cache_dashboard_data_v2',
  KHATA_PERSONS: '@cache_khata_persons_v2',
  KHATA_SUMMARY: '@cache_khata_summary_v2',
  NOTIFICATIONS: '@cache_notifications_v2',
  PROFILE_STATS: '@cache_profile_stats_v2',
};

// In-Memory cache for ultra-fast, zero-overhead sync retrieval across screens
const memoryCache = new Map<string, any>();

export const cacheService = {
  /**
   * Retrieves data from memory first (0ms), then falls back to AsyncStorage.
   */
  async get<T>(key: string): Promise<T | null> {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryCache.set(key, parsed);
        return parsed as T;
      }
    } catch (e) {
      console.warn(`[cacheService] Failed to read cache key "${key}":`, e);
    }
    return null;
  },

  /**
   * Synchronously reads from in-memory cache if already hydrated
   */
  getMemorySync<T>(key: string): T | null {
    return memoryCache.has(key) ? (memoryCache.get(key) as T) : null;
  },

  /**
   * Saves data to both memory cache and AsyncStorage.
   */
  async set<T>(key: string, data: T): Promise<void> {
    memoryCache.set(key, data);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`[cacheService] Failed to save cache key "${key}":`, e);
    }
  },

  /**
   * Clears a specific cache key from both memory and AsyncStorage.
   */
  async invalidate(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[cacheService] Failed to invalidate cache key "${key}":`, e);
    }
  },

  /**
   * Clears multiple cache keys (useful after creating or editing a transaction)
   */
  async invalidateMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.invalidate(k)));
  },

  /**
   * Clears all known application caches
   */
  async clearAll(): Promise<void> {
    memoryCache.clear();
    const allKeys = Object.values(CACHE_KEYS);
    await Promise.all(allKeys.map((k) => AsyncStorage.removeItem(k).catch(() => {})));
  },
};
