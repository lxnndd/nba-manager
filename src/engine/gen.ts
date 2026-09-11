// ============ 核心类型 ============
import type { Attrs, BodyAttrs, DraftPick, LeagueState, PickRound, Player, Pos, Skills18, Team, TeamStyleId, GameRef } from './types';
import { SAVE_VERSION } from './types';
import { TEAMS, FIRST_NAMES, LAST_NAMES, FIRST_EN, LAST_EN, POS_ORDER } from './data';
import { REAL_FA, REAL_ROSTER, type RealPlayerInfo } from './realRoster';
import { clamp, gauss, mulberry32, pick, randInt, shuffle, type Rng } from './rng';

// ---------- 位置模板：attr 相对基准的偏移 ----------
const POS_OFFSET: Record<Pos, { [k in keyof Attrs]: number }> = {
  PG: { three: 7, mid: 5, inside: -9, ath: 2, def: -3, pas: 14, reb: -13 },
  SG: { three: 9, mid: 7, inside: -6, ath: 3, def: -2, pas: 3, reb: -8 },
  SF: { three: 3, mid: 3, inside: 1, ath: 4, def: 4, pas: 0, reb: 2 },
  PF: { three: -6, mid: -3, inside: 8, ath: 3, def: 5, pas: -6, reb: 10 },
  C: { three: -14, mid: -7, inside: 11, ath: -2, def: 8, pas: -8, reb: 14 },
};

// 展示总评的权重（与位置相关性弱化，统一权重）
const OVR_W: Record<keyof Attrs, number> = {
  three: 0.14, mid: 0.12, inside: 0.13, ath: 0.14, def: 0.17, pas: 0.14, reb: 0.16,
};

const POS_HEIGHT: Record<Pos, [number, number]> = {
  PG: [72, 77], SG: [75, 80], SF: [78, 82], PF: [81, 85], C: [83, 88],
};

// ---------- v2.0 双位置：主位置 → 默认第二位置（向"大一号/小一号"相邻位置） ----------
export const POS_SEC: Record<Pos, Pos> = {
  PG: 'SG', SG: 'SF', SF: 'PF', PF: 'C', C: 'PF',
};

// v2.0 潜力 1-10 星：由旧 0-99 潜力值换算（55→2、70→5、80→6、88→8、94+→9/10）
export function potentialToStar(raw: number): number {
  return clamp(1 + Math.round((raw - 50) / 5.5), 1, 10);
}

