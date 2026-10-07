import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from '@/components/task/TaskItem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Task } from '@/types/task';

interface SortableTaskItemProps {
  task: Task;
  shift?: number;
  /** 落点指示线：above = 条目上方 / below = 条目下方（box-shadow 实现，不引起布局位移） */
  indicator?: 'above' | 'below';
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** 记录页保留拖拽反馈；桌面组件不降低条目透明度，避免组件整体像消失。 */
  dimWhenDragging?: boolean;
}

/** 让位过渡时长（方向稿 token --dur-fast），reduced-motion 时归零 */
const SORT_TRANSITION_MS = 200;

/** 可拖拽条目壳（§15-2 dnd-kit）：位移/重排交给 sortable，条目本身保持纯渲染 */
export function SortableTaskItem({
  task,
  shift = 0,
  indicator,
  onComplete,
  onDelete,
  onRename,
  dimWhenDragging = true,
}: SortableTaskItemProps) {
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { quadrant: task.quadrant },
    // 目标插入点的让位过渡：200ms 弹性缓动（reduced-motion 即时切换）
    transition: {
      duration: reducedMotion ? 0 : SORT_TRANSITION_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: shift ? `translateY(${shift}px)` : CSS.Transform.toString(transform),
        transition,
        boxShadow:
          indicator === 'above'
            ? '0 -2px 0 0 rgb(var(--accent-rgb))'
            : indicator === 'below'
              ? '0 2px 0 0 rgb(var(--accent-rgb))'
              : undefined,
      }}
      {...attributes}
      {...listeners}
      className={isDragging ? (dimWhenDragging ? 'opacity-30' : 'invisible') : ''}
    >
      <TaskItem task={task} onComplete={onComplete} onDelete={onDelete} onRename={onRename} />
    </div>
  );
}
