import { db } from '@/db/dexie';
import { taskRepo } from '@/db/taskRepo';
import type { Quadrant, Task } from '@/types/task';
import { QUADRANT_HORIZON, QUADRANT_IDS } from '@/types/task';

/**
 * seedService：初始/种子数据（2026-10-05 起替换原 demoService 演示数据，库内不再生成假数据）。
 * 数据 = 用户真实待办蓝图，按象限分组；生成器为纯函数（确定性 id），写库走 taskRepo（§5.3）。
 * 种子条目统一打 tags: ['seed']，可在设置页一键清除（不影响手动录入的数据）。
 */

export const SEED_TAG = 'seed';

/** 本机首次启动已种入标记：清除种子后不会因重启复活 */
const SEEDED_KEY = 'tickverse.seeded';

/** 用户真实待办蓝图：按象限分组（标题保持原样录入） */
export const SEED_BLUEPRINT: Record<Quadrant, string[]> = {
  q1: [
    '上海人才补贴申报',
    'giffgaff 手机号激活',
    'bitget 虚拟卡申请',
    'bybit',
    '发货量、占比等数据可视化提取',
    'NAS 分流：限定美国家宽节点访问 CPA 和 New API，禁用香港节点作为 AI 节点',
    'NAS Docker 端口从 1082 换成 7897 导致 New API 未走分流的排查',
    '视频无法传输到手机的排查',
  ],
  q2: [
    '影视飓风课程',
    '股票学习',
    '俄语',
    '健身 / 健身房',
    '练书法、粤语、乐器',
    '英语、会计、审计',
    '修内观',
    '读书：《枪炮、病菌与玫瑰》《禅与摩托车维修艺术》',
    '硬件参数整理、知识补充',
    '通配符学习',
    '每日笔记（记录每天做了什么）',
    '松下 S9 风景 LUT 适配、LUT 合集购买、LUT 清理',
    '电脑修图软件 PR',
    '松下调参数没有实时预览的原因',
    '足弓 / 扁平足（鞋子推荐）',
    '肌酸品牌选择、锌镁硒补品、Swisse 系列',
    '社保公积金相关信息了解',
    '歌曲整理 + 硬盘备份（保持硬盘为最新）',
    '冬季俄罗斯出行衣服',
    '今年接下来宜静、梳理规划',
  ],
  q3: [
    '秋季穿搭：长袖长裤、外套裤子、黑色长袖衬衫、黑色亚麻长裤、黑白 polo 衫各一件',
    '鞋子、裤子、外套（换季采购）',
    '买手机壳、增高鞋垫、超轻充电宝 5000mah',
    '耳塞',
    '安卓端好用的代理软件',
    'google pay',
    'Mac 合盖工作设置',
    '超声波洗眼镜、剃须刀祛味、去胡青的膏',
  ],
  q4: [
    'mortal cls63sedan、MJ wagon、拍车模、改车模工具箱',
    'hyperframes、mapstage、toolknight、opencut、注册机、日月同错',
    '万宝龙钢笔、银饰、香水',
    '练签名"梅"',
    '牧主家牛胸口（探店）',
  ],
};

/** 纯函数：蓝图 → Task[]（确定性 id、象限内 order 连续序号，便于单测） */
export function generateSeedTasks(now: number): Task[] {
  const tasks: Task[] = [];
  for (const quadrant of QUADRANT_IDS) {
    SEED_BLUEPRINT[quadrant].forEach((title, i) => {
      tasks.push({
        id: `seed-${quadrant}-${i + 1}`,
        title,
        horizon: QUADRANT_HORIZON[quadrant],
        quadrant,
        tags: [SEED_TAG],
        createdAt: now,
        updatedAt: now,
        order: i,
      });
    });
  }
  return tasks;
}

/** 空库时写入初始数据（返回写入条数；库内已有任何记录则不动、返回 0） */
export async function seedIfEmpty(now = Date.now()): Promise<number> {
  if ((await db.tasks.count()) > 0) return 0;
  const tasks = generateSeedTasks(now);
  await taskRepo.bulkAdd(tasks);
  return tasks.length;
}

/** 启动一次性种子：本机首次启动且库为空才写入（配合 SEEDED_KEY 幂等，清除后不复活） */
export async function seedOnLaunch(now = Date.now()): Promise<number> {
  if (localStorage.getItem(SEEDED_KEY) !== null) return 0;
  localStorage.setItem(SEEDED_KEY, String(now));
  return seedIfEmpty(now);
}

/** 清除全部种子数据（按 seed 标签），返回删除条数 */
export async function clearSeedTasks(): Promise<number> {
  return taskRepo.removeByTag(SEED_TAG);
}
