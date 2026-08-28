import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { LucideIcon } from 'lucide-react';
import { SortableTaskItem } from '@/components/task/SortableTaskItem';
import type { Horizon, Task } from '@/types/task';

interface HorizonCardProps {
  icon: LucideIcon;
  title: string;
  horizon: Horizon;
  tasks: Task[];
  /** 本次启动滚入的任务（短期模块顶部标"昨日遗留"） */
  rolledOverIds?: ReadonlySet<string>;
  /** 拖拽悬停目标（条目 id 或模块 horizon），用于 1px accent 指示线（方向稿 §11） */
  overId: string | null;
  activeId: string | null;
  onAdd: (title: string, horizon: Horizon) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/**
 * 模块档案卡夹：模块头 = Lucide 图标 + display 标题 + mono 计数 + 延伸细线（方向稿 §7）。
 * 输入线回车即存、连续录入；条目可排序、可跨模块拖入（dnd-kit，§15-2）。
 */
export function HorizonCard({
  icon: Icon,
  title,
  horizon,
  tasks,
  rolledOverIds,
  overId,
  activeId,
  onAdd,
  onComplete,
  onDelete,
  onRename,
}: HorizonCardProps) {
  const [draft, setDraft] = useState('');
  const { setNodeRef } = useDroppable({ id: horizon, data: { horizon } });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !draft.trim()) return;
    onAdd(draft, horizon);
    setDraft('');
  };

  /** 目标位置指示线：悬停在某条目上时出现在其上方 */
  const indicator = <div className="mx-1 h-px bg-accent" />;

  return (
    <section ref={setNodeRef} className="rounded-card border border-line bg-surface p-6">
      <header className="flex items-baseline gap-3">
        <Icon size={18} className="translate-y-[2px] text-sub" />
        <h2 className="font-display text-title">{title}</h2>
        <span className="font-mono text-caption text-sub">{tasks.length}</span>
        <div className="ml-2 h-px flex-1 bg-line" />
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-3 divide-y divide-line">
          {tasks.map((task) => (
            <div key={task.id}>
              {overId === task.id && activeId !== task.id && indicator}
              <SortableTaskItem
                task={task}
                badge={rolledOverIds?.has(task.id) ? '昨日遗留' : undefined}
                onComplete={onComplete}
                onDelete={onDelete}
                onRename={onRename}
              />
            </div>
          ))}
          {overId === horizon && indicator}
        </div>
      </SortableContext>

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="此刻，想拾起哪一刻……"
        className="mt-3 w-full border-t border-line bg-transparent pt-3 text-body placeholder:text-sub focus:outline-none"
      />
    </section>
  );
}
