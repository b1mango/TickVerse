import { Ruler } from 'lucide-react';

/** 时间轴总览页（M2 落地周视图；M1 为空态引导占位，交互原则 7：空态即引导） */
export function TimelinePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 pb-32 text-center">
      <Ruler size={48} strokeWidth={1} className="text-sub" />
      <p className="font-display text-display-2">勾掉的事，会在这里沉淀成刻度</p>
      <p className="font-mono text-caption text-sub">时间轴将于 M2 就绪</p>
    </div>
  );
}
