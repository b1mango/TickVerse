import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CloudSun, Flame, Sprout, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EditingSafePointerSensor } from '@/components/task/EditingSafePointerSensor';
import { SortableTaskItem } from '@/components/task/SortableTaskItem';
import { TaskItem } from '@/components/task/TaskItem';
import { useQuadrantTasks } from '@/hooks/useTasks';
import { taskService } from '@/services/taskService';
import { useUiStore } from '@/stores/uiStore';
import type { Quadrant, Task } from '@/types/task';

interface QuadrantColumnMeta {
  id: Quadrant;
  title: string;
  icon: LucideIcon;
  /** 顶部 2px 标识条色（与记录页四象限同一套四档） */
  stripe: string;
  tone: string;
}

const COLUMNS: readonly QuadrantColumnMeta[] = [
  { id: 'q1', title: '重要且紧急', icon: Flame, stripe: 'border-t-accent', tone: 'text-accent' },
  { id: 'q2', title: '重要不紧急', icon: Sprout, stripe: 'border-t-ink/60', tone: 'text-ink' },
  { id: 'q3', title: '紧急不重要', icon: Zap, stripe: 'border-t-sub', tone: 'text-sub' },
  { id: 'q4', title: '不重要不紧急', icon: CloudSun, stripe: 'border-t-line', tone: 'text-sub' },
];

interface WidgetColumnProps {
  meta: QuadrantColumnMeta;
  tasks: Task[];
  overId: string | null;
  activeId: string | null;
  highlight: boolean;
  onAdd: (title: string, quadrant: Quadrant) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/** 紧凑象限列卡：半透明 + 毛玻璃浮于桌面；不定高，随窗口拉伸、列内纵滚 */
function WidgetColumn({
  meta,
  tasks,
  overId,
  activeId,
  highlight,
  onAdd,
  onComplete,
  onDelete,
  onRename,
}: WidgetColumnProps) {
  const [draft, setDraft] = useState('');
  const { id, title, icon: Icon, stripe, tone } = meta;
  const { setNodeRef } = useDroppable({ id, data: { quadrant: id } });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !draft.trim()) return;
    onAdd(draft, id);
    setDraft('');
  };

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-0 flex-col rounded-card border bg-surface/85 p-2.5 backdrop-blur-md border-t-2 [box-shadow:var(--shadow-float)] ${stripe} ${
        highlight ? 'border-accent/60' : 'border-line'
      } transition-colors duration-[var(--dur-fast)]`}
    >
      <header className="flex shrink-0 items-baseline gap-1.5 border-b border-line/60 pb-1.5">
        <Icon size={12} className={`translate-y-[1px] ${tone}`} />
        <h3 className={`font-display text-caption ${tone}`}>{title}</h3>
        <span className="ml-auto font-mono text-caption text-sub">{tasks.length}</span>
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="no-scrollbar mt-1.5 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {tasks.length === 0 && overId !== id && (
            <p className="py-4 text-center font-mono text-caption text-sub/70">暂无记录</p>
          )}
          {tasks.map((task, i) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              indicator={
                overId === task.id && activeId !== task.id
                  ? 'above'
                  : overId === id && activeId !== task.id && i === tasks.length - 1
                    ? 'below'
                    : undefined
              }
              onComplete={onComplete}
              onDelete={onDelete}
              onRename={onRename}
              dimWhenDragging={false}
            />
          ))}
          {overId === id && tasks.length === 0 && <div className="mx-1 mt-1.5 h-0.5 bg-accent" />}
        </div>
      </SortableContext>

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="记入…"
        className="mt-1.5 w-full shrink-0 border-t border-line bg-transparent pt-1.5 text-caption placeholder:text-sub focus:outline-none"
      />
    </section>
  );
}

/**
 * 桌面组件四象限板（M7）：2x2 紧凑宫格，交互与记录页一致——录入、勾选归档、
 * 双击编辑、删除可撤销（toast）、跨象限拖拽（同一套 planQuadrantMove 写路径）。
 * 数据源 useQuadrantTasks：与主窗口同一 IndexedDB，liveQuery 跨上下文实时同步。
 */
export function QuadrantBoardMini() {
  const quadrantTasks = useQuadrantTasks();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overQuadrant, setOverQuadrant] = useState<Quadrant | null>(null);

  const tasksByQuadrant: Record<Quadrant, Task[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const t of quadrantTasks) {
    if (t.quadrant) tasksByQuadrant[t.quadrant].push(t);
  }

  const sensors = useSensors(
    useSensor(EditingSafePointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = (title: string, quadrant: Quadrant) => {
    void taskService.addQuadrantTask(title, quadrant, tasksByQuadrant[quadrant]);
  };
  const handleComplete = (id: string) => {
    void taskService.completeTask(id);
  };
  const handleDelete = (id: string) => {
    void taskService.deleteTask(id).then((snapshot) => {
      if (!snapshot) return;
      useUiStore.getState().showToast({
        message: '已删除',
        actionLabel: '撤销',
        onAction: () => void taskService.undoDelete(snapshot),
      });
    });
  };
  const handleRename = (id: string, title: string) => {
    void taskService.renameTask(id, title);
  };

  const findTask = (quadrant: Quadrant | undefined, id: string | number): Task | null =>
    quadrant ? (tasksByQuadrant[quadrant].find((t) => t.id === id) ?? null) : null;

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveTask(findTask(active.data.current?.quadrant as Quadrant | undefined, active.id));
  };
  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null);
    setOverQuadrant(over ? ((over.data.current?.quadrant ?? over.id) as Quadrant) : null);
  };
  const handleDragCancel = () => {
    setActiveTask(null);
    setOverId(null);
    setOverQuadrant(null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    setOverId(null);
    setOverQuadrant(null);
    if (!over || active.id === over.id) return;

    const from = active.data.current?.quadrant as Quadrant | undefined;
    if (!from) return;
    const to = (over.data.current?.quadrant ?? over.id) as Quadrant;
    const targetRest = tasksByQuadrant[to].filter((t) => t.id !== active.id);
    const overIndex = targetRest.findIndex((t) => t.id === over.id);
    void taskService.moveQuadrantTask(tasksByQuadrant, {
      id: String(active.id),
      from,
      to,
      toIndex: overIndex === -1 ? targetRest.length : overIndex,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {COLUMNS.map((meta) => (
          <WidgetColumn
            key={meta.id}
            meta={meta}
            tasks={tasksByQuadrant[meta.id]}
            overId={overId}
            activeId={activeTask?.id ?? null}
            highlight={overQuadrant === meta.id}
            onAdd={handleAdd}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        ))}
      </div>

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
  );
}
