import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
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
import { taskCollision, useTaskDrag } from '@/hooks/useTaskDrag';
import type { QuadrantMoveDescriptor } from '@/services/taskService';
import type { QuadrantLayoutMode } from '@/types/settings';
import type { Quadrant, Task } from '@/types/task';

interface QuadrantColumnMeta {
  id: Quadrant;
  title: string;
  icon: LucideIcon;
  /** 顶部 2px 标识条色（token 色板四档：accent → ink → sub → line，由重到轻区分象限） */
  stripe: string;
  /** 图标/标题色 */
  tone: string;
}

const COLUMNS: readonly QuadrantColumnMeta[] = [
  { id: 'q1', title: '重要且紧急', icon: Flame, stripe: 'border-t-accent', tone: 'text-accent' },
  { id: 'q2', title: '重要不紧急', icon: Sprout, stripe: 'border-t-ink/60', tone: 'text-ink' },
  { id: 'q3', title: '紧急不重要', icon: Zap, stripe: 'border-t-sub', tone: 'text-sub' },
  { id: 'q4', title: '不重要不紧急', icon: CloudSun, stripe: 'border-t-line', tone: 'text-sub' },
];

/** 列宽调节的 flex-grow 下限（防止列被拖没） */
const MIN_COLUMN_GROW = 0.5;
/** 象限列卡片高度上限（520 → 620 ≈ 加四行正文高度，2026-10-06 用户钦定）。
 *  高度随窗口动态调整（2026-10-07 修订十一）：钳 260px ~ 上限 × 视口余量，
 *  窗口缩小时卡片变矮（内容超长列内纵滚），不再一刀切撑出页外 */
const COLUMN_HEIGHT_PX = 620;

interface QuadrantMatrixProps {
  tasksByQuadrant: Record<Quadrant, Task[]>;
  layout: QuadrantLayoutMode;
  columnWidths: number[];
  onColumnWidthsChange: (widths: number[]) => void;
  onAdd: (title: string, quadrant: Quadrant) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (move: QuadrantMoveDescriptor) => void;
}

