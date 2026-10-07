import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Task } from '@/types/task';
import { tokenDuration } from '@/utils/motion';

/** 完成动效阶段（方向稿 §6）：描边 → 划线 → 右移淡出 → 归档戳 → 落库 */
type Phase = 'idle' | 'check' | 'strike' | 'leave' | 'stamp';

interface TaskItemProps {
  task: Task;
  /** 拖拽浮层内渲染时关闭交互 */
  overlay?: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/** 编辑框随内容自适应高度（多行保形：折行与换行都保留） */
function autosize(ta: HTMLTextAreaElement): void {
  ta.style.height = '0px';
  ta.style.height = `${ta.scrollHeight}px`;
}

/**
 * 条目 = 勾选框 + 标题（+ 截止日/备注 M2 后迭代）。
 * 完成动效基础版：勾选描边（micro）→ 划线左→右（fast）→ 右移 24px 淡出（normal）
 * → 归档戳淡入（档案室描边戳旋转 −8° / 极简文字直出）→ 写 completedAt。
 * 双击编辑：光标落回双击命中位置；编辑态 textarea 保形多行（Enter 提交 / Shift+Enter 换行 / Esc 取消）。
 * 展示态 whitespace-pre-wrap 保留手动换行（2026-10-07 修订十四）。
 */
export function TaskItem({ task, overlay, onComplete, onDelete, onRename }: TaskItemProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [editing, setEditing] = useState(false);
  /** 双击点的字符偏移（null = 落末尾） */
  const [editCaret, setEditCaret] = useState<number | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /** 进入编辑：聚焦 + 光标落到双击位置 + 高度跟随内容 */
  useLayoutEffect(() => {
    if (!editing) return;
    const ta = editRef.current;
    if (!ta) return;
    autosize(ta);
    ta.focus();
    const pos = editCaret ?? ta.value.length;
    ta.setSelectionRange(pos, pos);
  }, [editing, editCaret]);

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
  const handleDoubleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (overlay || phase !== 'idle') return;
    // caretRangeFromPoint 取命中文字节点的字符偏移；取不到（点在文本外/元素上）则落末尾
    let caret: number | null = null;
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (
      range &&
      range.startContainer.nodeType === Node.TEXT_NODE &&
      e.currentTarget.contains(range.startContainer)
    ) {
      caret = range.startOffset;
    }
    setEditCaret(caret);
    setEditing(true);
  };
  const commitRename = (value: string) => {
    setEditing(false);
    setEditCaret(null);
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
      className={`group flex ${editing ? 'items-start' : 'items-center'} gap-3 rounded-ctl px-1 py-2 transition-colors hover:bg-ink/[0.04] ${
        overlay
          ? `bg-surface [box-shadow:var(--shadow-float)] ${
              reducedMotion ? '' : 'scale-[1.02] -translate-y-0.5'
            }`
          : ''
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
            /* round 线帽会把隐藏描边的端点渗成勾选框内的小黑点：未选中整条隐藏，保持空框干净 */
            opacity={phase === 'idle' ? 0 : 1}
            style={{ transition: 'stroke-dashoffset var(--dur-micro) linear' }}
          />
        </svg>
      </button>

      {editing ? (
        <textarea
          ref={editRef}
          defaultValue={task.title}
          rows={1}
          onBlur={(e) => commitRename(e.target.value)}
          onChange={(e) => autosize(e.currentTarget)}
          onKeyDown={(e) => {
            // 阻止冒泡：dnd-kit KeyboardSensor 挂在条目容器上，Enter/Space 会被误当拖拽激活键
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitRename(e.currentTarget.value);
            }
            if (e.key === 'Escape') {
              setEditing(false);
              setEditCaret(null);
            }
          }}
          className="w-full flex-1 resize-none overflow-hidden bg-transparent text-body focus:outline-none"
        />
      ) : (
        <span className="relative flex-1 whitespace-pre-wrap break-words text-body" onDoubleClick={handleDoubleClick}>
          {task.title}
          <span
            className="absolute left-0 top-1/2 h-px bg-sub"
            style={{ width: striking ? '100%' : '0%', transition: 'width var(--dur-fast) linear' }}
          />
        </span>
      )}

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
