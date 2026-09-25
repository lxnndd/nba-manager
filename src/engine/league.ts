// ============ 联赛逻辑：赛季推进 / 排名 / 季后赛 / 球员估值 / 交易 ============
// （休赛期流程见 offseason.ts，奖项评选见 awards.ts）
import type { AiTradeOffer, Attrs, BodyAttrs, BoxLine, DraftPick, FinalsLine, GameResult, LeagueState, Player, Pos, Skills18, Team, TeamStyleId } from './types';
import { SAVE_VERSION } from './types';
import { simulateGame, teamEffMods } from './sim';
import { rollPostGameEvent } from './events';
import { salaryFor, resalaryIfLegacy, genFreeAgent, realFaPlayer, genBody, assignTags, deriveSkills, fromRealSkills, potentialToStar, POS_SEC, freshCareer, freshPickPool, rollPickPool, genDraftClass, ensureMeasure, freshStatLine, valueOvr } from './gen';
import { REAL_FA, REAL_ROSTER, ZH_NAME_MAP, type RealPlayerInfo } from './realRoster';
import { enNameToZh } from './data';
import { clamp, mulberry32, type Rng } from './rng';

export interface DayReport {
  day: number;
  games: GameResult[];
  userGame?: GameResult; // 用户球队当天比赛（含 box）
}

// ---------- 常规赛推进 ----------
export function simDay(l: LeagueState): DayReport | null {
  if (l.day >= l.totalDays) return null;
  const day = l.day + 1;
  const refs = l.schedule[day - 1];
  if (!refs || refs.length === 0) {
    // v0.3.3：无赛日（赛程空洞）也照常推进比赛日——否则"快进到某天"会被空天卡死，
    // 表现为按钮点了没反应、界面永远停在同一天
    l.day = day;
    return { day, games: [] };
  }
  // v0.3.4 防重复保险丝：该比赛日的比赛已全部存在于 results（存档被旧版本/
  // 多进程交替写盘污染时会出现"同一天反复模拟"）→ 直接跳过，绝不重打同一天
  let cnt = 0;
  for (const g of l.results) if (g.day === day) cnt++;
  if (cnt >= refs.length) {
    l.day = day;
    return { day, games: [] };
  }
  const rng = mulberry32(l.seed + day * 7919);
  const games: GameResult[] = [];
  let userGame: GameResult | undefined;
  // v1.2 球队气质（攻防系数）：粉丝相对联赛均值定主场加成
  const avgFans = l.teams.reduce((a, t) => a + t.fans, 0) / Math.max(1, l.teams.length);
  for (let gi = 0; gi < refs.length; gi++) {
    const ref = refs[gi];
    const away = l.teams[ref.awayId];
    const home = l.teams[ref.homeId];
    // v0.3.7：伤病判定用独立 rng 流（不扰动比赛主随机序）
    const { result, injuries } = simulateGame(
      away, home, rng, true, l.seed * 31 + day * 97 + gi * 13,
      { away: teamEffMods(away, false, false, avgFans), home: teamEffMods(home, true, false, avgFans), poff: false }
    );
    result.day = day;
    if (result.awayScore > result.homeScore) { away.win++; home.loss++; }
    else { home.win++; away.loss++; }
    if (l.userTeamId === ref.awayId || l.userTeamId === ref.homeId) {
      for (const inj of injuries) {
        if (inj.tid === l.userTeamId) {
          l.news.push(`🏥 ${inj.name} ${inj.type}，预计伤停 ${inj.games} 场${inj.games >= 15 ? '（大伤！）' : ''}`);
        }
      }
      // v1.2 赛后随机事件（球队气质 ±点数；独立 rng 流）
      rollPostGameEvent(l, result.homeScore > result.awayScore
        ? (ref.homeId === l.userTeamId)
        : (ref.awayId === l.userTeamId), day, gi);
      // v1.3 更衣室气氛（v2.0 执教风格）：每场比赛后士气（化学反应）小幅度提升
      if (l.teams[l.userTeamId].coachStyle === 'locker') {
        l.teams[l.userTeamId].chemistry = Math.min(100, l.teams[l.userTeamId].chemistry + 0.15);
      }
    }
    // 仅保留用户球队场次的 box（控制存档体积）
    if (ref.awayId === l.userTeamId || ref.homeId === l.userTeamId) {
      userGame = { ...result, awayBox: result.awayBox, homeBox: result.homeBox };
    } else {
      result.awayBox = undefined;
      result.homeBox = undefined;
    }
    games.push(result);
  }
  l.results.push(...games);
  l.day = day;
  // v2.0 交易截止日前 AI 也会交易（每 13 天尝试一笔；消息进球队动态）
  if (day % 13 === 0 && day < TRADE_DEADLINE_DAY && l.playoffRounds.length === 0 && l.day < l.totalDays) {
    tryAISeasonTrade(l, rng);
  }
  // v2.3 AI 也会主动向你报价（每 9 天一次机会，最多 3 份待处理）。
  // 用独立 rng 流：不消耗比赛主随机序，冻结基线不受影响。
  if (day % 9 === 0 && day <= TRADE_DEADLINE_DAY && l.playoffRounds.length === 0 && l.day < l.totalDays) {
    tryAITradeOfferToUser(l, mulberry32(l.seed * 1301 + day * 17 + 5));
  }
  return { day, games, userGame };
}

// ---------- 排名 ----------
export interface StandingRow {
  team: Team;
  rank: number;
  gamesBehind: number;
}

export function standings(l: LeagueState): { east: StandingRow[]; west: StandingRow[] } {
  const build = (conf: 'EAST' | 'WEST') => {
    const list = l.teams.filter((t) => t.conf === conf);
    const sorted = [...list].sort((a, b) => {
      const ra = a.win / Math.max(1, a.win + a.loss);
      const rb = b.win / Math.max(1, b.win + b.loss);
      return rb - ra || (b.win - b.loss) - (a.win - a.loss) || a.abbr.localeCompare(b.abbr);
    });
    const leader = sorted[0];
    return sorted.map((t, i) => {
      // 场差 = ((领先者胜-负) - (本队胜-负)) / 2：整数或 .5（不可能有 0.1/0.3 这类小数）
      const gb = leader ? ((leader.win - leader.loss) - (t.win - t.loss)) / 2 : 0;
      return { team: t, rank: i + 1, gamesBehind: gb };
    });
  };
  return { east: build('EAST'), west: build('WEST') };
}

// ---------- 数据榜 ----------
export interface LeaderRow {
  player: Player;
  teamAbbr: string;
  value: number;
}

export function leaders(l: LeagueState, stat: string, minGp = 15, playoff = false, limit = Infinity): LeaderRow[] {
  const rows: LeaderRow[] = [];
  for (const t of l.teams) {
    for (const p of t.players) {
      // v2.5.0：季后赛榜单用独立统计（poGp/poStats）
      const gp = playoff ? (p.poGp ?? 0) : p.gp;
      if (gp < minGp) continue;
      const s = playoff ? (p.poStats ?? p.stats) : p.stats;
      const g = Math.max(1, gp);
      let value = 0;
      switch (stat) {
        case 'pts': value = s.pts / g; break;
        case 'reb': value = (s.or + s.dr) / g; break;
        case 'ast': value = s.ast / g; break;
        case 'stl': value = s.stl / g; break;
        case 'blk': value = s.blk / g; break;
        case 'tpm': value = s.tpm / g; break;
        case 'effic':
          value = (s.pts + (s.or + s.dr) * 1.2 + s.ast * 1.6 + s.stl * 2.5 + s.blk * 2.5 - s.tov * 1.5 - (s.fga - s.fgm) - (s.fta - s.ftm) * 0.5) / g;
          break;
        default: value = 0;
      }
      rows.push({ player: p, teamAbbr: t.abbr, value });
    }
  }
  rows.sort((a, b) => b.value - a.value);
  // v2.6.3：默认返回**全部**上榜球员（用户要求"数据榜要能看到所有人"，此前写死 slice(0, 20)）；
  //   需要限量时显式传 limit。minGp 门槛保留（场均数据需要最少出场样本）。
  return Number.isFinite(limit) ? rows.slice(0, limit) : rows;
}

// 场均数组
export function perGame(p: Player): { [k: string]: number } {
  const g = Math.max(1, p.gp);
  const s = p.stats;
  return {
    min: s.min / g,
    pts: s.pts / g,
    reb: (s.or + s.dr) / g,
    ast: s.ast / g,
    stl: s.stl / g,
    blk: s.blk / g,
    tov: s.tov / g,
    fg: (s.fgm / Math.max(1, s.fga)) * 100,
    tp: (s.tpm / Math.max(1, s.tpa)) * 100,
    ft: (s.ftm / Math.max(1, s.fta)) * 100,
  };
}

// ---------- 季后赛 ----------
// 轮次模型：0=第一轮(8系列) → 1=半决赛(4) → 2=分区决赛(2) → 3=总决赛(1)
function mkSeries(l: LeagueState, aId: number, bId: number, label: string) {
  const ta = l.teams[aId];
  const tb = l.teams[bId];
  // 常规赛胜率高者为高种子，拥有主场优势（作为 home 方）
  const ra = ta.win / Math.max(1, ta.win + ta.loss);
  const rb = tb.win / Math.max(1, tb.win + tb.loss);
  const homeId = ra >= rb ? ta.id : tb.id;
  const awayId = homeId === ta.id ? tb.id : ta.id;
  return { awayId, homeId, awayWins: 0, homeWins: 0, games: [] as GameResult[] };
}

// v2.1 占位友好建系列：-1 = 该对阵方尚未确定（提前展示下一轮时允许半成品槽位）
function mkSeriesL(l: LeagueState, aId: number, bId: number, label: string) {
    if (aId < 0 && bId < 0) return { awayId: -1, homeId: -1, awayWins: 0, homeWins: 0, games: [] as GameResult[] };
  if (aId < 0 || bId < 0) {
    const known = aId >= 0 ? aId : bId;
    return { awayId: known, homeId: -1, awayWins: 0, homeWins: 0, games: [] as GameResult[] };
  }
  return mkSeries(l, aId, bId, label);
}

function winnerOf(s: { awayId: number; homeId: number; awayWins: number; homeWins: number }): number {
  if (s.awayWins >= 4) return s.awayId;
  if (s.homeWins >= 4) return s.homeId;
  return -1; // 未定
}

// v2.1 提前晋级：把下一轮槽位里的 -1 用已出现的晋级者填充（本轮部分完成即可看到下一轮对阵）。
// 只处理占位/半成品槽（未开打 series），绝不覆盖已开打的系列。
export function refreshPlayoffPlaceholders(l: LeagueState): void {
  for (let r = 1; r < l.playoffRounds.length; r++) {
    const prev = l.playoffRounds[r - 1];
    const round = l.playoffRounds[r];
    if (!prev || !round) continue;
    for (let i = 0; i < round.series.length; i++) {
      const s = round.series[i];
      if (s.games.length > 0) continue; // 已开打：不动
      const wa = prev.series[i * 2] ? winnerOf(prev.series[i * 2]) : -1;
      const wb = prev.series[i * 2 + 1] ? winnerOf(prev.series[i * 2 + 1]) : -1;
      if (wa >= 0 && wb >= 0) {
        // 双方都定 → 正式建系列（覆盖占位/半成品/未开打的空系列）
        round.series[i] = mkSeries(l, wa, wb, round.label);
      } else if (wa >= 0) {
        if (s.awayId < 0 && s.homeId < 0) { s.awayId = wa; s.homeId = -1; }
      } else if (wb >= 0) {
        if (s.awayId < 0 && s.homeId < 0) { s.awayId = wb; s.homeId = -1; }
      }
    }
  }
}

