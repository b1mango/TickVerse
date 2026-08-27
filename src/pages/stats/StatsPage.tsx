import { BarChart3 } from 'lucide-react';

/** 统计页（M4 落地；M1 为空态引导占位） */
export function StatsPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 pb-32 text-center">
      <BarChart3 size={48} strokeWidth={1} className="text-sub" />
      <p className="font-display text-display-2">回望，让每一刻都算数</p>
      <p className="font-mono text-caption text-sub">统计与 AI 总结将于 M4 就绪</p>
    </div>
  );
}
