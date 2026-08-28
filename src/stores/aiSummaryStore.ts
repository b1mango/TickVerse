import { create } from 'zustand';
import { LlmError } from '@/adapters/llm';
import { generateSummary, getCachedSummary, type PeriodRange } from '@/services/aiService';
import { useUiStore } from '@/stores/uiStore';
import type { LlmConfig } from '@/types/settings';
import type { Summary } from '@/types/summary';
import type { Task } from '@/types/task';

/**
 * aiSummaryStore：AI 总结的生成状态，按 range.id（周/月/年各自独立）管理。
 * 生成动作放 store 里执行：路由切换组件卸载后生成继续跑、流式文本继续累积，
 * 回到统计页直接从 store 读到实时进度（修复"切页即中断/看不到流式"的问题）。
 */

export type AiSummaryStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface AiSummaryRangeState {
  status: AiSummaryStatus;
  /** 流式累积文本（streaming 中逐块追加；流结束后清空，全文见 summary） */
  streamed: string;
  /** 生成完成/缓存命中的结果（generateSummary 落 summaries 表后同步到此） */
  summary: Summary | null;
  /** 流中途断时已生成的部分（保留展示、不落缓存，可重试） */
  interrupted: string | null;
  /** 非断流类错误信息 */
  error: string | null;
}

const EMPTY_RANGE: AiSummaryRangeState = {
  status: 'idle',
  streamed: '',
  summary: null,
  interrupted: null,
  error: null,
};

interface AiSummaryState {
  byRange: Record<string, AiSummaryRangeState>;
  /** 挂载时查缓存（summaries 表）；该区间已有进行中的任务时跳过，不覆盖实时状态 */
  loadCached: (rangeId: string) => Promise<void>;
  /** 流式生成：状态推进与落库都在 store 内完成，与组件生命周期解耦 */
  startGenerate: (cfg: LlmConfig, tasks: Task[], range: PeriodRange) => Promise<void>;
  /** 手改保存后同步 store 里的 summary */
  applyEdit: (rangeId: string, summary: Summary) => void;
}

export const useAiSummaryStore = create<AiSummaryState>((set, get) => {
  const patch = (rangeId: string, partial: Partial<AiSummaryRangeState>) =>
    set((s) => ({
      byRange: { ...s.byRange, [rangeId]: { ...(s.byRange[rangeId] ?? EMPTY_RANGE), ...partial } },
    }));

  return {
    byRange: {},

    loadCached: async (rangeId) => {
      if (get().byRange[rangeId]?.status === 'streaming') return;
      const cached = await getCachedSummary(rangeId);
      // 等待缓存期间可能已开始生成，二次确认不覆盖
      if (get().byRange[rangeId]?.status === 'streaming') return;
      patch(rangeId, {
        status: cached ? 'done' : 'idle',
        summary: cached ?? null,
        streamed: '',
        interrupted: null,
        error: null,
      });
    },

    startGenerate: async (cfg, tasks, range) => {
      const id = range.id;
      if (get().byRange[id]?.status === 'streaming') return; // 防止重复触发
      patch(id, { status: 'streaming', streamed: '', summary: null, interrupted: null, error: null });
      try {
        const summary = await generateSummary(cfg, tasks, range, (text) =>
          set((s) => {
            const cur = s.byRange[id];
            if (!cur || cur.status !== 'streaming') return s;
            return { byRange: { ...s.byRange, [id]: { ...cur, streamed: cur.streamed + text } } };
          }),
        );
        patch(id, { status: 'done', summary, streamed: '' });
      } catch (e) {
        const { showToast } = useUiStore.getState();
        // 流中途断：保留已出文本，提示重试（已出文本不落缓存）
        if (e instanceof LlmError && e.partial) {
          patch(id, { status: 'error', interrupted: e.partial });
          showToast({ message: '生成中断，已保留已生成的部分，可重试' });
        } else {
          const message = `生成失败：${e instanceof Error ? e.message : String(e)}`;
          patch(id, { status: 'error', error: message });
          showToast({ message });
        }
      }
    },

    applyEdit: (rangeId, summary) => patch(rangeId, { summary }),
  };
});
