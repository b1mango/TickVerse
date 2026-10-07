import { useState } from 'react';
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { QuadrantMoveDescriptor } from '@/services/taskService';
import { QUADRANT_IDS, type Quadrant, type Task } from '@/types/task';

/** Hit-test inside the pointed card first; never choose an adjacent column across a gap. */
export const taskCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const candidates = hits.filter((hit) => !QUADRANT_IDS.includes(hit.id as Quadrant));
  if (args.pointerCoordinates) return candidates.length ? candidates : hits;
  return closestCenter(args);
};

export function useTaskDrag(
  lists: Record<Quadrant, Task[]>,
  onMove: (move: QuadrantMoveDescriptor) => void,
) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [target, setTarget] = useState<QuadrantMoveDescriptor | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [after, setAfter] = useState(false);
  const [dragHeight, setDragHeight] = useState(40);
  const reset = () => {
    setActiveTask(null);
    setTarget(null);
    setOverId(null);
  };
  const locate = ({ active, over }: DragOverEvent): QuadrantMoveDescriptor | null => {
    const from = active.data.current?.quadrant as Quadrant;
    const to = (over?.data.current?.quadrant ?? over?.id) as Quadrant;
    if (
      !over ||
      !QUADRANT_IDS.includes(from) ||
      !QUADRANT_IDS.includes(to) ||
      active.id === over.id
    )
      return null;
    const rest = lists[to].filter((task) => task.id !== active.id);
    const index = rest.findIndex((task) => task.id === over.id);
    const rect = active.rect.current.translated;
    const below = !!rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2;
    return {
      id: String(active.id),
      from,
      to,
      toIndex: index < 0 ? rest.length : index + Number(below),
    };
  };
  return {
    activeTask,
    overId,
    overQuadrant: target?.to ?? null,
    after,
    // Cross-column placeholder gives the target a real gap without mutating source data.
    target,
    dragHeight,
    handleDragStart: ({ active }: DragStartEvent) => {
      setDragHeight(active.rect.current.initial?.height ?? 40);
      setActiveTask(
        Object.values(lists)
          .flat()
          .find((task) => task.id === active.id) ?? null,
      );
    },
    handleDragOver: (event: DragOverEvent) => {
      const next = locate(event);
      setTarget(next);
      setOverId(event.over ? String(event.over.id) : null);
      const rect = event.active.rect.current.translated;
      setAfter(
        !!rect &&
          !!event.over &&
          rect.top + rect.height / 2 > event.over.rect.top + event.over.rect.height / 2,
      );
    },
    handleDragCancel: reset,
    handleDragEnd: (event: DragEndEvent) => {
      const move = locate(event);
      reset();
      if (move) onMove(move);
    },
  };
}
