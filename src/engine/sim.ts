// ============ 比赛模拟：逐回合（possession）引擎 ============
// 每回合事件只写入 BoxLine；全场结束后一次性把 box 累计进球员赛季统计（防双计）。
// 产出比分 + 双方 Box Score。
import type { BoxLine, GameResult, Injury, Player, Pos, Team } from './types';
import { clamp, gauss, mulberry32, type Rng } from './rng';

// ---------- 每队深度排序辅助：按阵容内位置顺序（UI 可调）取人 ----------
export function posDepth(team: Team, pos: Pos): Player[] {
  return team.players.filter((p) => p.pos === pos);
}

// 球员在队内某位置的第几名（0 开始），不在则 -1
export function depthIndexOf(team: Team, player: Player): number {
  return posDepth(team, player.pos).indexOf(player);
}

// ---------- 轮换休息窗口表：每分钟该位置由第几深度打 ----------
// 每位置两个休息窗口（错开），窗口内由第一替补顶上（12 分钟）；首发约 36 分钟
const REST: Record<Pos, [number, number][]> = {
  PG: [[8, 14], [30, 36]],
  SG: [[9, 15], [29, 35]],
  SF: [[10, 16], [28, 34]],
  PF: [[7, 13], [31, 37]],
  C: [[11, 17], [30, 36]],
};

function restWindow(pos: Pos, minute: number): number {
  const wins = REST[pos];
  for (let w = 0; w < 2; w++) {
    if (minute >= wins[w][0] && minute < wins[w][1]) return w;
  }
  return -1;
}

// 该位置在 minute 分钟该上的球员（考虑垃圾时间）
export function playerAt(team: Team, pos: Pos, minute: number, garbage: boolean): Player {
  const list = posDepth(team, pos);
  const w = restWindow(pos, minute);
  if (w < 0) return list[0] ?? list[list.length - 1]; // 首发
  const sub = list[1] ?? list[0]; // 第一替补打全部休息时间（约 12 分钟/场）
  if (garbage && list.length > 3) {
    const g = list[3 + Math.floor(minute / 2) % Math.max(1, list.length - 3)];
    return g ?? sub;
  }
  return sub;
}

// ---------- 比赛 ----------
interface Side {
  team: Team;
  score: number;
  lines: Map<number, BoxLine>;
}

function newSide(team: Team): Side {
  const lines = new Map<number, BoxLine>();
  for (const p of team.players) {
    lines.set(p.id, {
      pid: p.id, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
      fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, or: 0, dr: 0, pm: 0,
    });
  }
  return { team, score: 0, lines };
}

function box(side: Side, p: Player): BoxLine {
  return side.lines.get(p.id)!;
}

function addScore(side: Side, pts: number): void {
  side.score += pts;
}

// 记分同时更新正负值
function scorePm(
  off: Side, def: Side, offLine: Player[], defLine: Player[], pts: number
): void {
  for (const p of offLine) box(off, p).pm += pts;
  for (const p of defLine) box(def, p).pm -= pts;
}

