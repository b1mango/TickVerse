import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CalendarDays, Mountain, RotateCcw, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CustomLayoutCanvas } from '@/components/editor/CustomLayoutCanvas';
import { LayoutModeSwitcher } from '@/components/editor/LayoutModeSwitcher';
import { HorizonCard } from '@/components/task/HorizonCard';
import { TaskItem } from '@/components/task/TaskItem';
import { useActiveCounts, useActiveTasks } from '@/hooks/useTasks';
import { taskService, type MoveDescriptor } from '@/services/taskService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import { useUiStore } from '@/stores/uiStore';
import type { EditorModuleKey } from '@/types/settings';
import type { Horizon, Task } from '@/types/task';

const MODULE_ORDER = ['today', 'short', 'long'] as const satisfies readonly EditorModuleKey[];

const MODULE_META: Record<EditorModuleKey, { title: string; icon: LucideIcon }> = {
  today: { title: '今日', icon: Sun },
  short: { title: '短期', icon: CalendarDays },
  long: { title: '长期', icon: Mountain },
};

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
  const editorLayout = useSettingsStore((s) => s.editorLayout);
  const setEditorLayoutMode = useSettingsStore((s) => s.setEditorLayoutMode);
  const setEditorModulePosition = useSettingsStore((s) => s.setEditorModulePosition);
  const setEditorModuleWidth = useSettingsStore((s) => s.setEditorModuleWidth);
  const resetEditorLayout = useSettingsStore((s) => s.resetEditorLayout);
  const { mode } = editorLayout;

  // 各模式容器宽度不定死：竖向单列收敛；多列/自定义随窗口弹性铺开（2026-08-28 用户钦定）
  const widthClass = {
    vertical: 'max-w-2xl',
    horizontal: 'max-w-[1600px]',
    split: 'max-w-[1400px]',
    custom: 'max-w-none',
  }[mode];

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    // 4px 位移阈值：普通点击/双击不触发拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasksByHorizon: Record<Horizon, Task[]> = {
    today: todayTasks,
    short: shortTasks,
    long: longTasks,
  };

  const now = new Date();

  const handleAdd = (title: string, horizon: Horizon) => {
    void taskService.addTask(title, horizon, tasksByHorizon[horizon]);
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

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasksByHorizon[active.data.current?.horizon as Horizon]?.find(
      (t) => t.id === active.id,
    );
    setActiveTask(task ?? null);
  };
  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null);
  };
  const handleDragCancel = () => {
    setActiveTask(null);
    setOverId(null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    setOverId(null);
    if (!over || active.id === over.id) return;

    const from = active.data.current?.horizon as Horizon | undefined;
    if (!from) return;
    const overHorizon = (over.data.current?.horizon ?? over.id) as Horizon;
    // 目标列表先剔除拖拽项，插入位 = 悬停条目在剔除后列表中的下标（与 planMove 语义一致）
    const targetRest = tasksByHorizon[overHorizon].filter((t) => t.id !== active.id);
    const overIndex = targetRest.findIndex((t) => t.id === over.id);
    const move: MoveDescriptor = {
      id: String(active.id),
      from,
      to: overHorizon,
      toIndex: overIndex === -1 ? targetRest.length : overIndex,
    };
    void taskService.moveTask(tasksByHorizon, move);
  };

  /** 按模块键渲染档案卡夹（四种布局共用） */
  const renderModule = (horizon: EditorModuleKey) => {
    const meta = MODULE_META[horizon];
    return (
      <HorizonCard
        icon={meta.icon}
        title={meta.title}
        horizon={horizon}
        tasks={tasksByHorizon[horizon]}
        rolledOverIds={horizon === 'short' ? rolledOverIds : undefined}
        overId={overId}
        activeId={activeTask?.id ?? null}
        onAdd={handleAdd}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onRename={handleRename}
      />
    );
  };

  return (
    <div className={`mx-auto px-6 pb-32 pt-16 ${widthClass}`}>
      {/* 头版区：每天打开像翻开当日报纸；布局切换器与"星期"行同高（2026-08-28 用户钦定） */}
      <header className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-display-1 tracking-[0.02em]">
            {now.getMonth() + 1}月{now.getDate()}日
          </h1>
          <p className="mt-2 font-mono text-caption text-sub">
            星期{WEEKDAYS[now.getDay()]} · {now.getFullYear()} 第 {isoWeek(now)} 周
          </p>
        </div>
        <div className="flex flex-col items-end justify-between self-stretch text-right">
          <p className="font-mono text-caption text-sub">
            今日 {counts.today} / 短期 {counts.short} / 长期 {counts.long}
          </p>
          <div className="flex items-center gap-3">
            {/* 复位布局仅自定义模式显示（移出画布，避免压住长期卡拖拽手柄） */}
            {mode === 'custom' && (
              <button
                type="button"
                onClick={resetEditorLayout}
                className="flex items-center gap-1 rounded-ctl border border-line bg-surface px-2 py-1.5 font-mono text-caption text-sub transition-colors hover:border-accent hover:text-accent"
              >
                <RotateCcw size={12} />
                复位布局
              </button>
            )}
            <LayoutModeSwitcher mode={mode} onChange={setEditorLayoutMode} />
          </div>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* key=mode：切换时重挂触发过渡动画 */}
        <div key={mode} className="layout-mode-in">
          {mode === 'vertical' && (
            <div className="flex flex-col gap-10">
              {MODULE_ORDER.map((h) => (
                <div key={h}>{renderModule(h)}</div>
              ))}
            </div>
          )}

          {mode === 'horizontal' && (
            /* 三列随容器弹性均分；窄屏 min-width 撑出横向滚动（水墨滑动条） */
            <div className="ink-scroll-x flex items-start gap-6 overflow-x-auto pb-2">
              {MODULE_ORDER.map((h) => (
                <div key={h} className="min-w-[340px] flex-1">
                  {renderModule(h)}
                </div>
              ))}
            </div>
          )}

          {mode === 'split' && (
            /* 今日在左（事项多给 3/5 宽），右列上短期下长期；窄屏退化为单列 */
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[3fr_2fr]">
              {renderModule('today')}
              <div className="flex flex-col gap-6">
                {renderModule('short')}
                {renderModule('long')}
              </div>
            </div>
          )}

          {mode === 'custom' && (
            <CustomLayoutCanvas
              placements={editorLayout.custom}
              onPositionChange={setEditorModulePosition}
              onWidthChange={setEditorModuleWidth}
              renderModule={renderModule}
            />
          )}
        </div>

        {/* 拖拽浮层：缩放 0.96 + 投影（方向稿 §11） */}
        <DragOverlay>
          {activeTask ? (
            <TaskItem
              task={activeTask}
              overlay
              onComplete={() => {}}
              onDelete={() => {}}
              onRename={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
