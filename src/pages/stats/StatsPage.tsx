import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Heatmap } from '@/components/charts/Heatmap';
import { TrendChart } from '@/components/charts/TrendChart';
import { AiSummaryCard } from '@/components/stats/AiSummaryCard';
import { useAllTasks } from '@/hooks/useTasks';
import { periodRange } from '@/services/aiService';
import { computeStats, yearHeatmap, type StatsPeriod } from '@/services/statsService';
import type { Horizon } from '@/types/task';

const TABS: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

const HORIZON_LABEL: Record<Horizon, string> = { today: '今日', short: '短期', long: '长期' };

/**
 * 统计页（§11 页面 3 / 方向稿 §9）：
 * A 区——周/月/年 Tab、大数字区（streak / 日均 / 最长空窗）、单色系趋势图、年度热力日历、按模块分组的完成清单；
 * B 区——AI 总结卡。一切可视化只用 ink 灰阶 + 唯一朱砂。
 */
export function StatsPage() {
  const tasks = useAllTasks();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const now = Date.now();

  const stats = useMemo(() => (tasks ? computeStats(tasks, period, now) : undefined), [tasks, period, now]);
  const range = useMemo(() => periodRange(period, now), [period, now]);
  const heat = useMemo(() => (tasks ? yearHeatmap(tasks, dayjs(now).year()) : undefined), [tasks, now]);

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-16">
      <h1 className="font-display text-display-2">回望</h1>

      {/* 周期 Tab：mono 小字 + 朱砂下划线 */}
      <div className="mt-8 flex gap-6 border-b border-line">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`-mb-px border-b-2 px-1 pb-2 font-mono text-caption transition-colors duration-[var(--dur-fast)] ${
              period === value ? 'border-accent text-accent' : 'border-transparent text-sub hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!stats && (
        <div className="mt-10 flex animate-pulse flex-col gap-4">
          <div className="h-16 w-2/3 rounded bg-line" />
          <div className="h-44 rounded bg-line" />
        </div>
      )}

      {stats && (
        <>
          {/* 大数字区：三栏非对称 */}
          <div className="mt-10 flex items-end gap-12">
            <div>
              <p className="font-mono text-display-1 leading-none">{stats.streak}</p>
              <p className="mt-2 font-mono text-caption text-sub">连续打卡（天）</p>
            </div>
            <div>
              <p className="font-mono text-display-2 leading-none">{stats.dailyAvg.toFixed(1)}</p>
              <p className="mt-2 font-mono text-caption text-sub">日均完成</p>
            </div>
            <div className="pb-1">
              <p className="font-mono text-title leading-none">{stats.longestGap}</p>
              <p className="mt-2 font-mono text-caption text-sub">最长空窗（天）</p>
            </div>
            <div className="ml-auto pb-1 text-right">
              <p className="font-mono text-title leading-none">{stats.total}</p>
              <p className="mt-2 font-mono text-caption text-sub">本周期完成</p>
            </div>
          </div>

          {/* 完成趋势图 */}
          <section className="mt-12">
            <h3 className="font-mono text-caption text-sub">完成趋势</h3>
            <div className="mt-3">
              <TrendChart data={stats.trend} />
            </div>
          </section>

          {/* 年度热力日历 */}
          {heat && (
            <section className="ink-scroll-x mt-12 overflow-x-auto">
              <h3 className="mb-3 font-mono text-caption text-sub">年度热力</h3>
              <Heatmap cells={heat} year={dayjs(now).year()} />
            </section>
          )}

          {/* 完成清单（按模块分组） */}
          <section className="mt-12">
            <h3 className="font-mono text-caption text-sub">完成清单</h3>
            {stats.total === 0 && (
              <p className="mt-3 text-body text-sub">本周期还没有勾掉任何事。</p>
            )}
            {(Object.keys(HORIZON_LABEL) as Horizon[]).map(
              (h) =>
                stats.byHorizon[h].length > 0 && (
                  <div key={h} className="mt-4">
                    <p className="font-mono text-caption text-accent">
                      {HORIZON_LABEL[h]} · {stats.byHorizon[h].length}
                    </p>
                    <ul className="mt-1 divide-y divide-line border-y border-line">
                      {stats.byHorizon[h].map((t) => (
                        <li key={t.id} className="flex items-baseline gap-3 py-2">
                          <span className="flex-1 text-body">{t.title}</span>
                          <span className="font-mono text-caption text-sub">
                            {dayjs(t.completedAt).format('MM/DD HH:mm')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </section>

          {/* B 区：AI 总结 */}
          <AiSummaryCard range={range} tasks={tasks ?? []} />
        </>
      )}
    </div>
  );
}