export function freshCareer() {
  return { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
}

// ---------- v1.4 18 项技能体系（4 组；总评 = 均值 + 长处补偿，见 calcOvr） ----------
export const SKILL_KEYS: (keyof Skills18)[] = [
  'layup', 'post', 'three', 'mid', 'ft',
  'handle', 'pass', 'vision',
  'perimeter', 'interior', 'steal', 'block', 'iq',
  'or', 'dr', 'speed', 'strength', 'vertical',
];

// 展示分组（顺序与 SKILL_KEYS 对应组）
export const SKILL_GROUPS: { title: string; keys: (keyof Skills18)[] }[] = [
  { title: '得分能力', keys: ['layup', 'post', 'three', 'mid', 'ft'] },
  { title: '组织能力', keys: ['handle', 'pass', 'vision'] },
  { title: '防守能力', keys: ['perimeter', 'interior', 'steal', 'block', 'iq'] },
  { title: '篮板与身体', keys: ['or', 'dr', 'speed', 'strength', 'vertical'] },
];

export const SKILL_LABEL: Record<keyof Skills18, string> = {
  layup: '篮下终结', post: '低位进攻', three: '三分投射', mid: '中距离', ft: '罚球',
  handle: '控球', pass: '传球', vision: '球场视野',
  perimeter: '外线防守', interior: '内线防守', steal: '抢断', block: '封盖', iq: '篮球智商',
  or: '进攻篮板', dr: '防守篮板', speed: '速度', strength: '力量', vertical: '弹跳',
};

// 技能位置模板（相对 0.9×targetOvr 的偏移；外线重投射/组织，内线重低位/篮板/力量）
export const SKILLS_OFFSET: Record<Pos, Record<keyof Skills18, number>> = {
  PG: { layup: -6, post: -14, three: 8, mid: 6, ft: 2, handle: 10, pass: 9, vision: 8, perimeter: -3, interior: -12, steal: 3, block: -12, iq: 2, or: -10, dr: -7, speed: 6, strength: -8, vertical: 2 },
  SG: { layup: -4, post: -12, three: 10, mid: 8, ft: 3, handle: 7, pass: 5, vision: 6, perimeter: 2, interior: -10, steal: 4, block: -10, iq: 2, or: -8, dr: -4, speed: 5, strength: -6, vertical: 4 },
  SF: { layup: 0, post: -6, three: 4, mid: 4, ft: 1, handle: 2, pass: 2, vision: 2, perimeter: 4, interior: 2, steal: 2, block: -2, iq: 3, or: -3, dr: 2, speed: 3, strength: 0, vertical: 5 },
  PF: { layup: 5, post: 5, three: -4, mid: -2, ft: 0, handle: -7, pass: -4, vision: -3, perimeter: -4, interior: 7, steal: -3, block: 5, iq: 4, or: 6, dr: 8, speed: 0, strength: 8, vertical: 4 },
  C: { layup: 8, post: 10, three: -12, mid: -8, ft: -1, handle: -12, pass: -7, vision: -6, perimeter: -10, interior: 10, steal: -6, block: 9, iq: 4, or: 8, dr: 11, speed: -6, strength: 12, vertical: 2 },
};

// v1.4 总评 = 全 18 项均值 + 长处补偿（top3 平均抬升 + 顶级属性≥90 额外加分）
// 依据用户的 2K 截图样本（均值 62.8 → 官方 82 等）设计：越长处越补，避免被短板直线拉平。
export function calcOvr(s: Skills18): number {
  const vals = SKILL_KEYS.map((k) => s[k]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sorted = vals.slice().sort((a, b) => b - a);
  const top3 = (sorted[0] + sorted[1] + sorted[2]) / 3;
  const top1 = sorted[0];
  return clamp(Math.round(avg + (top3 - avg) * 0.55 + Math.max(0, top1 - 90) * 0.15), 40, 99);
}

// 线性校准用（不含 top1≥90 的非线性项）：均值 + 0.55×长处差
function calcLin(s: Skills18): number {
  const vals = SKILL_KEYS.map((k) => s[k]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sorted = vals.slice().sort((a, b) => b - a);
  const top3 = (sorted[0] + sorted[1] + sorted[2]) / 3;
  return avg + (top3 - avg) * 0.55;
}

// 虚构球员技能生成：模板 + 噪声 → 线性缩放使「均值+补偿」≈ targetOvr（2K 式分布：属性均值低于总评）
export function genSkills(rng: Rng, pos: Pos, targetOvr: number): Skills18 {
  const off = SKILLS_OFFSET[pos];
  const raw = {} as Skills18;
  for (const k of SKILL_KEYS) raw[k] = targetOvr * 0.9 + off[k] + gauss(rng) * 6;
  const k = targetOvr / Math.max(20, calcLin(raw));
  const out = {} as Skills18;
  for (const key of SKILL_KEYS) out[key] = clamp(Math.round(raw[key] * k), 30, 99);
  return out;
}

// 18 项 → 引擎七维（sim.ts 比赛口径；虚构球员用；真实名单用 rp.r 原值不改动）
export function attrsFromSkills(s: Skills18): Attrs {
  const mk = (v: number) => clamp(Math.round(v), 25, 99);
  return {
    three: mk(s.three),
    mid: mk(s.mid),
    inside: mk(s.layup * 0.6 + s.post * 0.4),
    ath: mk(s.speed * 0.35 + s.vertical * 0.3 + s.strength * 0.2 + s.handle * 0.15),
    def: mk(s.perimeter * 0.3 + s.interior * 0.3 + s.steal * 0.15 + s.block * 0.15 + s.iq * 0.1),
    pas: mk(s.handle * 0.35 + s.pass * 0.35 + s.vision * 0.3),
    reb: mk(s.or * 0.35 + s.dr * 0.65),
  };
}

// 七维+身体 → 18 项（旧档迁移/虚构兜底派生）
export function deriveSkills(p: { attrs: Attrs; body: BodyAttrs }): Skills18 {
  const a = p.attrs, b = p.body;
  const mk = (v: number) => clamp(Math.round(v), 25, 99);
  return {
    layup: mk(a.inside * 0.6 + b.vertical * 0.25 + b.strength * 0.15),
    post: mk(a.inside * 0.65 + b.strength * 0.35),
    three: a.three,
    mid: a.mid,
    ft: mk(a.mid * 0.6 + a.three * 0.4),
    handle: mk(a.pas * 0.7 + b.agility * 0.3),
    pass: a.pas,
    vision: mk(a.pas * 0.8 + a.reb * 0.2),
    perimeter: mk(a.def * 0.6 + a.ath * 0.4),
    interior: mk(a.def * 0.75 + b.strength * 0.25),
    steal: mk(a.def * 0.8 + b.agility * 0.2),
    block: mk(a.def * 0.6 + b.vertical * 0.4),
    iq: mk(a.def * 0.8 + a.pas * 0.2),
    or: mk(a.reb * 0.7 + b.vertical * 0.3),
    dr: a.reb,
    speed: b.speed,
    strength: b.strength,
    vertical: b.vertical,
  };
}

// 真实名单：转换器输出的 18 项数组 → Skills18
export function fromRealSkills(s: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]): Skills18 {
  const out = {} as Skills18;
  SKILL_KEYS.forEach((k, i) => { out[k] = s[i]; });
  return out;
}

// ---------- v0.3.7 身体属性（虚构球员）：位置模板 + 年龄修正 ----------
const BODY_OFFSET: Record<Pos, BodyAttrs> = {
  PG: { strength: -9, speed: 10, stamina: 2, vertical: 2, agility: 10, durability: 0, hustle: 2 },
  SG: { strength: -6, speed: 9, stamina: 2, vertical: 5, agility: 8, durability: 0, hustle: 2 },
  SF: { strength: 0, speed: 5, stamina: 1, vertical: 6, agility: 4, durability: 0, hustle: 3 },
  PF: { strength: 7, speed: 0, stamina: 1, vertical: 6, agility: 0, durability: 1, hustle: 2 },
  C: { strength: 12, speed: -8, stamina: 0, vertical: 4, agility: -6, durability: 2, hustle: 1 },
};

export function genBody(rng: Rng, pos: Pos, age: number, ovr: number): BodyAttrs {
  const off = BODY_OFFSET[pos];
  // 老化：速度/敏捷/弹跳随年龄下滑；力量/耐久 30+ 后也小幅衰减
  const pen = Math.max(0, age - 29) * 1.6;
  const mk = (k: keyof BodyAttrs, extra: number) =>
    clamp(Math.round(ovr + off[k] + gauss(rng) * 6 - extra), 25, 99);
  return {
    strength: mk('strength', age > 31 ? (age - 31) * 0.8 : 0),
    speed: mk('speed', pen),
    stamina: mk('stamina', age > 33 ? (age - 33) * 0.6 : 0),
    vertical: mk('vertical', pen),
    agility: mk('agility', pen),
    durability: mk('durability', age > 34 ? (age - 34) * 0.7 : 0),
    hustle: mk('hustle', 0),
  };
}

// v2.0：展示层身高一律用 cm（引擎内部仍按英寸存，sim 身高项用）
export function heightLabel(inches: number): string {
  return `${Math.round(inches * 2.54)}cm`;
}

// ---------- v2.3.0 体测数据（体重 / 臂展）----------
// 真实球员由 2K 数据直接给出（weight: "235 lbs" / wingspan: "8'0\""）；
// 虚构球员与新秀按身高 + 位置推定。
export function weightFor(rng: Rng, pos: Pos, height: number, age: number): number {
  const off = BODY_OFFSET[pos].strength;
  const base = 160 + (height - 70) * 6 + off * 0.9 - (age <= 22 ? 8 : 0); // 年轻球员偏轻
  return clamp(Math.round(base + gauss(rng) * 7), 150, 330);
}

export function wingspanFor(rng: Rng, pos: Pos, height: number): number {
  const bonus = pos === 'C' || pos === 'PF' ? 2.2 : pos === 'SF' ? 1.8 : 1.2;
  return clamp(Math.round(height + bonus + gauss(rng) * 1.5), height, height + 8);
}

// 展示层：体重 → kg、臂展 → cm
export function weightLabel(lbs: number): string {
  return `${Math.round(lbs * 0.4536)}kg`;
}
export function wingspanLabel(inches: number): string {
  return `${Math.round(inches * 2.54)}cm`;
}
// 英制写法（鼠标悬浮提示用）：235 lbs / 8'0"
export function lbsLabel(lbs: number): string {
  return `${lbs} lbs`;
}
export function feetLabel(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

// 旧存档补体测数据（确定性、幂等：不消耗 rng）
export function ensureMeasure(p: Player): void {
  if (p.weight != null && p.wingspan != null) return;
  const rng = mulberry32((p.id + 1) * 7919 + p.height * 131 + p.age * 17 + p.pos.charCodeAt(0) * 31 + 3);
  if (p.weight == null) p.weight = weightFor(rng, p.pos, p.height, p.age);
  if (p.wingspan == null) p.wingspan = wingspanFor(rng, p.pos, p.height);
}

// ---------- v2.3.0 下一届选秀预测名单（80 人）----------
// 开档即生成，常规赛/休赛期随时可查看（身高/体重/臂展/年龄/潜力）；
// 休赛期选秀时直接作为本届新秀池消耗，随后重新生成下一届。
export function makeNextDraftClass(seed: number, seq: { v: number }): Player[] {
  const rng = mulberry32(seed * 5501 + 11); // 独立 rng 流：不扰动建档主随机序
  const list = genDraftClass(rng);
  for (const r of list) r.id = seq.v++;
  return list;
}

export function attrKeys(): (keyof Attrs)[] {
  return ['three', 'mid', 'inside', 'ath', 'def', 'pas', 'reb'];
}

export function computeOvr(attrs: Attrs): number {
  let s = 0;
  for (const k of attrKeys()) s += attrs[k] * OVR_W[k];
  return Math.round(s);
}

// ---------- 薪资表（万美元/年，按 OVR 分段） ----------
// v0.3.1 重新刻度（两轮压缩）：对齐真实 NBA 薪资量级——联盟最强 15 人工资单 ≈ 2.1-2.4 亿
// （少数豪强可超 2 亿第二土豪线受限制），普通队 1.5-1.9 亿、摆烂队 ~1.2 亿；
// 使 1.54 亿工资帽 / 1.87 亿税线 / 2 亿硬顶线成为有效约束。
export function salaryFor(ovr: number): number {
  if (ovr >= 93) return 4200;
  if (ovr >= 90) return 3400;
  if (ovr >= 87) return 2700;
  if (ovr >= 84) return 2100;
  if (ovr >= 81) return 1500;
  if (ovr >= 78) return 1050;
  if (ovr >= 75) return 700;
  if (ovr >= 72) return 480;
  if (ovr >= 69) return 320;
  if (ovr >= 66) return 240;
  if (ovr >= 63) return 170;
  return 110;
}

// v0.2/v0.3 存档中的旧刻度表（migrate 时用于识别"名单标准合同"并换算到新刻度）
const OLD_SALARY_FOR = (ovr: number): number => {
  if (ovr >= 93) return 5100;
  if (ovr >= 90) return 4500;
  if (ovr >= 87) return 3700;
  if (ovr >= 84) return 2900;
  if (ovr >= 81) return 2200;
  if (ovr >= 78) return 1500;
  if (ovr >= 75) return 1000;
  if (ovr >= 72) return 680;
  if (ovr >= 69) return 460;
  if (ovr >= 66) return 320;
  if (ovr >= 63) return 210;
  return 130;
};

// 存档迁移：把旧刻度"标准合同"（salary === 旧表值）换算成新刻度（签约/交易产生的不规则金额不动）
export function resalaryIfLegacy(p: { ovr: number; salary: number }): void {
  if (p.salary > 0 && p.salary === OLD_SALARY_FOR(p.ovr)) p.salary = salaryFor(p.ovr);
}

export function formatSalary(w: number): string {
  return (w / 100).toFixed(1) + '千万';
}

// ---------- 生成单个球员 ----------
let usedNames = new Set<string>();

export function genPlayer(
  rng: Rng, pos: Pos, targetOvr: number, age?: number, young?: boolean, idSeq?: { v: number }
): Player {
  // 名字（防重；中文姓名池组合）
  let name = '';
  for (let t = 0; t < 40; t++) {
    const cand = pick(rng, FIRST_NAMES) + pick(rng, LAST_NAMES);
    if (!usedNames.has(cand)) { usedNames.add(cand); name = cand; break; }
  }
  if (!name) name = pick(rng, FIRST_NAMES) + pick(rng, LAST_NAMES) + '二世';

  // v1.4 技能制：生成 18 项（均值≈target×0.9 + 长处补偿）→ 总评 = calcOvr ≈ target；
  // 引擎七维 attrs 由技能聚合（sim.ts 比赛口径与真实名单同一套映射逻辑）
  const skills = genSkills(rng, pos, targetOvr);
  const ovr = calcOvr(skills);
  const attrs = attrsFromSkills(skills);

  const a = age ?? (young ? randInt(rng, 19, 22) : randInt(rng, 20, 34));
  const [hMin, hMax] = POS_HEIGHT[pos];
  const potRaw = ovr + randInt(rng, -4, 12); // 0-99 语义（映射到 1-10 星）
  // v2.3.0：body/height 提前到 return 之前只为拿到身高算体重/臂展——rng 消耗顺序与原实现完全一致，
  // 而体重/臂展走独立确定性流（不扰动主随机序，冻结基线不受影响）。
  const body = genBody(rng, pos, a, ovr);
  const height = randInt(rng, hMin, hMax);
  const mRng = mulberry32(height * 7919 + a * 131 + pos.charCodeAt(0) * 31 + 7);
  const weight = weightFor(mRng, pos, height, a);
  const wingspan = wingspanFor(mRng, pos, height);
  return {
    id: idSeq ? idSeq.v++ : 0,
    name, pos, secPos: POS_SEC[pos], age: a, ovr, attrs, skills,
    body,
    height,
    weight,
    wingspan,
    salary: salaryFor(ovr) * (young ? 0.85 : 1),
    contractYears: randInt(rng, 1, 4),
    potential: potentialToStar(potRaw),
    exp: young || a <= 21 ? 1 : clamp(a - 18, 1, 20), // 20-21 岁视为一年级，其余按年龄近似
    starts: 0,
    min: null,
    usage: null,
    injury: null,
    basePos: pos,
    baseAttrs: { ...attrs },
    baseOvr: ovr,
    baseSkills: { ...skills },
    grow: Math.round((0.6 + rng() * 1.2) * 100) / 100, // v1.2 随机成长率 0.6-1.8
    tags: assignTags({ ovr, attrs }), // v1.3 风格标签（羁绊）
    points: 0,
    career: freshCareer(),
    nation: '美国',
    gp: 0,
    stats: { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, or: 0, dr: 0 },
  };
}

function freshStats(): Player['stats'] {
  return { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, or: 0, dr: 0 };
}

// ---------- 生成一队 15 人 ----------
export function genTeamRoster(rng: Rng, teamId: number, strength: number, idSeq: { v: number }): Player[] {
  const players: Player[] = [];
  // 头牌与二当家（随机位置）
  const starPos = pick(rng, POS_ORDER);
  const star2Pos = pick(rng, POS_ORDER.filter((p) => p !== starPos));
  const starOvr = clamp(Math.round(88 + strength * 5 + gauss(rng) * 3), 82, 97);
  const star2Ovr = clamp(Math.round(81 + strength * 4 + gauss(rng) * 3), 76, 93);

  for (const pos of POS_ORDER) {
    for (let depth = 0; depth < 3; depth++) {
      let target: number;
      if (pos === starPos && depth === 0) target = starOvr;
      else if (pos === star2Pos && depth === 0) target = star2Ovr;
      else if (depth === 0) target = Math.round(70 + strength * 3 + gauss(rng) * 4); // 首发（无星位）
      else if (depth === 1) target = Math.round(64 + strength * 2 + gauss(rng) * 4); // 主要轮换
      else target = Math.round(57 + strength * 1.5 + gauss(rng) * 4); // 边缘
      target = clamp(target, 50, 97);
      players.push(genPlayer(rng, pos, target, undefined, false, idSeq));
    }
  }
  void teamId;
  return players;
}

// ---------- 生成整个联赛 ----------
export function createLeague(seed: number): LeagueState {
  const rng = mulberry32(seed);
  usedNames = new Set();
  usedEnNames.clear();
  const idSeq = { v: 1 };
  const strengths = shuffle(rng, Array.from({ length: TEAMS.length }, () => gauss(rng) * 0.9));

  const teams: Team[] = TEAMS.map((info, i) => {
    const players = genTeamRoster(rng, i, strengths[i], idSeq);
    return {
      id: i,
      name: info.name,
      city: info.city,
      en: info.en,
      abbr: info.abbr,
      conf: info.conf,
      players,
      win: 0,
      loss: 0,
      pace: randInt(rng, 93, 104),
      initiator: 'PG',
      chemistry: randInt(rng, 45, 55),
      discipline: randInt(rng, 45, 55),
      brand: randInt(rng, 45, 55),
      fans: randInt(rng, 80, 140),
      // v1.3 AI 队同样拥有球队风格（独立 rng 流：不消耗主随机流，保持 v1.2 建档复现/冻结基线）
      style: pick(mulberry32(seed + 131 + i * 17), STYLE_IDS),
      // v2.0 执教风格独立随机（不同 rng 流，不消耗主随机流）
      coachStyle: pick(mulberry32(seed + 251 + i * 19), COACH_STYLE_IDS),
    };
  });

  return finishLeague(rng, teams, idSeq, seed, 2025, 'fictional');
}

// ---------- v2.3 选秀权池：每队每年 1 首轮 + 1 次轮，交易市场开放未来 3 年（滚动窗口） ----------
export const PICK_YEARS = 3;
export function freshPickPool(baseYear: number, teamCount: number): DraftPick[] {
  const out: DraftPick[] = [];
  for (let k = 1; k <= PICK_YEARS; k++) {
    for (const round of [1, 2] as PickRound[]) {
      for (let i = 0; i < teamCount; i++) out.push({ o: i, f: i, year: baseYear + k, round });
    }
  }
  return out;
}

// 滚动窗口：保留 [year+1, year+3] 内已有签（含已交易的持有者），补足缺失的年份/轮次，丢弃过期签。幂等。
export function rollPickPool(l: LeagueState): void {
  const from = l.year + 1;
  const to = l.year + PICK_YEARS;
  const keep = l.draftPool.filter((pk) => pk.year >= from && pk.year <= to);
  for (let y = from; y <= to; y++) {
    for (const round of [1, 2] as PickRound[]) {
      for (let i = 0; i < l.teams.length; i++) {
        if (!keep.some((pk) => pk.year === y && pk.round === round && pk.f === i)) {
          keep.push({ o: i, f: i, year: y, round });
        }
      }
    }
  }
  keep.sort((a, b) => a.year - b.year || a.round - b.round || a.f - b.f);
  l.draftPool = keep;
}

// ---------- 联赛公共收尾：赛程 + LeagueState ----------
// v0.3.3：新档第一赛季即开放自由市场——建档时就把初始市场铺好
//（真实名单 = 2K Free Agency 115 人；虚构 = 60 人随机池；休赛期另有保池逻辑）。
function finishLeague(rng: Rng, teams: Team[], idSeq: { v: number }, seed: number, year: number, mode: 'real' | 'fictional'): LeagueState {
  const schedule = makeSchedule(teams, rng, 170);
  const freeAgents: Player[] = [];
  if (mode === 'real') {
    for (const rp of REAL_FA) freeAgents.push(realFaPlayer(idSeq.v++, rp));
  } else {
    for (let i = 0; i < 60; i++) {
      const fa = genFreeAgent(rng);
      fa.id = idSeq.v++; // id 由联赛统一分配
      freeAgents.push(fa);
    }
  }
  // v2.3.0 下一届新秀预测名单（开档即可查看；先分配 id，playerSeq 随后取最新值）
  const nextDraftClass = makeNextDraftClass(seed, idSeq);
  return {
    version: SAVE_VERSION,
    seed,
    season: 1,
    year,
    day: 0,
    totalDays: 170,
    schedule,
    scheduleIds: schedule.map((g) => g.map((r) => r.awayId * 100 + r.homeId)),
    teams,
    playoffRounds: [],
    champion: null,
    results: [],
    userTeamId: -1,
    playerSeq: idSeq.v,
    history: [],
    mode,
    cultureId: null,
    offseason: false,
    offseasonStep: 0,
    midUsed: teams.map(() => false),
    freeAgents,
    awards: null,
    news: [],
    finalsAccum: [],
    draftPool: freshPickPool(year, teams.length), // v2.3：未来 3 年 × 首轮/次轮（180 枚）
    // v2.0 自由市场 7 天窗口 + 季后赛淘汰弹窗标记 + 待处理事件
    faDay: 1,
    faOffers: [],
    poffExitShown: false,
    pendingEvents: [],
    // v2.1 选秀大会（休赛期开启时才生成）
    draft: null,
    // v2.3 AI 主动报价队列
    tradeOffers: [],
    // v2.3.0 下一届新秀预测名单（80 人）
    nextDraftClass,
  };
}

// 位置序排序（与 league.ts sortRoster 同语义：位置序 + OVR 降序 = 轮换深度序）
function sortPlayersByDepth(players: Player[]): void {
  const orderMap: Record<Pos, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  players.sort((a, b) => orderMap[a.pos] - orderMap[b.pos] || b.ovr - a.ovr || a.id - b.id);
}

// ---------- 真实名单联赛：2K27 现役评分（2026-27 赛季阵容，见 realRoster.ts） ----------
function fromRealBody(b: [number, number, number, number, number, number, number]): BodyAttrs {
  return { strength: b[0], speed: b[1], stamina: b[2], vertical: b[3], agility: b[4], durability: b[5], hustle: b[6] };
}

// v2.3.0 体测数据：2K 源有 weight/wingspan 就直接用，缺失时按身高位置确定性推定
function measOf(rp: RealPlayerInfo): { weight: number; wingspan: number } {
  if (rp.wt && rp.ws) return { weight: rp.wt, wingspan: rp.ws };
  const rng = mulberry32(rp.h * 7919 + rp.a * 131 + rp.p.charCodeAt(0) * 31 + 5);
  return { weight: weightFor(rng, rp.p, rp.h, rp.a), wingspan: wingspanFor(rng, rp.p, rp.h) };
}

export function createRealLeague(seed: number): LeagueState {
  const rng = mulberry32(seed);
  usedNames = new Set();
  usedEnNames.clear();
  const idSeq = { v: 1 };
  const teams: Team[] = TEAMS.map((info, i) => {
    const real = REAL_ROSTER[i];
    if (real.t !== info.abbr) throw new Error(`realRoster 与 TEAMS 顺序不一致: ${real.t} vs ${info.abbr}`);
    const players: Player[] = real.players.map((rp) => ({
      id: idSeq.v++,
      name: rp.n,
      pos: rp.p,
      secPos: rp.q ?? POS_SEC[rp.p], // v2.3：用数据源给的第二位置（旧版按 POS_SEC 机械推导 → 卡鲁索曾变成 SF/PF）
      age: rp.a,
      ovr: rp.o,
      attrs: {
        three: rp.r[0], mid: rp.r[1], inside: rp.r[2],
        ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6],
      },
      skills: fromRealSkills(rp.s),
      body: fromRealBody(rp.b),
      height: rp.h,
      ...measOf(rp),
      salary: salaryFor(rp.o),
      contractYears: rp.c,
      potential: potentialToStar(rp.v),
      exp: rp.e,
      starts: 0,
      min: null,
      usage: null,
      injury: null,
      face: rp.f,
      basePos: rp.p,
      baseAttrs: {
        three: rp.r[0], mid: rp.r[1], inside: rp.r[2],
        ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6],
      },
      baseOvr: rp.o,
      baseSkills: fromRealSkills(rp.s),
      grow: growOfReal(rp),
      tags: assignTags({ ovr: rp.o, attrs: { three: rp.r[0], mid: rp.r[1], inside: rp.r[2], ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6] } }),
      points: 0,
      career: freshCareer(),
      nation: '美国',
      gp: 0,
      stats: freshStats(),
    }));
    return {
      id: i, name: info.name, city: info.city, en: info.en, abbr: info.abbr, conf: info.conf,
      players, win: 0, loss: 0, pace: randInt(rng, 93, 104), initiator: 'PG',
      chemistry: randInt(rng, 45, 55),
      discipline: randInt(rng, 45, 55),
      brand: randInt(rng, 45, 55),
      fans: randInt(rng, 80, 140),
      // v1.3 AI 队同样拥有球队风格（独立 rng 流：不消耗主随机流，保持 v1.2 建档复现/冻结基线）
      style: pick(mulberry32(seed + 131 + i * 17), STYLE_IDS),
      // v2.0 执教风格独立随机（不同 rng 流，不消耗主随机流）
      coachStyle: pick(mulberry32(seed + 251 + i * 19), COACH_STYLE_IDS),
    };
  });

  // 数据源个别队不足 15 人 → 补低顺位虚构新秀
  for (const t of teams) {
    if (t.players.length < 15) {
      while (t.players.length < 15) {
        t.players.push(genPlayer(rng, POS_ORDER[t.players.length % 5], randInt(rng, 58, 68), randInt(rng, 19, 23), true, idSeq));
      }
      sortPlayersByDepth(t.players);
    }
  }
  return finishLeague(rng, teams, idSeq, seed, 2026, 'real');
}

