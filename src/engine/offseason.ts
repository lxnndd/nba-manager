// ============ 休赛期（v0.3）：老化/退役/选秀/自由市场/AI 补强与交易/新赛季重置 ============
// 简化劳资规则（与真实 NBA 的差距在"使用说明.txt"中声明）：
//  - 工资帽 CAP = 15400 万美元/队（≈1.54 亿美元，对齐 2025-26 真实工资帽量级）
//  - 阵容 payroll（含新签年薪）≤ CAP → 可自由签约；
//  - 超过 CAP 的球队只能以"底薪"（年薪 ≤ MIN_SALARY=300 万）补人；
//  - 不实现：中产特例、奢侈税、球员选项/交易否决权等（单机简化）。
// 休赛期流程：beginOffseason(退役/老化/选秀/建池) → settleFreeAgency(玩家报价结算)
//   → simulateOffseasonAI(各队补缺) → simulateAIOffseasonTrades(重建/争冠队互市)
//   → finishOffseason(裁至 15、重置、开新赛季)。
import type { LeagueState, Player, Pos, Team, Skills18, DraftPick } from './types';
import { playoffChampion, sortRoster, applyTrade, evaluateTrade, tradeValue, pickValue, pickLabel, tryAITradeOfferToUser, lotteryDraw, rookieScaleSalary, SALARY_CAP, TAX_LINE, HARD_CAP, ROSTER_MAX } from './league';
import { genPlayer, genRookie, genFreeAgent, genDraftClass, realFaPlayer, makeSchedule, resetSeasonStats, salaryFor, STYLE_IDS, COACH_STYLE_IDS, SKILL_KEYS, SKILLS_OFFSET, calcOvr, rollPickPool } from './gen';
import { POS_ORDER } from './data';
import { REAL_FA } from './realRoster';
import { clamp, mulberry32, pick, randInt, shuffle, type Rng } from './rng';
import { computeSeasonAwards, computeFinalsMVP } from './awards';

// 简化劳资（v0.3.1 升级版；与真实 NBA 的差距在"使用说明.txt"中声明）：
//  - 工资帽 SALARY_CAP = 15400 万（≈1.54 亿）；帽下自由签
//  - 奢侈税线 TAX_LINE = 18700 万：超线球队无中产特例（仅底薪），交易薪资不得增加、不得打包
//  - 第二土豪线 HARD_CAP = 20000 万（2 亿美元）：硬顶，签约/交易后工资单不可超过
//  - 底薪 MIN_SALARY=300 万 / 中产 MID_LEVEL=1300 万（每队每休赛期 1 次，仅限 ≤税线球队）
export const MIN_SALARY = 300;     // 底薪上限：超帽/超税线球队补人的底价通道
export const MID_LEVEL = 1300;     // 中产特例上限：每休赛期可用 1 次（仅 ≤奢侈税线球队）

// ---------- 工具 ----------
export function payrollOf(t: Team): number {
  return t.players.reduce((s, p) => s + (p.salary || 0), 0);
}

// 球员市场要价（万美元/年）：能力薪资本位 × 0.8，年轻潜力上浮、老将下浮
export function askFor(p: Player): number {
  let ask = salaryFor(p.ovr) * 0.8;
  if (p.age <= 24 && p.potential - p.ovr >= 6) ask *= 1 + (p.potential - p.ovr) * 0.02;
  else if (p.age >= 33) ask *= 0.7;
  else if (p.age >= 30) ask *= 0.9;
  return clamp(Math.round(ask / 10) * 10, 250, 4200);
}

// 签约合法性（v0.3.1 分层，对应真实 NBA 土豪线结构）：
//  - 工资单 ≤1.54 亿（帽）：自由签
//  - ≤1.87 亿（税线）：帽下自由签 / 底薪 / 中产特例（每队每休赛期 1 次）
//  - >1.87 亿（第一土豪线）：仅底薪（无中产；首轮签冻结见交易规则）
//  - >2 亿（第二土豪线/硬顶）：仅能签底薪（薪金不得再增加）
export function canSign(l: LeagueState, t: Team, salary: number): boolean {
  const p0 = payrollOf(t);
  if (p0 > HARD_CAP) return salary <= MIN_SALARY;
  if (p0 > TAX_LINE) return salary <= MIN_SALARY;
  if (p0 + salary <= SALARY_CAP) return true;
  if (salary <= MIN_SALARY) return true;
  return salary <= MID_LEVEL && !l.midUsed[t.id];
}

// 签约通道：检查合法并占用资源（中产特例仅在真实成交时占用）
function chargeSign(l: LeagueState, t: Team, salary: number): boolean {
  const p0 = payrollOf(t);
  if (p0 > HARD_CAP) return salary <= MIN_SALARY;
  if (p0 > TAX_LINE) return salary <= MIN_SALARY;
  if (p0 + salary <= SALARY_CAP) return true;
  if (salary <= MIN_SALARY) return true;
  if (salary <= MID_LEVEL && !l.midUsed[t.id]) {
    l.midUsed[t.id] = true;
    return true;
  }
  return false;
}

// ---------- v2.0 成长加点（点数制：潜力星 × 成长阶段 × 出场时间系数） ----------
// 规则（用户指定）：18-25 黄金期 ×3 / 26-29 稳步期 ×2；出场时间 10 分钟为基准系数 1：
//   <5min→0.8、5-10→0.9、10-15→1、15-20→1.1、20-25→1.2、25+→1.3。
// 30+ 不再加点（老将每季衰减：30-32 -2 / 33-35 -4 / >35 -6 点，均匀从技能里扣）。
// 点数由玩家休赛期手动分配（用户队）或引擎自动分配（AI 队/兜底）；1 点 = 某项技能 +1。
export function timeCoefOf(p: Player): number {
  const g = Math.max(1, p.gp);
  const mpg = p.stats.min / g;
  if (mpg < 5) return 0.8;
  if (mpg < 10) return 0.9;
  if (mpg < 15) return 1;
  if (mpg < 20) return 1.1;
  if (mpg < 25) return 1.2;
  return 1.3;
}

export function growthPointsFor(p: Player): number {
  if (p.age >= 30) return 0; // 老将不加点（衰减见 agingPenaltyOf）
  const stage = p.age <= 25 ? 3 : 2;
  return Math.round(p.potential * stage * timeCoefOf(p));
}

export function agingPenaltyOf(p: Player): number {
  if (p.age <= 29) return 0;
  if (p.age <= 32) return 2;
  if (p.age <= 35) return 4;
  return 6;
}

