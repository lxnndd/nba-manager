// ============ 赛季奖项评选（v0.3；v2.0 一防二防 + FMVP 移出常规奖） ============
// 常规赛奖项：MVP / DPOY / 最佳第六人 / 最佳新秀 + All-NBA 一阵二阵三阵 + 新秀一阵二阵
//             + All-Defense 一阵二阵（v2.0）。
// 评选只依赖常规赛累计数据，全部确定性无随机。
// v2.0：FMVP 移出常规奖（只在冠军界面显示），由 computeFinalsMVP 用 finalsAccum 独立计算。
// 颁奖时机：常规赛结束（季后赛开始前）即评出常规赛奖项，时效不依赖季后赛。
import type { AwardEntry, FinalsLine, LeagueState, Player, Pos, SeasonAwards, Team } from './types';
import { playoffChampion } from './league';

const BACKCOURT: Pos[] = ['PG', 'SG'];
const FRONTCOURT: Pos[] = ['SF', 'PF', 'C'];

// 场均数据
function perG(p: Player) {
  const g = Math.max(1, p.gp);
  const s = p.stats;
  return {
    g, min: s.min / g, pts: s.pts / g, reb: (s.or + s.dr) / g, ast: s.ast / g,
    stl: s.stl / g, blk: s.blk / g, tov: s.tov / g,
  };
}

// 综合贡献线（场均）
export function lineScore(p: Player): number {
  const d = perG(p);
  return d.pts + d.ast * 1.5 + d.reb + d.stl * 2.2 + d.blk * 2.2 - d.tov * 1.4;
}

function winRate(t: Team): number {
  return t.win / Math.max(1, t.win + t.loss);
}

// 战绩因子：0.8 ~ 1.24（胜率 0→0.8，1→1.35）
function winFactor(t: Team): number {
  return 0.8 + winRate(t) * 0.55;
}

interface Cand {
  p: Player;
  team: Team;
}

// 综合票分（MVP 尺度）：贡献线 × 战绩 × 出勤 + 能力背书
function rankScore(c: Cand): number {
  return lineScore(c.p) * winFactor(c.team) * Math.min(1, c.p.gp / 70) + c.p.ovr * 0.25;
}

function entryOf(c: Cand): AwardEntry {
  return { playerId: c.p.id, teamId: c.team.id };
}