// ---------- 赛程：每队 82 场 = 同分区 4×4 + 同半区异分区(6队×4+4队×3) + 异半区 15×2 ----------
// 异分区"4 场对"用确定性旋转构造：每队从相邻分区组取 3 队、相隔分区组取 3 队，共 6 个升级对。
export function makeSchedule(teams: Team[], rng: Rng, totalDays: number): GameRef[][] {
  const n = teams.length;
  const matchups: { awayId: number; homeId: number }[] = [];

  const addSeries = (a: number, b: number, games: number) => {
    // 主客场尽量对半（奇数场轮换主客）
    let homeA = Math.floor(games / 2) + (games % 2 ? (rng() < 0.5 ? 1 : 0) : 0);
    for (let g = 0; g < games; g++) {
      if (homeA > 0) { matchups.push({ awayId: b, homeId: a }); homeA--; }
      else matchups.push({ awayId: a, homeId: b });
    }
  };

  const confPos = (id: number) => (id >= 15 ? id - 15 : id);
  const isUpgraded = (i: number, j: number): boolean => {
    // 同半区异分区：6 个对手打 4 场
    const pi = confPos(i), pj = confPos(j);
    const di = Math.floor(pi / 5), dj = Math.floor(pj / 5);
    if (di === dj) return true; // 同分区（由调用方保证异分区才调用，这里兜底）
    const k = Math.abs(dj - di) === 1 ? (pj - pi + 100) % 5 : (pi - pj + 100) % 5;
    return k <= 2;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const eastWest = i < 15 && j < 15;
      const westWest = i >= 15 && j >= 15;
      if (!eastWest && !westWest) {
        addSeries(i, j, 2); // 异半区 2 场
      } else {
        const di = Math.floor(confPos(i) / 5);
        const dj = Math.floor(confPos(j) / 5);
        if (di === dj) addSeries(i, j, 4); // 同分区 4 场
        else addSeries(i, j, isUpgraded(i, j) ? 4 : 3); // 同半区异分区
      }
    }
  }

  // 每队 82 场校验（构造应恰好 82，仅断言）
  const count: number[] = new Array(n).fill(0);
  for (const m of matchups) { count[m.awayId]++; count[m.homeId]++; }
  for (let i = 0; i < n; i++) {
    if (count[i] !== 82) console.warn('[schedule] 队', teams[i].abbr, '场次', count[i]);
  }

  // 分配到比赛日：随机放置，冲突则重试
  const busy: Set<number>[] = teams.map(() => new Set());
  const days: GameRef[][] = Array.from({ length: totalDays + 1 }, () => []);
  for (const m of shuffle(rng, matchups)) {
    let placed = false;
    for (let t = 0; t < 40 && !placed; t++) {
      const d = 1 + Math.floor(rng() * totalDays);
      if (!busy[m.awayId].has(d) && !busy[m.homeId].has(d)) {
        busy[m.awayId].add(d); busy[m.homeId].add(d);
        days[d].push(m);
        placed = true;
      }
    }
    if (!placed) {
      for (let d = 1; d <= totalDays && !placed; d++) {
        if (!busy[m.awayId].has(d) && !busy[m.homeId].has(d)) {
          busy[m.awayId].add(d); busy[m.homeId].add(d);
          days[d].push(m);
          placed = true;
        }
      }
    }
  }
  return days.slice(1);
}

