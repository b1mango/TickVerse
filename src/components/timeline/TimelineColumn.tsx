import dayjs from 'dayjs';
import type { ZoomColumn, ZoomLevel } from '@/services/timelineService';
import { isOverdue } from '@/services/timelineService';
import type { Task } from '@/types/task';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

interface TimelineColumnProps {
  column: ZoomColumn;
  level: ZoomLevel;
  now: number;
}

/**
 * 时间轴列（档位 = 渲染模板，清单 M3-3）：
 * 日/周档 = 完整日卡；月档 = 紧凑日卡；季档 = 周聚合；年档 = 月聚合；年视图档 = 年聚合。
 * 卡内：未完成投影在上，淡分割线，已完成在下（朱砂墨笔划线，2026-08-28 用户钦定）；
 * 卡片定高、内容超长卡内隐形纵滚（data-card-scroll 滚轮放行），不溢出卡外（2026-10-06 用户钦定）。
 */
export function TimelineColumn({ column, level, now }: TimelineColumnProps) {
  if (level === 'day' || level === 'week' || level === 'month')
    return <DayTemplate column={column} level={level} now={now} />;
  return <AggregateTemplate column={column} level={level} />;
}

/** 日/周档 = 完整日卡；月档 = 紧凑日卡（小一号字距） */
function DayTemplate({
  column,
  level,
  now,
}: {
  column: ZoomColumn;
  level: ZoomLevel;
  now: number;
}) {
  const d = dayjs(column.start);
  const compact = level === 'month';

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-card border bg-surface [box-shadow:var(--shadow-float)] transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5 ${
        compact ? 'p-2' : 'p-2.5'
      } ${column.isToday ? 'border-accent' : 'border-line'} ${column.isFuture ? 'opacity-80' : ''}`}
    >
      <header
        className={`shrink-0 whitespace-nowrap font-mono text-sub ${compact ? 'text-[10px] leading-4' : 'text-caption'}`}
      >
        {d.format('MM/DD')}
        {level === 'day' && ` · ${WEEKDAYS[d.day()]}`}
      </header>

      {/* 定高卡内隐形滚动（与四象限列卡同语言），内容再多也不溢出 */}
      <div
        data-card-scroll
        className={`no-scrollbar mt-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto ${compact ? 'gap-1' : 'gap-1.5'}`}
      >
        {/* 未完成投影在上（虚线态）；两行折行，窄卡也尽量读全 */}
        {column.projected.map((t) => (
          <div
            key={t.id}
            className={`flex shrink-0 items-start gap-1 rounded-ctl border border-dashed border-sub opacity-50 ${
              compact ? 'px-1 py-0.5' : 'px-1.5 py-1'
            }`}
            title={t.title}
          >
            {isOverdue(t, now) && (
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            )}
            <p
              className={`line-clamp-2 ${compact ? 'text-[10px] leading-[14px]' : 'text-caption leading-4'}`}
            >
              {t.title}
            </p>
          </div>
        ))}

        {/* 淡分割线 */}
        {column.projected.length > 0 && column.completed.length > 0 && (
          <div className="my-0.5 h-px shrink-0 bg-line/70" />
        )}

        {/* 已完成：朱砂墨笔划线（line-through 随折行逐行划过） */}
        {column.completed.map((t) => (
          <div
            key={t.id}
            className={`shrink-0 ${compact ? 'px-1 py-0' : 'px-1.5 py-0.5'}`}
            title={t.title}
          >
            <p
              className={`line-clamp-2 text-sub line-through decoration-accent/85 decoration-[1.5px] ${
                compact ? 'text-[10px] leading-[14px]' : 'text-caption leading-4'
              }`}
            >
              {t.title}
            </p>
            {level === 'day' && (
              <p className="font-mono text-[10px] leading-4 text-sub/70">
                {dayjs(t.completedAt).format('HH:mm')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 季档（周聚合）/ 年档（月聚合）/ 年视图档（年聚合）：大数字 + 代表条目 */
function AggregateTemplate({ column, level }: { column: ZoomColumn; level: ZoomLevel }) {
  const d = dayjs(column.start);
  const label =
    level === 'years'
      ? d.format('YYYY年')
      : level === 'year'
        ? d.format('MM月')
        : `${d.format('MM/DD')} 周`;
  const shown = column.completed.slice(0, 3);
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-card border bg-surface p-2.5 [box-shadow:var(--shadow-float)] transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5 ${
        column.isToday ? 'border-accent' : 'border-line'
      } ${column.isFuture ? 'opacity-80' : ''}`}
    >
      <header className="whitespace-nowrap font-mono text-caption text-sub">{label}</header>
      <p className="mt-1 font-mono text-title">{column.completed.length}</p>
      <div className="mt-1 flex flex-col gap-1">
        {shown.map((t: Task) => (
          <p key={t.id} className="line-clamp-2 text-caption leading-4 text-sub" title={t.title}>
            {t.title}
          </p>
        ))}
        {column.completed.length > shown.length && (
          <p className="font-mono text-[10px] leading-4 text-sub">
            +{column.completed.length - shown.length}
          </p>
        )}
        {column.projected.length > 0 && (
          <p className="font-mono text-[10px] leading-4 text-accent">
            进行中 {column.projected.length}
          </p>
        )}
      </div>
    </div>
  );
}
