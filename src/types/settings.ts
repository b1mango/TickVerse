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
