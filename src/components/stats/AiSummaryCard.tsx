import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { saveSummaryEdit, type PeriodRange } from '@/services/aiService';
import { useAiSummaryStore } from '@/stores/aiSummaryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import { LLM_PRIVACY_ACK_KEY } from '@/types/settings';
import type { Task } from '@/types/task';

interface AiSummaryCardProps {
  range: PeriodRange;
  tasks: Task[];
}

/** 纯文本渲染：按行分段（总结输出契约为纯散文，无列表/标题/加粗） */
function SummaryContent({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2">
      {content
        .split('\n')
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} className="text-body leading-7">
            {line}
          </p>
        ))}
    </div>
  );
}

/**
 * AI 总结卡（方向稿 §9：衬线引言式排版 + 左侧 2px accent 竖线 + accent 描边胶囊按钮）。
 * 生成状态在 aiSummaryStore（按 range.id 独立）：组件卸载后生成继续跑，
 * 回到页面直接订阅 store 看到实时流式进度；流式文本逐块出现，末尾跟呼吸光标。
 * 中途断流保留已出文本并提示重试；流结束后才写缓存（summaries 表）。
 * 支持重新生成与手动编辑；首次生成前弹一次隐私说明（§15-10）。
 */
export function AiSummaryCard({ range, tasks }: AiSummaryCardProps) {
  const llm = useSettingsStore((s) => s.llm);
  const setLlm = useSettingsStore((s) => s.setLlm);
  const showToast = useUiStore((s) => s.showToast);
  const rangeState = useAiSummaryStore((s) => s.byRange[range.id]);
  const loadCached = useAiSummaryStore((s) => s.loadCached);
  const startGenerate = useAiSummaryStore((s) => s.startGenerate);
  const applyEdit = useAiSummaryStore((s) => s.applyEdit);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const streaming = rangeState?.status === 'streaming';
  const streamed = rangeState?.streamed ?? '';
  const summary = rangeState?.summary ?? null;
  const interrupted = rangeState?.interrupted ?? null;

  useEffect(() => {
    setEditing(false);
    // 该区间还没有任何状态（未生成过、未读过缓存）时才查缓存；
    // 进行中/已完成/中断的区间保持 store 现状，不被缓存查询覆盖
    if (!useAiSummaryStore.getState().byRange[range.id]) {
      void loadCached(range.id);
    }
  }, [range.id, loadCached]);

  const doGenerate = () => void startGenerate(llm, tasks, range);

  const handleGenerate = () => {
    if (!llm.apiKey) {
      showToast({ message: '请先在设置页填写 API Key' });
      return;
    }
    if (localStorage.getItem(LLM_PRIVACY_ACK_KEY)) {
      doGenerate();
    } else {
      setShowPrivacy(true);
    }
  };

  const handlePrivacyAck = () => {
    localStorage.setItem(LLM_PRIVACY_ACK_KEY, '1');
    setShowPrivacy(false);
    doGenerate();
  };

  const handleSaveEdit = () => {
    if (!summary) return;
    void saveSummaryEdit(summary, draft).then(() => {
      applyEdit(range.id, { ...summary, content: draft });
      setEditing(false);
    });
  };

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-caption text-sub">AI 总结 · {range.label}</h3>
        <div className="flex gap-2">
          {/* 总结用模型选择（来自设置页已勾选列表，改动即写回全局配置） */}
          {llm.selectedModels.length > 0 && (
            <select
              value={llm.activeModel || llm.selectedModels[0]}
              onChange={(e) => setLlm({ ...llm, activeModel: e.target.value })}
              disabled={streaming}
              title="选择本次总结使用的模型"
              className="max-w-44 cursor-pointer rounded-full border border-line bg-transparent px-3 py-1 font-mono text-caption text-sub transition-colors hover:text-ink focus:outline-accent disabled:opacity-40"
            >
              {llm.selectedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {summary && !editing && (
            <button
              onClick={() => {
                setDraft(summary.content);
                setEditing(true);
              }}
              className="flex items-center gap-1 rounded-full border border-line px-3 py-1 font-mono text-caption text-sub transition-colors hover:text-ink"
            >
              <Pencil size={12} />
              手改
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={streaming}
            className="flex items-center gap-1.5 rounded-full border border-accent px-4 py-1 font-mono text-caption text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {summary || interrupted ? <RefreshCw size={12} /> : <Sparkles size={12} />}
            {streaming ? '生成中…' : summary || interrupted ? '重新生成' : '生成总结'}
          </button>
        </div>
      </div>

      <div className="mt-3 border-l-2 border-accent pl-5">
        {streaming && !streamed && (
          <div className="flex animate-pulse flex-col gap-2">
            <div className="h-4 w-2/3 rounded bg-line" />
            <div className="h-4 w-full rounded bg-line" />
            <div className="h-4 w-5/6 rounded bg-line" />
          </div>
        )}
        {streaming && streamed && (
          <div>
            <SummaryContent content={streamed} />
            {/* 流式呼吸光标：accent 细竖线 */}
            <span className="mt-1 inline-block h-4 w-[2px] animate-pulse bg-accent" />
          </div>
        )}
        {!streaming && !summary && !interrupted && (
          <p className="text-body text-sub">
            这个周期的回望还没写。点击"生成总结"，把勾掉的事升维成一段叙事。
          </p>
        )}
        {!streaming && interrupted && (
          <div>
            <SummaryContent content={interrupted} />
            <p className="mt-2 font-mono text-caption text-accent">生成中断，以上为已生成部分，可点右上角重试。</p>
          </div>
        )}
        {!streaming && summary && !editing && <SummaryContent content={summary.content} />}
        {!streaming && summary && editing && (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full rounded-ctl border border-line bg-transparent p-3 text-body focus:outline-accent"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="rounded-full border border-accent px-4 py-1 font-mono text-caption text-accent transition-opacity hover:opacity-70"
              >
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-line px-4 py-1 font-mono text-caption text-sub transition-colors hover:text-ink"
              >
                取消
              </button>
            </div>
          </div>
        )}
        {!streaming && summary && (
          <p className="mt-3 font-mono text-caption text-sub">
            {summary.model} · {dayjs(summary.createdAt).format('MM/DD HH:mm')} 生成
          </p>
        )}
      </div>

      {/* 首次生成前的隐私说明（仅弹一次） */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-6">
          <div className="max-w-md rounded-card border border-line bg-surface p-6 [box-shadow:var(--shadow-float)]">
            <h4 className="font-display text-title">生成前的说明</h4>
            <p className="mt-3 text-body leading-7">
              AI 总结会把所选周期内的<strong>完成记录（标题、完成时间、模块来源）</strong>
              发送给你在设置页配置的第三方模型服务（当前：{llm.baseUrl}）。
              API Key 只存在本机，不会随备份或同步外传。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPrivacy(false)}
                className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink"
              >
                取消
              </button>
              <button
                onClick={handlePrivacyAck}
                className="rounded-full border border-accent px-4 py-1.5 font-mono text-caption text-accent transition-opacity hover:opacity-70"
              >
                知道了，生成
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
