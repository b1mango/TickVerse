import { appFetch, isTauri } from '@/adapters/http';
import type { WebdavConfig } from '@/types/settings';

/**
 * WebDAV 适配器（清单 M5-4）：最小实现，仅覆盖同步所需四个动作。
 * 单 JSON 快照方案只需要 GET / PUT / MKCOL / 探活，不做 PROPFIND 列表。
 */

export class WebdavError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WebdavError';
  }
}

function joinUrl(endpoint: string, path: string): string {
  return `${endpoint.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function authHeader(cfg: WebdavConfig): string {
  return `Basic ${btoa(`${cfg.username}:${cfg.password}`)}`;
}

async function request(cfg: WebdavConfig, method: string, path: string, body?: string): Promise<Response> {
  let res: Response;
  try {
    res = await appFetch(joinUrl(cfg.endpoint, path), {
      method,
      headers: { Authorization: authHeader(cfg) },
      body,
      signal: AbortSignal.timeout(10_000), // 10s 超时：NAS 掉线时快速失败，不转圈
    });
  } catch (e) {
    // "Failed to fetch" 这类底层错误对用户无意义，翻译成可行动的排查提示
    const hint = isTauri()
      ? '无法连接到服务器：请确认 NAS 已开机、地址与端口正确（可在浏览器直接打开该地址验证）'
      : '无法连接：浏览器直连 WebDAV 会被 CORS 拦截，请用桌面应用连接；或先确认 NAS 在线';
    throw new WebdavError(`${hint}（${e instanceof Error ? e.message : String(e)}）`);
  }
  return res;
}

/** 探活：对 endpoint 根发一次 GET，200/404 都算通（401/403 即凭据错误） */
export async function testWebdav(cfg: WebdavConfig): Promise<void> {
  const res = await request(cfg, 'GET', cfg.remotePath);
  if (res.status === 401 || res.status === 403) {
    throw new WebdavError('认证失败，请检查账号密码', res.status);
  }
  // 404 = 凭据正确但远端还没有快照，属正常（首次同步会上传）
  await res.body?.cancel().catch(() => {});
}

/** 读取远端快照文本；不存在返回 null */
export async function getSnapshot(cfg: WebdavConfig): Promise<string | null> {
  const res = await request(cfg, 'GET', cfg.remotePath);
  if (res.status === 404) return null;
  if (!res.ok) throw new WebdavError(`GET 失败：HTTP ${res.status}`, res.status);
  return res.text();
}

/** 上传快照文本（先确保目录存在，405/409 = 已存在，忽略） */
export async function putSnapshot(cfg: WebdavConfig, text: string): Promise<void> {
  const dir = cfg.remotePath.split('/').slice(0, -1).join('/');
  if (dir) {
    const mk = await request(cfg, 'MKCOL', dir);
    if (!mk.ok && mk.status !== 405 && mk.status !== 409) {
      throw new WebdavError(`MKCOL 失败：HTTP ${mk.status}`, mk.status);
    }
    await mk.body?.cancel().catch(() => {});
  }
  const res = await request(cfg, 'PUT', cfg.remotePath, text);
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new WebdavError(`PUT 失败：HTTP ${res.status}`, res.status);
  }
  await res.body?.cancel().catch(() => {});
}
