import { create } from 'zustand';
import type {
  LlmConfig,
  QuadrantLayoutMode,
  ThemeFont,
  ThemeMode,
  ThemePreference,
  ThemeStyle,
  WebdavConfig,
  WidgetPrefs,
} from '@/types/settings';
import {
  DEFAULT_EDITOR_FONT,
  DEFAULT_LLM,
  DEFAULT_QUADRANT_COLUMN_WIDTHS,
  DEFAULT_QUADRANT_LAYOUT,
  DEFAULT_THEME,
  DEFAULT_WEBDAV,
  DEFAULT_WIDGET,
  EDITOR_FONT_RANGE,
  EDITOR_FONT_STORAGE_KEY,
  LLM_STORAGE_KEY,
  QUADRANT_LAYOUT_STORAGE_KEY,
  QUADRANT_WIDTHS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  WEBDAV_STORAGE_KEY,
  WIDGET_FONT_RANGE,
  WIDGET_OPACITY_RANGE,
  WIDGET_STORAGE_KEY,
} from '@/types/settings';

const hasWindow = typeof window !== 'undefined';
const media = hasWindow ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (media?.matches ? 'dark' : 'light') : mode;
}

/** 主题切换 = 根节点换 data-style / data-mode / data-font，零重载（《视觉方向稿.md》§2） */
function applyTheme(pref: ThemePreference): void {
  if (!hasWindow) return;
  const root = document.documentElement;
  root.dataset.style = pref.style;
  root.dataset.mode = resolveMode(pref.mode);
  root.dataset.font = pref.font;
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

/** 显式字段装载：废弃字段（clickThrough / 旧字母档位）不进入状态，非法数值回默认 */
function loadWidget(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET;
    const parsed = JSON.parse(raw) as Partial<WidgetPrefs>;
    const num = (v: unknown, min: number, max: number): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
    return {
      locked: typeof parsed.locked === 'boolean' ? parsed.locked : false,
      visible: typeof parsed.visible === 'boolean' ? parsed.visible : DEFAULT_WIDGET.visible,
      font: num(parsed.font, WIDGET_FONT_RANGE.min, WIDGET_FONT_RANGE.max) ?? DEFAULT_WIDGET.font,
      opacity:
        num(parsed.opacity, WIDGET_OPACITY_RANGE.min, WIDGET_OPACITY_RANGE.max) ??
        DEFAULT_WIDGET.opacity,
      width: num(parsed.width, 1, 10000),
      height: num(parsed.height, 1, 10000),
    };
  } catch {
    return DEFAULT_WIDGET;
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

/** 待办页字号：12–22 合法，非法回默认 15 */
function loadEditorFont(): number {
  try {
    const raw = localStorage.getItem(EDITOR_FONT_STORAGE_KEY);
    const v = raw ? Number(raw) : NaN;
    return Number.isFinite(v) && v >= EDITOR_FONT_RANGE.min && v <= EDITOR_FONT_RANGE.max
      ? v
      : DEFAULT_EDITOR_FONT;
  } catch {
    return DEFAULT_EDITOR_FONT;
  }
}

interface SettingsState {
  theme: ThemePreference;
  llm: LlmConfig;
  webdav: WebdavConfig;
  widget: WidgetPrefs;
  quadrantLayout: QuadrantLayoutMode;
  quadrantColumnWidths: number[];
  editorFont: number;
  setStyle: (style: ThemeStyle) => void;
  setMode: (mode: ThemeMode) => void;
  setFont: (font: ThemeFont) => void;
  setLlm: (llm: LlmConfig) => void;
  setWebdav: (webdav: WebdavConfig) => void;
  setWidget: (patch: Partial<WidgetPrefs>) => void;
  setQuadrantLayout: (mode: QuadrantLayoutMode) => void;
  setQuadrantColumnWidths: (widths: number[]) => void;
  setEditorFont: (px: number) => void;
  /** 桌面组件窗口用：主窗口改主题后经 storage 事件通知，本窗口重读并重挂 data-style/data-mode */
  reloadTheme: () => void;
  /** 同上：组件尺寸/字号等偏好改动经 storage 事件同步 */
  reloadWidget: () => void;
}

/** 主题偏好 / LLM 配置 / WebDAV 凭据 / 桌面组件 / 四象限版式与列宽仅存 localStorage（仅本地，不同步、不进导出文件） */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: loadTheme(),
  llm: loadLlm(),
  webdav: loadWebdav(),
  widget: loadWidget(),
  quadrantLayout: loadQuadrantLayout(),
  quadrantColumnWidths: loadQuadrantColumnWidths(),
  editorFont: loadEditorFont(),
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
  setFont: (font) => {
    const theme = { ...get().theme, font };
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
  setWidget: (patch) => {
    const widget = { ...loadWidget(), ...patch };
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widget));
    set({ widget });
  },
  setQuadrantLayout: (mode) => {
    localStorage.setItem(QUADRANT_LAYOUT_STORAGE_KEY, mode);
    set({ quadrantLayout: mode });
  },
  setQuadrantColumnWidths: (widths) => {
    localStorage.setItem(QUADRANT_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    set({ quadrantColumnWidths: widths });
  },
  setEditorFont: (px) => {
    localStorage.setItem(EDITOR_FONT_STORAGE_KEY, String(px));
    set({ editorFont: px });
  },
  reloadTheme: () => {
    const theme = loadTheme();
    applyTheme(theme);
    set({ theme });
  },
  reloadWidget: () => set({ widget: loadWidget() }),
}));

// 初始化应用 + system 模式下跟随系统切换
applyTheme(useSettingsStore.getState().theme);
media?.addEventListener('change', () => applyTheme(useSettingsStore.getState().theme));
