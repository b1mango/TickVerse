import { RotateCcw } from 'lucide-react';
import { QuadrantMatrix } from '@/components/task/QuadrantMatrix';
import { useQuadrantTasks } from '@/hooks/useTasks';
import { taskService, type QuadrantMoveDescriptor } from '@/services/taskService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import type { QuadrantLayoutMode } from '@/types/settings';
import { DEFAULT_QUADRANT_COLUMN_WIDTHS, WIDGET_FONT_BASE_PX } from '@/types/settings';
import type { Quadrant, Task } from '@/types/task';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

const LAYOUTS: readonly { value: QuadrantLayoutMode; label: string }[] = [
  { value: 'columns', label: '四列' },
  { value: 'grid', label: '四象限' },
];

/** ISO 周数（头版 mono 小字"第 N 周"） */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** 报纸头版式记录页（《视觉方向稿.md》§7）：超大衬线日期 + 常驻四象限模块（艾森豪威尔矩阵） */
export function EditorPage() {
  const quadrantTasks = useQuadrantTasks();
  const showToast = useUiStore((s) => s.showToast);
  const quadrantLayout = useSettingsStore((s) => s.quadrantLayout);
  const setQuadrantLayout = useSettingsStore((s) => s.setQuadrantLayout);
  const quadrantColumnWidths = useSettingsStore((s) => s.quadrantColumnWidths);
  const setQuadrantColumnWidths = useSettingsStore((s) => s.setQuadrantColumnWidths);
  /** 待办页正文字号（px，页面根 zoom 缩放交互与排版全局生效） */
  const editorFont = useSettingsStore((s) => s.editorFont);

  const tasksByQuadrant: Record<Quadrant, Task[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const t of quadrantTasks) {
    if (t.quadrant) tasksByQuadrant[t.quadrant].push(t);
  }

  const now = new Date();

  const handleAdd = (title: string, quadrant: Quadrant) => {
    void taskService.addQuadrantTask(title, quadrant, tasksByQuadrant[quadrant]);
  };
  const handleComplete = (id: string) => {
    void taskService.completeTask(id).then(() => {
      showToast({ message: '已归档 → 时间轴' });
    });
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
  const handleRename = (id: string, title: string) => {
    void taskService.renameTask(id, title);
  };
  const handleMove = (move: QuadrantMoveDescriptor) => {
    void taskService.moveQuadrantTask(tasksByQuadrant, move);
  };

  const isDefaultWidths = DEFAULT_QUADRANT_COLUMN_WIDTHS.every(
    (w, i) => quadrantColumnWidths[i] === w,
  );

  return (
    <div
      className="mx-auto max-w-[1500px] px-6 pb-32 pt-8"
      style={{ zoom: editorFont / WIDGET_FONT_BASE_PX }}
    >
      {/* 头版区：日期主标 + 星期行；模式操作与星期行同高右置（2026-10-07 修订十二：星期行与卡片间距回松） */}
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-display-1 tracking-[0.02em]">
            {now.getMonth() + 1}月{now.getDate()}日
          </h1>
          <p className="mt-1 font-mono text-caption text-sub">
            星期{WEEKDAYS[now.getDay()]} · {now.getFullYear()} 第 {isoWeek(now)} 周
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 恢复默认宽度：仅存在自定义列宽时可点 */}
          <button
            type="button"
            onClick={() => setQuadrantColumnWidths([...DEFAULT_QUADRANT_COLUMN_WIDTHS])}
            disabled={isDefaultWidths}
            title="恢复默认宽度"
            className="flex items-center gap-1 rounded-ctl border border-line px-2 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
          >
            <RotateCcw size={12} />
            恢复默认宽度
          </button>
          <div className="flex gap-2">
            {LAYOUTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setQuadrantLayout(value)}
                className={`rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
                  quadrantLayout === value
                    ? 'border-accent text-accent'
                    : 'border-line text-sub hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <QuadrantMatrix
        tasksByQuadrant={tasksByQuadrant}
        layout={quadrantLayout}
        columnWidths={quadrantColumnWidths}
        onColumnWidthsChange={setQuadrantColumnWidths}
        onAdd={handleAdd}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onRename={handleRename}
        onMove={handleMove}
      />
    </div>
  );
}
