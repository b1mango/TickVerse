/**
 * 统一 fetch 出口（§5.1 网络副作用集中在 adapters）。
 * Tauri 桌面端走 plugin-http 原生请求（绕过 webview CORS，用于 LLM / WebDAV）；
 * 浏览器端用 window.fetch（是否被目标服务 CORS 拦截取决于对方服务）。
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let cached: FetchLike | null = null;

/** 是否运行在 Tauri webview 内 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function loadFetch(): Promise<FetchLike> {
  if (cached) return cached;
  if (isTauri()) {
    const mod = await import('@tauri-apps/plugin-http');
    cached = mod.fetch as unknown as FetchLike;
  } else {
    cached = (input, init) => window.fetch(input, init);
  }
  return cached;
}

/** 与 fetch 同签名；仅接受 string URL（adapters 内部统一传字符串） */
export async function appFetch(url: string, init?: RequestInit): Promise<Response> {
  const f = await loadFetch();
  return f(url, init);
}