export function computeSeasonAwards(l: LeagueState): void {
  // v2.0：常规赛奖项不依赖季后赛 → 一旦评出即幂等返回（FMVP 另行计算，不再刷新）
  if (l.awards && l.awards.season === l.season) return;

  const cands: Cand[] = [];
  for (const team of l.teams) {
    for (const p of team.players) {
      if (p.gp > 0 && p.exp > 0) cands.push({ p, team });
    }
  }
  const a: SeasonAwards = {
    season: l.season,
    mvp: null, dpoy: null, sixth: null, rookie: null,
    allNba: [[], [], []],
    allRookie: [[], []],
    allDefense: [[], []],
  };

  const gpMin = (n: number) => cands.filter((c) => c.p.gp >= n);
  const g65 = gpMin(65); // MVP / All-NBA 出勤门槛（参考真实 65 场规则）

  // ---- MVP：贡献线 × 战绩因子 × 出勤 ----
  const mvpList = [...g65].sort((x, y) => rankScore(y) - rankScore(x));
  if (mvpList.length) a.mvp = entryOf(mvpList[0]);

  // ---- DPOY：防守属性 + 抢断盖帽产量 + 防守篮板 + 护框身高 + 战绩 ----
  const dpoyScore = (c: Cand) =>
    c.p.attrs.def * 0.55 + (c.p.stats.stl + c.p.stats.blk) / Math.max(1, c.p.gp) * 2.8
    + perG(c.p).reb * 0.25 + Math.max(0, c.p.height - 78) * 0.3 + winFactor(c.team) * 2;
  const dpoyList = gpMin(60).sort((x, y) => dpoyScore(y) - dpoyScore(x));
  if (dpoyList.length) a.dpoy = entryOf(dpoyList[0]);

  // ---- All-NBA：后场 2 + 前场 3 × 3 阵（65 场门槛） ----
  const bySide = (side: Pos[]) => {
    const list = g65.filter((c) => side.includes(c.p.pos)).sort((x, y) => rankScore(y) - rankScore(x));
    return list;
  };
  const bcAll = bySide(BACKCOURT);
  const fcAll = bySide(FRONTCOURT);
  for (let t = 0; t < 3; t++) {
    a.allNba[t] = [
      ...bcAll.slice(t * 2, t * 2 + 2),
      ...fcAll.slice(t * 3, t * 3 + 3),
    ].map(entryOf);
  }

  // ---- 最佳第六人：替补（首发场次 < 一半）为主力贡献 ----
  const sixthList = gpMin(50).filter((c) => c.p.starts >= 0 && c.p.starts < c.p.gp / 2)
    .sort((x, y) => lineScore(y.p) * Math.min(1, y.p.gp / 60) - lineScore(x.p) * Math.min(1, x.p.gp / 60));
  if (sixthList.length) a.sixth = entryOf(sixthList[0]);

  // ---- 最佳新秀（exp===1） ----
  const rookies = cands.filter((c) => c.p.exp === 1 && c.p.gp >= 40);
  const rotScore = (c: Cand) => lineScore(c.p) + c.p.ovr * 0.15;
  const rotList = [...rookies].sort((x, y) => rotScore(y) - rotScore(x));
  if (rotList.length) a.rookie = entryOf(rotList[0]);

  // ---- 新秀一阵二阵：后场 2 + 前场 3 × 2 阵 ----
  // v2.5.0：门槛放宽到 20 场，且某一阵某侧人数不足时**按总分补齐到 5 人**
  //   （此前前场/后场新秀不够会出现"二阵只有 4 个人"）
  const rkPool = cands.filter((c) => c.p.exp === 1 && c.p.gp >= 20);
  const rkSide = (side: Pos[]) =>
    rkPool.filter((c) => side.includes(c.p.pos)).sort((x, y) => rotScore(y) - rotScore(x));
  const rkAll = [...rkPool].sort((x, y) => rotScore(y) - rotScore(x));
  const rkUsed = new Set<number>();
  const takeRk = (pool: Cand[], n: number): AwardEntry[] => {
    const out: AwardEntry[] = [];
    for (const c of pool) {
      if (out.length >= n) break;
      if (!rkUsed.has(c.p.id)) { out.push(entryOf(c)); rkUsed.add(c.p.id); }
    }
    return out;
  };
  const rkBc = rkSide(BACKCOURT);
  const rkFc = rkSide(FRONTCOURT);
  for (let t = 0; t < 2; t++) {
    const picked = [
      ...takeRk(rkBc.slice(t * 2), 2),
      ...takeRk(rkFc.slice(t * 3), 3),
    ];
    if (picked.length < 5) picked.push(...takeRk(rkAll, 5 - picked.length)); // 补齐
    a.allRookie[t] = picked;
  }

  // ---- v2.0 All-Defense 一阵二阵：后场 2 + 前场 3 × 2 阵（按 DPOY 尺度，60 场门槛） ----
  // v2.5.0：同样在人数不足时按防守分补齐到 5 人
  const defPool = gpMin(60);
  const defSide = (side: Pos[]) =>
    defPool.filter((c) => side.includes(c.p.pos)).sort((x, y) => dpoyScore(y) - dpoyScore(x));
  const dAll = [...defPool].sort((x, y) => dpoyScore(y) - dpoyScore(x));
  const dUsed = new Set<number>();
  const takeDef = (pool: Cand[], n: number): AwardEntry[] => {
    const out: AwardEntry[] = [];
    for (const c of pool) {
      if (out.length >= n) break;
      if (!dUsed.has(c.p.id)) { out.push(entryOf(c)); dUsed.add(c.p.id); }
    }
    return out;
  };
  const dBC = defSide(BACKCOURT);
  const dFC = defSide(FRONTCOURT);
  for (let t = 0; t < 2; t++) {
    const picked = [
      ...takeDef(dBC.slice(t * 2), 2),
      ...takeDef(dFC.slice(t * 3), 3),
    ];
    if (picked.length < 5) picked.push(...takeDef(dAll, 5 - picked.length));
    a.allDefense[t] = picked;
  }

  l.awards = a;
}

// ---------- v2.0 总决赛 MVP（独立于常规奖）：冠军球队总决赛累计战报（finalsAccum）贡献线最高 ----------
export function computeFinalsMVP(l: LeagueState): AwardEntry | null {
  const champ = playoffChampion(l);
  if (champ == null) return null;
  const lines = l.finalsAccum.filter((x) => x.tid === champ);
  if (!lines.length) return null;
  const byPid = new Map<number, FinalsLine[]>();
  for (const fl of lines) {
    const arr = byPid.get(fl.pid);
    if (arr) arr.push(fl);
    else byPid.set(fl.pid, [fl]);
  }
  let best: { pid: number; score: number } | null = null;
  for (const [pid, arr] of byPid) {
    if (!arr.length) continue;
    const tot = arr.reduce(
      (s, x) => s + (x.pts + x.ast * 1.5 + x.reb + x.stl * 2.2 + x.blk * 2.2 - x.tov * 1.4), 0);
    const score = tot / arr.length;
    if (!best || score > best.score) best = { pid, score };
  }
  if (!best) return null;
  const team = l.teams[champ];
  const p = team.players.find((q) => q.id === best!.pid);
  return p ? { playerId: p.id, teamId: champ } : null;
}
