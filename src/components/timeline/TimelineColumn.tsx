import { useLayoutEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
 * 日/周档 = 完整日卡；月档 = 紧凑日卡（72px 可读宽）；季档 = 周聚合；年档 = 月聚合；年视图档 = 年聚合。
 * （2026-08-28 用户钦定：月档不删，加宽配紧凑模板；日卡条目改两行折行，不再一截就丢内容）
 * 卡内：未完成投影在上，淡分割线，已完成在下（朱砂墨笔划线，2026-08-28 用户钦定）；
 * 超出卡片长度时底部"展开更多"，点击展开看全部。
 */
export function TimelineColumn({ column, level, now }: TimelineColumnProps) {
  if (level === 'day' || level === 'week' || level === 'month')
    return <DayTemplate column={column} level={level} now={now} />;
  return <AggregateTemplate column={column} level={level} />;
}

/** 日/周档 = 完整日卡；月档 = 紧凑日卡（小一号字距，72px 列宽下约 10 字可读） */
function DayTemplate({ column, level, now }: { column: ZoomColumn; level: ZoomLevel; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const d = dayjs(column.start);
  const compact = level === 'month';

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 4);
  }, [column, level]);

  return (
    <div
      className={`flex flex-col rounded-card border bg-surface shadow-[var(--shadow-float)] transition-transform duration-[var(--dur-fast)] ${
        compact ? 'p-2' : 'p-2.5'
      } ${column.isToday ? 'border-accent' : 'border-line'} ${column.isFuture ? 'opacity-80' : ''} ${
        expanded
          ? 'absolute inset-x-0 top-0 z-20 max-h-[480px] hover:-translate-y-0'
          : 'h-full hover:-translate-y-0.5'
      }`}
    >
      <header
        className={`shrink-0 whitespace-nowrap font-mono text-sub ${compact ? 'text-[10px] leading-4' : 'text-caption'}`}
      >
        {d.format('MM/DD')}
        {level === 'day' && ` · ${WEEKDAYS[d.day()]}`}
      </header>

      <div
        ref={contentRef}
        {...(expanded ? { 'data-card-scroll': '' } : {})}
        className={`mt-1.5 flex min-h-0 flex-1 flex-col ${compact ? 'gap-1' : 'gap-1.5'} ${
          expanded ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
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
            {isOverdue(t, now) && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            <p className={`line-clamp-2 ${compact ? 'text-[10px] leading-[14px]' : 'text-caption leading-4'}`}>
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
          <div key={t.id} className={`shrink-0 ${compact ? 'px-1 py-0' : 'px-1.5 py-0.5'}`} title={t.title}>
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

      {(overflowing || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex shrink-0 items-center justify-center gap-1 border-t border-line/70 pt-1 font-mono text-[10px] leading-4 text-sub transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? '收起' : `展开更多 ${column.completed.length + column.projected.length} 项`}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
}

/** 季档（周聚合）/ 年档（月聚合）/ 年视图档（年聚合）：大数字 + 代表条目 */
function AggregateTemplate({ column, level }: { column: ZoomColumn; level: ZoomLevel }) {
  const d = dayjs(column.start);
  const label =
    level === 'years' ? d.format('YYYY年') : level === 'year' ? d.format('MM月') : `${d.format('MM/DD')} 周`;
  const shown = column.completed.slice(0, 3);
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-card border bg-surface p-2.5 shadow-[var(--shadow-float)] transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5 ${
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
          <p className="font-mono text-[10px] leading-4 text-sub">+{column.completed.length - shown.length}</p>
        )}
        {column.projected.length > 0 && (
          <p className="font-mono text-[10px] leading-4 text-accent">进行中 {column.projected.length}</p>
        )}
      </div>
    </div>
  );
}
