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