export function runPlayoffRound(l: LeagueState, roundIdx: number): { done: boolean } {
  if (l.playoffRounds.length < roundIdx) return { done: false };
  if (roundIdx === 0) {
    const ent = (conf: 'EAST' | 'WEST') => {
      const s = standings(l);
      const list = (conf === 'EAST' ? s.east : s.west).slice(0, 8).map((r) => r.team);
      // 1v8 4v5 2v7 3v6
      const pairs: [Team, Team][] = [];
      const order = [0, 7, 3, 4, 1, 6, 2, 5];
      for (let i = 0; i < 8; i += 2) {
        pairs.push([list[order[i]], list[order[i + 1]]]);
      }
      return pairs;
    };
    const mk = (pairs: [Team, Team][]) => pairs.map(([a, b]) => mkSeries(l, a.id, b.id, '第一轮'));
    l.playoffRounds = [
      { label: '第一轮', series: [...mk(ent('EAST')), ...mk(ent('WEST'))] },
    ];
    return { done: false };
  }

  const prev = l.playoffRounds[roundIdx - 1];
  if (!prev) return { done: false };
  // v2.1 上一轮胜者（未完成的系列 → -1 占位，下一轮可先展示"已晋级 vs 待定"）
  const winners = prev.series.map((s) => winnerOf(s));
  const label = roundIdx === 3 ? '总决赛' : roundIdx === 2 ? '分区决赛' : '半决赛';
  let series;
  if (roundIdx === 3) {
    // 东/西两半区胜者（半决赛后 winners: [东1, 东2, 西1, 西2] → 分区决赛胜者 [东冠, 西冠]）
    const east = winners[0];
    const west = winners[1];
    series = [mkSeriesL(l, east, west, label)];
  } else {
    const half = Math.pow(2, 4 - roundIdx); // 2: 半决赛从4个分区系列对 → 每侧2对
    const mkConf = (offset: number) => {
      const out = [];
      const side = winners.slice(offset, offset + half);
      for (let i = 0; i < side.length; i += 2) {
        out.push(mkSeriesL(l, side[i], side[i + 1], label));
      }
      return out;
    };
    series = [...mkConf(0), ...mkConf(half)];
  }
  l.playoffRounds.push({ label, series });
  refreshPlayoffPlaceholders(l);
  return { done: false };
}

// 模拟季后赛一场（按轮 index 与系列 index），返回 game result（user 队场次含 box）
export function simPlayoffGame(l: LeagueState, roundIdx: number, seriesIdx: number): GameResult | null {
  const round = l.playoffRounds[roundIdx];
  if (!round) return null;
  const series = round.series[seriesIdx];
  if (!series) return null;
  // v2.1 占位槽（对手未定）：不模拟
  if (series.awayId < 0 || series.homeId < 0) return null;
  if (series.awayWins >= 4 || series.homeWins >= 4) return null;
  const rng = mulberry32(l.seed * 101 + l.season * 10007 + roundIdx * 977 + seriesIdx * 131 + series.games.length);
  // 季后赛不累计常规统计（否则球员 gp 会超 82）；总决赛 FMVP 依据另由 finalsAccum 单独累计
  const injSeed = l.seed * 37 + l.season * 991 + roundIdx * 71 + seriesIdx * 17 + series.games.length;
  // v1.2 季后赛气质系数：化学反应权重提升（化学反应 → 季后赛表现）
  const avgFans = l.teams.reduce((a, t) => a + t.fans, 0) / Math.max(1, l.teams.length);
  const { result, injuries } = simulateGame(
    l.teams[series.awayId], l.teams[series.homeId], rng, 'playoff', injSeed,
    {
      away: teamEffMods(l.teams[series.awayId], false, true, avgFans),
      home: teamEffMods(l.teams[series.homeId], true, true, avgFans),
      poff: true,
    }
  );
  if (series.awayId === l.userTeamId || series.homeId === l.userTeamId) {
    for (const inj of injuries) {
      if (inj.tid === l.userTeamId) {
        l.news.push(`🏥 ${inj.name} ${inj.type}，预计伤停 ${inj.games} 场${inj.games >= 15 ? '（大伤！）' : ''}`);
      }
    }
  }
  // 赢家按结果判定（v0.1 无主场优势加成，主客仅影响显示）
  const winnerId = result.homeScore > result.awayScore ? series.homeId : series.awayId;
  if (winnerId === series.homeId) series.homeWins++;
  else series.awayWins++;
  // 总决赛：把每场双方全量战报累计进 finalsAccum（FMVP 依据），与用户场次保留策略无关
  if (roundIdx === 3) {
    const acc = (tid: number, box?: BoxLine[]) => {
      if (!box) return;
      for (const b of box) l.finalsAccum.push({ ...b, tid } as FinalsLine);
    };
    acc(series.awayId, result.awayBox);
    acc(series.homeId, result.homeBox);
  }
  const involvesUser = series.awayId === l.userTeamId || series.homeId === l.userTeamId;
  if (involvesUser) {
    // v1.3 更衣室气氛（v2.0 执教风格）：每场比赛（含季后赛）后士气（化学反应）小幅度提升
    const me = l.teams[l.userTeamId];
    if (me.coachStyle === 'locker') me.chemistry = Math.min(100, me.chemistry + 0.15);
  }
  if (!involvesUser) {
    result.awayBox = undefined;
    result.homeBox = undefined;
  }
  series.games.push(result);
  return result;
}

export function playoffDone(l: LeagueState): boolean {
  if (l.playoffRounds.length < 4) return false;
  const fin = l.playoffRounds[3].series[0];
  return fin.awayWins >= 4 || fin.homeWins >= 4;
}

export function playoffChampion(l: LeagueState): number | null {
  if (!playoffDone(l)) return null;
  const fin = l.playoffRounds[3].series[0];
  return fin.awayWins >= 4 ? fin.awayId : fin.homeId;
}

// v1.3 旧档 cultureId → 新球队风格近似映射（v1.2 三选一语义对应）
const OLD_CULTURE_STYLE: Record<string, TeamStyleId> = { defense: 'iron', stars: 'brand', team: 'locker' };
const STYLE_BY_SEED = ['youth', 'star', 'iron', 'locker', 'brand'] as const;
// v2.0 执教风格（AI 队默认按种子分配）
const COACH_BY_SEED = ['iron', 'locker', 'brand'] as const;

// ---------- v2.5.0 球队阶段（重建 / 补强 / 争冠）----------
// 按"队内最强 5 人（≈首发）的平均 OVR"划分（用户指定阈值）：
//   > 85 争冠：看重即时战力，愿意为即战力付出未来资产（选秀权 / 年轻潜力球员）
//   80-85 补强：较为看重即时战力
//   < 80 重建：非常重视未来资产（选秀权、年轻球员），老将不值钱
export type TeamPhase = 'contender' | 'retool' | 'rebuild';

export function teamPhase(t: Team): TeamPhase {
  // v2.6.2：用 valueOvr（位置无关）判定，避免玩家靠换位影响自己与对手的阶段定位
  const top5 = [...t.players].sort((a, b) => valueOvr(b) - valueOvr(a)).slice(0, 5);
  const avg = top5.length ? top5.reduce((s, p) => s + valueOvr(p), 0) / top5.length : 0;
  if (avg > 85) return 'contender';
  if (avg >= 80) return 'retool';
  return 'rebuild';
}

export function phaseLabel(p: TeamPhase): string {
  return p === 'contender' ? '争冠' : p === 'retool' ? '补强' : '重建';
}

// 球员在特定球队阶段眼中的价值：作用对象是「未来溢价」部分（见 tradeEff），
// 当下战力（ovr + 合同性价比 + 球星稀缺）不受阶段影响——
// 因此「更强且更年轻」的球员在任何阶段都不会被算得比「更弱更老」的低。
export function phaseFutureWeight(phase: TeamPhase): number {
  return phase === 'contender' ? 0.6 : phase === 'retool' ? 0.9 : 1.35;
}
// 某球队阶段眼中的球员价值（绝对估值，与 tradeValue 同尺度可直接比较）
export function phaseValue(p: Player, phase: TeamPhase): number {
  const { now, future } = tradeEff(p);
  return Math.round(effToValue(now + future * phaseFutureWeight(phase)) * ovrValueWeight(valueOvr(p)) * 100) / 100;
}
// 折算系数的展示口径（＝折算后价值 / 市场价值），用于 UI 文案"未来资产打 X 折"
export function phasePlayerWeight(p: Player, phase: TeamPhase): number {
  const base = tradeValue(p);
  return base > 0 ? Math.round((phaseValue(p, phase) / base) * 100) / 100 : 1;
}
export function phasePickWeight(phase: TeamPhase): number {
  return phase === 'contender' ? 0.7 : phase === 'retool' ? 0.9 : 1.35;
}

// ---------- 球员评分（MVP 用） ----------
export function playerScore(p: Player): number {
  const g = Math.max(1, p.gp);
  const s = p.stats;
  return (s.pts + s.ast * 1.5 + (s.or + s.dr) * 1.1 + s.stl * 2 + s.blk * 2 - s.tov * 1.5) / g + p.ovr * 0.4;
}

