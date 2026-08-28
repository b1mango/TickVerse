/**
 * 主题偏好（《项目设计.md》§9）：风格 × 明暗二维。
 * 偏好仅存 localStorage，不进 WebDAV 同步文件。
 */
export type ThemeStyle = 'archive' | 'mono';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePreference {
  style: ThemeStyle;
  mode: ThemeMode;
}

export const THEME_STORAGE_KEY = 'tickverse.theme';

export const DEFAULT_THEME: ThemePreference = { style: 'archive', mode: 'system' };

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
 * 记录页布局偏好：竖向（默认）/ 横向 / 左今右分 / 自定义拖拽。
 * 与主题一样只存 localStorage，不进 WebDAV 同步文件。
 */
export type EditorLayoutMode = 'vertical' | 'horizontal' | 'split' | 'custom';

export type EditorModuleKey = 'today' | 'short' | 'long';

/** 自定义模式单模块摆位：画布坐标 + 宽度（px，宽度约束见 editorLayout.ts） */
export interface EditorModulePlacement {
  x: number;
  y: number;
  w: number;
}

export interface EditorLayoutPreference {
  mode: EditorLayoutMode;
  /** 自定义模式下三模块的画布坐标与宽度（px，相对画布左上角；老数据无 w 时读取迁移回退默认宽） */
  custom: Record<EditorModuleKey, EditorModulePlacement>;
}

export const EDITOR_LAYOUT_STORAGE_KEY = 'tickverse.editorLayout';

/** 默认摆位：横向三连（模块宽 360 + 24 间距，与 editorLayout.ts 的默认一致） */
export const DEFAULT_EDITOR_LAYOUT: EditorLayoutPreference = {
  mode: 'vertical',
  custom: {
    today: { x: 0, y: 0, w: 360 },
    short: { x: 384, y: 0, w: 360 },
    long: { x: 768, y: 0, w: 360 },
  },
};

/** 常用服务商预设（清单 M5-4：坚果云 / 自有 NAS） */
export const WEBDAV_PRESETS = [
  { label: '坚果云', endpoint: 'https://dav.jianguoyun.com/dav/' },
  { label: '自有 NAS', endpoint: '' },
] as const;