// ---------- 新秀池（休赛期补人用） ----------
export function genRookie(rng: Rng, tier: number, idSeq: { v: number }): Player {
  // tier 0 = 状元级别（强），越大越弱。
  // v1.2 新秀压制：ovr 上限 80（<85），潜力 ≤88（让新秀 1-2 个赛季内拿奖变困难）。
  // v1.4 总评=均值+长处补偿（比 target 高 0-2）：target 上限压 77 保证 ovr≤80。
  const pos = pick(rng, POS_ORDER);
  const target = clamp(Math.round(76 - tier * 4 + gauss(rng) * 6), 55, 77);
  const p = genPlayer(rng, pos, target, undefined, true, idSeq);
  p.contractYears = 4;
  // v2.0：潜力 1-10 星（≈旧 60-88 值域映射 3-8 星，最高 8 星不给满）
  p.potential = potentialToStar(clamp(p.ovr + randInt(rng, 4, 12), 60, 88));
  return p;
}

// ---------- v2.0 选秀大会：每届 80 人（v2.1：美 70% 英文名 / 中 5% 中文名 / 其他 25% 英文名） ----------
// 保证恰好 1 名总评 ≥80（**不锁定状元**，由 rng 决定在哪一顺位），其余一律 <80；
// 返回按生成顺序（≈即战力顺位）的 80 人池（id 由调用方统一分配）。
const OTHER_NATIONS = ['欧洲', '南美', '非洲', '澳洲', '亚洲'];
const usedEnNames = new Set<string>(); // 英文名防重（模块级，选秀/补员共用）

