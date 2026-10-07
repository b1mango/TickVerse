/**
 * 主题偏好（《项目设计.md》§9）：风格 × 明暗 × 字体三维。
 * 偏好仅存 localStorage，不进 WebDAV 同步文件。
 */
export type ThemeStyle = 'archive' | 'mono';
export type ThemeMode = 'light' | 'dark' | 'system';
/** 字体（2026-10-06 修订九新增维度）：auto 跟随风格（现状）/ serif 衬线 / sans 黑体 */
export type ThemeFont = 'auto' | 'serif' | 'sans';

export interface ThemePreference {
  style: ThemeStyle;
  mode: ThemeMode;
  font: ThemeFont;
}

export const THEME_STORAGE_KEY = 'tickverse.theme';

export const DEFAULT_THEME: ThemePreference = { style: 'archive', mode: 'system', font: 'auto' };

/**
 * LLM 配置（§10.3）：OpenAI 兼容接入（2026-08-28 改版参考 ccswitch 类主流做法：
 * 名称 + Base URL + Key + "获取模型"拉取列表多选）。
 * Key 只存本地 localStorage，不上传、不进导出文件（§15-10 / 清单 M4）。
 */
export interface LlmConfig {
  /** 配置名称（如 DeepSeek / Kimi） */
  name: string;
  baseUrl: string;
  apiKey: string;
  /** "获取模型"拉取到的模型列表（本地缓存） */
  models: string[];
  /** 用户勾选的模型（多选） */
  selectedModels: string[];
  /** AI 总结实际使用的模型（selectedModels 之一） */
  activeModel: string;
}

export const LLM_STORAGE_KEY = 'tickverse.llm';

/** 默认 DeepSeek 接入（2026-08-28 用户指定）；可在设置页改为任意 OpenAI 兼容服务 */
export const DEFAULT_LLM: LlmConfig = {
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  models: [],
  selectedModels: ['deepseek-chat'],
  activeModel: 'deepseek-chat',
};

/** 首次生成 AI 总结前的隐私说明弹窗（§15-10）：确认过一次后不再弹 */
export const LLM_PRIVACY_ACK_KEY = 'tickverse.llmPrivacyAck';

/**
 * WebDAV 同步配置（§10.2 / 清单 M5-4）。
 * 密码只存 localStorage，不进导出文件；同步内容是单 JSON 快照（不含本配置）。
 */
export interface WebdavConfig {
  endpoint: string; // 如 https://dav.jianguoyun.com/dav/
  username: string;
  password: string;
  remotePath: string; // 相对 endpoint 的快照路径
  enabled: boolean;
}

export const WEBDAV_STORAGE_KEY = 'tickverse.webdav';

export const DEFAULT_WEBDAV: WebdavConfig = {
  endpoint: '',
  username: '',
  password: '',
  remotePath: 'tickverse/tickverse-sync.json',
  enabled: false,
};

/**
 * 桌面组件偏好（M7，Tauri 第二窗口）：显隐 + 字号（zoom 连续值）+ 透明度 + 拖拽落定的尺寸。
 * 与主题一样只存 localStorage；改动经 storage 事件即时同步组件窗。
 * 修订九（2026-10-06）：点击穿透已删（始终可交互）；尺寸改组件边缘直拖（去设置预设）。
 */
export interface WidgetPrefs {
  visible: boolean;
  /** 固定组件位置与尺寸；任务仍可编辑。 */
  locked: boolean;
  /** 组件正文字号（px，基准 15；组件侧 zoom = font/15），WIDGET_FONT_RANGE 范围内 */
  font: number;
  /** 组件窗口透明度（NSWindow alpha），WIDGET_OPACITY_RANGE 范围内 */
  opacity: number;
  /** 用户在组件上拖边缘调出的尺寸（逻辑像素，启动恢复用） */
  width?: number;
  height?: number;
}

export const WIDGET_STORAGE_KEY = 'tickverse.widget';

export const DEFAULT_WIDGET: WidgetPrefs = { visible: true, locked: false, font: 15, opacity: 1 };

/** 字号滑动条范围（正文字号 px） */
export const WIDGET_FONT_RANGE = { min: 12, max: 22, step: 0.5 } as const;

/** 组件字号 px → 根 zoom 系数的基准字号（与 token --text-body 一致） */
export const WIDGET_FONT_BASE_PX = 15;

/** 待办页正文字号（px，页面根 zoom = font / WIDGET_FONT_BASE_PX；仅存 localStorage） */
export const EDITOR_FONT_STORAGE_KEY = 'tickverse.editorFont';

export const EDITOR_FONT_RANGE = { min: 12, max: 22, step: 0.5 } as const;

export const DEFAULT_EDITOR_FONT = 15;

/** 透明度滑动条范围 */
export const WIDGET_OPACITY_RANGE = { min: 0.3, max: 1, step: 0.05 } as const;

/**
 * 四象限模块版式偏好：columns 四列（auto-fit 响应式，宽容器一行四列 / 窄容器自动降级）
 * / grid 四象限（固定 2x2 宫格）。与主题一样只存 localStorage，不进 WebDAV 同步文件。
 */
export type QuadrantLayoutMode = 'columns' | 'grid';

export const QUADRANT_LAYOUT_STORAGE_KEY = 'tickverse.quadrantLayout';

export const DEFAULT_QUADRANT_LAYOUT: QuadrantLayoutMode = 'columns';

/** 四列版式下列宽的 flex-grow 比例（4 项，拖列间分隔条调节；仅存 localStorage） */
export const QUADRANT_WIDTHS_STORAGE_KEY = 'tickverse.quadrantWidths';

export const DEFAULT_QUADRANT_COLUMN_WIDTHS: readonly number[] = [1, 1, 1, 1];

/** 常用服务商预设（清单 M5-4：坚果云 / 自有 NAS） */
export const WEBDAV_PRESETS = [
  { label: '坚果云', endpoint: 'https://dav.jianguoyun.com/dav/' },
  { label: '自有 NAS', endpoint: '' },
] as const;