// ---------- 一次进攻 ----------
function possession(
  rng: Rng,
  off: Side,
  def: Side,
  offLine: Player[],
  defLine: Player[],
  secondChance: boolean,
  offEff = 0, // v1.2 球队气质：进攻侧命中率增量（正）
  defEff = 0  // v1.2 球队气质：防守侧命中率增量（负值 = 降低对手命中）
): void {
  // 持球人：组织能力 × 位置加权 × 能力权重（v2.2 前场 SF/PF/C 更多球权 + 能力球员更多球权；
  // 自定义球权权重与 PlayCall 发起人仍绝对优先）
  const posW: Record<Pos, number> = { PG: 0.9, SG: 0.85, SF: 1.0, PF: 0.95, C: 0.85 };
  // 能力球员获得更多球权（75 能力 = 1.0，90 = 1.18，60 = 0.82；clamp 0.70-1.30）
  const ability = (p: Player) => clamp(1 + (p.ovr - 75) * 0.012, 0.7, 1.3);
  const initPos = off.team.initiator;
  const usageCustom = offLine.some((p) => p.usage != null);
  const playCustom = usageCustom || initPos !== 'PG';
  const hw: number[] = offLine.map((p) => {
    let w = Math.pow(p.attrs.pas / 70, 2) * posW[p.pos] * ability(p);
    if (p.usage != null) w *= 0.35 + p.usage * 0.13; // 自定义球权权重（相对值：5 ≈ 组织默认档）
    if (playCustom) {
      if (p.pos === initPos) w *= 2.6;               // 战术发起人优先拿球
      else if (p.usage == null) w *= 0.85;           // 其余无自定义者相对让渡
    }
    return w;
  });
  const hwSum = hw.reduce((a, b) => a + b, 0);
  let r = rng() * hwSum;
  let hi = 0;
  for (let i = 0; i < offLine.length; i++) { r -= hw[i]; if (r <= 0) { hi = i; break; } }
  const handler = offLine[hi];

  // 失误判定
  const tovP = clamp(0.15 - (handler.attrs.pas - 70) * 0.002, 0.06, 0.22);
  if (rng() < tovP) {
    const hl = box(off, handler);
    hl.tov++;
    if (rng() < 0.45) {
      // 抢断：防守方防守强的球员更可能
      const dw = defLine.map((p) => Math.pow(p.attrs.def / 70, 2) + p.attrs.ath * 0.004);
      const ds = dw.reduce((a, b) => a + b, 0);
      let rr = rng() * ds; let di = 0;
      for (let i = 0; i < defLine.length; i++) { rr -= dw[i]; if (rr <= 0) { di = i; break; } }
      box(def, defLine[di]).stl++;
    }
    return;
  }

  // 出手者：持球人直接投，或传给队友（v2.2 前场接球倾向提升 + 能力加权）
  let shooter: Player;
  if (rng() < 0.35) {
    shooter = handler;
  } else {
    const others = offLine.filter((p) => p !== handler);
    const tend: Record<Pos, number> = { PG: 0.55, SG: 0.85, SF: 1.0, PF: 0.9, C: 0.8 };
    const w2 = others.map((p) => tend[p.pos] * (0.8 + p.attrs.three / 180) * ability(p));
    const s2 = w2.reduce((a, b) => a + b, 0);
    let rr = rng() * s2; let oi = 0;
    for (let i = 0; i < others.length; i++) { rr -= w2[i]; if (rr <= 0) { oi = i; break; } }
    shooter = others[oi];
  }

  // 投篮类型概率：三分 / 内线 / 中投（现代三分时代）
  const pos3: Record<Pos, number> = { PG: 0.56, SG: 0.61, SF: 0.46, PF: 0.23, C: 0.1 };
  const posIn: Record<Pos, number> = { PG: 0.12, SG: 0.13, SF: 0.28, PF: 0.6, C: 0.76 };
  let p3 = pos3[shooter.pos] + (shooter.attrs.three - 70) * 0.0035;
  if (shooter === handler) p3 *= 0.82; // 持球干拔三分更少
  p3 = clamp(p3, 0.01, 0.6);
  const pIn = clamp(posIn[shooter.pos] + (shooter.attrs.inside - 70) * 0.003, 0.05, 0.88);

  let shotType: 'three' | 'mid' | 'inside';
  {
    const r2 = rng();
    if (r2 < p3) shotType = 'three';
    else if (r2 < p3 + (1 - p3) * pIn) shotType = 'inside';
    else shotType = 'mid';
  }

  // 对位防守人（同位置），内线投篮取防守护框最强者
  const defender = shotType === 'inside'
    ? defLine.reduce((a, b) => (a.attrs.def + (a.height - 78) * 1.2 > b.attrs.def + (b.height - 78) * 1.2 ? a : b))
    : (defLine.find((p) => p.pos === shooter.pos) ?? defLine[0]);

  // 命中率：攻方属性 - 守方属性 + 类型基准
  const defAdj = (defender.attrs.def - 70) * 0.0052 + (shooter.height - defender.height > 5 ? -0.015 : 0);
  const offAdj =
    shotType === 'three' ? (shooter.attrs.three - 70) * 0.0048 :
    shotType === 'mid' ? (shooter.attrs.mid - 70) * 0.005 :
    (shooter.attrs.inside - 70) * 0.004 + (shooter.attrs.ath - 70) * 0.0015;
  const baseMake: Record<string, number> = { three: 0.33, mid: 0.49, inside: 0.62 };
  let makeP = baseMake[shotType] + offAdj - defAdj + (secondChance ? 0.08 : 0) + offEff + defEff;
  makeP = clamp(makeP, 0.03, 0.8);

  // 投篮犯规 → 罚球（不记投篮出手）
  const foulP = shotType === 'three' ? 0.06 : shotType === 'mid' ? 0.1 : 0.17;
  if (rng() < foulP) {
    const nFT = shotType === 'three' ? 3 : 2;
    const ftP = clamp(0.775 + (shooter.attrs.mid - 70) * 0.002, 0.55, 0.93);
    let made = 0;
    for (let i = 0; i < nFT; i++) if (rng() < ftP) made++;
    const sb = box(off, shooter);
    sb.fta += nFT; sb.ftm += made; sb.pts += made;
    box(def, defender).pf++;
    if (made > 0) {
      addScore(off, made);
      scorePm(off, def, offLine, defLine, made);
    }
    if (made < nFT) {
      reboundAfterMiss(rng, off, def, offLine, defLine, true, nFT - made);
    }
    return;
  }

  // 盖帽判定（近筐出手）
  const rimFactor = shotType === 'inside' ? 1 : shotType === 'mid' ? 0.2 : 0;
  const blkP = rimFactor * clamp(0.12 + (defender.attrs.def - 70) * 0.003 + (defender.height - shooter.height) * 0.012 - (shooter.attrs.ath - 70) * 0.001, 0.015, 0.3);
  if (rng() < blkP) {
    const db = box(def, defender);
    db.blk++; db.dr++; db.reb++;
    return;
  }

  const madeShot = rng() < makeP;
  const sb = box(off, shooter);
  // fga/fgm 用 NBA 口径：fgm 含三分命中
  sb.fga++;
  if (shotType === 'three') sb.tpa++;
  if (madeShot) {
    sb.fgm++;
    if (shotType === 'three') sb.tpm++;
    sb.pts += shotType === 'three' ? 3 : 2;
  }

  if (madeShot) {
    const pts = shotType === 'three' ? 3 : 2;
    addScore(off, pts);
    scorePm(off, def, offLine, defLine, pts);
    // 助攻：接球投命中记给持球人；持球人自投得分小概率记队友
    const astP =
      shooter === handler
        ? (shotType === 'three' ? 0.5 : shotType === 'mid' ? 0.3 : 0.2)
        : (shotType === 'three' ? 0.92 : shotType === 'mid' ? 0.8 : 0.6);
    if (rng() < astP) {
      if (shooter === handler) {
        const mates = offLine.filter((p) => p !== shooter);
        box(off, mates[Math.floor(rng() * mates.length)]).ast++;
      } else {
        box(off, handler).ast++;
      }
    }
  } else {
    reboundAfterMiss(rng, off, def, offLine, defLine, false, 0);
  }
}

