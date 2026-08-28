import dayjs from 'dayjs';
import { heatLevel, type HeatCell } from '@/services/statsService';

interface HeatmapProps {
  cells: HeatCell[];
  year: number;
}

/** ink 透明度 5 档（方向稿 §9：不用彩色） */
const LEVEL_STYLE = [
  'bg-ink/[0.06]',
  'bg-ink/25',
  'bg-ink/45',
  'bg-ink/70',
  'bg-ink',
] as const;

/** 左侧星期标签：GitHub 同款只标 一/三/五 三行 */
const WEEKDAY_LABELS: Array<{ row: number; text: string }> = [
  { row: 1, text: '一' },
  { row: 3, text: '三' },
  { row: 5, text: '五' },
];

/**
 * GitHub 风年度热力日历：周为列、日为行，方格圆角 2px，hover 出 mono 提示；
 * 顶部月份标签落在每月首日所在周列（2026-08-28 用户钦定补月份，对标 GitHub）。
 */
export function Heatmap({ cells, year }: HeatmapProps) {
  // 以周为列重排：首列从 1 月 1 日所在周的周一开始
  const firstDate = cells[0]?.date ?? Date.now();
  const gridStart = dayjs(firstDate).subtract((dayjs(firstDate).day() + 6) % 7, 'day');
  const weeks: HeatCell[][] = [];
  let cursor = gridStart.valueOf();
  const cellByDate = new Map(cells.map((c) => [c.date, c]));
  while (cursor <= cells[cells.length - 1].date) {
    const week: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = dayjs(cursor).add(i, 'day').valueOf();
      week.push(cellByDate.get(d) ?? { date: d, count: -1 }); // -1 = 年外占位
    }
    weeks.push(week);
    cursor = dayjs(cursor).add(7, 'day').valueOf();
  }

  // 月份标签：本周内有任意一天属于新月（与上一列不同月）→ 标在该列
  const monthLabels = weeks.map((week, wi) => {
    const month = dayjs(week[0].date).month();
    if (wi === 0) return null; // 首列不标，避免与左缘重叠
    const prevMonth = dayjs(weeks[wi - 1][0].date).month();
    return month !== prevMonth ? `${month + 1}月` : null;
  });

  return (
    <div>
      <div className="flex gap-[3px]">
        {/* 星期标签列 */}
        <div className="flex flex-col gap-[3px] pr-1">
          {Array.from({ length: 7 }, (_, row) => (
            <span
              key={row}
              className="flex h-[11px] items-center font-mono text-[9px] leading-none text-sub/70"
            >
              {WEEKDAY_LABELS.find((w) => w.row === row)?.text ?? ''}
            </span>
          ))}
        </div>
        <div>
          {/* 月份标签行（与方格列同宽对齐） */}
          <div className="mb-1 flex gap-[3px]">
            {weeks.map((_, wi) => (
              <span
                key={wi}
                className="w-[11px] shrink-0 whitespace-nowrap font-mono text-[9px] leading-none text-sub"
              >
                {monthLabels[wi] ?? ''}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell) =>
                  cell.count < 0 ? (
                    <div key={cell.date} className="h-[11px] w-[11px]" />
                  ) : (
                    <div
                      key={cell.date}
                      title={`${dayjs(cell.date).format('YYYY-MM-DD')} · 完成 ${cell.count}`}
                      className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLE[heatLevel(cell.count)]} font-mono`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-caption text-sub">
        <span>{year} 热力</span>
        {/* GitHub 同款图例：少 → 方格渐变 → 多 */}
        <span className="flex items-center gap-1">
          少
          {LEVEL_STYLE.map((s) => (
            <span key={s} className={`h-[11px] w-[11px] rounded-[2px] ${s}`} />
          ))}
          多
        </span>
      </div>
    </div>
  );
}
