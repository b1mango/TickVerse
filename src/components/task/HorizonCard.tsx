import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TaskItem } from '@/components/task/TaskItem';
import type { Horizon, Task } from '@/types/task';

interface HorizonCardProps {
  icon: LucideIcon;
  title: string;
  horizon: Horizon;
  tasks: Task[];
  /** 本次启动滚入的任务（短期模块顶部标"昨日遗留"） */
  rolledOverIds?: ReadonlySet<string>;
  onAdd: (title: string, horizon: Horizon) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * 模块档案卡夹：模块头 = Lucide 图标 + display 标题 + mono 计数 + 延伸细线（方向稿 §7）。
 * 输入线回车即存、连续录入（核心路径 ≤2 步）。
 */
export function HorizonCard({
  icon: Icon,
  title,
  horizon,
  tasks,
  rolledOverIds,
  onAdd,
  onComplete,
  onDelete,
}: HorizonCardProps) {
  const [draft, setDraft] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !draft.trim()) return;
    onAdd(draft, horizon);
    setDraft('');
  };

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <header className="flex items-baseline gap-3">
        <Icon size={18} className="translate-y-[2px] text-sub" />
        <h2 className="font-display text-title">{title}</h2>
        <span className="font-mono text-caption text-sub">{tasks.length}</span>
        <div className="ml-2 h-px flex-1 bg-line" />
      </header>

      <div className="mt-3 divide-y divide-line">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            badge={rolledOverIds?.has(task.id) ? '昨日遗留' : undefined}
            onComplete={onComplete}
            onDelete={onDelete}
          />
        ))}
      </div>

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
