/** 读取动效时长 token（如 --dur-fast），供 JS 动效序列对齐主题档位（含 mono 降档） */
export function tokenDuration(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}