// ---------- 存档迁移（v1/v2/v3 → v4：中文名/轮换/战术/选秀权/身体/伤病/头像字段补齐） ----------
// 由 useGame 读档后调用；对新档是幂等 no-op。
export function migrateSave(l: LeagueState): void {
  if (!l.mode) {
    // v1 档无模式标记：真实名单必有 2K 球员（启发式识别；v1 档名字必为英文）
    const realNames = new Set<string>();
    for (const t of REAL_ROSTER) for (const p of t.players) realNames.add(p.n);
    const hasReal = l.teams.some((t) => t.players.some((p) => realNames.has(p.name)));
    l.mode = hasReal ? 'real' : 'fictional';
  }
  // v0.3.1：真实名单英文名 → 中文译名（幂等：已是中文则 ZH_NAME_MAP 查不到）
  if (l.mode === 'real') {
    const zh = (name: string): string => ZH_NAME_MAP[name] ?? name;
    for (const t of l.teams) for (const p of t.players) p.name = zh(p.name);
    if (l.freeAgents) for (const p of l.freeAgents) p.name = zh(p.name);
  }
  const expByName = new Map<string, number>();
  for (const t of REAL_ROSTER) for (const p of t.players) expByName.set(p.n, p.e);
  for (const p of REAL_FA) expByName.set(p.n, p.e);
  // v0.3.7：真实球员中文名 → 大头照 slug（migrate 旧真实档也能找回头像）
  const faceByZh = new Map<string, string>();
  for (const t of REAL_ROSTER) for (const p of t.players) if (p.f) faceByZh.set(p.n, p.f);
  for (const p of REAL_FA) if (p.f) faceByZh.set(p.n, p.f);
  // v2.3：真实球员中文名 → 推断后的主/副位置（老存档同步到新位置口径）
  const posByZh = new Map<string, { p: Pos; q: Pos }>();
  for (const t of REAL_ROSTER) for (const p of t.players) posByZh.set(p.n, { p: p.p, q: p.q });
  for (const p of REAL_FA) posByZh.set(p.n, { p: p.p, q: p.q });
  // v1.4：真实球员中文名 → 18 项技能（2K 官方属性映射；取不到则从 attrs+body 派生兜底）
  const skillByZh = new Map<string, RealPlayerInfo['s']>();
  for (const t of REAL_ROSTER) for (const p of t.players) skillByZh.set(p.n, p.s);
  for (const p of REAL_FA) skillByZh.set(p.n, p.s);
  const skillsOf = (name: string, attrs: Attrs, body: BodyAttrs): Skills18 => {
    const s = l.mode === 'real' ? skillByZh.get(name) : undefined;
    return s ? fromRealSkills(s) : deriveSkills({ attrs, body });
  };
  for (const t of l.teams) {
    const rngT = mulberry32(l.seed * 101 + t.id * 977 + 13);
    for (const p of t.players) {
      if (p.exp == null) p.exp = expByName.get(p.name) ?? clamp(p.age - 18, 1, 20);
      if (p.starts == null) p.starts = 0;
      // v0.3.1：轮换/球权字段（undefined → null 表示"自动"）
      if (p.min == null) p.min = null;
      if (p.usage == null) p.usage = null;
      // v0.3.7：身体属性（旧档缺 → 按位置/年龄确定性补全）/ 伤病 / 大头照
      if (!p.body) p.body = genBody(rngT, p.pos, p.age, p.ovr);
      if (p.injury === undefined) p.injury = null;
      if (p.face === undefined && l.mode === 'real') p.face = faceByZh.get(p.name);
      // v1.1：位置适配基准（换位幂等；旧档以当前值作为基准）
      if (p.basePos == null) p.basePos = p.pos;
      if (p.baseAttrs == null) p.baseAttrs = { ...p.attrs };
      if (p.baseOvr == null) p.baseOvr = p.ovr;
      // v2.3 位置口径升级：源数据第二位置生效 + 修正错乱的源位置（如杰伦·威廉姆斯曾被标 C）。
      // 只修正"玩家没手动换过位"的球员（pos === basePos）；换过位的尊重玩家选择，不覆盖。
      if (l.mode === 'real') {
        const rp2 = posByZh.get(p.name);
        if (rp2 && p.pos === p.basePos && (p.pos !== rp2.p || p.secPos !== rp2.q)) {
          p.pos = rp2.p;
          p.secPos = rp2.q;
          p.basePos = rp2.p;
        }
      }
      // v1.2：成长率
      if (p.grow == null) p.grow = 1;
      // v1.3：风格标签（羁绊；按属性特征确定性重算，与建档一致）
      if (!p.tags) p.tags = assignTags({ ovr: p.ovr, attrs: p.attrs });
      // v1.4：18 项技能（真实档按中文名从 2K 数据重建；否则 attrs+body 派生）
      if (!p.skills) p.skills = skillsOf(p.name, p.attrs, p.body);
      // v2.0：双位置 / 潜力 1-10 星 / 技能基准 / 加点与生涯 / 国籍
      if (!p.secPos) p.secPos = POS_SEC[p.pos];
      if (p.potential == null || p.potential > 10) p.potential = potentialToStar(p.potential > 10 ? p.potential : p.ovr + 5);
      if (!p.baseSkills) p.baseSkills = { ...p.skills };
      if (p.points == null) p.points = 0;
      if (!p.career) p.career = freshCareer();
      if (!p.nation) p.nation = '美国';
    }
    if (t.initiator == null) t.initiator = 'PG';
    // v1.2：球队气质（旧档补中性默认 50/50/50/100 万）
    if (t.chemistry == null) t.chemistry = 50;
    if (t.discipline == null) t.discipline = 50;
    if (t.brand == null) t.brand = 50;
    if (t.fans == null) t.fans = 100;
    // v1.3：球队风格（旧档按 cultureId 近似映射，无则按种子确定性分配；AI 队同样拥有）
    if (t.style == null) {
      t.style = (l.cultureId == null ? null : OLD_CULTURE_STYLE[l.cultureId] ?? null)
        ?? (t.id === l.userTeamId ? 'youth' : STYLE_BY_SEED[(l.seed + t.id * 7) % STYLE_BY_SEED.length]);
    }
    // v2.0 执教风格拆分：旧五选一中的 iron/locker/brand 归入 coachStyle；其余按种子分配
    if (t.coachStyle == null && (t.style === 'iron' || t.style === 'locker' || t.style === 'brand')) {
      t.coachStyle = t.style;
      t.style = null;
    }
    if (t.coachStyle == null) {
      t.coachStyle = t.id === l.userTeamId ? null : COACH_BY_SEED[(l.seed + t.id * 13 + 5) % COACH_BY_SEED.length];
    }
  }
  if (l.freeAgents) {
    const rngF = mulberry32(l.seed * 131 + 7);
    for (const p of l.freeAgents) {
      if (!p.body) p.body = genBody(rngF, p.pos, p.age, p.ovr);
      if (p.injury === undefined) p.injury = null;
      if (p.face === undefined && l.mode === 'real') p.face = faceByZh.get(p.name);
      if (p.basePos == null) p.basePos = p.pos;
      if (p.baseAttrs == null) p.baseAttrs = { ...p.attrs };
      if (p.baseOvr == null) p.baseOvr = p.ovr;
      if (p.grow == null) p.grow = 1;
      if (!p.tags) p.tags = assignTags({ ovr: p.ovr, attrs: p.attrs });
      if (!p.skills) p.skills = skillsOf(p.name, p.attrs, p.body);
      if (!p.secPos) p.secPos = POS_SEC[p.pos];
      // v2.3 位置口径升级（自由球员同样同步）
      if (l.mode === 'real') {
        const rp2 = posByZh.get(p.name);
        if (rp2 && p.pos === p.basePos && (p.pos !== rp2.p || p.secPos !== rp2.q)) {
          p.pos = rp2.p;
          p.secPos = rp2.q;
          p.basePos = rp2.p;
        }
      }
      if (p.potential == null || p.potential > 10) p.potential = potentialToStar(p.potential > 10 ? p.potential : p.ovr + 5);
      if (!p.baseSkills) p.baseSkills = { ...p.skills };
      if (p.points == null) p.points = 0;
      if (!p.career) p.career = freshCareer();
      if (!p.nation) p.nation = '美国';
      if (!p.skills) p.skills = skillsOf(p.name, p.attrs, p.body);
    }
  }
  // v0.3.1：薪资刻度换算（v2 真实名单档的"标准合同"从旧刻度换到新刻度；签约产生的非常规金额不动）
  if (l.version < 3 && l.mode === 'real') {
    for (const t of l.teams) for (const p of t.players) resalaryIfLegacy(p);
  }
  l.version = SAVE_VERSION;
  l.offseason = l.offseason ?? false;
  l.offseasonStep = l.offseasonStep ?? 0;
  l.midUsed = l.midUsed ?? l.teams.map(() => false);
  l.freeAgents = l.freeAgents ?? [];
  // v0.3.3：自由市场从开档第一赛季即开放——旧档若在赛季中途升级且还没建过市场，
  // 补建初始市场（幂等：市场非空不再补；真实模式补 REAL_FA，虚构模式补随机池）
  if (l.freeAgents.length === 0) {
    let maxId = 0;
    for (const t of l.teams) for (const p of t.players) maxId = Math.max(maxId, p.id);
    if (l.mode === 'real') {
      const rostered = new Set<string>();
      for (const t of l.teams) for (const p of t.players) rostered.add(p.name);
      for (const rp of REAL_FA) {
        if (rostered.has(rp.n)) continue; // 已被球队签下的真实球员不进市场
        l.freeAgents.push(realFaPlayer(++maxId, rp));
      }
    } else {
      const rng = mulberry32(l.seed * 7 + 5);
      for (let i = 0; i < 60; i++) {
        const fa = genFreeAgent(rng);
        fa.id = ++maxId;
        l.freeAgents.push(fa);
      }
    }
  }
  l.awards = l.awards ?? null;
  if (l.awards && !l.awards.allDefense) l.awards.allDefense = [[], []]; // v2.0 一防二防字段
  l.news = l.news ?? [];
  l.finalsAccum = l.finalsAccum ?? [];
  // v2.0：自由市场 7 天窗口 / 季后赛淘汰弹窗标记 / 待处理事件
  l.faDay = l.faDay ?? 1;
  l.faOffers = l.faOffers ?? [];
  l.poffExitShown = l.poffExitShown ?? false;
  l.pendingEvents = l.pendingEvents ?? [];
  // v2.1：选秀大会状态（旧档无 → null；休赛期进行中的旧档由 finishOffseason 兜底代选）
  l.draft = l.draft ?? null;
  // v1.2：建队理念（旧档无 → null；属性已按中性默认补）
  l.cultureId = l.cultureId ?? null;
  // v0.3.1：未来选秀权池
  // v2.3：升级为「每队未来 3 年 × 首轮/次轮」结构；旧档每队 1 枚无年份首轮签 →
  //       按原持有关系映射到下一届首轮，其余年份/轮次补齐（幂等）
  l.draftPool = l.draftPool ?? [];
  const legacyPicks = l.draftPool.filter((pk) => (pk as { year?: number }).year == null);
  if (l.draftPool.length === 0 || legacyPicks.length > 0) {
    const fresh = freshPickPool(l.year, l.teams.length);
    for (const pk of legacyPicks) {
      const slot = fresh.find((x) => x.year === l.year + 1 && x.round === 1 && x.f === pk.f);
      if (slot && pk.o >= 0 && pk.o < l.teams.length) slot.o = pk.o;
    }
    l.draftPool = fresh;
  }
  rollPickPool(l); // 保证"未来 3 年 × 首轮/次轮"窗口完整（丢弃过期签、补足缺失签）
  // v2.3：AI 主动报价队列 + 事件选项多效果格式（旧档单效果 → effects）
  l.tradeOffers = l.tradeOffers ?? [];
  l.pendingEvents = (l.pendingEvents ?? []).map((ev) => ({
    ...ev,
    options: (ev.options ?? []).map((op) => (
      op.effects ? op : { label: op.label, effects: op.key ? [{ key: op.key, delta: op.delta ?? 0 }] : [] }
    )),
  }));
  // v2.3：选秀状态补年份（旧档休赛期进行中 → 用下一届年份）
  if (l.draft && (l.draft as { year?: number }).year == null) l.draft.year = l.year + 1;
  // v2.4.0：乐透抽签结果（旧档无 → null，下次休赛期重新抽）
  l.lottery = l.lottery ?? null;
  // v2.5.0：旧档抽签结果补乐透区球队 id（UI 用 lotteryIds 只渲染乐透区 14 行）
  if (l.lottery && !Array.isArray(l.lottery.lotteryIds)) {
    l.lottery.lotteryIds = l.lottery.order.slice(0, 14);
  }
  // v2.5.0：锁定球员 + 休赛期交易窗口 + 季后赛统计字段
  l.lockedPids = l.lockedPids ?? [];
  l.offseasonTradeDays = l.offseasonTradeDays ?? 0;
  for (const p of [...l.teams.flatMap((t) => t.players), ...l.freeAgents, ...(l.nextDraftClass ?? [])]) {
    if (p.poStats == null) p.poStats = freshStatLine();
    if (p.poGp == null) p.poGp = 0;
    // v2.5.0：新秀名字全部汉化——旧存档里"美国新秀的英文名"也翻译成中文译名
    //   （enNameToZh 对认不出的名字原样返回，所以真实球员的英文名不会被误改）
    if (/^[A-Za-z]/.test(p.name)) p.name = enNameToZh(p.name);
  }
  // v2.3.0：下一届新秀预测名单（旧档补建）+ 体测数据（体重/臂展）补全
  l.nextDraftClass = l.nextDraftClass ?? [];
  if (l.nextDraftClass.length === 0) {
    const rngD = mulberry32(l.seed * 5501 + l.season * 97 + 23);
    const list = genDraftClass(rngD);
    for (const r of list) r.id = l.playerSeq++;
    l.nextDraftClass = list;
  }
  for (const p of [...l.teams.flatMap((t) => t.players), ...l.freeAgents, ...l.nextDraftClass]) {
    ensureMeasure(p);
  }
}

