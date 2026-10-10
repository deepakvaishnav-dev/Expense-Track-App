import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURITY_STORAGE_KEYS = {
  APP_LOCK_ENABLED: '@app_lock_enabled',
  APP_PIN_CODE: '@app_pin_code',
  BIOMETRICS_ENABLED: '@app_biometrics_enabled',
  LOCK_TIMEOUT: '@app_lock_timeout',
};

interface SecurityState {
  isAppLockEnabled: boolean;
  pinCode: string;
  biometricsEnabled: boolean;
  isLocked: boolean;
  lockTimeout: 'immediate' | '1m' | '5m';

  loadSecuritySettings: () => Promise<void>;
  enableAppLock: (pin: string) => Promise<void>;
  disableAppLock: () => Promise<void>;
  changePin: (newPin: string) => Promise<void>;
  setBiometrics: (enabled: boolean) => Promise<void>;
  setLockTimeout: (timeout: 'immediate' | '1m' | '5m') => Promise<void>;
  lockApp: () => void;
  unlockApp: (inputPin: string) => boolean;
  unlockWithBiometrics: () => boolean;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  isAppLockEnabled: false,
  pinCode: '',
  biometricsEnabled: false,
  isLocked: false,
  lockTimeout: 'immediate',

  loadSecuritySettings: async () => {
    try {
      const [enabled, pin, biometrics, timeout] = await Promise.all([
        AsyncStorage.getItem(SECURITY_STORAGE_KEYS.APP_LOCK_ENABLED),
        AsyncStorage.getItem(SECURITY_STORAGE_KEYS.APP_PIN_CODE),
        AsyncStorage.getItem(SECURITY_STORAGE_KEYS.BIOMETRICS_ENABLED),
        AsyncStorage.getItem(SECURITY_STORAGE_KEYS.LOCK_TIMEOUT),
      ]);

      const isEnabled = enabled === 'true';
      set({
        isAppLockEnabled: isEnabled,
        pinCode: pin || '',
        biometricsEnabled: biometrics === 'true',
        lockTimeout: (timeout as any) || 'immediate',
      });
    } catch (e) {
      console.warn('Failed to load security settings:', e);
    }
  },

  enableAppLock: async (pin: string) => {
    set({ isAppLockEnabled: true, pinCode: pin });
    try {
      await Promise.all([
        AsyncStorage.setItem(SECURITY_STORAGE_KEYS.APP_LOCK_ENABLED, 'true'),
        AsyncStorage.setItem(SECURITY_STORAGE_KEYS.APP_PIN_CODE, pin),
      ]);
    } catch (e) {
      console.warn('Failed to persist app lock:', e);
    }
  },

  disableAppLock: async () => {
    set({ isAppLockEnabled: false, pinCode: '', isLocked: false });
    try {
      await Promise.all([
        AsyncStorage.setItem(SECURITY_STORAGE_KEYS.APP_LOCK_ENABLED, 'false'),
        AsyncStorage.removeItem(SECURITY_STORAGE_KEYS.APP_PIN_CODE),
      ]);
    } catch (e) {
      console.warn('Failed to disable app lock:', e);
    }
  },

  changePin: async (newPin: string) => {
    set({ pinCode: newPin });
    try {
      await AsyncStorage.setItem(SECURITY_STORAGE_KEYS.APP_PIN_CODE, newPin);
    } catch (e) {
      console.warn('Failed to update PIN:', e);
    }
  },

  setBiometrics: async (enabled: boolean) => {
    set({ biometricsEnabled: enabled });
    try {
      await AsyncStorage.setItem(SECURITY_STORAGE_KEYS.BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to persist biometrics setting:', e);
    }
  },

  setLockTimeout: async (timeout: 'immediate' | '1m' | '5m') => {
    set({ lockTimeout: timeout });
    try {
      await AsyncStorage.setItem(SECURITY_STORAGE_KEYS.LOCK_TIMEOUT, timeout);
    } catch (e) {
      console.warn('Failed to persist lock timeout:', e);
    }
  },

  lockApp: () => {
    const { isAppLockEnabled } = get();
    if (isAppLockEnabled) {
      set({ isLocked: true });
    }
  },

  unlockApp: (inputPin: string) => {
    const { pinCode } = get();
    if (inputPin === pinCode) {
      set({ isLocked: false });
      return true;
    }
    return false;
  },

  unlockWithBiometrics: () => {
    const { biometricsEnabled } = get();
    if (biometricsEnabled) {
      set({ isLocked: false });
      return true;
    }
    return false;
  },
}));

// Auto-load on launch
useSecurityStore.getState().loadSecuritySettings().catch(() => {});
