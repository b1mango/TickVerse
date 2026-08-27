import dayjs from 'dayjs';

/** 当天 00:00 的时间戳 */
export function startOfDay(ts: number): number {
  return dayjs(ts).startOf('day').valueOf();
}

/** 两个时间戳是否同一自然日 */
export function isSameDay(a: number, b: number): boolean {
  return dayjs(a).isSame(dayjs(b), 'day');
}