export function sortRoster(team: Team): void {
  const orderMap: Record<Pos, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  team.players.sort((a, b) => {
    if (orderMap[a.pos] !== orderMap[b.pos]) return orderMap[a.pos] - orderMap[b.pos];
    return b.ovr - a.ovr || a.id - b.id;
  });
}

// ---------- 交易 ----------
// v0.3.6 估值模型 v4（指数化）：用户要求「以 75 能力为基线、每多 10 能力价值翻一倍」。
//  - 把潜力/年龄/合同折算成「等效能力 eff」，再进指数曲线 value = 2^((eff-75)/10)：
//    75 能力=1.0、85=2.0、95=4.0、65=0.5——高 ovr 球星与普通首发拉开指数级差距；
//  - v2.0 潜力改 1-10 星：每星 ≈ +3 OVR 潜力空间（潜力 10 → 等效 +15 OVR）。
//  - 老将：31 岁起每年 eff -0.8（温和折价，避免 36+ 老超巨崩盘）；
//  - 合同：溢价 eff-1.5 / 廉价 eff+1；球星稀缺（ovr≥90）eff+1；
//  - 目标：22 岁 o72 p10 潜力新秀 ≈ 32 岁 o85 老将（价值对等）；选秀权与球员同尺度可比较。
//
// v2.5.1 重构：把等效能力拆成「当下战力 now」与「未来溢价 future」两部分。
//   原因（用户反馈的真实案例）：萨博尼斯 85/29 岁 ↔ 莫布利 87/24 岁 竟被判「基本对等」——
//   旧实现把年龄系数乘在**整个球员价值**上，争冠队 ×0.75 把「更强且更年轻」的莫布利打到
//   2.475、把老将萨博尼斯 ×1.2 抬到 2.4，于是更强更年轻的球员反而被算成等价。
//   现在球队阶段偏好**只作用于 future 部分**，当下战力（含合同性价比、球星稀缺）永远按原值计。
export function tradeEff(p: Player): { now: number; future: number } {
  // v2.6.2：估值口径与阵容位置脱钩——用 valueOvr（基准位置口径）而不是当前 p.ovr，
  //   否则玩家把球员拖到副位置就能压低/抬高他的交易身价（用户反馈"换位置不变价值不太公平"）。
  const vo = valueOvr(p);
  let now = vo;
  let future = 0;
  const potEff = vo + (p.potential - 5) * 3; // 潜力空间折算
  if (p.age <= 25 && potEff > vo) {
    // 越年轻乘数越大：1+(25-age)×0.08（clamp 0.6-1.6）
    const ageFactor = clamp(1 + (25 - p.age) * 0.08, 0.6, 1.6);
    future += (potEff - vo) * 0.55 * ageFactor;
  } else if (p.age <= 25) {
    future += 0.5; // 年轻即战力小加分
  }
  if (p.age >= 31) future -= (p.age - 30) * 0.8; // 31 岁起每年折损 0.8 等效能力
  const fair = salaryFor(vo);
  if (p.salary > fair * 1.15 && p.salary > 0) now -= 1.5; // 明显溢价合同
  else if (p.salary > 0 && p.salary < fair * 0.9) now += 1; // 廉价合同（新秀红利）
  if (vo >= 90) now += 1; // 顶级球星市场稀缺溢价
  return { now, future };
}
function effToValue(eff: number): number {
  return Math.max(0.1, Math.round(Math.pow(2, (eff - 75) / 10) * 100) / 100);
}
// v2.6.1 能力档位价值系数（用户指定口径）：低能力"添头"折价、高能力核心溢价——
//   OVR < 75      → ×0.5（对半砍）
//   75 ≤ OVR < 80 → ×0.8（降 20%）
//   80 ≤ OVR < 85 → ×1.0（不变）
//   85 ≤ OVR < 90 → ×1.2（涨 20%）
//   OVR ≥ 90      → ×1.4（涨 40%）
// 目的：低能力球员不再能"凑数"凑出球星身价，真正的核心则更贵、更难被换走。
// ⚠️ 同时作用于市场价 tradeValue 与决策价 phaseValue，保证"展示口径 = 判定口径"（v2.5.1 教训）。
export function ovrValueWeight(ovr: number): number {
  if (ovr < 75) return 0.5;
  if (ovr < 80) return 0.8;
  if (ovr < 85) return 1;
  if (ovr < 90) return 1.2;
  return 1.4;
}
export function tradeValue(p: Player): number {
  const { now, future } = tradeEff(p);
  return Math.round(effToValue(now + future) * ovrValueWeight(valueOvr(p)) * 100) / 100;
}

// 未来选秀权估值（v2.6.0：按用户指定的"初始价值"口径重做）
//  - 初始价值（= 战绩中性时，开档 0-0 就是这些数）：首轮 1.5 / 1.2 / 1.0（未来第 1/2/3 年），
//    次轮 0.4 / 0.3 / 0.2；超出表格的年份沿用最后一年（当前窗口只有 3 年）；
//  - 战绩修正：签值多少钱看**原属球队**的当季战绩——摆烂队的签更值钱。
//    质量系数 quality：首轮 [0.6, 1.4]、次轮 [0.8, 1.2]，联盟中位 = 1.0（正好等于初始价值）；
//  - 样本不足（< 8 场）时按中性 1.0 计，与"初始价值"一致。
const PICK_BASE: Record<number, number[]> = { 1: [1.5, 1.2, 1.0], 2: [0.4, 0.3, 0.2] };
export function pickValue(l: LeagueState, pick: DraftPick): number {
  const draftYear = l.year + 1;                   // 下一个选秀年
  const off = Math.max(0, pick.year - draftYear); // 距今几届
  const table = PICK_BASE[pick.round] ?? PICK_BASE[2];
  const base = table[Math.min(off, table.length - 1)];
  const team = l.teams[pick.f];
  const played = team ? team.win + team.loss : 0;
  let q = 0.5; // 中性位（联盟中位战绩）
  if (played >= 8) {
    const sorted = [...l.teams].sort((a, b) => {
      const ra = a.win / Math.max(1, a.win + a.loss);
      const rb = b.win / Math.max(1, b.win + b.loss);
      return ra - rb || a.abbr.localeCompare(b.abbr);
    });
    const r = Math.max(0, sorted.findIndex((t) => t.id === pick.f)); // 0 = 联盟最差
    q = 1 - r / Math.max(1, sorted.length - 1);                      // 1 = 最差（签最好）
  }
  const quality = pick.round === 1 ? 0.6 + q * 0.8 : 0.8 + q * 0.4;
  return Math.round(base * quality * 100) / 100;
}

// ---------- v2.3.0 乐透抽签（参照 NBA 2023 版劳资协议规则）----------
// 14 支未进季后赛的球队按概率抽前 4 顺位；其余乐透队 5-14 顺位按战绩逆序；
// 进了季后赛的 16 队 15-30 顺位也按战绩逆序。
// 状元概率：最差 3 队各 14%，其后依次 12.5 / 10.5 / 9.5 / 8.6 / 7.5 / 6.4 / 5.5 / 4.5 / 3.2 / 2.4 / 1.8%。
export const LOTTERY_ODDS = [0.14, 0.14, 0.14, 0.125, 0.105, 0.095, 0.086, 0.075, 0.064, 0.055, 0.045, 0.032, 0.024, 0.018];

// 返回 30 队的选秀顺位序列 + 每队的状元概率（供 UI 可视化展示）
export function lotteryDraw(l: LeagueState, rng: Rng): { order: number[]; odds: number[]; lotteryIds: number[] } {
  const wr = (t: Team) => t.win / Math.max(1, t.win + t.loss);
  const ranked = [...l.teams].sort((a, b) => wr(a) - wr(b) || a.abbr.localeCompare(b.abbr));
  const st = standings(l);
  const playoffIds = new Set<number>();
  for (const r of [...st.east.slice(0, 8), ...st.west.slice(0, 8)]) playoffIds.add(r.team.id);
  const lottery = ranked.filter((t) => !playoffIds.has(t.id));
  const rest = ranked.filter((t) => playoffIds.has(t.id));
  const oddsOf = new Map<number, number>();
  lottery.forEach((t, i) => oddsOf.set(t.id, LOTTERY_ODDS[i] ?? 0.005));
  const pool = lottery.map((t, i) => ({ id: t.id, w: LOTTERY_ODDS[i] ?? 0.005 }));
  const top: number[] = [];
  for (let k = 0; k < 4 && pool.length > 0; k++) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    top.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  const order = [...top, ...pool.map((x) => x.id), ...rest.map((t) => t.id)];
  return {
    order,
    odds: order.map((id) => oddsOf.get(id) ?? 0),
    lotteryIds: lottery.map((t) => t.id),
  };
}

// 兼容旧调用：只取顺位序列
export function lotteryOrder(l: LeagueState, rng: Rng): number[] {
  return lotteryDraw(l, rng).order;
}

// v2.3.0 Stepien 规则（"不能连续两年没有首轮签"）——v2.5.0 已按用户要求移除，不再约束交易。
// 函数保留仅作历史记录，任何地方都不应再调用它。

// v2.3.0 首轮新秀薪资阶位（Rookie Scale 简化：状元 1200 万 → 30 号秀 200 万，线性递减）
export function rookieScaleSalary(pickNo: number): number {
  const k = clamp(pickNo, 1, 30);
  return Math.round(clamp(1200 - (k - 1) * 34.5, 200, 1200));
}

export function pickLabel(l: LeagueState, pick: DraftPick): string {
  const f = l.teams[pick.f];
  const o = l.teams[pick.o];
  const rn = pick.round === 1 ? '首轮' : '次轮';
  return pick.o === pick.f
    ? `${pick.year} ${rn}（${f?.abbr ?? '?'}）`
    : `${pick.year} ${rn}（${f?.abbr ?? '?'} → ${o?.abbr ?? '?'}）`;
}
// 选秀权池构造/滚动（freshPickPool / rollPickPool / PICK_YEARS）见 gen.ts（避免循环依赖）