// 技能变化 → 总评重算（基准制：真实名单 = 官方 OVR + 算法增量；虚构初始差为 0 同公式）
export function recalcOvr(p: Player): void {
  const base = p.baseSkills ?? p.skills;
  const baseOvr = p.baseOvr ?? p.ovr;
  const delta = calcOvr(p.skills) - calcOvr(base);
  p.ovr = clamp(Math.round(baseOvr + delta), 40, 99);
}

// 花费 1 点（或扣 1 点）到指定技能；正点需要预算，负点直接扣（老将衰减用）
export function spendPoint(p: Player, key: keyof Skills18, delta: 1 | -1): void {
  if (delta === 1 && p.points <= 0) return;
  p.skills[key] = clamp(p.skills[key] + delta, 25, 99);
  if (delta === 1) p.points--;
  recalcOvr(p);
}

// AI 自动分配（v2.1 规则）：优先加到"突出的能力"（当前最高的技能），单项不超过 90；
// 若所有技能都已 ≥90，剩余点数直接清零（规则：不超过 90）。
export function autoDistribute(rng: Rng, p: Player): void {
  void rng; // 新规则不需要随机（确定性：永远加当前最高且 <90 的技能）
  let guard = 0;
  while (p.points > 0 && guard++ < 2000) {
    let best: keyof Skills18 | null = null;
    for (const k of SKILL_KEYS) {
      if (p.skills[k] >= 90) continue;
      if (best == null || p.skills[k] > p.skills[best]) best = k;
    }
    if (best == null) break; // 全部 ≥90 → 停止
    p.skills[best] = clamp(p.skills[best] + 1, 25, 99);
    p.points--;
    recalcOvr(p);
  }
  if (p.points > 0) p.points = 0; // 兑现不出来时清零（规则：不超过 90）
}

// ---------- 老化（v2.0 点数制：发点由 beginOffseason 做；此函数只做年龄/经验增长与衰减） ----------
export function agePlayer(rng: Rng, p: Player, style?: string | null): void {
  p.age++;
  p.exp++;
  const penalty = agingPenaltyOf(p);
  if (penalty > 0) {
    let dec = penalty;
    if (style === 'star' && p.ovr >= 90) dec = Math.ceil(dec / 2); // 球星成色：90+ 球星衰退减缓
    for (let i = 0; i < dec; i++) {
      const k = SKILL_KEYS[Math.floor(rng() * SKILL_KEYS.length)];
      p.skills[k] = clamp(p.skills[k] - 1, 25, 99);
    }
    recalcOvr(p);
  }
}

export function winRateOf(t: Team): number {
  return t.win / Math.max(1, t.win + t.loss);
}

const money = (w: number) => (w >= 10000 ? (w / 10000).toFixed(1) + '亿' : w + '万');
const tName = (l: LeagueState, id: number) => (id >= 0 && id < l.teams.length ? l.teams[id].name : '?');

