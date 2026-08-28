import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from '@/components/task/TaskItem';
import type { Task } from '@/types/task';

interface SortableTaskItemProps {
  task: Task;
  badge?: string;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

/** 可拖拽条目壳（§15-2 dnd-kit）：位移/重排交给 sortable，条目本身保持纯渲染 */
export function SortableTaskItem({ task, badge, onComplete, onDelete, onRename }: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { horizon: task.horizon },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-30' : ''}
    >
      <TaskItem
        task={task}
        badge={badge}
        onComplete={onComplete}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  );
}