// ---------- 劳资约束（简化；与使用说明.txt 的声明一致） ----------
export const SALARY_CAP = 15400;  // 工资帽（万美元 ≈1.54 亿）
export const TAX_LINE = 18700;    // 奢侈税线：超线球队 = 中产/打包受限 + 交易薪资不得增加
export const HARD_CAP = 20000;    // 第二土豪线（2 亿美元）：硬顶，任何操作不可超过
export const ROSTER_MIN = 13;     // 交易/休赛期名单下限（保证 >12）
export const ROSTER_MAX = 17;     // 交易/休赛期名单上限（开季前裁至 15）
// v1.1 交易截止日：常规赛第 110 比赛日后（约全明星后）关闭玩家交易，季后赛/休赛期不再开放
export const TRADE_DEADLINE_DAY = 110;
// v2.3.0 单季出场数容差：赛程随机铺日 → 各队进度有差异，跨队转会后"已打 + 新队剩余"可能略超 82
export const GP_CAP = 82;
export const GP_TRADE_TOLERANCE = 6;

export function payrollOf(players: Player[]): number {
  return players.reduce((s, p) => s + (p.salary || 0), 0);
}

export interface TradeVerdict {
  accept: boolean;
  reason: string;
}

function rosterError(list: Player[]): string | null {
  if (list.length > ROSTER_MAX) return `名单超过 ${ROSTER_MAX} 人（交易上限，开季前会裁至 15）`;
  if (list.length < ROSTER_MIN) return `名单不足 ${ROSTER_MIN} 人`;
  const has = (pos: Pos) => list.some((p) => p.pos === pos);
  if (!(has('PG') && has('SG') && has('SF') && has('PF') && has('C'))) return '名单缺位置';
  return null;
}

// 名单/薪金/奢侈税规则的公共检查（交易双方都要过）
function tradeRuleError(l: LeagueState, teams: { t: Team; after: Player[]; sending: Player[] }[]): string | null {
  for (const { t, after, sending } of teams) {
    const err = rosterError(after);
    if (err) return `${t.name}：${err}`;
    const p0 = payrollOf(t.players);
    const p1 = payrollOf(after);
    if (p1 > HARD_CAP) return `${t.name}：交易后工资单 ${moneyW(p1)} 超过 2 亿美元硬顶`;
    if (p0 > TAX_LINE) {
      if (p1 > p0 + 0.001) return `${t.name}已超奢侈税线：交易后薪金不能增加（需减薪或薪资严格匹配）`;
      if (sending.length > 1) return `${t.name}已超奢侈税线：不能打包多名球员交易`;
    }
  }
  return null;
}

// ---------- v2.6.1 核心球员保护（用户指定：ovr ≥ 85 都是各队的"中流砥柱"）----------
// 用户反馈（截图为证）：反向报价搜索器会给出「马刺送出 87/20 岁的卡斯尔，换回 85/29 岁的
//   萨博尼斯 + 68 的夏普 + 71 的普洛登」这类方案——争冠队不可能送走自己的组队核心，
//   更不该"用一堆添头凑价值"把核心换走。
// 三道互补的防线（缺一不可，实测数据见 §10 经验）：
//   ① 核心数量门槛：对方送出 N 名核心，你必须送出 ≥ N 名核心——选秀权与低能力添头不能替代核心。
//   ② 不许降级：配对的核心 ovr 不得低于对方送出的核心（85 换不走 87）——
//      估值再凑得上也不行，因为"换的目的是补强"，降级式换核心等于拆队。
//   ③ 同档不许拿老换少：ovr 相同时，不能拿更老的核心去换对方更年轻的核心。
//   另有能力档位系数 ovrValueWeight（低能力折价、高能力溢价）：
//   <75 半价 / 75-79 八折 / 80-84 原价 / 85-89 涨 20% / ≥90 涨 40%。
//   ⚠️ 实测（真实名单 27 组"85 核心+2 添头 换 87+ 核心"）：只靠折价仍有 11 笔成交
//      （含用户截图中的骑士莫布利），加上 ①②③ 后归零。
export const CORE_OVR = 85;

// v2.6.2 当家球星溢价（用户指定）：球队对自己**队内前两位**球员（按 OVR 降序）的交易欲望不高，
//   必须收到其价值 1.5 倍的回报才肯放人——大当家、二当家一视同仁。
//   与核心门槛互补：核心门槛管"能不能换"（必须核心换核心、不许降级），本溢价管"要多少才换"。
export const TOP2_PREMIUM = 1.5;

/** 队内前二（按 OVR 降序；同分按 id 稳定排序），供交易要价与反向搜索共用 */
export function top2Ids(t: Team): Set<number> {
  return new Set(
    [...t.players].sort((a, b) => valueOvr(b) - valueOvr(a) || a.id - b.id).slice(0, 2).map((p) => p.id),
  );
}

function coreBlockReason(ai: Team, want: Player[], give: Player[]): string | null {
  // v2.6.2：核心判定也用 valueOvr（位置无关），否则玩家把核心拖到副位置让他"掉出 85"就能规避门槛
  const aiCores = want
    .filter((p) => valueOvr(p) >= CORE_OVR)
    .sort((a, b) => valueOvr(b) - valueOvr(a) || a.age - b.age);
  if (!aiCores.length) return null;
  const myCores = give
    .filter((p) => valueOvr(p) >= CORE_OVR)
    .sort((a, b) => valueOvr(b) - valueOvr(a) || a.age - b.age);
  const who = aiCores.map((p) => `${p.name}（OVR ${valueOvr(p)} · ${p.age}岁）`).join('、');
  if (myCores.length < aiCores.length) {
    return `${ai.name} 拒绝交易：${who} 是队内中流砥柱（OVR ≥ ${CORE_OVR}），不接受用添头或选秀权凑价值`
      + `——你必须送出至少 ${aiCores.length} 名 OVR ≥ ${CORE_OVR} 的核心球员来置换`;
  }
  for (let i = 0; i < aiCores.length; i++) {
    const w = aiCores[i];
    const g = myCores[i];
    if (valueOvr(g) < valueOvr(w)) {
      return `${ai.name} 拒绝交易：${w.name}（OVR ${valueOvr(w)} · ${w.age}岁）是队内中流砥柱，`
        + `你给出的核心 ${g.name}（OVR ${valueOvr(g)}）档次更低——核心只能用同等或更强的核心去换`;
    }
    if (valueOvr(g) === valueOvr(w) && g.age > w.age) {
      return `${ai.name} 拒绝交易：${w.name}（OVR ${valueOvr(w)} · ${w.age}岁）是队内中流砥柱，`
        + `不会用更年轻的核心去换更老的 ${g.name}（${g.age}岁）——换来的必须让球队变强`;
    }
  }
  return null;
}

