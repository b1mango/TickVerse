import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Task } from '@/types/task';
import { tokenDuration } from '@/utils/motion';

/** 完成动效阶段（方向稿 §6）：描边 → 划线 → 右移淡出 → 归档戳 → 落库 */
type Phase = 'idle' | 'check' | 'strike' | 'leave' | 'stamp';

interface TaskItemProps {
  task: Task;
  /** 朱砂 mono 小标签（如"昨日遗留"），置顶于短期模块 */
  badge?: string;
  /** 拖拽浮层内渲染时关闭交互 */
  overlay?: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * 条目 = 勾选框 + 标题（+ 截止日/备注 M2 后迭代）。
 * 完成动效基础版：勾选描边（micro）→ 划线左→右（fast）→ 右移 24px 淡出（normal）
 * → 归档戳淡入（档案室描边戳旋转 −8° / 极简文字直出）→ 写 completedAt。
 */
export function TaskItem({ task, badge, overlay, onComplete, onDelete, onRename }: TaskItemProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [editing, setEditing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const handleCheck = () => {
    if (phase !== 'idle') return;
    const micro = tokenDuration('--dur-micro', 120);
    const fast = tokenDuration('--dur-fast', 200);
    const normal = tokenDuration('--dur-normal', 300);
    setPhase('check');
    timers.current = [
      setTimeout(() => setPhase('strike'), micro),
      setTimeout(() => setPhase('leave'), micro + fast),
      setTimeout(() => setPhase('stamp'), micro + fast + normal),
      setTimeout(() => onComplete(task.id), micro + fast + normal + 500),
    ];
  };
  const handleDelete = () => onDelete(task.id);
  const handleDoubleClick = () => {
    if (!overlay && phase === 'idle') setEditing(true);
  };
  const commitRename = (value: string) => {
    setEditing(false);
    if (value.trim() && value.trim() !== task.title) onRename(task.id, value);
  };

  if (phase === 'stamp') {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="archive-stamp font-mono text-caption">已归档</span>
      </div>
    );
  }

  const striking = phase === 'strike' || phase === 'leave';

  return (
    <div
      className={`group flex items-center gap-3 px-1 py-2 ${
        overlay ? 'scale-[0.96] rounded-ctl bg-surface shadow-[var(--shadow-float)]' : ''
      }`}
      style={{
        opacity: phase === 'leave' ? 0 : 1,
        transform: phase === 'leave' ? 'translateX(24px)' : undefined,
        transition: `opacity var(--dur-normal) linear, transform var(--dur-normal) linear`,
      }}
    >
      <button
        aria-label="完成"
        onClick={handleCheck}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border border-sub transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-ink">
          <path
            d="M3 8.5l3.2 3L13 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={14}
            strokeDashoffset={phase === 'idle' ? 14 : 0}
            style={{ transition: 'stroke-dashoffset var(--dur-micro) linear' }}
          />
        </svg>
      </button>

      {editing ? (
        <input
          autoFocus
          defaultValue={task.title}
          onBlur={(e) => commitRename(e.target.value)}
          onKeyDown={(e) => {
            // 阻止冒泡：dnd-kit KeyboardSensor 挂在条目容器上，Enter/Space 会被误当拖拽激活键
            e.stopPropagation();
            if (e.key === 'Enter') commitRename(e.currentTarget.value);
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 bg-transparent text-body focus:outline-none"
        />
      ) : (
        <span className="relative flex-1 text-body" onDoubleClick={handleDoubleClick}>
          {task.title}
          <span
            className="absolute left-0 top-1/2 h-px bg-sub"
            style={{ width: striking ? '100%' : '0%', transition: 'width var(--dur-fast) linear' }}
          />
        </span>
      )}

      {badge && <span className="shrink-0 font-mono text-caption text-accent">{badge}</span>}
      {!overlay && (
        <button
          aria-label="删除"
          onClick={handleDelete}
          className="shrink-0 text-sub opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
