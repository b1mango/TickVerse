import dayjs from 'dayjs';
import type { ChatMessage } from '@/adapters/llm';
import { chatStream } from '@/adapters/llm';
import { summaryRepo } from '@/db/summaryRepo';
import type { LlmConfig } from '@/types/settings';
import type { Summary, SummaryPeriod } from '@/types/summary';
import type { Task } from '@/types/task';
import { weekStartOf } from '@/services/timelineService';
import { computeLongestGap, computeStreak } from '@/services/statsService';

/**
 * aiService：AI 总结的领域编排（§10.3 / 清单 M4-B）。
 * prompt 组装为纯函数可单测；生成走 adapters/llm；结果缓存进 summaries 表，不重复调 API。
 */

export interface PeriodRange {
  id: string;
  period: SummaryPeriod;
  start: number;
  end: number;
  label: string;
}

/** 周期区间与 Summary id（week=本周一至今，month=本月至今，year=今年至今） */
export function periodRange(period: SummaryPeriod, now: number): PeriodRange {
  const d = dayjs(now);
  if (period === 'week') {
    const start = weekStartOf(now);
    return {
      id: `${d.year()}-W${String(isoWeek(now)).padStart(2, '0')}`,
      period,
      start,
      end: now,
      label: `${dayjs(start).format('MM/DD')} — ${d.format('MM/DD')}`,
    };
  }
  if (period === 'month') {
    return {
      id: d.format('YYYY-MM'),
      period,
      start: d.startOf('month').valueOf(),
      end: now,
      label: d.format('YYYY 年 M 月'),
    };
  }
  return {
    id: d.format('YYYY'),
    period,
    start: d.startOf('year').valueOf(),
    end: now,
    label: d.format('YYYY 年'),
  };
}

/** ISO 周数（不依赖 dayjs 插件） */
function isoWeek(ts: number): number {
  const d = new Date(ts);
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return Math.ceil(((u.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const HORIZON_LABEL = { today: '今日（当日事）', short: '短期（近期事）', long: '长期（长期目标）' } as const;

/**
 * 总结 prompt 组装（2026-08-28 改版：拟人化，调研依据 = Anthropic Claude 4 系统提示词
 * + Gemini 泄露版 + Wikipedia:Signs of AI writing 反面清单）。
 * 输出契约：纯文本两三段短话——不用列表/标题/加粗/emoji，UI 按段落渲染纯文本即可。
 * 统计数字由代码算好随记录一起喂入，提示模型不要逐项汇报；
 * 系统提示词只有一套，周期差异仅在用户消息里带一句语境。
 */
export function buildSummaryMessages(tasks: Task[], range: PeriodRange): ChatMessage[] {
  const done = tasks
    .filter((t) => t.completedAt !== undefined && t.completedAt >= range.start && t.completedAt <= range.end)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

  const records = done
    .map((t) => `- [${dayjs(t.completedAt).format('MM-DD HH:mm')}] ${t.title}（${HORIZON_LABEL[t.horizon]}）`)
    .join('\n');

  // 统计数字：代码算好，模型只参考、不汇报
  const byHorizon = { today: 0, short: 0, long: 0 };
  const byDay = new Map<string, number>();
  for (const t of done) {
    byHorizon[t.horizon]++;
    const d = dayjs(t.completedAt).format('MM/DD');
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  let busiest = '';
  let busiestCount = 0;
  for (const [d, n] of byDay) {
    if (n > busiestCount) {
      busiest = d;
      busiestCount = n;
    }
  }
  const overdue = tasks.filter(
    (t) => t.completedAt === undefined && t.dueDate !== undefined && dayjs(t.dueDate).isBefore(dayjs(range.end), 'day'),
  ).length;
  const stats = [
    `共完成 ${done.length} 件`,
    `今日 ${byHorizon.today} 件、短期 ${byHorizon.short} 件、长期 ${byHorizon.long} 件`,
    busiest ? `最密集的一天是 ${busiest}（${busiestCount} 件）` : '',
    `连续打卡 ${computeStreak(tasks, range.end)} 天`,
    `最长空窗 ${computeLongestGap(tasks, range.end)} 天`,
    overdue > 0 ? `另有 ${overdue} 件逾期未完成的待办` : '',
  ]
    .filter(Boolean)
    .join('；');

  const periodContext: Record<SummaryPeriod, string> = {
    week: '这一周',
    month: '这个月',
    year: '这一年',
    custom: '这段时间',
  };

  return [
    {
      role: 'system',
      content: [
        '你认识这个人很久了。现在你翻着他勾掉的事项记录，像老朋友一样随口聊几句。',
        '',
        '直接开口。不打招呼，不自我介绍，不报幕，不谢幕——禁说"好的""以下是""希望对你有帮助"这类话。',
        '',
        '用第二人称"你"。写两三段短话，纯散文：不用列表，不用标题，不用加粗，不用 emoji。',
        '',
        '统计数字他已经看过了，给你只是让你心里有数，不要逐项汇报；只在某个数字本身有反差或意味时，自然地带出一次。',
        '',
        '从记录里挑一两个真正值得注意的细节：一件具体的事、一个具体的时间、一个反复出现的模式。可以指出问题，但只说事实，不评判。至多顺口提一个建议，且必须挂在具体的观察上，不说空泛的鼓励。',
        '',
        '记录里没什么可说的，就写短，一两句也行。',
        '',
        '禁用这些腔调："总而言之""值得注意的是""总的来说""赋能""见证""不仅……而且……"。',
        '',
        '只基于给定记录说话，不编造他没有做的事。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `这是${periodContext[range.period]}（${range.label}）的记录。`,
        '',
        `统计（你已知，不要逐项汇报）：${stats}。`,
        '',
        `完成记录：\n${records || '（无）'}`,
      ].join('\n'),
    },
  ];
}

/**
 * 流式生成总结并写入缓存（调用方负责隐私确认与 loading 态）。
 * onDelta 逐块回调增量文本；流结束后全文才落 summaries 表，中途断流不写缓存。
 */
export async function generateSummary(
  cfg: LlmConfig,
  tasks: Task[],
  range: PeriodRange,
  onDelta: (text: string) => void = () => {},
): Promise<Summary> {
  // 模型兜底链：activeModel 为空（旧版迁移/未勾选）时取勾选列表首个；都没有 → 友好报错而非 400
  const model = cfg.activeModel || cfg.selectedModels[0] || '';
  if (!model) throw new Error('请先在设置页「获取模型」并勾选总结用模型');
  const content = await chatStream({ ...cfg, activeModel: model }, buildSummaryMessages(tasks, range), onDelta);
  const summary: Summary = {
    id: range.id,
    period: range.period,
    rangeStart: range.start,
    rangeEnd: range.end,
    content,
    model,
    createdAt: Date.now(),
  };
  await summaryRepo.put(summary);
  return summary;
}

/** 读缓存（统计页加载时先查，不重复调 API） */
export async function getCachedSummary(id: string): Promise<Summary | undefined> {
  return summaryRepo.getById(id);
}

/** 手动编辑覆盖缓存 */
export async function saveSummaryEdit(summary: Summary, content: string): Promise<void> {
  await summaryRepo.put({ ...summary, content });
}
