import { appFetch } from '@/adapters/http';
import type { LlmConfig } from '@/types/settings';

/**
 * LLM 适配器（§10.3）：OpenAI 兼容 POST {baseUrl}/chat/completions。
 * 网络副作用集中在 adapters（§5.1）；Key 由调用方从本地配置传入，适配器不做持久化。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** 流式中途断线时已生成的部分文本（调用方可选择保留展示） */
    readonly partial?: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** 发起一次 chat/completions 请求，返回助手文本 */
export async function chatCompletion(cfg: LlmConfig, messages: ChatMessage[]): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let res: Response;
  try {
    res = await appFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.activeModel, messages, temperature: 0.7 }),
    });
  } catch (e) {
    throw new LlmError(`网络请求失败：${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`HTTP ${res.status}：${body.slice(0, 200) || res.statusText}`, res.status);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError('响应中没有 choices[0].message.content');
  return content;
}

/**
 * 解析单条 SSE data 负载（纯函数，可单测）。
 * 返回增量文本；[DONE] 为结束标记；无法解析或无增量时 text 为空串。
 */
export function parseSseChunk(payload: string): { done: boolean; text: string } {
  if (payload === '[DONE]') return { done: true, text: '' };
  try {
    const data = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
    };
    return { done: false, text: data.choices?.[0]?.delta?.content ?? '' };
  } catch {
    return { done: false, text: '' };
  }
}

/** 从 SSE 文本缓冲里切出完整行，返回各行的 data 负载与剩余半截行（纯函数，可单测） */
export function splitSseBuffer(buf: string): { payloads: string[]; rest: string } {
  const lines = buf.split('\n');
  const rest = lines.pop() ?? '';
  const payloads: string[] = [];
  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line.startsWith('data:')) continue; // 跳过空行 / event: / 注释行
    const payload = line.slice(5).trim();
    if (payload) payloads.push(payload);
  }
  return { payloads, rest };
}

/**
 * 流式 chat/completions（stream: true，SSE）。
 * onDelta 逐块回调增量文本，返回拼接全文。
 * 流式能力：tauri-plugin-http 2.x 的 fetch 响应体就是 ReadableStream
 * （pull 逐块读 Rust 侧 reqwest 流，见 plugin-http dist-js fetch_read_body），
 * 与浏览器 window.fetch 行为一致，故两端同走流式，无需降级；
 * 仅在 body 为 null 的极端情况下回退为非流式一次性读取。
 * 中途断流：抛出带 partial 的 LlmError，调用方可保留已出文本。
 */
export async function chatStream(
  cfg: LlmConfig,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let res: Response;
  try {
    res = await appFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.activeModel, messages, temperature: 0.7, stream: true }),
    });
  } catch (e) {
    throw new LlmError(`网络请求失败：${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`HTTP ${res.status}：${body.slice(0, 200) || res.statusText}`, res.status);
  }

  // 降级兜底：响应体不可流式读取时按非流式 JSON 一次解析（正常不会走到）
  if (!res.body) {
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new LlmError('响应中没有可解析的内容');
    onDelta(content);
    return content;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  const consume = (): boolean => {
    const { payloads, rest } = splitSseBuffer(buf);
    buf = rest;
    for (const p of payloads) {
      const { done, text } = parseSseChunk(p);
      if (done) return true;
      if (text) {
        full += text;
        onDelta(text);
      }
    }
    return false;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if (consume()) return full;
    }
    buf += decoder.decode();
    buf += '\n'; // 收尾补换行：最后一行若无结尾 \n 也要被解析
    consume();
  } catch (e) {
    throw new LlmError(`生成中断：${e instanceof Error ? e.message : String(e)}`, undefined, full);
  }
  return full;
}

/** "获取模型"：OpenAI 兼容 GET {baseUrl}/models，返回模型 id 列表 */
export async function listModels(cfg: LlmConfig): Promise<string[]> {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/models`;
  let res: Response;
  try {
    res = await appFetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  } catch (e) {
    throw new LlmError(`网络请求失败：${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LlmError(`HTTP ${res.status}：${body.slice(0, 200) || res.statusText}`, res.status);
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? []).map((m) => m.id).filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (ids.length === 0) throw new LlmError('响应中没有模型列表');
  return ids;
}

/** 设置页"测试连接"：最小开销探活 */
export async function testConnection(cfg: LlmConfig): Promise<void> {
  await chatCompletion(cfg, [
    { role: 'system', content: '回复"ok"即可。' },
    { role: 'user', content: 'ping' },
  ]);
}