interface QuadrantColumnProps {
  meta: QuadrantColumnMeta;
  tasks: Task[];
  /** 拖拽悬停目标（条目 id 或象限列 id），用于 accent 指示线 */
  overId: string | null;
  activeId: string | null;
  /** 拖拽悬停在本列（高亮描边，明确"拖到哪个象限"） */
  highlight: boolean;
  after: boolean;
  insertion?: { index: number; height: number };
  onAdd: (title: string, quadrant: Quadrant) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/** 象限列卡：固定统一高度，列内清单纵滚；悬浮投影 + 悬停轻抬 + 标题分隔 + 条目行悬停微染色（2026-10-06 视觉打磨） */
function QuadrantColumn({
  meta,
  tasks,
  overId,
  activeId,
  highlight,
  after,
  insertion,
  onAdd,
  onComplete,
  onDelete,
  onRename,
}: QuadrantColumnProps) {
  const [draft, setDraft] = useState('');
  const { id, title, icon: Icon, stripe, tone } = meta;
  const { setNodeRef } = useDroppable({ id, data: { quadrant: id } });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key !== 'Enter' || !draft.trim()) return;
    onAdd(draft, id);
    setDraft('');
  };

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col rounded-card border bg-surface p-4 border-t-2 [box-shadow:var(--shadow-float)] ${stripe} ${
        highlight ? 'border-accent/60' : 'border-line'
      } transition-[transform,border-color] duration-[var(--dur-fast)] ${
        activeId === null ? 'hover:-translate-y-0.5' : ''
      }`}
      style={{ height: `clamp(260px, calc(100dvh - 272px), ${COLUMN_HEIGHT_PX}px)` }}
    >
      <header className="flex shrink-0 items-baseline gap-2 border-b border-line/60 pb-3">
        <Icon size={15} className={`translate-y-[2px] ${tone}`} />
        <h3 className={`font-display text-body ${tone}`}>{title}</h3>
        <span className="font-mono text-caption text-sub">{tasks.length}</span>
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {/* 列内纵滚（无可见滑动条保滚动），卡片高度恒定不随内容生长 */}
        <div className="no-scrollbar mt-2 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {tasks.length === 0 && overId !== id && (
            <p className="py-6 text-center font-mono text-caption text-sub/70">此象限暂无记录</p>
          )}
          {tasks.map((task, i) => (
            <SortableTaskItem
              key={task.id}
              shift={insertion && i >= insertion.index ? insertion.height : 0}
              task={task}
              indicator={
                overId === task.id && activeId !== task.id
                  ? after
                    ? 'below'
                    : 'above'
                  : overId === id && activeId !== task.id && i === tasks.length - 1
                    ? 'below'
                    : undefined
              }
              onComplete={onComplete}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
          {overId === id && tasks.length === 0 && <div className="mx-1 mt-2 h-0.5 bg-accent" />}
        </div>
      </SortableContext>

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`记入「${title}」…`}
        className="mt-2 w-full shrink-0 border-t border-line bg-transparent pt-2 text-body placeholder:text-sub focus:outline-none"
      />
    </section>
  );
}

/**
 * 四象限模块（艾森豪威尔矩阵，清单 M6 B-8）：q1–q4 四列并排。
 * 版式二选一（偏好存 localStorage）：四列 = flex 响应式一行四列（窄容器自动降级），
 * 前三列右缘 / 末列左缘 10px 热区拖调宽度（flex 比例落盘）；四象限 = 固定 2x2 宫格等宽（宽度调节禁用）。
 * 条目可跨象限拖拽（dnd-kit）：浮层卡片抬升投影、源位半透明占位、目标列高亮 +
 * 让位过渡 200ms / accent 指示线，reduced-motion 全部降级为即时切换。
 */
export function QuadrantMatrix({
  tasksByQuadrant,
  layout,
  columnWidths,
  onColumnWidthsChange,
  onAdd,
  onComplete,
  onDelete,
  onRename,
  onMove,
}: QuadrantMatrixProps) {
  /** 列宽拖拽中的实时比例（抬手才落盘） */
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null);
  const liveWidthsRef = useRef<number[] | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);

  const sensors = useSensors(
    // 4px 位移阈值：普通点击/双击不触发拖拽；编辑输入上按下不激活（见 EditingSafePointerSensor）
    useSensor(EditingSafePointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const effectiveWidths = liveWidths ?? columnWidths;

  /**
   * 拖列缘调宽（去掉列间分隔条，列缘 10px 热区）：热区成对作用于相邻两列（sum 守恒），
   * 指针映射 pair 内左列宽、右列取余量。布点（2026-10-06 修订七）：
   * 左缘热区 q2/q3/q4 各一（与左邻成对），右缘热区 q1/q2/q3 各一（与右邻成对），q1 左缘不加。
   */
  const startResize = (a: number, b: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const start = [...effectiveWidths];
    const sum = start[a] + start[b];
    const left = columnRefs.current[a]?.getBoundingClientRect().left ?? 0;
    const right = columnRefs.current[b]?.getBoundingClientRect().right ?? 0;
    const span = Math.max(1, right - left);

    // 全局监听而非 setPointerCapture：注入式输入（自动化/CDP）下 capture 会抛异常
    const move = (ev: PointerEvent) => {
      const raw = ((ev.clientX - left) / span) * sum;
      const resized = Math.min(sum - MIN_COLUMN_GROW, Math.max(MIN_COLUMN_GROW, raw));
      const next = [...start];
      next[a] = resized;
      next[b] = sum - resized;
      liveWidthsRef.current = next;
      setLiveWidths(next);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (liveWidthsRef.current) {
        onColumnWidthsChange(liveWidthsRef.current.map((w) => Math.round(w * 100) / 100));
      }
      liveWidthsRef.current = null;
      setLiveWidths(null);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };

  const {
    activeTask,
    overId,
    overQuadrant,
    after,
    target,
    dragHeight,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useTaskDrag(tasksByQuadrant, onMove);

  return (
    <section>
      <DndContext
        sensors={sensors}
        collisionDetection={taskCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragMove={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className={
            layout === 'grid'
              ? 'mt-2 grid grid-cols-2 items-stretch gap-6'
              : 'mt-2 flex flex-wrap items-stretch gap-6'
          }
        >
          {COLUMNS.map((meta, i) => (
            <div
              key={meta.id}
              ref={(el) => {
                columnRefs.current[i] = el;
              }}
              className="relative"
              style={
                layout === 'columns'
                  ? { flexGrow: effectiveWidths[i] ?? 1, flexBasis: 0, minWidth: 180 }
                  : undefined
              }
            >
              <QuadrantColumn
                meta={meta}
                tasks={tasksByQuadrant[meta.id]}
                overId={overId}
                activeId={activeTask?.id ?? null}
                highlight={overQuadrant === meta.id}
                after={after}
                insertion={
                  target?.to === meta.id && target.from !== target.to
                    ? { index: target.toIndex, height: dragHeight }
                    : undefined
                }
                onAdd={onAdd}
                onComplete={onComplete}
                onDelete={onDelete}
                onRename={onRename}
              />
              {/* 左缘热区（q2/q3/q4：与左邻成对，q1 不加；常态无线，hover 显朱砂竖条） */}
              {layout === 'columns' && i > 0 && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`调节「${COLUMNS[i - 1].title}」与「${meta.title}」列宽`}
                  onPointerDown={startResize(i - 1, i)}
                  className="group absolute -left-[5px] top-0 z-10 h-full w-[10px] cursor-ew-resize touch-none select-none"
                >
                  <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-70" />
                </div>
              )}
              {/* 右缘热区（q1/q2/q3：与右邻成对） */}
              {layout === 'columns' && i < COLUMNS.length - 1 && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`调节「${meta.title}」与「${COLUMNS[i + 1].title}」列宽`}
                  onPointerDown={startResize(i, i + 1)}
                  className="group absolute -right-[5px] top-0 z-10 h-full w-[10px] cursor-ew-resize touch-none select-none"
                >
                  <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-70" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 拖拽浮层：抬升 + 投影（reduced-motion 直出，见 TaskItem） */}
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <TaskItem
                task={activeTask}
                overlay
                onComplete={() => {}}
                onDelete={() => {}}
                onRename={() => {}}
              />
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
    </section>
  );
}
