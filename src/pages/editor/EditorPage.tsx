import { CalendarDays, Mountain, Sun } from 'lucide-react';
import { HorizonCard } from '@/components/task/HorizonCard';
import { useActiveCounts, useActiveTasks } from '@/hooks/useTasks';
import { taskService } from '@/services/taskService';
import { useTaskStore } from '@/stores/taskStore';
import { useUiStore } from '@/stores/uiStore';
import type { Horizon } from '@/types/task';

const MODULES = [
  { horizon: 'today', title: '今日', icon: Sun },
  { horizon: 'short', title: '短期', icon: CalendarDays },
  { horizon: 'long', title: '长期', icon: Mountain },
] as const;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** ISO 周数（头版 mono 小字"第 N 周"） */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** 报纸头版式编辑页（《视觉方向稿.md》§7）：超大衬线日期 + mono 元信息 + 三模块档案卡夹 */
export function EditorPage() {
  const todayTasks = useActiveTasks('today');
  const shortTasks = useActiveTasks('short');
  const longTasks = useActiveTasks('long');
  const counts = useActiveCounts();
  const rolledOverIds = useTaskStore((s) => s.rolledOverIds);
  const showToast = useUiStore((s) => s.showToast);

  const tasksByHorizon: Record<Horizon, typeof todayTasks> = {
    today: todayTasks,
    short: shortTasks,
    long: longTasks,
  };

  const now = new Date();

  const handleAdd = (title: string, horizon: Horizon) => {
    void taskService.addTask(title, horizon, tasksByHorizon[horizon]);
  };
  const handleComplete = (id: string) => {
    void taskService.completeTask(id);
  };
  const handleDelete = (id: string) => {
    void taskService.deleteTask(id).then((snapshot) => {
      if (!snapshot) return;
      showToast({
        message: '已删除',
        actionLabel: '撤销',
        onAction: () => void taskService.undoDelete(snapshot),
      });
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 pb-32 pt-16">
      {/* 头版区：每天打开像翻开当日报纸 */}
      <header className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="font-display text-display-1 tracking-[0.02em]">
            {now.getMonth() + 1}月{now.getDate()}日
          </h1>
          <p className="mt-2 font-mono text-caption text-sub">
            星期{WEEKDAYS[now.getDay()]} · {now.getFullYear()} 第 {isoWeek(now)} 周
          </p>
        </div>
        <p className="text-right font-mono text-caption text-sub">
          今日 {counts.today} / 短期 {counts.short} / 长期 {counts.long}
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {MODULES.map(({ horizon, title, icon }) => (
          <HorizonCard
            key={horizon}
            icon={icon}
            title={title}
            horizon={horizon}
            tasks={tasksByHorizon[horizon]}
            rolledOverIds={horizon === 'short' ? rolledOverIds : undefined}
            onAdd={handleAdd}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
