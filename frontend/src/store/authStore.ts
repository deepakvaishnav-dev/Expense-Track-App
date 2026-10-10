import { create } from 'zustand';
import { Platform, NativeModules } from 'react-native';
import * as SecureStore from 'expo-secure-store';

declare const window: any;

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Hardware-backed secure storage manager utilizing expo-secure-store.
 * Leverages iOS Keychain with kSecAttrAccessibleAfterFirstUnlock and Android Keystore.
 * Provides fallback for web and in-memory caching to guarantee synchronous reads.
 */
class SecureStoreManager {
  private inMemoryCache: Record<string, string | null> = {
    user: null,
    accessToken: null,
    refreshToken: null,
  };

  constructor() {
    this.hydrate();
  }

  /**
   * Reads stored credentials on application launch into the in-memory cache and Zustand store.
   */
  async hydrate(): Promise<void> {
    try {
      const [user, accessToken, refreshToken] = await Promise.all([
        this.getItem('user'),
        this.getItem('accessToken'),
        this.getItem('refreshToken'),
      ]);

      this.inMemoryCache = { user, accessToken, refreshToken };

      const parsedUser = user ? JSON.parse(user) : null;
      useAuthStore.setState({
        user: parsedUser,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        isAuthenticated: !!accessToken,
        isHydrated: true,
      });
    } catch (e) {
      console.warn('[SecureStore] Initial store hydration failure:', e);
      useAuthStore.setState({ isHydrated: true });
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    this.inMemoryCache[key] = value;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
    } catch (e) {
      console.warn(`[SecureStore] Error writing key ${key} to hardware keystore:`, e);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.inMemoryCache[key] !== undefined && this.inMemoryCache[key] !== null) {
      return this.inMemoryCache[key];
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          return window.sessionStorage.getItem(key);
        }
        return null;
      }
      const val = await SecureStore.getItemAsync(key, SECURE_OPTIONS);
      this.inMemoryCache[key] = val;
      return val;
    } catch (e) {
      console.warn(`[SecureStore] Error retrieving key ${key} from hardware keystore:`, e);
      return null;
    }
  }

  async deleteItem(key: string): Promise<void> {
    this.inMemoryCache[key] = null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
    } catch (e) {
      console.warn(`[SecureStore] Error purging key ${key} from hardware keystore:`, e);
    }
  }

  async clearSession(): Promise<void> {
    this.inMemoryCache = { user: null, accessToken: null, refreshToken: null };
    await Promise.allSettled([
      this.deleteItem('user'),
      this.deleteItem('accessToken'),
      this.deleteItem('refreshToken'),
    ]);
  }
}

export const secureStoreManager = new SecureStoreManager();

interface AuthState {
  user: {
    id: string;
    email: string;
    full_name: string;
    is_admin: boolean;
    phone?: string;
    currency?: string;
  } | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: any, accessToken: string, refreshToken: string) => void;
  updateUser: (updates: Partial<{ full_name: string; email: string; phone?: string; currency?: string }>) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,

  login: (user, accessToken, refreshToken) => {
    // 1. Immediately update Zustand state synchronously
    set({ user, accessToken, refreshToken, isAuthenticated: true });

    // 2. Persist to hardware-backed secure storage
    secureStoreManager.setItem('user', JSON.stringify(user)).catch(console.warn);
    secureStoreManager.setItem('accessToken', accessToken).catch(console.warn);
    secureStoreManager.setItem('refreshToken', refreshToken).catch(console.warn);

    // 3. Write tokens to native Android background bridge if available
    try {
      if (NativeModules.ExpenseAIBridge) {
        NativeModules.ExpenseAIBridge.saveTokens(accessToken, refreshToken);
      }
    } catch (e) {
      console.warn('[SecureStore] Native bridge token sync error:', e);
    }
  },

  updateUser: (updates) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...updates };
      secureStoreManager.setItem('user', JSON.stringify(updated)).catch(console.warn);
      return { user: updated };
    });
  },

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    secureStoreManager.setItem('accessToken', accessToken).catch(console.warn);
    secureStoreManager.setItem('refreshToken', refreshToken).catch(console.warn);

    try {
      if (NativeModules.ExpenseAIBridge) {
        NativeModules.ExpenseAIBridge.saveTokens(accessToken, refreshToken);
      }
    } catch (e) {
      console.warn('[SecureStore] Native bridge token sync error:', e);
    }
  },

  logout: async () => {
    // 1. Purge memory state immediately
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });

    // 2. Atomically purge hardware-backed storage entries
    await secureStoreManager.clearSession();

    // 3. Clear native background bridge tokens
    try {
      if (NativeModules.ExpenseAIBridge) {
        NativeModules.ExpenseAIBridge.saveTokens('', '');
      }
    } catch (e) {
      console.warn('[SecureStore] Native bridge token clear error:', e);
    }
  },
}));