// 投失后的篮板与二次进攻（v2.1 系数下调：进攻板概率基线 0.19→0.165、篮板差影响
// 0.0026→0.0022、球员吸附权重 2.2→1.5——高篮板球员吸附下降，篮板分布更平均、总量微降）
function reboundAfterMiss(
  rng: Rng, off: Side, def: Side, offLine: Player[], defLine: Player[],
  isFT: boolean, _ftLeft: number
): void {
  const offReb = offLine.reduce((a, p) => a + p.attrs.reb, 0) / offLine.length;
  const defReb = defLine.reduce((a, p) => a + p.attrs.reb, 0) / defLine.length;
  let orP = 0.165 + (offReb - 70) * 0.0022 - (defReb - 70) * 0.0022 + (isFT ? -0.08 : 0);
  orP = clamp(orP, 0.05, 0.30);
  if (rng() < orP) {
    const p = weightedBy(rng, offLine, (x) => Math.pow(x.attrs.reb / 70, 1.5));
    const pb = box(off, p);
    pb.or++; pb.reb++;
    if (!isFT) {
      // 二次进攻：直接补篮一次
      const makeP = clamp(0.5 + (p.attrs.inside - 70) * 0.005 + (p.attrs.ath - 70) * 0.001 - 0.05, 0.15, 0.72);
      pb.fga++;
      if (rng() < makeP) {
        pb.fgm++; pb.pts += 2;
        addScore(off, 2);
        scorePm(off, def, offLine, defLine, 2);
      } else {
        reboundAfterMiss(rng, off, def, offLine, defLine, false, 0);
      }
    }
  } else {
    const p = weightedBy(rng, defLine, (x) => Math.pow(x.attrs.reb / 70, 1.5));
    const db = box(def, p);
    db.dr++; db.reb++;
  }
}

