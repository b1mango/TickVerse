import dayjs from 'dayjs';
import { taskRepo } from '@/db/taskRepo';
import type { Task } from '@/types/task';
import { startOfDay } from '@/utils/date';

/**
 * demoService：演示数据生成与清理（2026-08-28 用户要求：2025-08-01 至今，体现真实感）。
 * 生成器为纯函数（LCG 伪随机、确定性），写库走 taskRepo（§5.3）。
 * 演示条目统一打 tags: ['demo']，可一键清除。
 */

export const DEMO_TAG = 'demo';

/** LCG 伪随机（确定性，便于测试与复现） */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const WEEKDAY_POOL = [
  '写项目周报',
  '和需求方对齐排期',
  'Review 同事的 PR',
  '重构登录模块',
  '补单元测试',
  '整理技术方案文档',
  '站会前过一遍看板',
  '修线上反馈的 bug',
  '跟进设计稿还原度',
  '清理收件箱',
  '读 30 页专业书',
  '背 50 个单词',
  '看一节架构课',
  '整理读书笔记',
  '听一期技术播客',
  '给妈妈回电话',
  '缴水电费',
  '预约体检',
  '洗堆积的衣服',
  '收拾书桌',
] as const;

const WEEKEND_POOL = [
  '去公园跑步 5 公里',
  '游泳 40 分钟',
  '骑行绕城一圈',
  '读《百年孤独》两章',
  '看一部收藏的电影',
  '做一顿正经午饭',
  '大扫除',
  '逛书店',
  '约朋友打球',
  '整理相册',
  '写手账复盘本周',
  '爬山',
] as const;

const LONG_GOALS = [
  '完成拾刻 TickVerse 个人工具',
  '跑完一次半程马拉松',
  '读完《百年孤独》',
  '攒下 6 个月紧急备用金',
  '学会基础的 Rust',
] as const;

const TODAY_POOL = ['回复两条重要消息', '更新本周计划', '晚饭后散步 30 分钟'] as const;
const SHORT_POOL = ['周六前提交报销单', '约牙医复查', '读完本周开始的那本书', '整理季度照片备份'] as const;

/**
 * 生成 [rangeStart, rangeEnd) 区间的演示任务：
 * 工作日 1–3 条（偏工作/学习），周末 0–2 条（偏生活/运动），约 8% 整天留空（空窗）；
 * 边界几天留未完成（投影/逾期/长期锚点演示用）。
 */
export function generateDemoTasks(rangeStart: number, rangeEnd: number, seed = 42): Task[] {
  const rand = lcg(seed);
  const pick = <T>(pool: readonly T[]): T => pool[Math.floor(rand() * pool.length)];
  const tasks: Task[] = [];
  let order = 0;

  const push = (partial: Omit<Task, 'id' | 'updatedAt' | 'order' | 'tags'>): void => {
    tasks.push({
      ...partial,
      id: `demo-${tasks.length}`,
      updatedAt: partial.completedAt ?? partial.createdAt,
      order: order++,
      tags: [DEMO_TAG],
    });
  };

  for (let d = startOfDay(rangeStart); d < rangeEnd; d = dayjs(d).add(1, 'day').valueOf()) {
    const dow = dayjs(d).day();
    const weekend = dow === 0 || dow === 6;
    if (rand() < 0.08) continue; // 空窗日
    const count = weekend ? Math.floor(rand() * 2.4) : 1 + Math.floor(rand() * 2.6);
    const pool = weekend ? WEEKEND_POOL : WEEKDAY_POOL;
    for (let i = 0; i < count; i++) {
      const created = d + (8 + rand() * 2) * 3600000;
      const doneAt = d + (14 + rand() * 8) * 3600000;
      const done = rand() < 0.9 && doneAt <= rangeEnd; // 90% 当天完成；完成时间不能在未来
      if (!done && d < rangeEnd - 3 * 86400000) continue; // 早期的未完成任务不再展示（早已滚存/清理）
      push({
        title: pick(pool),
        horizon: rand() < 0.6 ? 'today' : rand() < 0.75 ? 'short' : 'long',
        createdAt: created,
        ...(done ? { completedAt: doneAt } : {}),
      });
    }
  }

  // 今天：2 条已完成 + 进行中条目（时间轴投影演示）
  const todayStart = startOfDay(rangeEnd - 1);
  push({ title: '晨间例会同步进度', horizon: 'today', createdAt: todayStart + 9 * 3600000, completedAt: todayStart + 9.5 * 3600000 });
  push({ title: '处理两条代码评审意见', horizon: 'today', createdAt: todayStart + 10 * 3600000, completedAt: todayStart + 11 * 3600000 });
  for (const title of TODAY_POOL) {
    push({ title, horizon: 'today', createdAt: todayStart + 8.5 * 3600000 });
  }
  // 短期：进行中 + 一条逾期（红点演示）
  for (const title of SHORT_POOL) {
    push({ title, horizon: 'short', createdAt: todayStart - 2 * 86400000 });
  }
  push({
    title: '昨天就该交的周报销',
    horizon: 'short',
    dueDate: dayjs(todayStart).subtract(1, 'day').format('YYYY-MM-DD'),
    createdAt: todayStart - 3 * 86400000,
  });
  // 长期目标：锚定时间轴未来端
  LONG_GOALS.forEach((title, i) => {
    push({ title, horizon: 'long', createdAt: todayStart - (150 - i * 20) * 86400000 });
  });

  return tasks;
}

/** 填充演示数据（增量，不动用户真实数据） */
export async function seedDemoTasks(now = Date.now()): Promise<number> {
  const start = new Date(2025, 7, 1).getTime(); // 2025-08-01
  const tasks = generateDemoTasks(start, now + 1);
  await taskRepo.bulkAdd(tasks);
  return tasks.length;
}

/** 清除全部演示数据（按 demo 标签） */
export async function clearDemoTasks(): Promise<number> {
  return taskRepo.removeByTag(DEMO_TAG);
}
