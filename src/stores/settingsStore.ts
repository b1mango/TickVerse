import { create } from 'zustand';
import type {
  LlmConfig,
  QuadrantLayoutMode,
  ThemeMode,
  ThemePreference,
  ThemeStyle,
  WebdavConfig,
} from '@/types/settings';
import {
  DEFAULT_LLM,
  DEFAULT_QUADRANT_COLUMN_WIDTHS,
  DEFAULT_QUADRANT_LAYOUT,
  DEFAULT_THEME,
  DEFAULT_WEBDAV,
  LLM_STORAGE_KEY,
  QUADRANT_LAYOUT_STORAGE_KEY,
  QUADRANT_WIDTHS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  WEBDAV_STORAGE_KEY,
} from '@/types/settings';

const hasWindow = typeof window !== 'undefined';
const media = hasWindow ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (media?.matches ? 'dark' : 'light') : mode;
}

/** 主题切换 = 根节点换 data-style / data-mode，零重载（《视觉方向稿.md》§2） */
function applyTheme(pref: ThemePreference): void {
  if (!hasWindow) return;
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

function loadLlm(): LlmConfig {
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY);
    if (!raw) return DEFAULT_LLM;
    // 兼容旧版字段 model（单模型）→ activeModel / selectedModels；空串视为未设，回退勾选列表首个
    const parsed = JSON.parse(raw) as Partial<LlmConfig> & { model?: string };
    const selectedModels = parsed.selectedModels ?? [];
    const activeModel =
      parsed.activeModel || parsed.model || selectedModels[0] || DEFAULT_LLM.activeModel;
    return {
      ...DEFAULT_LLM,
      ...parsed,
      models: parsed.models ?? [],
      selectedModels: selectedModels.length > 0 ? selectedModels : [activeModel],
      activeModel,
    };
  } catch {
    return DEFAULT_LLM;
  }
}

function loadWebdav(): WebdavConfig {
  try {
    const raw = localStorage.getItem(WEBDAV_STORAGE_KEY);
    return raw ? { ...DEFAULT_WEBDAV, ...(JSON.parse(raw) as WebdavConfig) } : DEFAULT_WEBDAV;
  } catch {
    return DEFAULT_WEBDAV;
  }
}

/** 非法值回退默认四列版式 */
function loadQuadrantLayout(): QuadrantLayoutMode {
  try {
    const raw = localStorage.getItem(QUADRANT_LAYOUT_STORAGE_KEY);
    return raw === 'columns' || raw === 'grid' ? raw : DEFAULT_QUADRANT_LAYOUT;
  } catch {
    return DEFAULT_QUADRANT_LAYOUT;
  }
}

/** 列宽比例：必须正好 4 项有限正数（0.2–4），否则回退等宽 */
function loadQuadrantColumnWidths(): number[] {
  try {
    const raw = localStorage.getItem(QUADRANT_WIDTHS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_QUADRANT_COLUMN_WIDTHS];
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      parsed.every((n) => Number.isFinite(n) && n >= 0.2 && n <= 4)
    ) {
      return parsed as number[];
    }
    return [...DEFAULT_QUADRANT_COLUMN_WIDTHS];
  } catch {
    return [...DEFAULT_QUADRANT_COLUMN_WIDTHS];
  }
}

interface SettingsState {
  theme: ThemePreference;
  llm: LlmConfig;
  webdav: WebdavConfig;
  quadrantLayout: QuadrantLayoutMode;
  quadrantColumnWidths: number[];
  setStyle: (style: ThemeStyle) => void;
  setMode: (mode: ThemeMode) => void;
  setLlm: (llm: LlmConfig) => void;
  setWebdav: (webdav: WebdavConfig) => void;
  setQuadrantLayout: (mode: QuadrantLayoutMode) => void;
  setQuadrantColumnWidths: (widths: number[]) => void;
}

/** 主题偏好 / LLM 配置 / WebDAV 凭据 / 四象限版式与列宽仅存 localStorage（仅本地，不同步、不进导出文件） */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: loadTheme(),
  llm: loadLlm(),
  webdav: loadWebdav(),
  quadrantLayout: loadQuadrantLayout(),
  quadrantColumnWidths: loadQuadrantColumnWidths(),
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
  setLlm: (llm) => {
    localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(llm));
    set({ llm });
  },
  setWebdav: (webdav) => {
    localStorage.setItem(WEBDAV_STORAGE_KEY, JSON.stringify(webdav));
    set({ webdav });
  },
  setQuadrantLayout: (mode) => {
    localStorage.setItem(QUADRANT_LAYOUT_STORAGE_KEY, mode);
    set({ quadrantLayout: mode });
  },
  setQuadrantColumnWidths: (widths) => {
    localStorage.setItem(QUADRANT_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    set({ quadrantColumnWidths: widths });
  },
}));

// 初始化应用 + system 模式下跟随系统切换
applyTheme(useSettingsStore.getState().theme);
media?.addEventListener('change', () => applyTheme(useSettingsStore.getState().theme));
