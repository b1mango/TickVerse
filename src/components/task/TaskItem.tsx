import { useState } from 'react';
import { X } from 'lucide-react';
import type { Task } from '@/types/task';

interface TaskItemProps {
  task: Task;
  /** 朱砂 mono 小标签（如"昨日遗留"），置顶于短期模块 */
  badge?: string;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * 条目 = 勾选框 + 标题（截止日/备注 M2 后迭代）。
 * 勾选完成：先普通淡出，再写 completedAt（完成不删除，§10.1）。
 */
export function TaskItem({ task, badge, onComplete, onDelete }: TaskItemProps) {
  const [leaving, setLeaving] = useState(false);

  const handleCheck = () => {
    setLeaving(true);
    // 淡出动画（--dur-normal）结束后再落库
    setTimeout(() => onComplete(task.id), 300);
  };
  const handleDelete = () => onDelete(task.id);

  return (
    <div
      className={`group flex items-center gap-3 px-1 py-2 transition-opacity duration-[var(--dur-normal)] ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <button
        aria-label="完成"
        onClick={handleCheck}
        className="h-4 w-4 shrink-0 rounded-[2px] border border-sub transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <span className="flex-1 text-body">{task.title}</span>
      {badge && <span className="shrink-0 font-mono text-caption text-accent">{badge}</span>}
      <button
        aria-label="删除"
        onClick={handleDelete}
        className="shrink-0 text-sub opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