export function evaluateTrade(
  l: LeagueState, fromTeamId: number, targetTeamId: number,
  givePids: number[], wantPids: number[],
  givePickIdx: number[] = [], wantPickIdx: number[] = []
): TradeVerdict {
  const me = l.teams[fromTeamId];
  const ai = l.teams[targetTeamId];
  if (!me || !ai || ai.id === me.id) return { accept: false, reason: '目标球队无效' };
  const give = givePids.map((pid) => me.players.find((p) => p.id === pid)!).filter(Boolean);
  const want = wantPids.map((pid) => ai.players.find((p) => p.id === pid)!).filter(Boolean);
  if (!give.length && givePickIdx.length === 0) return { accept: false, reason: '至少送出一名球员或一枚选秀权' };
  if (!want.length && wantPickIdx.length === 0) return { accept: false, reason: '至少得到一名球员或一枚选秀权' };
  // 签归属校验
  for (const i of givePickIdx) {
    const pk = l.draftPool[i];
    if (!pk || pk.o !== me.id) return { accept: false, reason: '送出的选秀权不属于你（或已失效）' };
  }
  for (const i of wantPickIdx) {
    const pk = l.draftPool[i];
    if (!pk || pk.o !== ai.id) return { accept: false, reason: '想要的选秀权不属于对方' };
  }
  // v2.5.0：Stepien 规则已按用户要求移除（不再限制"连续两年没有首轮签"的交易）
  // 选秀权冻结：超奢侈税线（第一土豪线）的球队不能送出自己的选秀权（真实 NBA 土豪线罚则简化版）
  if (givePickIdx.length > 0 && payrollOf(me.players) > TAX_LINE) {
    return { accept: false, reason: `你的球队工资单 ${moneyW(payrollOf(me.players))} 已超奢侈税线：未来选秀权被冻结，不能作为交易筹码` };
  }
  if (wantPickIdx.length > 0 && payrollOf(ai.players) > TAX_LINE) {
    return { accept: false, reason: `${ai.name} 的工资单已超奢侈税线：它的未来选秀权被冻结，不在交易市场上` };
  }
  // v2.6.1 核心门槛（先于明星/估值判定：核心问题是最硬的拒因）
  const coreBlock = coreBlockReason(ai, want, give);
  if (coreBlock) return { accept: false, reason: coreBlock };
  // v2.0 对方球队的现实考虑（实际薪资 + 上赛季排名）→ 明星交易可能被直接拒绝
  for (const star of want) {
    const svo = valueOvr(star); // v2.6.2：明星判定同样用位置无关口径
    if (svo < 88) continue;
    const fairStar = salaryFor(svo);
    if (star.salary > 0 && star.salary < fairStar * 0.9) {
      return { accept: false, reason: `${ai.name} 拒绝交易：${star.name} 是廉价合同（年薪 ${moneyW(star.salary)} 低于身价 ${moneyW(fairStar)}），合同红利不卖` };
    }
    if (svo >= 90) {
      const wrAi = ai.win / Math.max(1, ai.win + ai.loss);
      if (wrAi >= 0.55) {
        return { accept: false, reason: `${ai.name} 拒绝交易：${star.name} 是队内当家球星，且其胜率 ${(wrAi * 100).toFixed(1)}%（上季排名前 ~8）争冠球队不放人` };
      }
      if (wrAi < 0.42 && payrollOf(ai.players) < SALARY_CAP) {
        return { accept: false, reason: `${ai.name} 拒绝交易：${star.name} 是队内唯一招牌，重建也需要球星卖票（且球队帽下有空间）` };
      }
    }
  }
  const gvPlayers = give.reduce((s, p) => s + tradeValue(p), 0);
  const wvPlayers = want.reduce((s, p) => s + tradeValue(p), 0);
  // v2.0 单季 82 场上限：日历稀疏（每天 4-6 场）导致跨队转会后"已打场次 + 新队剩余场次"可超 82。
  // v2.3.0 修正：旧版直接以「已打 + 新队剩余 > 82」拒绝，但赛程是随机铺日的，各队进度天然有几天差异
  //   （第 10 天时有的队打 12 场、有的只打 8 场），于是赛季早期就出现「OG·阿努诺比已打 12 场 →
  //   拒绝（12+74=86）」这种没道理的理由。现在只有超出上限 GP_TRADE_TOLERANCE 场以上才拒绝。
  for (const p of give) {
    const remain = GP_CAP - playedCount(l, ai.id);
    if (p.gp + remain > GP_CAP + GP_TRADE_TOLERANCE) {
      return { accept: false, reason: `${ai.name} 拒绝：${p.name} 本赛季已打 ${p.gp} 场，转入后预计超 ${GP_CAP} 场上限（球员单赛季最多打 ${GP_CAP} 场）` };
    }
  }
  for (const p of want) {
    const remain = GP_CAP - playedCount(l, me.id);
    if (p.gp + remain > GP_CAP + GP_TRADE_TOLERANCE) {
      return { accept: false, reason: `对方拒绝：${p.name} 本赛季已打 ${p.gp} 场，转入后预计超 ${GP_CAP} 场上限（球员单赛季最多打 ${GP_CAP} 场）` };
    }
  }
  const gvPicks = givePickIdx.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
  const wvPicks = wantPickIdx.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
  const gv = gvPlayers + gvPicks;
  const wv = wvPlayers + wvPicks;
  const meAfter = [...me.players.filter((p) => !givePids.includes(p.id)), ...want];
  const aiAfter = [...ai.players.filter((p) => !wantPids.includes(p.id)), ...give];
  const err = tradeRuleError(l, [
    { t: me, after: meAfter, sending: give },
    { t: ai, after: aiAfter, sending: want },
  ]);
  if (err) return { accept: false, reason: err };
  // ---------- v2.5.0 AI 视角估值：按 AI 球队阶段（重建/补强/争冠）调整资产偏好 ----------
  //   v2.5.1 修正：阶段偏好只作用于「未来溢价」（选秀权 100% 是未来资产；球员的潜力/年龄部分），
  //   当下战力不参与打折——否则会出现"更强且更年轻"的球员被算成等价甚至更便宜的荒谬结果
  //   （案例：争冠队眼中 87/24 岁的莫布利 3.3×0.75=2.5 ≈ 85/29 岁的萨博尼斯 2.0×1.2=2.4）。
  //   现在：争冠 未来溢价×0.6（不愿为潜力付钱、也不过分计较年龄）、补强 ×0.9、重建 ×1.35。
  const phase = teamPhase(ai);
  const wPlayer = (p: Player) => phaseValue(p, phase);
  const wPick = (v: number) => v * phasePickWeight(phase);
  // v2.6.2：队内前二当家要价 ×1.5（见 TOP2_PREMIUM）
  const aiTop2 = top2Ids(ai);
  const wantTop2 = want.filter((p) => aiTop2.has(p.id));
  const askedOf = (p: Player) => wPlayer(p) * (aiTop2.has(p.id) ? TOP2_PREMIUM : 1);
  // AI 送出（want，当家另计 1.5 倍要价）与拿回（give）都按它的偏好折算
  const aiGiveVal = want.reduce((s, p) => s + askedOf(p), 0) + wPick(wvPicks);
  const aiGetVal = give.reduce((s, p) => s + wPlayer(p), 0) + wPick(gvPicks);
  const aiGain = aiGetVal - aiGiveVal;
  // 接受阈值：基准不吃亏超过 6% 就换（以 AI 送出物的偏好价值为基准）
  const avgAge = (list: Player[]) => (list.length ? list.reduce((s, p) => s + p.age, 0) / list.length : 99);
  const giveAge = avgAge(give);
  const wantAge = avgAge(want);
  let tol = 0.06 * aiGiveVal;
  let mood = '';
  if (phase === 'rebuild') {
    // 重建队：乐于收年轻资产与选秀权，老将要求明显赚头
    if (giveAge <= 25) { tol += 0.1 * aiGiveVal; mood = '（重建中：乐于收年轻资产与选秀权，愿吃小亏）'; }
    else if (wantAge >= 30) { tol += 0.08 * aiGiveVal; mood = '（重建中：老将可以打折出手）'; }
    else if (giveAge >= 30) { tol -= 0.1 * aiGiveVal; mood = '（重建中：收老将要求明显赚头）'; }
    else mood = '（重建中：非常重视未来资产）';
  } else if (phase === 'contender') {
    // 争冠队：愿为即战力买单、可透支年轻资产（幅度已收敛，避免与上面的估值偏好重复放大）
    if (giveAge >= 29) { tol += 0.04 * aiGiveVal; mood = '（争冠中：愿为即战力买单）'; }
    else if (wantAge <= 25) { tol += 0.04 * aiGiveVal; mood = '（争冠中：可透支年轻资产换现在）'; }
    else mood = '（争冠中：看重即时战力）';
  } else {
    mood = '（补强中：较为看重即时战力）';
  }
  const valText = `${gvPlayers.toFixed(1)}${gvPicks ? `+签${gvPicks.toFixed(1)}` : ''} ↔ ${wvPlayers.toFixed(1)}${wvPicks ? `+签${wvPicks.toFixed(1)}` : ''}`;
  const wText = `按${phaseLabel(phase)}偏好折算后 你给 ${aiGetVal.toFixed(1)} / 他给 ${aiGiveVal.toFixed(1)}`;
  // v2.6.2：被索要的当家球星按 1.5 倍计要价，文案点明，避免玩家看不懂"他给"为何偏高
  const top2Text = wantTop2.length
    ? `（${wantTop2.map((p) => p.name).join('、')} 是队内前二当家：要价按 ${TOP2_PREMIUM} 倍计）`
    : '';
  if (aiGain >= -tol) {
    const feel = aiGain >= 0 ? '对方觉得这笔交易划算' : '对方觉得基本对等';
    return { accept: true, reason: `${feel}${mood}${top2Text}（原始估值 ${valText}；${wText}，差 ${aiGain.toFixed(1)}）` };
  }
  return {
    accept: false,
    reason: `对方拒绝${mood}：送出价值 ${wv.toFixed(1)}，拿回 ${gv.toFixed(1)}${top2Text}（${wText}，亏 ${(-aiGain).toFixed(1)} 点，最多容忍 ${tol.toFixed(1)} 点）。原始估值：${valText}`,
  };
}

// 阵容战力预测（按 OVR 排序前 15 加权，交易前后对比展示用）
const STRENGTH_W = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.62, 0.55, 0.48, 0.4, 0.33, 0.27, 0.22, 0.18];
export function teamStrength(players: Player[]): number {
  const top = [...players].sort((a, b) => b.ovr - a.ovr).slice(0, STRENGTH_W.length);
  let s = 0;
  for (let i = 0; i < top.length; i++) s += top[i].ovr * STRENGTH_W[i];
  return Math.round(s * 10) / 10;
}

export function applyTrade(
  l: LeagueState, fromTeamId: number, targetTeamId: number,
  givePids: number[], wantPids: number[],
  givePickIdx: number[] = [], wantPickIdx: number[] = []
): void {
  const me = l.teams[fromTeamId];
  const ai = l.teams[targetTeamId];
  if (!me || !ai) return;
  const give = me.players.filter((p) => givePids.includes(p.id));
  const want = ai.players.filter((p) => wantPids.includes(p.id));
  for (const p of give) {
    const i = me.players.indexOf(p);
    if (i >= 0) me.players.splice(i, 1);
  }
  for (const p of want) {
    const i = ai.players.indexOf(p);
    if (i >= 0) ai.players.splice(i, 1);
  }
  me.players.push(...want);
  ai.players.push(...give);
  // 选秀权转移：送出的签归对方、要来的签归自己（f 不变，顺位质量按原队战绩）
  for (const i of givePickIdx) l.draftPool[i].o = ai.id;
  for (const i of wantPickIdx) l.draftPool[i].o = me.id;
  sortRoster(me);
  sortRoster(ai);
}

// ---------- v2.0 季中 AI 交易（交易截止日前；simDay 每 13 天尝试一笔） ----------
// 与休赛期市场同构但更轻量：卖家 = 重建队（<42%）出清 29+ 老将；买家 = 强队（≥55%）补即战力。
// 只发生在 AI 队之间（用户队不被 AI 强买，避免打断玩家操作）；成交消息进球队动态 l.news。
function tryAISeasonTrade(l: LeagueState, rng: Rng): void {
  const isUser = (id: number) => id === l.userTeamId;
  const wrOf = (t: Team) => t.win / Math.max(1, t.win + t.loss);
  const sellers = l.teams.filter((t) =>
    !isUser(t.id) && wrOf(t) < 0.42 && t.players.some((p) => p.age >= 29 && p.ovr >= 80));
  if (!sellers.length) return;
  const seller = sellers[Math.floor(rng() * sellers.length)];
  const stars = seller.players.filter((p) => p.age >= 29 && p.ovr >= 80).sort((a, b) => b.ovr - a.ovr);
  const star = stars[Math.floor(rng() * Math.min(stars.length, 3))];
  const starV = tradeValue(star);
  const buyers = l.teams.filter((t) =>
    !isUser(t.id) && t.id !== seller.id && wrOf(t) >= 0.55 && t.players.length <= ROSTER_MAX - 1);
  if (!buyers.length) return;
  const buyer = buyers[Math.floor(rng() * buyers.length)];
  const same = buyer.players.filter((q) => q.pos === star.pos);
  const need = !same.length || Math.min(...same.map((q) => q.ovr)) < star.ovr - 5;
  if (!need) return;
  const chips = buyer.players.filter((c) => {
    const v = tradeValue(c);
    return v <= starV * 0.8 && (c.age <= 26 || c.ovr <= star.ovr - 10) && c.id !== star.id;
  }).sort((a, b) => tradeValue(b) - tradeValue(a));
  const target = starV * (0.88 + rng() * 0.12);
  const chipPids: number[] = [];
  let curVal = 0;
  for (const c of chips) {
    if (chipPids.length >= 2) break;
    if (curVal + tradeValue(c) <= target * 1.05) { chipPids.push(c.id); curVal += tradeValue(c); }
  }
  const pickIdxs: number[] = [];
  if (curVal < target * 0.85) {
    const ownPicks = l.draftPool
      .map((pk, i) => ({ pk, i }))
      .filter((x) => x.pk.o === buyer.id)
      .sort((a, b) => pickValue(l, a.pk) - pickValue(l, b.pk));
    for (const { i } of ownPicks) {
      if (pickIdxs.length >= 1) break;
      const nv = curVal + pickValue(l, l.draftPool[i]);
      if (nv <= target * 1.05) { pickIdxs.push(i); curVal = nv; }
    }
  }
  if ((!chipPids.length && !pickIdxs.length) || curVal < target * 0.8) return;
  const verdict = evaluateTrade(l, seller.id, buyer.id, [star.id], chipPids, [], pickIdxs);
  if (!verdict.accept) return;
  const names = chipPids.map((pid) => buyer.players.find((q) => q.id === pid)?.name ?? '?');
  const pickNames = pickIdxs.map((i) => pickLabel(l, l.draftPool[i]));
  l.news.push(`🔄 季中交易：${buyer.name} 送出 ${[...names, ...pickNames].join('、')}，从 ${seller.name} 换来 ${star.name}`);
  if (l.news.length > 90) l.news.splice(0, l.news.length - 90);
  applyTrade(l, seller.id, buyer.id, [star.id], chipPids, [], pickIdxs);
}

// 万 → 文本（避免与 offseason 内部 money 命名冲突）
const moneyW = (w: number) => (w >= 10000 ? (w / 10000).toFixed(1) + '亿' : w + '万');

