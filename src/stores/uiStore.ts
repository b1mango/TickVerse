import { create } from 'zustand';

/**
 * uiStore：全局 UI 瞬时状态（toast）。
 * toast 视觉：底部居中胶囊、mono 小字（《视觉方向稿.md》§11）。
 */
export interface ToastPayload {
  message: string;
  /** 撤销等动作；有动作时停留 5s（§15-6），否则 3s 自动消（方向稿 §11） */
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  toast: ToastPayload | null;
  showToast: (toast: ToastPayload) => void;
  dismissToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
}));
