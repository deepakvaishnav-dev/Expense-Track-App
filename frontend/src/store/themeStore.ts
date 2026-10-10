import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeId = 'royal-blue' | 'midnight-dark' | 'emerald-mint' | 'cyber-violet' | 'sunset-coral';

export interface AppTheme {
  id: ThemeId;
  name: string;
  subtitle: string;
  emoji: string;
  primary: string;
  primaryDark: string;
  accent: string;
  headerBg: string;
  surfaceBg: string;
  cardBg: string;
  pillBg: string;
  pillBorder: string;
  textColor: string;
}

export const AVAILABLE_THEMES: Record<ThemeId, AppTheme> = {
  'royal-blue': {
    id: 'royal-blue',
    name: 'Royal Blue',
    subtitle: 'Classic & Clean Fintech',
    emoji: '💎',
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    accent: '#60a5fa',
    headerBg: '#2563eb',
    surfaceBg: '#f8fafc',
    cardBg: '#ffffff',
    pillBg: '#eff6ff',
    pillBorder: '#bfdbfe',
    textColor: '#0f172a',
  },
  'midnight-dark': {
    id: 'midnight-dark',
    name: 'Midnight Obsidian',
    subtitle: 'Sleek Dark Mode',
    emoji: '🌙',
    primary: '#0f172a',
    primaryDark: '#020617',
    accent: '#38bdf8',
    headerBg: '#0f172a',
    surfaceBg: '#090d16',
    cardBg: '#1e293b',
    pillBg: '#1e293b',
    pillBorder: '#334155',
    textColor: '#f8fafc',
  },
  'emerald-mint': {
    id: 'emerald-mint',
    name: 'Emerald Mint',
    subtitle: 'Fresh Wealth & Growth',
    emoji: '🌿',
    primary: '#059669',
    primaryDark: '#047857',
    accent: '#34d399',
    headerBg: '#059669',
    surfaceBg: '#f0fdf4',
    cardBg: '#ffffff',
    pillBg: '#ecfdf5',
    pillBorder: '#a7f3d0',
    textColor: '#0f172a',
  },
  'cyber-violet': {
    id: 'cyber-violet',
    name: 'Cyber Violet',
    subtitle: 'Futuristic & Vibrant',
    emoji: '🔮',
    primary: '#7c3aed',
    primaryDark: '#6d28d9',
    accent: '#c084fc',
    headerBg: '#7c3aed',
    surfaceBg: '#faf5ff',
    cardBg: '#ffffff',
    pillBg: '#f5f3ff',
    pillBorder: '#ddd6fe',
    textColor: '#0f172a',
  },
  'sunset-coral': {
    id: 'sunset-coral',
    name: 'Sunset Coral',
    subtitle: 'Warm & Luxury Gold',
    emoji: '🌅',
    primary: '#e11d48',
    primaryDark: '#be123c',
    accent: '#fb7185',
    headerBg: '#e11d48',
    surfaceBg: '#fff1f2',
    cardBg: '#ffffff',
    pillBg: '#ffe4e6',
    pillBorder: '#fecdd3',
    textColor: '#0f172a',
  },
};

const THEME_STORAGE_KEY = '@user_app_theme_id';

interface ThemeState {
  currentThemeId: ThemeId;
  theme: AppTheme;
  setTheme: (themeId: ThemeId) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentThemeId: 'royal-blue',
  theme: AVAILABLE_THEMES['royal-blue'],

  setTheme: async (themeId: ThemeId) => {
    const selected = AVAILABLE_THEMES[themeId] || AVAILABLE_THEMES['royal-blue'];
    set({ currentThemeId: themeId, theme: selected });
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (e) {
      console.warn('Failed to persist theme:', e);
    }
  },

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved && (saved in AVAILABLE_THEMES)) {
        const themeId = saved as ThemeId;
        set({ currentThemeId: themeId, theme: AVAILABLE_THEMES[themeId] });
      }
    } catch (e) {
      console.warn('Failed to load theme:', e);
    }
  },
}));

// Load theme on startup
useThemeStore.getState().loadTheme().catch(() => {});