export function makeEnName(rng: Rng): string {
  for (let t = 0; t < 40; t++) {
    const cand = pick(rng, FIRST_EN) + ' ' + pick(rng, LAST_EN);
    if (!usedEnNames.has(cand)) { usedEnNames.add(cand); return cand; }
  }
  return pick(rng, FIRST_EN) + ' ' + pick(rng, LAST_EN) + ' Jr.';
}

export function genDraftClass(rng: Rng): Player[] {
  const class80: Player[] = [];
  for (let i = 0; i < 80; i++) {
    // tier：前 30 位近似首轮（0-9 档次），后 50 位次轮档
    const tier = Math.floor(i / 3);
    const p = genRookie(rng, Math.min(tier, 22), { v: -1 }); // id 由调用方重新分配
    p.id = -1;
    // 国籍分布：i<56 美国 / 56-60 中国 / 60-80 其他均分（用 rng 保持确定性复现）
    p.nation = i < 56 ? '美国' : i < 60 ? '中国' : pick(rng, OTHER_NATIONS);
    // v2.1 名字与国籍匹配：美国/其他用英文名，中国用中文名（genPlayer 已生成中文名，需要替换）
    if (p.nation !== '中国') p.name = makeEnName(rng);
    // 压回 <80（保持"其余都低于 80"；≥80 的幸运儿稍后随机指定）
    if (p.ovr >= 80) p.ovr = 79;
    class80.push(p);
  }
  // v2.1：保证恰好 1 名总评 ≥80，但"未必是状元"——随机选一名新秀给 +3（80-83）
  // v2.3.0：天骄从"高实力区间"里选（此前 80 人完全等概率，会出现 OVR 80 却只有 3 星潜力的怪状元），
  //         命中后潜力至少 7 星，让新秀榜的头部球员名副其实
  const hotPool = class80.map((p, i) => ({ p, i })).filter((x) => x.p.ovr >= 72);
  const lucky = hotPool.length
    ? hotPool[Math.floor(rng() * hotPool.length)].i
    : Math.floor(rng() * 80);
  class80[lucky].ovr = clamp(class80[lucky].ovr + 3, 80, 83);
  class80[lucky].potential = Math.max(class80[lucky].potential, 7);
  return class80;
}