function hasAllPositions(players: Player[]): boolean {
  return (['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]).every((pos) => players.some((q) => q.pos === pos));
}

function addNews(l: LeagueState, s: string) {
  l.news.push(s);
  if (l.news.length > 90) l.news.splice(0, l.news.length - 90); // 防膨胀
}

// 球员离开球队时的去向：年轻或还有战力的回自由市场，否则直接离开联盟（防市场积压）
function releasePlayer(l: LeagueState, p: Player): void {
  p.salary = 0;
  p.contractYears = 0;
  p.stats = { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, or: 0, dr: 0 };
  p.gp = 0;
  p.starts = 0;
  if (p.ovr >= 68 && p.age <= 31) l.freeAgents = [...l.freeAgents, p]; // 战力尚可：回市场等底薪机会（替换新数组 → UI 能感知）
  // 其余视为退役/海外淘金，直接出联盟
}

// ---------- 第一步：开启休赛期（颁奖/老化/退役/选秀/建自由市场） ----------
export function beginOffseason(l: LeagueState): void {
  l.news = []; // 上一赛季的消息归档（新赛季开始后可在历史中查），本期从头记
  // v2.0 生涯结算：把刚结束赛季的常规赛数据累计进 career（随后 aging/交易/退役展示用）
  const settleCareer = (p: Player) => {
    p.career.gp += p.gp;
    p.career.pts += p.stats.pts;
    p.career.reb += p.stats.or + p.stats.dr;
    p.career.ast += p.stats.ast;
    p.career.stl += p.stats.stl;
    p.career.blk += p.stats.blk;
  };
  for (const t of l.teams) for (const p of t.players) settleCareer(p);
  for (const p of l.freeAgents) settleCareer(p);
  // 常规赛奖项（v2.0 已不含 FMVP）；FMVP 冠军界面独立计算
  computeSeasonAwards(l);
  const champ = playoffChampion(l);
  const awards = l.awards;
  const fmvp = computeFinalsMVP(l);
  l.history.push({
    season: l.season,
    year: l.year,
    championId: champ ?? -1,
    mvpId: awards?.mvp?.playerId,
    finalsMvpId: fmvp?.playerId,
  });

  const rng = mulberry32(l.seed + l.season * 77777 + 13); // 沿用 v0.1 休赛期种子点（复现性）
  // v2.0 每赛季风格归零重选：AI 队球队风格（二选一）+ 执教风格（三选一）重新随机
  for (const team of l.teams) {
    if (team.id !== l.userTeamId) {
      team.style = pick(rng, STYLE_IDS);
      team.coachStyle = pick(rng, COACH_STYLE_IDS);
    }
  }
  // 老化 / 退役（阵容球员 + 上个休赛期留存自由球员）
  const retireOf = (p: Player) => p.age >= 38 || (p.age >= 35 && p.ovr < 62 && rng() < 0.5);
  const ageOne = (p: Player, style?: string | null) => agePlayer(rng, p, style);

  const retiring: { teamId: number; p: Player }[] = [];
  for (const team of l.teams) {
    for (const p of team.players) {
      // v2.0 发点：按"上赛季出场时间系数 × 潜力星 × 成长阶段"计算（30+ 无加点）
      p.points += growthPointsFor(p);
      ageOne(p, team.style);
      if (retireOf(p)) retiring.push({ teamId: team.id, p });
    }
  }
  // v2.5.0：赛季结束伤病全部康复（用户要求："前一赛季受伤，下一赛季直接康复，不会延续状态"）；
  //   同时合同年数逐年递减（此前完全没有递减逻辑 → "合同年份随赛季好像没变化"）
  const offSeasonBookkeeping = (p: Player) => {
    p.injury = null;
    if (p.contractYears > 0) p.contractYears--;
  };
  for (const team of l.teams) for (const p of team.players) offSeasonBookkeeping(p);
  for (const r of retiring) {
    const team = l.teams[r.teamId];
    const i = team.players.indexOf(r.p);
    if (i >= 0) team.players.splice(i, 1);
    const c = r.p.career;
    addNews(l, `👋 ${r.p.name}（${team.name}）宣布退役，结束 ${r.p.exp - 1} 年职业生涯（生涯 ${c.gp} 场 · ${Math.round(c.pts)} 分 · ${Math.round(c.reb)} 板 · ${Math.round(c.ast)} 助）。`);
  }

  // 留存自由球员同样老化/退役（另：30 岁+ 每年约 8% 去海外淘金离联盟，防止市场无限积压）
  const faLeft: Player[] = [];
  for (const p of l.freeAgents) {
    p.points += growthPointsFor(p);
    ageOne(p);
    offSeasonBookkeeping(p); // v2.5.0：伤病康复 + 合同年递减
    if (retireOf(p)) {
      const c = p.career;
      addNews(l, `👋 自由球员 ${p.name} 宣布退役（生涯 ${c.gp} 场 · ${Math.round(c.pts)} 分 · ${Math.round(c.reb)} 板 · ${Math.round(c.ast)} 助）。`);
      continue;
    }
    if (p.age >= 30 && rng() < 0.08) { addNews(l, `✈️ 自由球员 ${p.name} 选择去海外联赛淘金。`); continue; }
    faLeft.push(p);
  }
  l.freeAgents = faLeft;

  // ---------- v2.5.0：合同到期处理（用户要求"合同年份随赛季变化"）----------
  //   合同年递减到 0 = 到期：按安全阀放走最弱的几名（进入自由市场），其余自动续约。
  //   安全阀（避免名单被打空）：每队 ≥13 人、每个位置 ≥1 人、每队最多放走 3 人。
  const released: Player[] = [];
  for (const team of l.teams) {
    const due = team.players.filter((p) => p.contractYears <= 0);
    if (!due.length) continue;
    const keep = new Set<number>();
    for (const pos of POS_ORDER) {
      const list = team.players.filter((p) => p.pos === pos);
      if (list.length === 1) keep.add(list[0].id);
    }
    const allowed = Math.max(0, Math.min(3, team.players.length - 13));
    const relIds = new Set(
      due.filter((p) => !keep.has(p.id)).sort((a, b) => a.ovr - b.ovr).slice(0, allowed).map((p) => p.id),
    );
    for (const p of due) {
      if (relIds.has(p.id)) {
        p.salary = 0;
        released.push(p);
        addNews(l, `📄 ${p.name}（${team.name} · ${p.pos} · OVR ${p.ovr}）合同到期未续约，进入自由市场。`);
      } else {
        // 自动续约：老将 1 年、29-31 岁 2 年、其余 3 年，年薪按市场价重签
        p.contractYears = p.age >= 32 ? 1 : p.age >= 29 ? 2 : 3;
        p.salary = salaryFor(p.ovr);
      }
    }
    if (relIds.size) team.players = team.players.filter((p) => !relIds.has(p.id));
  }
  if (released.length) {
    l.freeAgents = [...l.freeAgents, ...released];
    addNews(l, `📄 本休赛期共 ${released.length} 名球员合同到期进入自由市场。`);
  }

  // v2.1 选秀大会（可操作版）：生成 80 人池 + 签序，进入 DraftState；
  // 处理进度由休赛期 UI / AI 代选推进（draftPickAuto / draftPickUser / draftComplete）。
  // v2.3：本届选秀 = l.year + 1 那年的签（30 首轮 + 30 次轮）；首轮先选、次轮后选，各自按归属队战绩差排序。
  const draftYear = l.year + 1;
  const rankOf = [...l.teams].sort((a, b) => winRateOf(a) - winRateOf(b) || a.abbr.localeCompare(b.abbr));
  const rank = (teamId: number) => rankOf.findIndex((t) => t.id === teamId);
  // v2.3.0 乐透抽签（独立 rng 流）：14 支乐透队按概率抽前 4 顺位，其余按战绩逆序
  const lottoRng = mulberry32(l.seed * 4271 + l.season * 613 + 29);
  const draw = lotteryDraw(l, lottoRng);
  const draftPosOrder = draw.order;
  const posOfTeam = (id: number) => {
    const i = draftPosOrder.indexOf(id);
    return i < 0 ? 99 : i;
  };
  // v2.4.0：保存抽签结果供休赛期界面可视化展示（概率 + 顺位 + 前 4 高亮）
  l.lottery = { year: draftYear, order: draw.order, odds: draw.odds, top4: draw.order.slice(0, 4), lotteryIds: draw.lotteryIds };
  const order = l.draftPool
    .filter((pk) => pk.year === draftYear)
    .sort((x, y) => {
      if (x.round !== y.round) return x.round - y.round; // 首轮先选
      // 首轮按乐透抽签顺位；次轮无乐透（纯按战绩逆序，与真实规则一致）
      const d = x.round === 1 ? posOfTeam(x.f) - posOfTeam(y.f) : rank(x.f) - rank(y.f);
      return d || x.o - y.o;
    });
  {
    const top4 = draftPosOrder.slice(0, 4).map((id) => l.teams[id]?.abbr ?? '?').join(' → ');
    addNews(l, `🎲 乐透抽签：${l.teams[draftPosOrder[0]]?.name ?? '?'} 抽中状元签（前四顺位 ${top4}）；其余乐透队按战绩逆序，非乐透队 15-30 顺位。`);
  }
  // v2.3.0：本届新秀 = 开档/上一休赛期就已生成的"预测名单"（玩家整个赛季都能提前考察这些人）
  const draftClass = l.nextDraftClass?.length ? l.nextDraftClass : genDraftClass(rng);
  for (const rookie of draftClass) if (!rookie.id || rookie.id <= 0) rookie.id = l.playerSeq++; // 统一分配 id
  l.draft = { year: draftYear, class: draftClass, order, next: 0, picked: [] };
  const nFirst = order.filter((pk) => pk.round === 1).length;
  addNews(l, `🎓 ${draftYear} 年选秀 80 人已出炉（含 1 名 80+ 天骄，未必是状元）；${nFirst} 枚首轮 + ${order.length - nFirst} 枚次轮签按战绩差顺序挑选。`);
  // 生成下一届预测名单（独立 rng 流：不扰动休赛期既有随机序）
  {
    const ndRng = mulberry32(l.seed * 5501 + l.season * 97 + 23);
    const nextList = genDraftClass(ndRng);
    for (const r of nextList) r.id = l.playerSeq++;
    l.nextDraftClass = nextList;
  }

  // 自由球员池：真实名单首季已在建档时铺好 REAL_FA（v0.3.3 起开档即开放市场）；
  // 旧档升级且市场为空时才在此补建（新档走建档路径，不会重复）
  if (l.mode === 'real' && l.season === 1 && l.freeAgents.length === 0) {
    for (const rp of REAL_FA) l.freeAgents.push(realFaPlayer(l.playerSeq++, rp));
    addNews(l, `🏀 自由市场开启：${REAL_FA.length} 名真实自由球员进入市场。`);
  }
  // 保池：虚构模式下赛季市场至少 ~55 人，每年少量新人进入联盟
  if (l.mode !== 'real' || l.season > 1 || l.freeAgents.length === 0) {
    const want = 55 + randInt(rng, 0, 10);
    const add = want - l.freeAgents.length;
    if (add > 0) {
      for (let i = 0; i < add; i++) {
        const fa = genFreeAgent(rng);
        fa.id = l.playerSeq++; // id 由联赛统一分配
        l.freeAgents.push(fa);
      }
    }
  }

  l.offseason = true;
  l.offseasonStep = 1;
  l.midUsed = l.teams.map(() => false); // 中产特例每休赛期一次
  // v2.5.0：休赛期交易窗口（乐透抽签后 3 天）——step1 期间可交易，进入自由市场前关闭
  l.offseasonTradeDays = 3;
  // v2.0 自由市场 7 天窗口重置 + 季后赛淘汰弹窗标记 + 待处理事件清理
  l.faDay = 1;
  l.faOffers = [];
  l.poffExitShown = false;
  l.pendingEvents = [];
  // v2.3：休赛期重新生成 AI 报价（上赛季遗留的报价跨季失效）
  l.tradeOffers = [];
  // v2.1 成长自动分配：全员（含用户队）统一按"优先突出能力、单项 ≤90"自动加点
  for (const team of l.teams) {
    for (const p of team.players) if (p.points > 0) autoDistribute(rng, p);
  }
  for (const p of l.freeAgents) if (p.points > 0) autoDistribute(rng, p);
}

// ---------- v2.1 选秀大会（休赛期可操作）：签序状态机 ----------
// order 按 from 战绩差排好；next 指向下一个待处理签。AI 签自动选最高 OVR 剩余新秀；
// 用户持有的签由玩家在休赛期 UI 中挑选（或一键 AI 代选）。
export function draftIsUserTurn(l: LeagueState): boolean {
  const d = l.draft;
  if (!d || d.next >= d.order.length) return false;
  return d.order[d.next].o === l.userTeamId;
}

export function draftRemaining(l: LeagueState): { current: DraftPick | null; total: number } {
  const d = l.draft;
  if (!d) return { current: null, total: 0 };
  return { current: d.next < d.order.length ? d.order[d.next] : null, total: d.order.length };
}

// 把一名新秀分配给持有签的队（满 17 落选进 FA / 满 15 裁最弱冗余位 → 联盟人数守恒）
function assignRookie(l: LeagueState, team: Team, rookie: Player): void {
  const pick = l.draft!.order[l.draft!.next];
  const pickNo = l.draft!.next + 1;
  const idx = l.draft!.class.indexOf(rookie);
  if (idx >= 0) l.draft!.class.splice(idx, 1);
  l.draft!.picked.push(rookie.id);
  // v2.3.0 新秀合同：首轮签按薪资阶位（Rookie Scale，状元 1200 万 → 30 号 200 万）签 4 年；
  // 次轮签无固定薪资 → 底薪档（200-300 万）2 年（与真实规则一致）
  if (pick && pick.round === 1) {
    rookie.salary = rookieScaleSalary(pickNo);
    rookie.contractYears = 4;
  } else {
    rookie.salary = clamp(salaryFor(rookie.ovr), 200, MIN_SALARY);
    rookie.contractYears = 2;
  }
  if (team.players.length >= ROSTER_MAX) {
    // v2.3.0：名单满员时也先裁掉最弱的冗余位置球员为新秀腾位（真实球队会给新秀机会），
    // 只有当五个位置全是独苗（无人可裁）时才让新秀落选
    const count = (pos: Pos) => team.players.filter((q) => q.pos === pos).length;
    const weakest = [...team.players]
      .filter((q) => count(q.pos) > 1)
      .sort((a, b) => a.ovr - b.ovr)[0];
    if (weakest) {
      const wi = team.players.indexOf(weakest);
      team.players.splice(wi, 1);
      releasePlayer(l, weakest);
      team.players.push(rookie);
      addNews(l, `🎓 第 ${pickNo} 顺位新秀 ${rookie.name} 加盟 ${team.name}（为腾位裁掉 ${weakest.name}）。`);
    } else {
      rookie.salary = 0;
      rookie.contractYears = 0;
      l.freeAgents.push(rookie);
      addNews(l, `🎓 第 ${pickNo} 顺位新秀 ${rookie.name} 因 ${team.name} 名单已满落选，进入自由市场。`);
    }
  } else {
    // v2.3.0：休赛期名单上限是 ROSTER_MAX(17)，选秀后直接扩编即可——
    // 此前在 15 人就裁人，导致刚选中的新秀常被自己球队裁掉（一届 60 签只留下 36 人）；
    // 开季前 finishOffseason 会统一裁到 15 人。
    team.players.push(rookie);
  }
  l.draft!.next++;
  sortRoster(team);
}

// AI 代选：签序下一个签 → 池中剩余最高 OVR 新秀（若下一签属于用户则跳过，返回 false）
export function draftPickAuto(l: LeagueState): boolean {  const d = l.draft;
  if (!d || d.next >= d.order.length) return false;
  if (d.order[d.next].o === l.userTeamId) return false; // 轮到玩家：等玩家选
  const pick = d.order[d.next];
  const team = l.teams[pick.o];
  if (!team) { d.next++; return true; }
  const best = [...d.class].sort((a, b) => b.ovr - a.ovr)[0];
  if (!best) { d.next++; return true; }
  const pickNo = d.next + 1;
  addNews(l, `🎓 第 ${pickNo} 顺位（${team.name}${team.abbr !== l.teams[pick.f]?.abbr ? ` · ${l.teams[pick.f].abbr} 的签` : ''}）：选中 ${best.name}（${best.pos} · OVR ${best.ovr}${best.nation !== '美国' ? ` · ${best.nation}` : ''}）`);
  assignRookie(l, team, best);
  return true;
}

// v2.4.0 快进到玩家持有的签：AI 依次代选，直到轮到玩家（或选秀结束）。返回跳过的签数。
export function draftFastToUserPick(l: LeagueState): number {
  const d = l.draft;
  if (!d) return 0;
  let steps = 0;
  while (d.next < d.order.length && !draftIsUserTurn(l) && steps < 200) {
    if (!draftPickAuto(l)) break;
    steps++;
  }
  return steps;
}

// 玩家为用户队持有的签挑选新秀
export function draftPickUser(l: LeagueState, rookieId: number): boolean {
  const d = l.draft;
  if (!d || d.next >= d.order.length) return false;
  if (d.order[d.next].o !== l.userTeamId) return false;
  const rookie = d.class.find((p) => p.id === rookieId);
  if (!rookie) return false;
  const pick = d.order[d.next];
  const team = l.teams[pick.o] ?? l.teams[l.userTeamId];
  const pickNo = d.next + 1;
  addNews(l, `🎓 第 ${pickNo} 顺位（你的选择 · ${team.name}${team.abbr !== l.teams[pick.f]?.abbr ? ` · ${l.teams[pick.f].abbr} 的签` : ''}）：选中 ${rookie.name}（${rookie.pos} · OVR ${rookie.ovr}${rookie.nation !== '美国' ? ` · ${rookie.nation}` : ''}）`);
  assignRookie(l, team, rookie);
  return true;
}

// 收尾：剩余签全部 AI 代选；落选秀（池中剩余）进自由市场；l.draft 置 null
export function draftComplete(l: LeagueState): void {
  const d = l.draft;
  if (!d) return;
  let guard = 0;
  while (d.next < d.order.length && guard++ < 200) {
    // ⚠️ v2.3.0 修复：此前 draftPickAuto 遇到"用户持有的签"返回 false 就直接 break，
    // 导致「自动完成全部选秀」在轮到玩家签时提前收工——剩余签位全部变成落选秀
    // （实测一届只签下 37 人、43 人莫名落选）。现在用户签改为在循环内直接代选。
    if (d.order[d.next].o === l.userTeamId) {
      const pick = d.order[d.next];
      const team = l.teams[pick.o] ?? l.teams[l.userTeamId];
      const best = [...d.class].sort((a, b) => b.ovr - a.ovr)[0];
      if (!best) { d.next++; continue; }
      addNews(l, `🎓 第 ${d.next + 1} 顺位（${team.name}）：代选 ${best.name}（OVR ${best.ovr}）`);
      assignRookie(l, team, best);
      continue;
    }
    if (!draftPickAuto(l)) break; // AI 签（异常态兜底：无法推进时退出）
  }
  // 落选秀（池中剩余）→ 自由市场（报部分，防刷屏）
  // v2.4.0：改为替换新数组——push 就地修改不会改变引用，UI 的 useMemo 依赖不会失效，
  // 玩家会以为"落选秀没进自由市场"（实际进了但列表不刷新）
  const leftovers = [...d.class];
  let reported = 0;
  const added: Player[] = [];
  for (const rookie of leftovers) {
    rookie.salary = 0;
    rookie.contractYears = 0;
    rookie.gp = 0;
    rookie.starts = 0;
    added.push(rookie);
    if ((rookie.ovr >= 72) && reported < 8) {
      addNews(l, `🎓 落选秀 ${rookie.name}（${rookie.pos} · OVR ${rookie.ovr}${rookie.nation !== '美国' ? ` · ${rookie.nation}` : ''}）进入自由市场。`);
      reported++;
    }
  }
  if (added.length) l.freeAgents = [...l.freeAgents, ...added];
  addNews(l, `📋 本届选秀共 80 人：${d.picked.length} 人获签，${leftovers.length} 名落选秀进入自由市场。`);
  // v2.3：本届（year）的签已用完 → 移出选秀权池（滚动窗口在 finishOffseason 补齐最远年份）
  const used = d.year;
  l.draftPool = l.draftPool.filter((pk) => pk.year > used);
  l.draft = null;
  for (const team of l.teams) sortRoster(team);
}

// ---------- 第二步：自由市场结算（玩家报价 vs AI 竞争） ----------
export interface FaOffer {
  pid: number;
  years: number;  // 1-4
  salary: number; // 万美元/年
}

export interface FaResult {
  pid: number;
  name: string;
  ok: boolean;
  won: boolean;       // 是否被本队签下（AI 竞价更高则 false）
  teamId: number;     // 成交球队（-1 未成交）
  years: number;
  salary: number;
  note: string;
}

export function settleFreeAgency(l: LeagueState, offers: FaOffer[]): FaResult[] {
  const rng = mulberry32(l.seed * 977 + l.season * 1009 + 7);
  const me = l.teams[l.userTeamId];
  const results: FaResult[] = [];
  const aiBidUsed = new Set<number>(); // 每个 AI 队同窗口只竞价一次

  for (const offer of offers) {
    const p = l.freeAgents.find((x) => x.id === offer.pid);
    const base: FaResult = {
      pid: offer.pid, name: p?.name ?? '?', ok: false, won: false, teamId: -1,
      years: offer.years, salary: offer.salary, note: '',
    };
    if (!p) { results.push({ ...base, note: '球员已不在自由市场' }); continue; }
    if (offer.years < 1 || offer.years > 4) { results.push({ ...base, note: '合同年限需 1-4 年' }); continue; }
    if (offer.salary < 250 || offer.salary > 4200) { results.push({ ...base, note: '年薪超出允许范围(250-4200万)' }); continue; }
    // 名单容量（v0.3.1：休赛期上限 17，开季自动裁至 15）
    if (me.players.length >= ROSTER_MAX) { results.push({ ...base, note: `名单已满 ${ROSTER_MAX} 人，请先裁人腾位` }); continue; }
    // 预算通道预检（不占用资源；成交时才真正占用特例）
    if (!canSign(l, me, offer.salary)) {
      results.push({ ...base, note: `超出工资帽且无可用特例：只能签底薪(≤${MIN_SALARY}万)或中产(≤${MID_LEVEL}万，每休赛期1次)` });
      continue;
    }
    const ask = askFor(p);
    // AI 竞争：找对该位置有需求且付得起的队
    let rival: { team: Team; bid: number } | null = null;
    const candTeams = shuffle(rng, l.teams.filter((t) => t.id !== l.userTeamId && !aiBidUsed.has(t.id)));
    for (const t of candTeams) {
      const same = t.players.filter((q) => q.pos === p.pos);
      const needPos = t.players.length < 15 || !same.length || Math.min(...same.map((q) => q.ovr)) < p.ovr - 3;
      if (!needPos) continue;
      const bid = clamp(Math.round(ask * (0.93 + rng() * 0.15) / 10) * 10, 250, 4200);
      if (!canSign(l, t, bid)) continue;
      rival = { team: t, bid };
      aiBidUsed.add(t.id);
      break;
    }
    const playerWorth = offer.salary / ask;
    // v1.3 球星成色：追逐 90+（以 ovr≥88 为界）球星时更有吸引力 → 接受门槛从 85% 降到 78%
    const starCharm = me.style === 'star' && p.ovr >= 88 ? 0.78 : 0.85;
    if (!rival) {
      // 无竞争：报价 ≥ 接受门槛成交，否则谈崩
      if (playerWorth < starCharm) {
        results.push({ ...base, note: `报价低于 ${p.name} 的预期（要价 ${money(ask)}），谈崩` });
        continue;
      }
    } else if (rival.bid > offer.salary) {
      // AI 竞价更高：球员转投
      if (!chargeSign(l, rival.team, rival.bid)) {
        results.push({ ...base, note: `${p.name} 拒绝了报价（${rival.team.name} 出价更高但因薪金问题未能成行）` });
        continue;
      }
      const rivalYears = 2 + Math.floor(rng() * 2);
      signTo(l, p, rival.team, rivalYears, rival.bid);
      results.push({ ...base, won: false, teamId: rival.team.id, years: rivalYears, salary: rival.bid, note: `${p.name} 接受了 ${rival.team.name} 的更高报价` });
      continue;
    }
    // 玩家成交（此时占用底薪/中产通道）
    if (!chargeSign(l, me, offer.salary)) {
      results.push({ ...base, note: '薪金通道被其他签约占用（中产特例每队每休赛期仅 1 次）' });
      continue;
    }
    signTo(l, p, me, offer.years, offer.salary);
    results.push({ ...base, ok: true, won: true, teamId: me.id, note: '签约成功' });
  }
  return results;
}

// ---------- 赛季中自由签约（v0.3.3：自由市场从开档第一赛季即开放） ----------
// 与休赛期结算的区别：无 AI 竞价（AI 只在休赛期行动），报价 ≥ 要价 85% 即时成交。
// 薪资通道与休赛期一致：帽下自由签 / 帽上底薪 ≤MIN_SALARY 或中产 ≤MID_LEVEL
// （每队每赛季 1 次，超税线球队无中产资格）/ 硬顶队仅底薪。
export function signFreeAgentNow(l: LeagueState, teamId: number, pid: number, years: number, salary: number): FaResult {
  const team = l.teams[teamId];
  const p = l.freeAgents.find((x) => x.id === pid);
  const base: FaResult = { pid, name: p?.name ?? '?', ok: false, won: false, teamId: -1, years, salary, note: '' };
  if (!team || !p) return { ...base, note: '球员已不在自由市场' };  if (years < 1 || years > 4) return { ...base, note: '合同年限需 1-4 年' };
  if (salary < 250 || salary > 4200) return { ...base, note: '年薪超出允许范围(250-4200万)' };
  if (team.players.length >= ROSTER_MAX) return { ...base, note: `名单已满 ${ROSTER_MAX} 人，请先在「交易」页腾出名额` };
  if (!canSign(l, team, salary)) {
    return { ...base, note: `超出工资帽且无可用通道：只能签底薪(≤${MIN_SALARY}万)或中产(≤${MID_LEVEL}万，每队每赛季1次，超税线球队无中产)` };
  }
  const ask = askFor(p);
  // v1.3 球星成色：追逐 90+（以 ovr≥88 为界）球星时更有吸引力（接受门槛 85% → 78%）
  const starCharm = team.style === 'star' && p.ovr >= 88 ? 0.78 : 0.85;
  if (salary < ask * starCharm) return { ...base, note: `报价低于 ${p.name} 的预期（要价 ${money(ask)}），谈崩` };
  if (!chargeSign(l, team, salary)) return { ...base, note: '薪金通道被占用（中产特例每队每赛季仅 1 次）' };
  signTo(l, p, team, years, salary);
  return { ...base, ok: true, won: true, teamId, note: '签约成功' };
}

// 玩家/球队裁人：球员解除合同回自由市场（休赛期专用；赛季中不可用）
// 位置保护：某位置仅剩 1 人时不可裁（避免五位置缺口）。
export function cutPlayer(l: LeagueState, playerId: number): boolean {
  const team = l.teams.find((t) => t.id === l.userTeamId) ?? l.teams.find((t) => t.players.some((p) => p.id === playerId));
  if (!team) return false;
  const i = team.players.findIndex((p) => p.id === playerId);
  if (i < 0) return false;
  const p = team.players[i];
  const samePos = team.players.filter((q) => q.pos === p.pos).length;
  if (samePos <= 1) return false; // 破位保护
  team.players.splice(i, 1);
  p.salary = 0;
  p.contractYears = 0;
  // ⚠️ v2.3.0 用"替换新数组"而非 push：引擎的就地增删不会改变数组引用，
  //    而 useGame 的 tick 是浅拷贝 → UI 的 useMemo 依赖不会失效（表现为列表不刷新）
  l.freeAgents = [...l.freeAgents, p];
  addNews(l, `✂️ ${team.name} 裁掉了 ${p.name}（进入自由市场）。`);
  sortRoster(team);
  return true;
}

// 签约入队（队满 15 则裁掉"最弱且不破坏五位置"的球员回池）；news 由调用侧保证（此函数不记新闻）
function signTo(l: LeagueState, p: Player, team: Team, years: number, salary: number): void {
  l.freeAgents = l.freeAgents.filter((x) => x.id !== p.id); // 替换新数组（见 cutPlayer 注释）
  p.salary = salary;
  p.contractYears = years;
  p.starts = 0;
  p.gp = 0;
  team.players.push(p);
  if (team.players.length > ROSTER_MAX) {
    // 裁掉队内最弱且不破坏五位置的人（去向按战力判定）
    const posCount = (pos: Pos) => team.players.filter((q) => q.pos === pos).length;
    const weakest = [...team.players]
      .filter((q) => posCount(q.pos) > 1)
      .sort((a, b) => a.ovr - b.ovr)[0];
    if (weakest) {
      const wi = team.players.indexOf(weakest);
      team.players.splice(wi, 1);
      releasePlayer(l, weakest);
      const went = weakest.ovr >= 68 && weakest.age <= 31 ? '进入自由市场' : '离开联盟';
      addNews(l, `✂️ ${team.name} 为签约让出了 ${weakest.name}（${went}）。`);
    }
  }
  addNews(l, `📝 ${p.name} 以 ${years} 年合同加盟 ${team.name}（年薪 ${money(salary)}）。`);
  sortRoster(team);
}

// ---------- 第三步：AI 补强（无人竞价的市场剩余球员按需签约，每队最多 2 人） ----------
export function simulateOffseasonAI(l: LeagueState): void {
  const rng = mulberry32(l.seed * 31 + l.season * 577 + 3);
  // 弱队先挑
  const order = [...l.teams].filter((t) => t.id !== l.userTeamId)
    .sort((a, b) => winRateOf(a) - winRateOf(b));
  for (const team of order) {
    if (l.freeAgents.length === 0) break;
    let signed = 0;
    // 0. 五位置缺口修复（独苗退役/交易后）：缺位时先签对应位置（满员则裁最弱冗余位腾位；每队至多修 2 位）
    let posFix = 0;
    while (posFix < 2) {
      const missingPos = (['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]).find((pos) => !team.players.some((q) => q.pos === pos));
      if (!missingPos) break;
      const market = [...l.freeAgents]
        .filter((q) => q.pos === missingPos && canSign(l, team, askFor(q)))
        .sort((a, b) => b.ovr - a.ovr)[0];
      if (!market) break;
      if (team.players.length >= 15) {
        const count = (p: Pos) => team.players.filter((q) => q.pos === p).length;
        const redundant = [...team.players]
          .filter((q) => count(q.pos) > 1)
          .sort((a, b) => a.ovr - b.ovr)[0];
        if (!redundant) break; // 全是独苗（异常态，交给 finish 兜底）
        const ri = team.players.indexOf(redundant);
        team.players.splice(ri, 1);
        releasePlayer(l, redundant);
      }
      const ask = askFor(market);
      if (!chargeSign(l, team, ask)) break;
      const mi = l.freeAgents.indexOf(market);
      l.freeAgents.splice(mi, 1);
      signTo(l, market, team, 1 + Math.floor(rng() * 2), ask);
      posFix++;
      signed++;
    }
    // 优先补名额缺口（先补五位置缺口，其次补可负担的头部球员）
    const needCount = Math.max(0, 15 - team.players.length);
    if (needCount > 0 && signed < 2) {
      const pool = [...l.freeAgents].sort((a, b) => b.ovr - a.ovr);
      for (let i = 0; i < needCount && signed < 2; i++) {
        const missingPos = (['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]).find((pos) => !team.players.some((q) => q.pos === pos));
        const pick = missingPos
          ? pool.find((p) => p.pos === missingPos && canSign(l, team, askFor(p)))
          : pool.find((p) => canSign(l, team, askFor(p)));
        if (!pick) break;
        if (!chargeSign(l, team, askFor(pick))) break;
        const idx = l.freeAgents.indexOf(pick);
        l.freeAgents.splice(idx, 1);
        pool.splice(pool.indexOf(pick), 1);
        signTo(l, pick, team, 1 + Math.floor(rng() * 2), askFor(pick));
        signed++;
      }
    }
    // 位置深度补强（每队至多 2 人；满员也执行——裁 1 签 1 腾位）：
    //   · 好货（中产特例/帽下空间可签）需要比队内同位置第 3 人强 ≥4；
    //   · 底薪级球员（≤MIN_SALARY）差距 ≥2 即可签来充实替补席。
    if (signed < 2) {
      const posOrder: Pos[] = ['PG', 'SG', 'SF', 'PF', 'C'];
      for (const pos of posOrder) {
        if (signed >= 2) break;
        const same = team.players.filter((q) => q.pos === pos);
        if (same.length < 3) continue; // 位置已有缺口时上面 needCount 已处理
        const thirdBest = [...same].sort((a, b) => b.ovr - a.ovr)[2];
        const market = [...l.freeAgents].filter((q) => q.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
        if (!market) continue;
        const ask = askFor(market);
        const gap = market.ovr - thirdBest.ovr;
        const goodEnough = ask > MIN_SALARY ? gap >= 4 : gap >= 2; // 底薪门槛放宽
        if (!goodEnough || !canSign(l, team, ask)) continue;
        if (!chargeSign(l, team, ask)) continue;
        // 裁掉队内该位置最弱球员腾位（去向按战力判定）
        const cut = [...same].sort((a, b) => a.ovr - b.ovr)[0];
        const ci = team.players.indexOf(cut);
        if (ci >= 0) team.players.splice(ci, 1);
        releasePlayer(l, cut);
        const idx = l.freeAgents.indexOf(market);
        l.freeAgents.splice(idx, 1);
        signTo(l, market, team, 1 + Math.floor(rng() * 3), ask);
        signed++;
      }
    }
  }
}

// ---------- 第四步：AI 交易市场（重建队清老将 ↔ 争冠队补即战力） ----------
export function simulateAIOffseasonTrades(l: LeagueState): void {
  const rng = mulberry32(l.seed * 1013 + l.season * 599 + 11);
  const isUser = (id: number) => id === l.userTeamId;
  let deals = 0;
  let attempts = 0;
  while (deals < 8 && attempts < 300) {
    attempts++;
    // 卖家池：战绩 < 42% 且持有 29+ 岁、80+ OVR 老将
    const sellers = l.teams.filter((t) =>
      !isUser(t.id) && winRateOf(t) < 0.42 &&
      t.players.some((p) => p.age >= 29 && p.ovr >= 80));
    if (!sellers.length) break;
    const seller = pick(rng, sellers);
    const stars = seller.players
      .filter((p) => p.age >= 29 && p.ovr >= 80)
      .sort((a, b) => b.ovr - a.ovr);
    const star = stars[Math.min(stars.length - 1, Math.floor(rng() * Math.min(stars.length, 3)))];
    const starV = tradeValue(star);
    // 买家池：战绩 ≥ 55%、名单对该位置有缺口（上限 17 内收人）
    const buyers = l.teams.filter((t) =>
      !isUser(t.id) && t.id !== seller.id && winRateOf(t) >= 0.55 && t.players.length <= ROSTER_MAX - 1);
    if (!buyers.length) break;
    const buyer = pick(rng, buyers);
    const same = buyer.players.filter((q) => q.pos === star.pos);
    const need = !same.length || Math.min(...same.map((q) => q.ovr)) < star.ovr - 5;
    if (!need) continue;
    // 买家筹码：年轻潜力或低 ovr 角色 + 首轮签（组合凑价，对应真实市场"球员+选秀权"资产包）
    const chips = buyer.players.filter((c) => {
      const v = tradeValue(c);
      return v <= starV * 0.8 && (c.age <= 26 || c.ovr <= star.ovr - 10) && c.id !== star.id;
    }).sort((a, b) => tradeValue(b) - tradeValue(a));
    const target = starV * (0.82 + rng() * 0.16); // 卖家愿折价出清
    const chipPids: number[] = [];
    let curVal = 0;
    for (const c of chips) {
      if (chipPids.length >= 2) break;
      if (curVal + tradeValue(c) <= target * 1.05) { chipPids.push(c.id); curVal += tradeValue(c); }
    }
    const pickIdxs: number[] = [];
    if (curVal < target * 0.85) {
      // 球员筹码不够 → 补首轮签（先给低价值签，最多 2 枚）
      const ownPicks = l.draftPool
        .map((pk, i) => ({ pk, i }))
        .filter((x) => x.pk.o === buyer.id)
        .sort((a, b) => pickValue(l, a.pk) - pickValue(l, b.pk));
      for (const { i } of ownPicks) {
        if (pickIdxs.length >= 2) break;
        const nv = curVal + pickValue(l, l.draftPool[i]);
        if (nv <= target * 1.05) { pickIdxs.push(i); curVal = nv; }
      }
    }
    if ((!chipPids.length && !pickIdxs.length) || curVal < target * 0.8) continue;
    const verdict = evaluateTrade(l, seller.id, buyer.id, [star.id], chipPids, [], pickIdxs);
    if (!verdict.accept) continue;
    const names = chipPids.map((pid) => buyer.players.find((q) => q.id === pid)?.name ?? '?');
    const pickNames = pickIdxs.map((i) => pickLabel(l, l.draftPool[i]));
    addNews(l, `🔄 交易：${buyer.name} 送出 ${[...names, ...pickNames].join('、')}，从 ${seller.name} 换来 ${star.name}。`);
    applyTrade(l, seller.id, buyer.id, [star.id], chipPids, [], pickIdxs);
    sortRoster(buyer);
    sortRoster(seller);
    deals++;
  }
  // v2.3 休赛期 AI 也会向玩家报价（上限 3 份，独立 rng 流；玩家在休赛期界面接受或拒绝）
  const offerRng = mulberry32(l.seed * 1607 + l.season * 811 + 19);
  for (let k = 0; k < 3; k++) {
    if (!tryAITradeOfferToUser(l, offerRng)) break;
  }
}

// ---------- 第五步：结束休赛期（收尾名单至 15 / 重置数据 / 新赛程） ----------
export function finishOffseason(l: LeagueState): void {
  const rng = mulberry32(l.seed + l.season * 77777 + 13);
  // v2.1 兜底：若选秀尚未完成（玩家没处理完），自动代选全部
  if (l.draft) draftComplete(l);
  // v2.0 兜底：所有球员（含用户队未手动分配的）加点由引擎自动分配完
  for (const team of l.teams) {
    for (const p of team.players) if (p.points > 0) autoDistribute(rng, p);
  }
  for (const p of l.freeAgents) if (p.points > 0) autoDistribute(rng, p);
  for (const team of l.teams) {
    // 1. 裁到 15（开季 ≤15）：优先裁"冗余位置"的最弱者，避免裁掉独苗造成位置缺口
    while (team.players.length > 15) {
      const count = (pos: Pos) => team.players.filter((q) => q.pos === pos).length;
      const redundant = [...team.players]
        .filter((p) => count(p.pos) > 1)
        .sort((a, b) => a.ovr - b.ovr)[0];
      const cut = redundant ?? [...team.players].sort((a, b) => a.ovr - b.ovr)[0];
      const wi = team.players.indexOf(cut);
      team.players.splice(wi, 1);
      releasePlayer(l, cut);
    }
    // 2. 兜底（防御）：人数 <13 或五位置缺口时补齐。
    //    · 15 人缺位：先让出最弱冗余位再补缺口（等价换血，不开 16 人名单）
    //    · <13 或缺位且人数不足 15：直接从市场补（缺位可应急生成；按底薪档签，不破坏土豪线规则）
    const pool = [...l.freeAgents].sort((a, b) => b.ovr - a.ovr);
    const fillSalary = (p: Player) => Math.min(askFor(p), MIN_SALARY);
    while (team.players.length < 13 || !hasAllPositions(team.players)) {
      const missing = (['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]).find((pos) => !team.players.some((q) => q.pos === pos));
      if (team.players.length >= 15 && missing) {
        // 满员却缺位：裁一个冗余位置最弱者腾位
        const count = (pos: Pos) => team.players.filter((q) => q.pos === pos).length;
        const redundant = [...team.players]
          .filter((q) => count(q.pos) > 1)
          .sort((a, b) => a.ovr - b.ovr)[0];
        if (!redundant) break; // 全员五个位置独苗（不可能 15 人）→ 防御跳出
        const wi = team.players.indexOf(redundant);
        team.players.splice(wi, 1);
        releasePlayer(l, redundant);
        continue;
      }
      let p: Player | undefined;
      if (missing) {
        p = pool.find((x) => x.pos === missing);
        if (!p) {
          // 市场无该位置 → 生成一名应急球员
          const created = genFreeAgent(rng, missing);
          created.id = l.playerSeq++;
          l.freeAgents.push(created);
          pool.push(created);
          p = created;
        }
      } else {
        p = pool.shift(); // 不缺位置但人数不足：补市场最高 OVR
      }
      if (!p) break;
      const idx = l.freeAgents.indexOf(p);
      if (idx >= 0) l.freeAgents.splice(idx, 1);
      signTo(l, p, team, 1, fillSalary(p));
    }
    sortRoster(team);
  }

  l.season++;
  l.year++;
  l.day = 0;
  l.champion = null;
  l.playoffRounds = [];
  l.results = [];
  l.finalsAccum = [];
  l.schedule = makeSchedule(l.teams, rng, 170);
  l.scheduleIds = l.schedule.map((g) => g.map((r) => r.awayId * 100 + r.homeId));
  for (const team of l.teams) {
    team.win = 0;
    team.loss = 0;
    for (const p of team.players) resetSeasonStats(p);
  }
  l.offseason = false;
  l.offseasonStep = 0;
  l.offseasonTradeDays = 0; // v2.5.0：新赛季开始，休赛期交易窗口关闭
  // v2.3 选秀权滚动窗口：新赛季（year 已 +1）保留未来 3 年内的签（含已交易的持有者），
  // 丢弃刚用完的那一届并补足最远年份（每队 1 首轮 + 1 次轮）
  rollPickPool(l);
  // v2.3 休赛期结束：清空 AI 报价队列（新赛季重新生成）
  l.tradeOffers = [];
}
