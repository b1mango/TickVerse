import { create } from 'zustand';

/** WebDAV 同步状态（UI 展示用；配置在 settingsStore） */
interface SyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  setSyncing: (syncing: boolean) => void;
  setResult: (at: number | null, error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  setSyncing: (syncing) => set({ syncing }),
  setResult: (lastSyncAt, lastError) => set({ lastSyncAt, lastError }),
}));