// ---------- v2.3 AI 主动报价：AI 会向玩家要人 / 兜售球员与选秀权 ----------
// 与 tryAISeasonTrade（AI↔AI）互补：这里的报价进 l.tradeOffers，玩家在「球队动态」里接受或拒绝。
// 报价必须通过 evaluateTrade（AI 视角愿意接受）才会生成 —— 玩家看到的都是可成交的报价。
export const MAX_TRADE_OFFERS = 3;

function nextOfferId(l: LeagueState): number {
  return l.tradeOffers.reduce((m, o) => Math.max(m, o.id), 0) + 1;
}

// 位置相邻表（AI 找替代筹码时用）
const ADJ_POS: Record<Pos, Pos[]> = {
  PG: ['PG', 'SG'], SG: ['SG', 'PG', 'SF'], SF: ['SF', 'SG', 'PF'], PF: ['PF', 'SF', 'C'], C: ['C', 'PF'],
};

// 生成一份 AI → 玩家的报价（生成成功返回 true）
export function tryAITradeOfferToUser(l: LeagueState, rng: Rng): boolean {
  const me = l.teams[l.userTeamId];
  if (!me || !me.players.length) return false;
  if ((l.tradeOffers?.length ?? 0) >= MAX_TRADE_OFFERS) return false;
  l.tradeOffers = l.tradeOffers ?? [];
  const others = l.teams.filter((t) => t.id !== l.userTeamId && t.players.length > 0);
  if (!others.length) return false;

  // ---------- 动机 A：AI 想要你的一名球员（该位置能明显升级） ----------
  // v2.5.0：被锁定的球员不会被 AI 报价（用户在交易市场手动锁定）
  const locked = new Set(l.lockedPids ?? []);
  const wants: { ai: Team; target: Player }[] = [];
  for (const ai of others) {
    for (const p of me.players) {
      if (p.ovr < 78 || locked.has(p.id)) continue;
      const same = ai.players.filter((q) => q.pos === p.pos);
      const best = same.length ? Math.max(...same.map((q) => q.ovr)) : 0;
      if (!same.length || p.ovr - best >= 3) wants.push({ ai, target: p });
    }
  }
  if (wants.length && rng() < 0.75) {
    const { ai, target } = wants[Math.floor(rng() * wants.length)];
    const tv = tradeValue(target);
    const chips = ai.players
      .filter((c) => ADJ_POS[target.pos].includes(c.pos) && c.id !== target.id && tradeValue(c) <= tv * 0.95)
      .sort((a, b) => tradeValue(b) - tradeValue(a));
    const chipPids: number[] = [];
    let cur = 0;
    for (const c of chips) {
      if (chipPids.length >= 2) break;
      if (cur + tradeValue(c) <= tv * 1.02) { chipPids.push(c.id); cur += tradeValue(c); }
    }
    const pickIdxs: number[] = [];
    if (cur < tv * 0.9) {
      // 球员筹码不够 → 补送选秀权（先给低价值的：次轮/远期）
      const own = l.draftPool
        .map((pk, i) => ({ pk, i }))
        .filter((x) => x.pk.o === ai.id)
        .sort((a, b) => pickValue(l, a.pk) - pickValue(l, b.pk));
      for (const { i } of own) {
        if (pickIdxs.length >= 2) break;
        const nv = cur + pickValue(l, l.draftPool[i]);
        if (nv <= tv * 1.05) { pickIdxs.push(i); cur = nv; }
      }
    }
    if ((chipPids.length || pickIdxs.length) && cur >= tv * 0.78) {
      const verdict = evaluateTrade(l, me.id, ai.id, [target.id], chipPids, [], pickIdxs);
      if (verdict.accept) {
        const chipNames = chipPids.map((pid) => ai.players.find((q) => q.id === pid)?.name ?? '?');
        const pickNames = pickIdxs.map((i) => pickLabel(l, l.draftPool[i]));
        l.tradeOffers.push({
          id: nextOfferId(l),
          fromTeamId: ai.id,
          givePids: [target.id],
          givePickIdx: [],
          wantPids: chipPids,
          wantPickIdx: pickIdxs,
          day: l.day,
          year: l.year,
          note: `${ai.name}（${ai.win}-${ai.loss}）想要 ${target.name}（${target.pos} · OVR ${target.ovr}）：愿意送出 ${[...chipNames, ...pickNames].join('、')}`,
        });
        l.news.push(`📨 ${ai.name} 发来交易报价：用 ${[...chipNames, ...pickNames].join('、')} 换你的 ${target.name}。`);
        return true;
      }
    }
  }

  // ---------- 动机 B：AI 想要你的选秀权（送出即战力球员换未来） ----------
  const myPicks = l.draftPool
    .map((pk, i) => ({ pk, i }))
    .filter((x) => x.pk.o === l.userTeamId && pickValue(l, x.pk) >= 0.5);
  if (myPicks.length) {
    const { pk, i: pickIdx } = myPicks[Math.floor(rng() * myPicks.length)];
    const pv = pickValue(l, pk);
    const ai = others[Math.floor(rng() * others.length)];
    // 送出价值接近该签的球员（AI 愿意用轮换球员换签）
    const chips = ai.players
      .filter((c) => tradeValue(c) <= pv * 1.25 && tradeValue(c) >= pv * 0.7 && c.ovr >= 70)
      .sort((a, b) => tradeValue(a) - tradeValue(b));
    const chip = chips[Math.floor(rng() * Math.min(chips.length, 4))];
    if (chip) {
      const verdict = evaluateTrade(l, me.id, ai.id, [], [chip.id], [pickIdx], []);
      if (verdict.accept) {
        l.tradeOffers.push({
          id: nextOfferId(l),
          fromTeamId: ai.id,
          givePids: [],
          givePickIdx: [pickIdx],
          wantPids: [chip.id],
          wantPickIdx: [],
          day: l.day,
          year: l.year,
          note: `${ai.name}（${ai.win}-${ai.loss}）想要 ${pickLabel(l, pk)}：愿意送出 ${chip.name}（${chip.pos} · OVR ${chip.ovr} · ${chip.age}岁）`,
        });
        l.news.push(`📨 ${ai.name} 发来交易报价：用 ${chip.name} 换你的 ${pickLabel(l, pk)}。`);
        return true;
      }
    }
  }
  return false;
}

// 玩家接受 AI 报价：执行前重新过一遍规则（名单/薪金/劳资/82 场）
export function acceptTradeOffer(l: LeagueState, offerId: number): { ok: boolean; reason: string } {
  const of = (l.tradeOffers ?? []).find((o) => o.id === offerId);
  if (!of) return { ok: false, reason: '该报价已失效' };
  const ai = l.teams[of.fromTeamId];
  const me = l.teams[l.userTeamId];
  if (!ai || !me) return { ok: false, reason: '球队不存在' };
  const verdict = evaluateTrade(l, me.id, ai.id, of.givePids, of.wantPids, of.givePickIdx, of.wantPickIdx);
  if (!verdict.accept) {
    l.tradeOffers = l.tradeOffers.filter((o) => o.id !== offerId);
    return { ok: false, reason: `交易无法完成（${ai.name} 撤回报价）：${verdict.reason}` };
  }
  const outNames = [...of.givePids.map((pid) => me.players.find((q) => q.id === pid)?.name ?? '?'),
    ...of.givePickIdx.map((i) => pickLabel(l, l.draftPool[i]))];
  const inNames = [...of.wantPids.map((pid) => ai.players.find((q) => q.id === pid)?.name ?? '?'),
    ...of.wantPickIdx.map((i) => pickLabel(l, l.draftPool[i]))];
  applyTrade(l, me.id, ai.id, of.givePids, of.wantPids, of.givePickIdx, of.wantPickIdx);
  l.tradeOffers = l.tradeOffers.filter((o) => o.id !== offerId);
  l.news.push(`✅ 交易达成：你送出 ${outNames.join('、') || '—'}，从 ${ai.name} 得到 ${inNames.join('、') || '—'}。`);
  return { ok: true, reason: `交易完成：得到 ${inNames.join('、')}` };
}

export function rejectTradeOffer(l: LeagueState, offerId: number): void {
  const of = (l.tradeOffers ?? []).find((o) => o.id === offerId);
  if (!of) return;
  const ai = l.teams[of.fromTeamId];
  l.tradeOffers = l.tradeOffers.filter((o) => o.id !== offerId);
  l.news.push(`❌ 你拒绝了 ${ai?.name ?? '?'} 的交易报价。`);
}

// ---------- v2.3.0 交易搜索器 ----------
// 玩家勾选自己愿意送出的筹码（1-N 名球员 / 选秀权）→ 遍历 29 支球队，搜索对方愿意接受的组合：
//   ① 单换单 ② 对方「球员 + 选秀权」 ③ 对方打包两人 ④ 都不成立时自动尝试追加你的其他筹码
//      （真实场景：AI 往往想要你好几个人，第 ④ 类结果会标注"需追加"）
// 只返回 evaluateTrade 判定的可成交方案（含名单/薪资/82 场等全部规则校验；v2.5.0 起无 Stepien 检查）。
export interface TradeSuggestion {
  teamId: number;
  givePids: number[];       // 你送出（球员）
  givePickIdx: number[];    // 你送出（选秀权池下标）
  wantPids: number[];       // 你得到（球员）
  wantPickIdx: number[];    // 你得到（选秀权池下标）
  reason: string;           // AI 的接受理由（含估值明细）
  gain: number;             // 你的净收益（得到 − 送出，估值口径）
  needsMore: boolean;       // true = 需要在你勾选的筹码之外再追加（AI 想要你更多人）
  note: string;             // 一句话说明
}

