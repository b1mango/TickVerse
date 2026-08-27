import { create } from 'zustand';

/**
 * taskStore：编辑页会话状态（不直接碰存储，§5.1）。
 * rolledOverIds：本次启动滚入短期的任务 id 集合，用于"昨日遗留"置顶标记（纯 UI 计算，§15-5）。
 */
interface TaskState {
  rolledOverIds: ReadonlySet<string>;
  setRolledOverIds: (ids: string[]) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  rolledOverIds: new Set<string>(),
  setRolledOverIds: (ids) => set({ rolledOverIds: new Set(ids) }),
}));