function weightedBy(rng: Rng, list: Player[], w: (p: Player) => number): Player {
  const ws = list.map(w);
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  let r = rng() * sum;
  for (let i = 0; i < list.length; i++) {
    r -= ws[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

// ---------- v0.3.1 自定义轮换：任一球员设置了 min 即进入手动模式（全队统一按目标分钟调度） ----------
// ---------- v0.3.7 伤病系统：身体素质（耐久/体能/负荷）+ 出场时间 → 伤停概率 ----------
// 每场每名"可能出场"球员独立判定：p = 0.004 × 耐久因子 × 负荷因子 × 球权因子
function injuryRisk(p: Player, team: Team): number {
  const dur = p.body?.durability ?? 70;
  const rf = clamp((100 - dur) / 60, 0.35, 1.6);       // 耐久低 → 易伤（70 耐久 ≈ 0.5）
  const avg = targetMinutes(p, team);                   // 出场负荷（自动档 36/12/0）
  const mf = clamp(0.55 + avg / 48, 0.55, 1.6);
  const uf = 1 + (p.usage ?? 0) * 0.02;
  return 0.004 * rf * mf * uf;
}

function rollInjury(rng: Rng): Injury {
  const r = rng();
  if (r < 0.3) return { type: '轻微扭伤', games: 1 };
  if (r < 0.6) return { type: '肌肉拉伤', games: 2 + Math.floor(rng() * 4) };   // 2-5
  if (r < 0.85) return { type: '脚踝扭伤', games: 1 + Math.floor(rng() * 4) };  // 1-4
  if (r < 0.97) return { type: '膝盖酸痛', games: 3 + Math.floor(rng() * 7) };  // 3-9
  return { type: '手腕骨折', games: 15 + Math.floor(rng() * 26) };              // 15-40 大伤
}

// 赛前伤病处理：已有伤停递减（本场仍无法出场）；健康球员按概率新增伤病。
// 返回本场新发生的伤病（联赛层用于给用户球护士播报）。
function pregameInjury(team: Team, irng: Rng): { name: string; type: string; games: number; tid: number }[] {
  const out: { name: string; type: string; games: number; tid: number }[] = [];
  for (const p of team.players) {
    if (p.injury) {
      p.injury.games--;
      if (p.injury.games <= 0) { p.injury = null; continue; } // 本场复出
      continue; // 本场继续伤停
    }
    // 只对"本场可能出场"的人判定（深度 0-1 或设置了正分钟）
    const idx = posDepth(team, p.pos).indexOf(p);
    const plays = (p.min != null && p.min > 0) || (p.min == null && idx < 2);
    if (!plays) continue;
    if (irng() < injuryRisk(p, team)) {
      p.injury = rollInjury(irng);
      out.push({ name: p.name, type: p.injury.type, games: p.injury.games, tid: team.id });
    }
  }
  return out;
}

// 伤停中球员不可入选阵容（该位置自动由后续深度顶上）
function available(list: Player[]): Player[] {
  return list.filter((p) => !(p.injury && p.injury.games > 0));
}

export function manualRotation(team: Team): boolean {
  return team.players.some((p) => p.min != null);
}

// 自动档位（与 REST 引擎语义对齐）：首发约 36 分钟 / 第一替补 12 / 其余 0（垃圾时间才上）
export const AUTO_MINUTES = [36, 12, 0];

// 手动模式球员目标分钟（p.min ?? 当前轮换深度默认档）
export function targetMinutes(p: Player, team: Team): number {
  if (p.min != null) return p.min;
  const idx = posDepth(team, p.pos).indexOf(p);
  return AUTO_MINUTES[Math.min(idx, AUTO_MINUTES.length - 1)];
}

// 手动模式首发 = 位置内目标时间最高者（与调度贪心一致，保证 starts 统计吻合；伤停者除外）
export function manualStarter(team: Team, pos: Pos): Player | undefined {
  const list = available(posDepth(team, pos));
  if (!list.length) return undefined;
  let best: Player | undefined;
  let bt = -1;
  for (const p of list) {
    const t = targetMinutes(p, team);
    if (t > bt) { bt = t; best = p; }
  }
  return best;
}

// 每分钟场上阵容（lines=本场逐回合累计，unit=每回合原始计数 ≈ 分钟换算，手动模式按剩余目标贪心）
function sideLineup(team: Team, minute: number, diff: number, lines?: Map<number, BoxLine>, unit = 1): Player[] {
  const garbage = Math.abs(diff) >= 14 && minute >= 40;
  if (manualRotation(team)) {
    const out: Player[] = [];
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]) {
      const list = available(posDepth(team, pos));
      if (!list.length) continue;
      let pool = list;
      if (garbage) {
        // 垃圾时间优先上"未安排时间"的边缘人（第三阵容）
        const third = list.filter((p) => (p.min ?? 0) === 0);
        if (third.length) pool = third;
      }
      // 候选 = 有目标时间的球员；该位置无人设目标 → 整列兜底
      const active = pool.filter((p) => (p.min ?? 0) > 0);
      const cands = active.length ? active : pool;
      let best: Player | null = null;
      let bestRem = Number.NEGATIVE_INFINITY;
      // 第一轮：还欠时间（remaining>0）的人里挑最欠的
      for (const p of cands) {
        const rem = targetMinutes(p, team) * unit - (lines?.get(p.id)?.min ?? 0);
        if (rem > 0 && rem > bestRem) { bestRem = rem; best = p; }
      }
      if (!best) {
        // 全部打满（或全无目标）：挑超时最少者（主力吸收加时/剩余时间）
        for (const p of cands) {
          const rem = targetMinutes(p, team) * unit - (lines?.get(p.id)?.min ?? 0);
          if (rem > bestRem) { bestRem = rem; best = p; }
        }
      }
      out.push(best ?? list[0]);
    }
    return out;
  }
  const positions: Pos[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const out: Player[] = [];
  for (const pos of positions) {
    const list = available(posDepth(team, pos));
    let pick: Player | undefined;
    const w = restWindow(pos, minute);
    if (w < 0) pick = list[0];
    else pick = list[1] ?? list[0];
    if (garbage && list.length > 3) {
      const gIdx = 3 + (Math.floor(minute / 2) % (list.length - 3));
      pick = list[gIdx];
    }
    if (!pick && list.length) pick = list[0];
    if (pick) out.push(pick);
  }
  return out;
}

function toBoxArray(side: Side): BoxLine[] {
  return Array.from(side.lines.values());
}

// ---------- 主入口 ----------
export interface GameOutcome {
  result: GameResult;
  otCount: number;
  injuries: { name: string; type: string; games: number; tid: number }[]; // 本场新伤病
}

// v1.2 球队气质对比赛的攻防系数（命中率增量；def 为负 = 让对手更难投进）
export interface TeamMods {
  off: number;
  def: number;
}

// v1.3 羁绊：同队同风格标签 ≥2 人组成羁绊，人数越多效果越强
// （每多 1 名同标签队友 +0.12pp 进攻、+0.06pp 防守；4 人及以上按 5 人档封顶 0.48pp）
export function bondMods(team: Team): { off: number; def: number } {
  const cnt: Record<string, number> = {};
  for (const p of team.players) {
    if (!p.tags) continue;
    for (const t of p.tags) cnt[t] = (cnt[t] ?? 0) + 1;
  }
  let off = 0;
  let def = 0;
  for (const n of Object.values(cnt)) {
    if (n >= 2) {
      const k = Math.min(n - 1, 3) * 0.0012;
      off += k;
      def += k * 0.5;
    }
  }
  return { off, def };
}

// 由球队气质计算比赛加成：
// - 化学(chem)：进攻加成，季后赛 ×1.6（化学反应提升季后赛表现）
// - 纪律(disc)：防守加成，常规赛权重更高（稳定性、减少爆冷）
// - 粉丝(fans)：主场加成基线 30%（客场 10%）× 相对粉丝系数（主场的粉丝默认 +30%）
// - v1.3/v2.0 球队风格（style：youth 青年战力 / star 球星战力）+ 执教风格（coachStyle：iron 季后赛防守 / brand 主场粉丝加成提升）
// - v1.3 羁绊 bondMods（同标签 ≥2 人组队加成）
export function teamEffMods(team: Team, isHome: boolean, poff: boolean, avgFans: number): TeamMods {
  const style = team.style;
  const coach = team.coachStyle;
  const rel = clamp(team.fans / Math.max(1, avgFans), 0.5, 1.5);
  const homeBase = coach === 'brand' ? 0.36 : 0.30;              // 商业价值（执教）：主场粉丝加成 30% → 36%
  const fan = (isHome ? homeBase : 0.10) * (rel - 1) * 0.05;   // ±0.75pp（主场）/±0.25pp（客场）
  const chem = (team.chemistry - 50) * (poff ? 0.0011 : 0.0007); // ±5.5pp / ±3.5pp（满差）
  const disc = (team.discipline - 50) * (poff ? 0.0003 : 0.0007); // ±1.5pp / ±3.5pp（满差）
  const bond = bondMods(team);
  let off = fan + chem + bond.off;
  let def = -disc - bond.def;
  if (style === 'youth') {
    const young = team.players.filter((p) => p.age <= 29).length; // 青春风暴：29 岁以下战力小加成
    off += young * 0.0004;
  } else if (style === 'star') {
    const stars = team.players.filter((p) => p.ovr >= 90).length; // 球星成色：90+ 球星战力小加成
    off += stars * 0.0005;
  }
  if (coach === 'iron' && poff) {
    def -= 0.001; // 铁血手腕：季后赛防守加成
  }
  return { off, def };
}

export function simulateGame(
  awayTeam: Team,
  homeTeam: Team,
  rng: Rng,
  accumulate = true,
  injurySeed?: number,
  mods?: { away: TeamMods | null; home: TeamMods | null; poff?: boolean }
): GameOutcome {
  // v0.3.7 伤病判定使用独立 rng 流（injurySeed 由联赛层按 day/场次提供），
  // 不消耗比赛主 rng → 无伤病发生时比赛序列与旧版本完全一致（冻结基线可保）。
  const irng = mulberry32(injurySeed ?? 0x9e3779b9);
  const injuries = [
    ...pregameInjury(awayTeam, irng),
    ...pregameInjury(homeTeam, irng),
  ];

  const away = newSide(awayTeam);
  const home = newSide(homeTeam);
  // v1.2 球队气质系数（不传 mods 时 = 零加成，保持旧调用/基线行为）
  const awayMods = mods?.away ?? { off: 0, def: 0 };
  const homeMods = mods?.home ?? { off: 0, def: 0 };

  const paceAvg = (awayTeam.pace + homeTeam.pace) / 2;
  const awayT = Math.max(80, Math.round(paceAvg + gauss(rng) * 3));
  const homeT = Math.max(80, Math.round(paceAvg + gauss(rng) * 3));
  const totalSeq = awayT + homeT;
  const unit = (totalSeq * 5) / 240; // 每回合原始计数 ≈ 1 分钟（手动轮换目标换算用）
  const offFirst = rng() < 0.5;

  let seq = 0;
  let minute = 0;
  while (seq < totalSeq) {
    const isAwayOff = offFirst ? seq % 2 === 0 : seq % 2 === 1;
    const off = isAwayOff ? away : home;
    const def = isAwayOff ? home : away;
    minute = Math.min(47, Math.floor((seq * 48) / totalSeq));
    const offLine = sideLineup(off.team, minute, off.score - def.score, off.lines, unit);
    const defLine = sideLineup(def.team, minute, def.score - off.score, def.lines, unit);
    // 在场分钟累计
    for (const p of offLine) box(off, p).min++;
    for (const p of defLine) box(def, p).min++;
    possession(
      rng, off, def, offLine, defLine, false,
      (isAwayOff ? awayMods : homeMods).off,
      (isAwayOff ? homeMods : awayMods).def
    );
    seq++;
  }

  // 加时（最多 3 个；4 节常规时间平局才进入）
  let ot = 0;
  while (away.score === home.score && ot < 3) {
    ot++;
    const otTotal = Math.max(12, Math.round((paceAvg / 4.8) * 2));
    let oi = 0;
    while (oi < otTotal) {
      const isAwayOff = offFirst ? oi % 2 === 0 : oi % 2 === 1;
      const off = isAwayOff ? away : home;
      const def = isAwayOff ? home : away;
      const m = 47 + Math.floor((oi * 5) / otTotal);
      const offLine = sideLineup(off.team, m, off.score - def.score, off.lines, unit);
      const defLine = sideLineup(def.team, m, def.score - off.score, def.lines, unit);
      for (const p of offLine) box(off, p).min++;
      for (const p of defLine) box(def, p).min++;
      possession(
        rng, off, def, offLine, defLine, false,
        (isAwayOff ? awayMods : homeMods).off,
        (isAwayOff ? homeMods : awayMods).def
      );
      oi++;
    }
  }
  if (away.score === home.score) {
    if (rng() < 0.5) away.score++; else home.score++;
  }

  // 分钟换算：每队全场累计 ≈ totalSeq×5（每回合场上 5 人各 +1），折算到 240 分钟
  const scale = (240 / (totalSeq * 5)) * 1.0;
  for (const line of away.lines.values()) {
    line.min = Math.round(line.min * scale);
    // 分钟与出场数自洽：0 分钟 = DNP
  }
  for (const line of home.lines.values()) {
    line.min = Math.round(line.min * scale);
  }

  // box → 赛季累计（一次性，防双计；季后赛等非正式比赛 accumulate=false 不累计常规统计）
  if (accumulate) {
    for (const side of [away, home]) {
      // 首发：手动轮换 = 位置内目标分钟最高者；自动 = 队内各位置第 1 人
      const starterIds = new Set<number>();
      for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Pos[]) {
        const f = manualRotation(side.team) ? manualStarter(side.team, pos) : side.team.players.find((q) => q.pos === pos);
        if (f) starterIds.add(f.id);
      }
      for (const p of side.team.players) {
        const l = side.lines.get(p.id)!;
        if (l.min === 0 && l.fga === 0 && l.fta === 0 && l.pf === 0 && l.tov === 0) continue; // 未出场
        p.gp++;
        if (starterIds.has(p.id)) p.starts++;
        const s = p.stats;
        s.min += l.min; s.pts += l.pts; s.reb += l.reb; s.ast += l.ast; s.stl += l.stl;
        s.blk += l.blk; s.tov += l.tov; s.pf += l.pf; s.fgm += l.fgm; s.fga += l.fga;
        s.tpm += l.tpm; s.tpa += l.tpa; s.ftm += l.ftm; s.fta += l.fta; s.or += l.or; s.dr += l.dr;
      }
    }
  }

  const result: GameResult = {
    day: 0,
    awayId: awayTeam.id,
    homeId: homeTeam.id,
    awayScore: away.score,
    homeScore: home.score,
    awayBox: toBoxArray(away),
    homeBox: toBoxArray(home),
  };

  return { result, otCount: ot, injuries };
}
