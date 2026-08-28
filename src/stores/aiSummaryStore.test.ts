import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmError } from '@/adapters/llm';
import type { PeriodRange } from '@/services/aiService';
import type { LlmConfig } from '@/types/settings';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

// 模拟 aiService：store 单测不发真实网络请求、不碰 Dexie
vi.mock('@/services/aiService', () => ({
  generateSummary: vi.fn(),
  getCachedSummary: vi.fn(),
}));

import { generateSummary, getCachedSummary } from '@/services/aiService';
import { useAiSummaryStore } from '@/stores/aiSummaryStore';

const mockGenerate = vi.mocked(generateSummary);
const mockCached = vi.mocked(getCachedSummary);

const CFG: LlmConfig = {
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test',
  models: [],
  selectedModels: ['deepseek-chat'],
  activeModel: 'deepseek-chat',
};

const RANGE: PeriodRange = { id: '2026-W35', period: 'week', start: 0, end: 1, label: '08/24 — 08/28' };

const SUMMARY: Summary = {
  id: RANGE.id,
  period: 'week',
  rangeStart: 0,
  rangeEnd: 1,
  content: '你这周挺扎实。',
  model: 'deepseek-chat',
  createdAt: 123,
};

const state = () => useAiSummaryStore.getState().byRange[RANGE.id];

beforeEach(() => {
  useAiSummaryStore.setState({ byRange: {} });
  vi.clearAllMocks();
});

describe('aiSummaryStore.startGenerate', () => {
  it('流式逐块累积 streamed，完成后置 done 并写入 summary', async () => {
    mockGenerate.mockImplementation(
      (_cfg: LlmConfig, _tasks: Task[], _range: PeriodRange, onDelta?: (text: string) => void) => {
        onDelta?.('你这');
        expect(state().streamed).toBe('你这');
        expect(state().status).toBe('streaming');
        onDelta?.('周挺扎实。');
        return Promise.resolve(SUMMARY);
      },
    );
    await useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    expect(state()).toMatchObject({ status: 'done', summary: SUMMARY, streamed: '', interrupted: null });
  });

  it('streaming 中重复触发被忽略', async () => {
    let resolve: ((s: Summary) => void) | undefined;
    mockGenerate.mockImplementation(() => new Promise<Summary>((r) => (resolve = r)));
    void useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    await useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    resolve?.(SUMMARY);
  });

  it('流中途断（LlmError 带 partial）→ error 状态并保留 interrupted', async () => {
    mockGenerate.mockRejectedValue(new LlmError('生成中断：socket hang up', undefined, '已出一半'));
    await useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    expect(state()).toMatchObject({ status: 'error', interrupted: '已出一半', summary: null });
  });

  it('普通失败 → error 状态带错误信息', async () => {
    mockGenerate.mockRejectedValue(new Error('HTTP 401'));
    await useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    expect(state()?.status).toBe('error');
    expect(state()?.error).toContain('HTTP 401');
    expect(state()?.interrupted).toBeNull();
  });

  it('不同 range.id 状态互相独立', async () => {
    const month: PeriodRange = { ...RANGE, id: '2026-08', period: 'month' };
    mockGenerate.mockResolvedValue(SUMMARY);
    await useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    expect(useAiSummaryStore.getState().byRange[RANGE.id]?.status).toBe('done');
    expect(useAiSummaryStore.getState().byRange[month.id]).toBeUndefined();
  });
});

describe('aiSummaryStore.loadCached / applyEdit', () => {
  it('有缓存 → done；无缓存 → idle', async () => {
    mockCached.mockResolvedValue(SUMMARY);
    await useAiSummaryStore.getState().loadCached(RANGE.id);
    expect(state()).toMatchObject({ status: 'done', summary: SUMMARY });

    useAiSummaryStore.setState({ byRange: {} });
    mockCached.mockResolvedValue(undefined);
    await useAiSummaryStore.getState().loadCached(RANGE.id);
    expect(state()).toMatchObject({ status: 'idle', summary: null });
  });

  it('streaming 中的区间不被缓存查询覆盖', async () => {
    let resolve: ((s: Summary) => void) | undefined;
    mockGenerate.mockImplementation(() => new Promise<Summary>((r) => (resolve = r)));
    void useAiSummaryStore.getState().startGenerate(CFG, [], RANGE);
    await useAiSummaryStore.getState().loadCached(RANGE.id);
    expect(mockCached).not.toHaveBeenCalled();
    expect(state().status).toBe('streaming');
    resolve?.(SUMMARY);
  });

  it('applyEdit 同步手改后的 summary', () => {
    useAiSummaryStore.setState({ byRange: { [RANGE.id]: { status: 'done', streamed: '', summary: SUMMARY, interrupted: null, error: null } } });
    const edited = { ...SUMMARY, content: '手改后的文字' };
    useAiSummaryStore.getState().applyEdit(RANGE.id, edited);
    expect(state().summary?.content).toBe('手改后的文字');
  });
});
