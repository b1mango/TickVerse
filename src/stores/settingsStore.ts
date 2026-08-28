import { create } from 'zustand';
import type {
  EditorLayoutPreference,
  EditorModuleKey,
  EditorLayoutMode,
  LlmConfig,
  ThemeMode,
  ThemePreference,
  ThemeStyle,
  WebdavConfig,
} from '@/types/settings';
import { CUSTOM_MODULE_WIDTH } from '@/services/editorLayout';
import {
  DEFAULT_EDITOR_LAYOUT,
  DEFAULT_LLM,
  DEFAULT_THEME,
  DEFAULT_WEBDAV,
  EDITOR_LAYOUT_STORAGE_KEY,
  LLM_STORAGE_KEY,
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

const EDITOR_MODES: readonly EditorLayoutMode[] = ['vertical', 'horizontal', 'split', 'custom'];
const EDITOR_MODULE_KEYS: readonly EditorModuleKey[] = ['today', 'short', 'long'];

/** 老用户无此字段时回退默认竖向；逐模块合并坐标，坏数据回退默认摆位；老数据无 w 字段 → 回退默认宽（读取迁移） */
function loadEditorLayout(): EditorLayoutPreference {
  try {
    const raw = localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<EditorLayoutPreference>;
    const custom = { ...DEFAULT_EDITOR_LAYOUT.custom };
    for (const key of EDITOR_MODULE_KEYS) {
      const pos = parsed.custom?.[key];
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        custom[key] = {
          x: pos.x,
          y: pos.y,
          w: Number.isFinite(pos.w) ? pos.w : CUSTOM_MODULE_WIDTH,
        };
      }
    }
    return {
      mode: parsed.mode && EDITOR_MODES.includes(parsed.mode) ? parsed.mode : 'vertical',
      custom,
    };
  } catch {
    return DEFAULT_EDITOR_LAYOUT;
  }
}

interface SettingsState {
  theme: ThemePreference;
  llm: LlmConfig;
  webdav: WebdavConfig;
  editorLayout: EditorLayoutPreference;
  setStyle: (style: ThemeStyle) => void;
  setMode: (mode: ThemeMode) => void;
  setLlm: (llm: LlmConfig) => void;
  setWebdav: (webdav: WebdavConfig) => void;
  setEditorLayoutMode: (mode: EditorLayoutMode) => void;
  setEditorModulePosition: (key: EditorModuleKey, pos: { x: number; y: number }) => void;
  setEditorModuleWidth: (key: EditorModuleKey, w: number) => void;
  resetEditorLayout: () => void;
}

/** 主题偏好 / LLM 配置 / WebDAV 凭据 / 记录页布局仅存 localStorage（仅本地，不同步、不进导出文件） */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: loadTheme(),
  llm: loadLlm(),
  webdav: loadWebdav(),
  editorLayout: loadEditorLayout(),
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
  setEditorLayoutMode: (mode) => {
    const editorLayout = { ...get().editorLayout, mode };
    localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(editorLayout));
    set({ editorLayout });
  },
  setEditorModulePosition: (key, pos) => {
    const prev = get().editorLayout;
    // 只改坐标、保留已调宽度
    const editorLayout = {
      ...prev,
      custom: { ...prev.custom, [key]: { ...prev.custom[key], ...pos } },
    };
    localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(editorLayout));
    set({ editorLayout });
  },
  setEditorModuleWidth: (key, w) => {
    const prev = get().editorLayout;
    const editorLayout = { ...prev, custom: { ...prev.custom, [key]: { ...prev.custom[key], w } } };
    localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(editorLayout));
    set({ editorLayout });
  },
  resetEditorLayout: () => {
    const editorLayout = { ...get().editorLayout, custom: DEFAULT_EDITOR_LAYOUT.custom };
    localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(editorLayout));
    set({ editorLayout });
  },
}));

// 初始化应用 + system 模式下跟随系统切换
applyTheme(useSettingsStore.getState().theme);
media?.addEventListener('change', () => applyTheme(useSettingsStore.getState().theme));
