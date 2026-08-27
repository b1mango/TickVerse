import { create } from 'zustand';
import type { ThemeMode, ThemePreference, ThemeStyle } from '@/types/settings';
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/types/settings';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
}

/** 主题切换 = 根节点换 data-style / data-mode，零重载（《视觉方向稿.md》§2） */
function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.style = pref.style;
  root.dataset.mode = resolveMode(pref.mode);
}

function loadTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? { ...DEFAULT_THEME, ...(JSON.parse(raw) as ThemePreference) } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

interface SettingsState {
  theme: ThemePreference;
  setStyle: (style: ThemeStyle) => void;
  setMode: (mode: ThemeMode) => void;
}

/** 主题偏好仅存 localStorage（仅本地，不同步） */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: loadTheme(),
  setStyle: (style) => {
    const theme = { ...get().theme, style };
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    applyTheme(theme);
    set({ theme });
  },
  setMode: (mode) => {
    const theme = { ...get().theme, mode };
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    applyTheme(theme);
    set({ theme });
  },
}));

// 初始化应用 + system 模式下跟随系统切换
applyTheme(useSettingsStore.getState().theme);
media.addEventListener('change', () => applyTheme(useSettingsStore.getState().theme));
