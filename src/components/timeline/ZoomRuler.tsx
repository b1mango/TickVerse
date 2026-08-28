import dayjs from 'dayjs';
import type { ZoomColumn, ZoomLevel } from '@/services/timelineService';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

interface ZoomRulerProps {
  columns: ZoomColumn[];
  level: ZoomLevel;
  pxPerDay: number;
  gap: number;
}

/**
 * 卷尺刻度带（方向稿 §8，M3 连续形变版）：随缩放档位连续伸缩；
 * 今日刻度为朱砂竖线；由页面包装为浮动悬浮条（sticky + 毛玻璃 + 投影）。
 */
export function ZoomRuler({ columns, level, pxPerDay, gap }: ZoomRulerProps) {
  // 列宽（含间距）与标签抽稀：保证相邻标签间距 ≥ 56px
  const colWidth = (col: ZoomColumn) => col.days * pxPerDay + gap;
  const step = Math.max(1, Math.ceil(56 / ((columns[0]?.days ?? 1) * pxPerDay + gap)));

  const label = (col: ZoomColumn): string => {
    const d = dayjs(col.start);
    if (level === 'years') return d.format('YYYY年');
    if (level === 'year') return d.format('MM月');
    if (level === 'quarter') return `${d.format('MM/DD')} 周`;
    if (level === 'month') return d.format('MM/DD'); // 72px 窄列只放日期，避免标签互叠
    return `${d.format('MM/DD')} ${WEEKDAYS[d.day()]}`;
  };

  return (
    <div className="flex">
      {columns.map((col, i) => (
        <div key={col.start} className="shrink-0" style={{ width: colWidth(col) }}>
          <div className="flex items-end">
            <div className={`w-px ${col.isToday ? 'h-3.5 bg-accent' : 'h-3 bg-sub/60'}`} />
            {(level === 'day' || level === 'week') &&
              Array.from({ length: 3 }, (_, j) => (
                <div
                  key={j}
                  className="h-1.5 w-px bg-line"
                  style={{ marginLeft: pxPerDay / 4 - 1 }}
                />
              ))}
          </div>
          {i % step === 0 && (
            <p
              className={`mt-1.5 whitespace-nowrap font-mono text-caption ${
                col.isToday ? 'text-accent' : 'text-sub'
              }`}
            >
              {label(col)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