export function resetSeasonStats(p: Player): void {
  p.gp = 0;
  p.starts = 0;
  p.stats = freshStats();
}

// ---------- 自由球员 ----------
// 虚构自由球员（v2.1：能力均匀随机 55-80；可指定位置兜底）。id 由调用方统一分配。
export function genFreeAgent(rng: Rng, pos?: Pos): Player {
  const target = randInt(rng, 55, 80); // 55-80 均匀分布（修复"池子里全是 55"）
  const age = randInt(rng, 19, 35);
  const p = genPlayer(rng, pos ?? pick(rng, POS_ORDER), target, age, false, undefined);
  p.salary = 0;
  p.contractYears = 0;
  p.exp = clamp(age - 18, 1, 20);
  if (age <= 23) p.potential = clamp(p.ovr + randInt(rng, 5, 16), 60, 99);
  else if (age >= 32) p.potential = Math.min(p.potential, p.ovr);
  return p;
}

// 真实名单自由球员条目（REAL_FA）→ Player（自由身：salary=0 / contractYears=0）
export function realFaPlayer(id: number, rp: RealPlayerInfo): Player {
  return {
    id,
    name: rp.n,
    pos: rp.p,
    secPos: rp.q ?? POS_SEC[rp.p], // v2.3：数据源第二位置优先
    age: rp.a,
    ovr: rp.o,
    attrs: {
      three: rp.r[0], mid: rp.r[1], inside: rp.r[2],
      ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6],
    },
    skills: fromRealSkills(rp.s),
    body: fromRealBody(rp.b),
    height: rp.h,
    ...measOf(rp),
    salary: 0,
    contractYears: 0,
    potential: potentialToStar(rp.v),
    exp: rp.e,
    starts: 0,
    min: null,
    usage: null,
    injury: null,
    face: rp.f,
    basePos: rp.p,
    baseAttrs: {
      three: rp.r[0], mid: rp.r[1], inside: rp.r[2],
      ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6],
    },
    baseOvr: rp.o,
    baseSkills: fromRealSkills(rp.s),
    grow: growOfReal(rp),
    tags: assignTags({ ovr: rp.o, attrs: { three: rp.r[0], mid: rp.r[1], inside: rp.r[2], ath: rp.r[3], def: rp.r[4], pas: rp.r[5], reb: rp.r[6] } }),
    points: 0,
    career: freshCareer(),
    nation: '美国',
    gp: 0,
    stats: freshStats(),
  };
}

