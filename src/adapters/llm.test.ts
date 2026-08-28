import { describe, expect, it, vi } from 'vitest';
import type { LlmConfig } from '@/types/settings';

// 模拟 appFetch：chatStream 的单测不发真实网络请求
vi.mock('@/adapters/http', () => ({ appFetch: vi.fn() }));

import { appFetch } from '@/adapters/http';
import { chatStream, LlmError, parseSseChunk, splitSseBuffer } from '@/adapters/llm';

const mockFetch = vi.mocked(appFetch);

const CFG: LlmConfig = {
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test',
  models: [],
  selectedModels: ['deepseek-chat'],
  activeModel: 'deepseek-chat',
};

/** 用真实 DeepSeek SSE 形态的分片构造流式 Response */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const delta = (content: string) =>
  `data: ${JSON.stringify({
    choices: [{ index: 0, delta: { content, role: 'assistant' } }],
  })}\n\n`;

describe('parseSseChunk', () => {
  it('取 choices[0].delta.content', () => {
    const r = parseSseChunk('{"choices":[{"delta":{"content":"你"}}]}');
    expect(r).toEqual({ done: false, text: '你' });
  });
  it('[DONE] → 结束标记', () => {
    expect(parseSseChunk('[DONE]')).toEqual({ done: true, text: '' });
  });
  it('delta 无 content（首帧只有 role）→ 空增量', () => {
    expect(parseSseChunk('{"choices":[{"delta":{"role":"assistant","content":null}}]}')).toEqual({
      done: false,
      text: '',
    });
  });
  it('无法解析的负载 → 空增量不抛错', () => {
    expect(parseSseChunk('not json')).toEqual({ done: false, text: '' });
  });
});

describe('splitSseBuffer', () => {
  it('按行切出 data 负载，剩余半截行留在 rest', () => {
    const { payloads, rest } = splitSseBuffer('data: a\n\ndata: b\ndata: 半');
    expect(payloads).toEqual(['a', 'b']);
    expect(rest).toBe('data: 半');
  });
  it('跳过空行与非 data 行，兼容 \\r\\n', () => {
    const { payloads } = splitSseBuffer('event: message\r\ndata: x\r\n: comment\n');
    expect(payloads).toEqual(['x']);
  });
});

describe('chatStream', () => {
  it('逐块回调增量并拼全文返回，[DONE] 结束', async () => {
    mockFetch.mockResolvedValue(sseResponse([delta('你这'), delta('周挺'), 'data: [DONE]\n\n', delta('不应出现')]));
    const deltas: string[] = [];
    const full = await chatStream(CFG, [{ role: 'user', content: 'hi' }], (t) => deltas.push(t));
    expect(full).toBe('你这周挺');
    expect(deltas).toEqual(['你这', '周挺']);
    // stream: true 与鉴权头
    const init = mockFetch.mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toMatchObject({ stream: true, model: 'deepseek-chat' });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('一个网络分片含多条 SSE / 一条 SSE 跨分片都能正确解析', async () => {
    const payload = delta('拼') + delta('接');
    const half = Math.floor(payload.length / 2);
    mockFetch.mockResolvedValue(sseResponse([payload.slice(0, half), payload.slice(half)]));
    const full = await chatStream(CFG, [], () => {});
    expect(full).toBe('拼接');
  });

  it('多字节汉字被网络分片从 UTF-8 序列中间切开也能正确解码', async () => {
    // DeepSeek 常见情形：一个中文 token 的字节被拆进两个 chunk
    const bytes = new TextEncoder().encode(delta('旧友'));
    const cut = bytes.indexOf(0xe6); // 第一个汉字的首字节
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut + 1));
        controller.enqueue(bytes.slice(cut + 1));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));
    const full = await chatStream(CFG, [], () => {});
    expect(full).toBe('旧友');
  });

  it('流中途断 → 抛带 partial 的 LlmError', async () => {
    const encoder = new TextEncoder();
    let sent = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // 第一块正常送达，第二次读取时断流（error 会清空队列，不能同拍 enqueue+error）
        if (!sent) {
          sent = true;
          controller.enqueue(encoder.encode(delta('已出一半')));
        } else {
          controller.error(new Error('socket hang up'));
        }
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));
    const err = await chatStream(CFG, [], () => {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).partial).toBe('已出一半');
  });

  it('HTTP 非 200 → LlmError 带状态码', async () => {
    mockFetch.mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 }));
    const err = await chatStream(CFG, [], () => {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).status).toBe(401);
  });

  it('body 为 null 时降级为非流式一次解析', async () => {
    const res = new Response(null, { status: 200 });
    vi.spyOn(res, 'json').mockResolvedValue({ choices: [{ message: { content: '整段' } }] });
    Object.defineProperty(res, 'body', { value: null });
    mockFetch.mockResolvedValue(res);
    const deltas: string[] = [];
    const full = await chatStream(CFG, [], (t) => deltas.push(t));
    expect(full).toBe('整段');
    expect(deltas).toEqual(['整段']);
  });
});