export function searchTrades(
  l: LeagueState, givePids: number[], givePickIdx: number[], maxPerTeam = 2,
): TradeSuggestion[] {
  const me = l.teams[l.userTeamId];
  if (!me) return [];
  const mePlayers = new Map(me.players.map((p) => [p.id, p]));
  const give = givePids.map((pid) => mePlayers.get(pid)).filter(Boolean) as Player[];
  if (give.length !== givePids.length) return [];
  // 选秀权估值只算一次（pickValue 内部要对 30 队排序，搜索循环里会调用上千次）
  const pickVals = l.draftPool.map((pk) => pickValue(l, pk));
  const pv = (i: number) => pickVals[i] ?? 0;
  const gv = give.reduce((s, p) => s + tradeValue(p), 0) + givePickIdx.reduce((s, i) => s + pv(i), 0);
  if (gv <= 0) return [];

  const myPicks = l.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === me.id);
  // 备用筹码（用户没勾、但 AI 可能一并想要的）：先试最便宜的角色球员与最低价值的签
  const sparePlayers = me.players
    .filter((p) => !givePids.includes(p.id))
    .sort((a, b) => tradeValue(a) - tradeValue(b))
    .slice(0, 4);
  const sparePicks = myPicks
    .filter((x) => !givePickIdx.includes(x.i))
    .sort((a, b) => pv(a.i) - pv(b.i))
    .slice(0, 3);

  const out: TradeSuggestion[] = [];
  // v2.5.1：搜索结果的"你赚/你亏"改用**我方阶段偏好折算**后的价值（与能否成交口径一致）
  const myPhase = teamPhase(me);
  const myVal = (p: Player) => phaseValue(p, myPhase);
  for (const ai of l.teams) {
    if (ai.id === me.id) continue;
    const aiPlayers = new Map(ai.players.map((p) => [p.id, p]));
    const cands = ai.players
      .map((p) => ({ p, v: tradeValue(p) }))
      .filter((x) => x.v >= gv * 0.45 && x.v <= gv * 1.9)
      .sort((a, b) => Math.abs(a.v - gv) - Math.abs(b.v - gv))
      .slice(0, 8);
    const candPicks = l.draftPool
      .map((pk, i) => ({ pk, i, v: pv(i) }))
      .filter((x) => x.pk.o === ai.id && x.v >= gv * 0.25 && x.v <= gv * 1.9)
      .sort((a, b) => a.v - b.v)
      .slice(0, 4);

    const found: TradeSuggestion[] = [];
    let extraTried = false;
    const tryCombo = (wantPids: number[], wantPickIdx: number[], extraP: Player[] = [], extraK: number[] = []) => {
      if (extraP.length || extraK.length) extraTried = true;
      if (!wantPids.length && !wantPickIdx.length) return;
      if (!givePids.length && !givePickIdx.length && !extraP.length && !extraK.length) return;
      const gIds = [...givePids, ...extraP.map((p) => p.id)];
      const gK = [...givePickIdx, ...extraK];
      const verdict = evaluateTrade(l, me.id, ai.id, gIds, wantPids, gK, wantPickIdx);
      if (!verdict.accept) return;
      const gvAll = [...give, ...extraP].reduce((s, p) => s + myVal(p), 0) + gK.reduce((s, i) => s + pv(i) * phasePickWeight(myPhase), 0);
      const wvAll = wantPids.reduce((s, pid) => s + myVal(aiPlayers.get(pid)!), 0)
        + wantPickIdx.reduce((s, i) => s + pv(i) * phasePickWeight(myPhase), 0);
      const names = [
        ...wantPids.map((pid) => aiPlayers.get(pid)?.name ?? '?'),
        ...wantPickIdx.map((i) => pickLabel(l, l.draftPool[i])),
      ];
      found.push({
        teamId: ai.id,
        givePids: gIds,
        givePickIdx: gK,
        wantPids,
        wantPickIdx,
        reason: verdict.reason,
        gain: Math.round((wvAll - gvAll) * 100) / 100,
        needsMore: extraP.length > 0 || extraK.length > 0,
        note: `${ai.name} 愿意送出 ${names.join('、')}`,
      });
    };

    // ① 单换单
    for (const c of cands) tryCombo([c.p.id], []);
    // ② 对方「球员 + 选秀权」
    for (const c of cands.slice(0, 4)) for (const k of candPicks.slice(0, 2)) tryCombo([c.p.id], [k.i]);
    // ③ 对方打包两名球员（清仓换你的即战力）
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        if (cands[i].v + cands[j].v > gv * 1.9) continue;
        tryCombo([cands[i].p.id, cands[j].p.id], []);
      }
    }
    // ④ 追加你的其他筹码：既做"当前筹码换不动"的兜底，也做"再加一点换更好的"升级方案
    //    （真实场景：AI 常常想要你好几个人才肯放人 → 这类结果标 needsMore）
    if ((givePids.length || givePickIdx.length) && !extraTried) {
      const richer = found.filter((f) => !f.needsMore).length
        ? ai.players
          .map((p) => ({ p, v: tradeValue(p) }))
          .filter((x) => x.v >= gv * 1.25)
          .sort((a, b) => b.v - a.v)
          .slice(0, 3)
        : cands.slice(0, 3);
      for (const extra of sparePlayers) {
        for (const c of richer) tryCombo([c.p.id], [], [extra]);
      }
      for (const k of sparePicks.slice(0, 2)) {
        for (const c of richer.slice(0, 2)) tryCombo([c.p.id], [], [], [k.i]);
      }
      if (sparePlayers.length >= 2) {
        for (const c of richer.slice(0, 2)) tryCombo([c.p.id], [], sparePlayers.slice(0, 2));
      }
    }
    const normal = found.filter((f) => !f.needsMore).sort((a, b) => b.gain - a.gain).slice(0, maxPerTeam);
    const upgrade = found.filter((f) => f.needsMore).sort((a, b) => b.gain - a.gain).slice(0, 1); // 每队最多 1 条升级方案
    out.push(...normal, ...upgrade);
  }
  out.sort((a, b) => Number(a.needsMore) - Number(b.needsMore) || b.gain - a.gain);
  return out;
}

// ---------- v2.6.0 反向报价搜索器：选定"我想要的对方球员/签" → 算出"我要付什么" ----------
// 与 searchTrades 方向相反：输入 = 用户想要的目标（球员 id / 选秀权池下标），
// 输出 = 该队愿意接受的"我方筹码组合"（按我方净收益排序）。
export interface TargetSuggestion extends TradeSuggestion {
  myGiveVal: number;  // 我方送出的价值（按我方阶段折算）
  myGetVal: number;   // 我方得到的价值（按我方阶段折算）
}

export function searchTradeTargets(
  l: LeagueState, wantPids: number[], wantPickIdx: number[], maxPerTeam = 3,
): TargetSuggestion[] {
  const me = l.teams[l.userTeamId];
  if (!me) return [];
  if (!wantPids.length && !wantPickIdx.length) return [];
  const locked = new Set(l.lockedPids ?? []);
  const pickVals = l.draftPool.map((pk) => pickValue(l, pk));
  const pv = (i: number) => pickVals[i] ?? 0;
  // 目标按"现属球队"分组（球员按所在队，选秀权按持有人 pk.o）
  const groups = new Map<number, { pids: number[]; picks: number[] }>();
  for (const pid of wantPids) {
    const ai = l.teams.find((t) => t.id !== me.id && t.players.some((p) => p.id === pid));
    if (!ai) continue;
    const g = groups.get(ai.id) ?? { pids: [], picks: [] };
    g.pids.push(pid);
    groups.set(ai.id, g);
  }
  for (const i of wantPickIdx) {
    const pk = l.draftPool[i];
    if (!pk || pk.o === me.id) continue;
    const g = groups.get(pk.o) ?? { pids: [], picks: [] };
    g.picks.push(i);
    groups.set(pk.o, g);
  }
  if (!groups.size) return [];

  const myPhase = teamPhase(me);
  const myVal = (p: Player) => phaseValue(p, myPhase);
  const out: TargetSuggestion[] = [];

  for (const [aiId, want] of groups) {
    const ai = l.teams[aiId];
    if (!ai) continue;
    const aiPhase = teamPhase(ai);
    // 对方对"我要的东西"的估价（他们索要多少）；v2.6.2：队内前二当家按 1.5 倍要价——
    //   反向搜索的筹码剪枝窗口必须跟着放大，否则会漏掉"需要多付才能换来当家"的可行方案。
    const aiTop2 = top2Ids(ai);
    const wantVal = want.pids.reduce((s, pid) => {
      const p = ai.players.find((q) => q.id === pid);
      return s + (p ? phaseValue(p, aiPhase) * (aiTop2.has(p.id) ? TOP2_PREMIUM : 1) : 0);
    }, 0) + want.picks.reduce((s, i) => s + pv(i) * phasePickWeight(aiPhase), 0);
    if (wantVal <= 0) continue;
    // 我方可动筹码（被锁定的球员不可交易）；价值剪枝：只保留与对方要价同量级的候选
    const cands = me.players
      .filter((p) => !locked.has(p.id))
      .map((p) => ({ p, v: phaseValue(p, aiPhase) }))
      .filter((x) => x.v >= wantVal * 0.4 && x.v <= wantVal * 2.6)
      .sort((a, b) => Math.abs(a.v - wantVal) - Math.abs(b.v - wantVal))
      .slice(0, 10);
    const candPicks = l.draftPool
      .map((pk, i) => ({ pk, i, v: pv(i) * phasePickWeight(aiPhase) }))
      .filter((x) => x.pk.o === me.id && x.v <= wantVal * 2.2)
      .sort((a, b) => b.v - a.v)
      .slice(0, 4);

    const found: TargetSuggestion[] = [];
    const seen = new Set<string>();
    const tryGive = (gP: Player[], gK: number[]) => {
      if (!gP.length && !gK.length) return;
      const key = `${gP.map((p) => p.id).sort((a, b) => a - b).join(',')}|${[...gK].sort((a, b) => a - b).join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);
      const verdict = evaluateTrade(l, me.id, aiId, gP.map((p) => p.id), want.pids, gK, want.picks);
      if (!verdict.accept) return;
      const gvAll = gP.reduce((s, p) => s + myVal(p), 0) + gK.reduce((s, i) => s + pv(i) * phasePickWeight(myPhase), 0);
      const wvAll = want.pids.reduce((s, pid) => {
        const p = ai.players.find((q) => q.id === pid);
        return s + (p ? myVal(p) : 0);
      }, 0) + want.picks.reduce((s, i) => s + pv(i) * phasePickWeight(myPhase), 0);
      const names = [
        ...want.pids.map((pid) => ai.players.find((q) => q.id === pid)?.name ?? '?'),
        ...want.picks.map((i) => pickLabel(l, l.draftPool[i])),
      ];
      found.push({
        teamId: aiId,
        givePids: gP.map((p) => p.id),
        givePickIdx: gK,
        wantPids: want.pids,
        wantPickIdx: want.picks,
        reason: verdict.reason,
        gain: Math.round((wvAll - gvAll) * 100) / 100,
        myGiveVal: Math.round(gvAll * 100) / 100,
        myGetVal: Math.round(wvAll * 100) / 100,
        needsMore: false,
        note: `${ai.name} 愿意送出 ${names.join('、')}`,
      });
    };

    // ① 单人 / ② 单人 + 1 签 / ③ 两人打包 / ④ 两人 + 1 签
    for (const c of cands) tryGive([c.p], []);
    for (const c of cands.slice(0, 6)) for (const k of candPicks.slice(0, 2)) tryGive([c.p], [k.i]);
    for (let i = 0; i < Math.min(cands.length, 6); i++) {
      for (let j = i + 1; j < Math.min(cands.length, 6); j++) tryGive([cands[i].p, cands[j].p], []);
    }
    for (let i = 0; i < Math.min(cands.length, 5); i++) {
      for (let j = i + 1; j < Math.min(cands.length, 5); j++) {
        if (candPicks[0]) tryGive([cands[i].p, cands[j].p], [candPicks[0].i]);
      }
    }
    out.push(...found.sort((a, b) => b.gain - a.gain).slice(0, maxPerTeam));
  }
  out.sort((a, b) => b.gain - a.gain);
  return out;
}

// 用户球队的下一场
export function nextGameOf(l: LeagueState, teamId: number): { day: number; awayId: number; homeId: number } | null {
  for (let d = l.day; d < l.totalDays; d++) {
    const g = l.schedule[d].find((r) => r.awayId === teamId || r.homeId === teamId);
    if (g) return { day: d + 1, awayId: g.awayId, homeId: g.homeId };
  }
  return null;
}

export function playedCount(l: LeagueState, teamId: number): number {
  let c = 0;
  for (const r of l.results) {
    if (r.awayId === teamId || r.homeId === teamId) c++;
  }
  return c;
}