// 真实球员成长率：由评分/年龄/经验确定性散列（0.6-1.79），不消耗 rng（保持建档复现）
function growOfReal(rp: RealPlayerInfo): number {
  return Math.round((0.6 + ((rp.o * 13 + rp.a * 7 + rp.e * 3) % 120) / 100) * 100) / 100;
}

// ---------- v0.3.7 位置调整：拖拽换位后能力值随位置适配 ----------
// 位置适配轮廓（相对基准 1.0）：外线吃三分/组织，内线吃篮板/内线终结/防守
const POS_PROFILE: Record<Pos, { [k in keyof Attrs]: number }> = {
  PG: { three: 1.00, mid: 0.97, inside: 0.72, ath: 0.96, def: 0.92, pas: 1.12, reb: 0.70 },
  SG: { three: 1.02, mid: 1.00, inside: 0.80, ath: 0.97, def: 0.95, pas: 0.98, reb: 0.80 },
  SF: { three: 0.97, mid: 0.97, inside: 0.92, ath: 1.00, def: 1.00, pas: 0.92, reb: 0.95 },
  PF: { three: 0.88, mid: 0.92, inside: 1.02, ath: 0.97, def: 1.02, pas: 0.85, reb: 1.08 },
  C: { three: 0.78, mid: 0.85, inside: 1.08, ath: 0.90, def: 1.05, pas: 0.78, reb: 1.16 },
};

// 按新位置适配（v1.1 基准制，幂等）：attrs 从球员的「生成基准」（baseAttrs/basePos）
// 按位置轮廓比例重新计算，而非在当前值上反复乘除——换回去精确还原，多换几次数值不再漂移。
//（保留 2K overall 量级，避免直接 computeOvr 把 90+ 球星压回 ~70）
function adaptToPos(p: Player, newPos: Pos): void {
  const oldPos = p.pos;
  if (oldPos === newPos) return;
  const base = p.baseAttrs ?? p.attrs; // 旧档迁移前兜底（migrate 会补 baseAttrs）
  const basePos = p.basePos ?? oldPos;
  const baseOvr = p.baseOvr ?? p.ovr;
  const pb = POS_PROFILE[basePos];
  const pn = POS_PROFILE[newPos];
  const attrs = {} as Attrs;
  let wBase = 0;
  let wNew = 0;
  for (const k of attrKeys()) {
    const ratio = pn[k] / pb[k];
    attrs[k] = clamp(Math.round(base[k] * ratio), 25, 99);
    wBase += base[k] * OVR_W[k];
    wNew += attrs[k] * OVR_W[k];
  }
  p.attrs = attrs;
  p.pos = newPos;
  if (wBase > 0) p.ovr = clamp(Math.round(baseOvr * (wNew / wBase)), 40, 99);
}

