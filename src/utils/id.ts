/** 生成 uuid（用平台内置 crypto，不为此引入依赖包） */
export function uuid(): string {
  return crypto.randomUUID();
}