// 换位（v2.0 双位置语义）：每个球员只有两个位置（主 pos + 副 secPos），
// 拖拽只能在两列间切换——把目标位置设为主位置，原主位置变副位置（主副互换）。
// 位置人数不限制（可以 5 名控卫同队）；不与其他球员交换（v2.0 需求：自由分配每个人位置）。
// 能力值按新位置轮廓适配（基准制，幂等）。
export function repositionPlayer(team: Team, pid: number, newPos: Pos): { moved: Player; swapped: Player | null } {
  const p = team.players.find((q) => q.id === pid);
  if (!p) throw new Error(`repositionPlayer: 未找到球员 ${pid}`);
  if (p.pos === newPos) return { moved: p, swapped: null };
  // v2.0：只能拖到该球员的 {主,副} 位置（UI 也只高亮这两列）
  if (p.secPos !== newPos) {
    throw new Error(`${p.name} 只能打 ${p.pos}/${p.secPos} 两个位置，不能改打 ${newPos}`);
  }
  const old = p.pos;
  adaptToPos(p, newPos); // attrs/ovr 按新位置适配
  p.secPos = old;        // 主副互换
  sortPlayersByDepth(team.players);
  return { moved: p, swapped: null };
}

// ---------- v1.3 球员风格标签（羁绊体系） ----------
// 标签按球员属性特征自动判定（ovr≥80 取 1 个、≥90 取 2 个）：
// 同队同标签 ≥2 人即组成羁绊，人数越多比赛加成越强（见 sim.ts bondMod）。
// 属性已按引擎刻度压缩（three 顶 ~78、mid/inside 顶 ~86、ath/def/pas/reb 顶 ~90），阈值随之适配。
const TAG_CANDIDATES: [keyof Attrs, number, string][] = [
  ['three', 74, '三分神射'],
  ['mid', 76, '中投大师'],
  ['inside', 76, '内线终结者'],
  ['ath', 77, '运动狂人'],
  ['def', 77, '防守铁闸'],
  ['pas', 76, '组织核心'],
  ['reb', 76, '篮板悍将'],
];

export function assignTags(p: { ovr: number; attrs: Attrs }): string[] {
  if (p.ovr < 80) return [];
  const n = p.ovr >= 90 ? 2 : 1;
  const hits = TAG_CANDIDATES
    .filter(([k, t]) => p.attrs[k] >= t)
    .sort((a, b) => p.attrs[b[0]] - p.attrs[a[0]]);
  const tags = hits.slice(0, n).map(([, , name]) => name);
  if (tags.length < n) {
    // 兜底：80+ 必有至少 1 个标签（取最高属性对应项，≥70 才给；否则全能战士）
    const top = (Object.keys(p.attrs) as (keyof Attrs)[])
      .sort((a, b) => p.attrs[b] - p.attrs[a])[0];
    const cand = TAG_CANDIDATES.find(([k]) => k === top);
    if (cand && p.attrs[top] >= 70) tags.push(cand[2]);
    else tags.push('全能战士');
  }
  return [...new Set(tags)].slice(0, n);
}

export function bodyKeys(): (keyof BodyAttrs)[] {
  return ['strength', 'speed', 'stamina', 'vertical', 'agility', 'durability', 'hustle'];
}

// ---------- v1.3 球队风格（v2.0 拆分：球队风格二选一 + 执教风格三选一；每季归零重选） ----------
export interface StyleOption {
  id: TeamStyleId;
  name: string;
  icon: string;
  desc: string;
}

// 球队风格（二选一）：青春风暴 / 球星成色
export const TEAM_STYLES: StyleOption[] = [
  { id: 'youth', name: '青春风暴', icon: '🌪️', desc: '25 岁以下成长加快 · 29 岁以下战力小加成' },
  { id: 'star', name: '球星成色', icon: '💎', desc: '90+ 球星衰退减缓 · 签约球星更有吸引力' },
];

// 执教风格（三选一）：铁血手腕 / 更衣室气氛 / 商业价值
export const COACH_STYLES: StyleOption[] = [
  { id: 'iron', name: '铁血手腕', icon: '⛓️', desc: '球队纪律上升 · 季后赛防守加成' },
  { id: 'locker', name: '更衣室气氛', icon: '🤝', desc: '化学反应上升 · 每场赛后士气小幅提升' },
  { id: 'brand', name: '商业价值', icon: '📈', desc: '球迷增长 · 主场粉丝加成提升' },
];

export const STYLE_IDS: TeamStyleId[] = TEAM_STYLES.map((s) => s.id);
export const COACH_STYLE_IDS: TeamStyleId[] = COACH_STYLES.map((s) => s.id);

// 应用球队风格（用户队，二选一）：写入 style/cultureId
export function applyTeamStyle(l: LeagueState, style: 'youth' | 'star' | null): void {
  const t = l.teams[l.userTeamId];
  if (!t) return;
  t.style = style;
  l.cultureId = style; // 冗余字段与 Team.style 同步（旧档/UI 兼容）
}

// 应用执教风格（用户队，三选一）：写入 coachStyle + 静态加成（重选时覆盖，防重复叠加）
export function applyCoachStyle(l: LeagueState, coach: 'iron' | 'locker' | 'brand' | null): void {
  const t = l.teams[l.userTeamId];
  if (!t) return;
  t.coachStyle = coach;
  if (coach === 'iron') t.discipline = clamp(50 + 8, 0, 100);       // 铁血手腕：纪律上升
  else if (coach === 'locker') t.chemistry = clamp(50 + 8, 0, 100); // 更衣室：化学反应上升
  else if (coach === 'brand') t.fans = Math.min(600, Math.max(t.fans, 100 + 40)); // 商业价值：球迷增长
}
