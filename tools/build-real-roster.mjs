// 把 nba2k27_curr.json（2K27 评分，2026-27 赛季阵容）转成游戏名单 src/engine/realRoster.ts
// 运行: node tools/build-real-roster.mjs
import fs from 'node:fs';
import { ZH } from './zh-names.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./raw/nba2k27_curr.json', import.meta.url), 'utf-8'));

// ---------- v2.3.0 老将年龄校准 ----------
// 2K 的 ratingHistory 只保留最近 18 个版本（2K10-2K27），2009 年及以前进入联盟的球员会被截断，
// 原来的"35 + hash%7"公式会给出 35-41 的随机年龄（威少被算成 41 岁，实际 37）。
// 这 17 人按真实出生年份校准（数值 = 2026-27 赛季时的年龄）。
const VET_AGE = {
  'Stephen Curry': 38,      // 1988-03-14
  'Kevin Durant': 37,       // 1988-09-29
  'LeBron James': 41,       // 1984-12-30
  'James Harden': 37,       // 1989-08-26
  'DeMar DeRozan': 37,      // 1989-08-07
  'Jrue Holiday': 36,       // 1990-06-12
  'Al Horford': 40,         // 1986-06-03
  'Brook Lopez': 38,        // 1988-04-01
  'Mike Conley': 38,        // 1987-10-11
  'DeAndre Jordan': 38,     // 1988-07-21
  'Kevin Love': 38,         // 1988-09-07
  'Nicolas Batum': 37,      // 1988-12-14
  'Eric Gordon': 37,        // 1988-12-25
  'Kyle Lowry': 40,         // 1986-03-25
  'Jeff Green': 40,         // 1986-08-28
  'Taj Gibson': 41,         // 1985-06-24
  'Russell Westbrook': 37,  // 1988-11-12
};

// ---------- v2.3.0 评分断崖修正 ----------
// 数据源对"已离开联盟"的老将会给断崖式降分（威少 2K26 = 80 → 2K27 = 42，delta -38）。
// 这类异常用上一版评分 - 3（正常衰退）替代，避免自由市场里出现 42 分的威少。
function fixedOverall(p) {
  const hist = p.ratingHistory ?? [];
  if (hist[0] && hist[0].delta <= -15 && hist[1] && hist[1].overall) {
    return Math.max(hist[1].overall - 3, 60);
  }
  return p.overall;
}

// 2K 队名 → 游戏内球队顺序（与 src/engine/data.ts TEAMS 的 0..29 对齐）
const TEAM_ORDER = [
  'Boston Celtics', 'New York Knicks', 'Philadelphia 76ers', 'Toronto Raptors', 'Brooklyn Nets',
  'Milwaukee Bucks', 'Cleveland Cavaliers', 'Indiana Pacers', 'Chicago Bulls', 'Detroit Pistons',
  'Miami Heat', 'Orlando Magic', 'Atlanta Hawks', 'Charlotte Hornets', 'Washington Wizards',
  'Denver Nuggets', 'Minnesota Timberwolves', 'Oklahoma City Thunder', 'Portland Trail Blazers', 'Utah Jazz',
  'Golden State Warriors', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Phoenix Suns', 'Sacramento Kings',
  'Dallas Mavericks', 'Houston Rockets', 'Memphis Grizzlies', 'New Orleans Pelicans', 'San Antonio Spurs',
];
const ABBR = ['BOS', 'NYK', 'PHI', 'TOR', 'BKN', 'MIL', 'CLE', 'IND', 'CHI', 'DET', 'MIA', 'ORL', 'ATL', 'CHA', 'WAS',
  'DEN', 'MIN', 'OKC', 'POR', 'UTA', 'GSW', 'LAC', 'LAL', 'PHX', 'SAC', 'DAL', 'HOU', 'MEM', 'NOP', 'SAS'];

// 确定性 hash（FNV-1a），供年龄/潜力微调 —— 每次构建结果一致
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

// 2K 细项属性 → 引擎七维（与 src/engine/gen.ts attrKeys 顺序一致: three,mid,inside,ath,def,pas,reb）
// v2.3：pos 由 inferPositions 推断（源数据 positions 顺序不可靠），不再直接用 positions[0]
function mapAttrs(p, pos = 'SF') {
  const at = p.attributes;
  const g = (k, d = 55) => (at && at[k] != null ? at[k] : d);
  // 内线终结
  const inside = Math.round(
    g('drivingLayup') * 0.22 + g('drivingDunk') * 0.16 + g('standingDunk') * 0.14 +
    g('closeShot') * 0.24 + g('postControl') * 0.14 + g('postHook') * 0.05 + g('postFade') * 0.05
  );
  // 中距离（中投为主 + 近距离修正）
  const mid = Math.round(g('midRangeShot') * 0.7 + g('closeShot') * 0.3);
  // 运动能力：外线吃速度，内线吃力量
  let ath;
  if (pos === 'PG' || pos === 'SG') {
    ath = Math.round(g('speed') * 0.28 + g('speedWithBall') * 0.22 + g('agility') * 0.2 + g('vertical') * 0.1 + g('stamina') * 0.12 + g('strength') * 0.08);
  } else if (pos === 'SF') {
    ath = Math.round(g('speed') * 0.2 + g('speedWithBall') * 0.15 + g('agility') * 0.16 + g('vertical') * 0.14 + g('stamina') * 0.15 + g('strength') * 0.2);
  } else {
    ath = Math.round(g('speed') * 0.12 + g('speedWithBall') * 0.08 + g('agility') * 0.12 + g('vertical') * 0.12 + g('stamina') * 0.15 + g('strength') * 0.41);
  }
  // 防守
  const def = Math.round(
    g('perimeterDefense') * 0.18 + g('interiorDefense') * 0.2 + g('block') * 0.14 +
    g('steal') * 0.14 + g('helpDefenseIQ') * 0.16 + g('defensiveConsistency') * 0.18
  );
  // 组织
  const pas = Math.round(g('passAccuracy') * 0.3 + g('passVision') * 0.25 + g('passIQ') * 0.2 + g('passPerception') * 0.15 + g('ballHandle') * 0.1);
  // 篮板
  const reb = Math.round(g('defensiveRebound') * 0.65 + g('offensiveRebound') * 0.35);
  return [
    c(g('threePointShot'), SC_3PT), c(mid, SC_OFF), c(inside, SC_OFF),
    c(ath, SC_DEF), c(def, SC_DEF), c(pas, SC_DEF), c(reb, SC_DEF),
  ];
}
const clamp99 = (v) => Math.max(25, Math.min(99, Math.round(v)));
// 2K 属性尺度整体偏高（联盟均值 ~78），引擎命中模型按均值 ~70 校准。
// 攻防同缩会互相抵消 → 进攻属性单独多压（三分最狠，压命中与产量；防守少压）
const c = (v, s) => clamp99(25 + (clamp99(v) - 25) * s);
const SC_OFF = 0.82; // mid / inside
const SC_3PT = 0.72; // three（直接决定命中率与出手权）
const SC_DEF = 0.88; // ath / def / pas / reb / body

// v0.3.7 身体/综合素质 7 项（str,spd,sta,ver,agi,dur,hus）→ 引擎 Player.body
function mapBody(p) {
  const at = p.attributes;
  const g = (k, d = 55) => (at && at[k] != null ? at[k] : d);
  return [
    c(g('strength'), SC_DEF),
    c((g('speed') + g('speedWithBall')) / 2, SC_DEF),
    c(g('stamina'), SC_DEF),
    c(g('vertical'), SC_DEF),
    c(g('agility'), SC_DEF),
    c(g('durability'), SC_DEF),
    c(g('hustle'), SC_DEF),
  ];
}

// v1.4：2K 35 项细项属性 → 18 项技能（展示 + 总评参考；总评 o 仍保留 2K official overall）
// 分组与 src/engine/gen.ts SKILL_KEYS 顺序一致：layup,post,three,mid,ft,handle,pass,vision,
// perimeter,interior,steal,block,iq,or,dr,speed,strength,vertical
function mapSkills(p) {
  const at = p.attributes;
  const g = (k, d = 55) => (at && at[k] != null ? at[k] : d);
  const cl = (v) => Math.max(25, Math.min(99, Math.round(v)));
  return [
    cl(g('drivingLayup') * 0.6 + g('standingDunk') * 0.4),                    // layup 篮下终结
    cl(g('postControl') * 0.7 + g('postHook') * 0.15 + g('postFade') * 0.15), // post 低位进攻
    g('threePointShot'),            // three 三分投射
    g('midRangeShot'),              // mid 中距离
    g('freeThrow'),                 // ft 罚球
    g('ballHandle'),                // handle 控球
    g('passAccuracy'),              // pass 传球
    cl(g('passVision') * 0.6 + g('passIQ') * 0.4),                            // vision 球场视野
    g('perimeterDefense'),          // perimeter 外线防守
    g('interiorDefense'),           // interior 内线防守
    g('steal'),                     // steal 抢断
    g('block'),                     // block 封盖
    cl(g('shotIQ') * 0.5 + g('helpDefenseIQ') * 0.5),                         // iq 篮球智商
    g('offensiveRebound'),          // or 进攻篮板
    g('defensiveRebound'),          // dr 防守篮板
    g('speed'),                     // speed 速度
    g('strength'),                  // strength 力量
    g('vertical'),                  // vertical 弹跳
  ];
}

// 18 项技能键序（与 src/engine/gen.ts SKILL_KEYS 一致）
const SKILL_KEYS = ['layup', 'post', 'three', 'mid', 'ft', 'handle', 'pass', 'vision', 'perimeter', 'interior', 'steal', 'block', 'iq', 'or', 'dr', 'speed', 'strength', 'vertical'];

function parseHeight(h) {
  const m = /^(\d+)'(\d{1,2})"/.exec(String(h ?? ''));
  if (!m) return 79; // 6'7" 兜底
  return Number(m[1]) * 12 + Number(m[2]);
}

// v2.3.0 体测数据：2K 源给的是 '235 lbs' / '8\'0"' 文本
function parseWeight(w) {
  const m = /(\d+)/.exec(String(w ?? ''));
  return m ? Number(m[1]) : 0;
}
function parseWingspan(s) {
  const m = /^(\d+)'(\d{1,2})/.exec(String(s ?? ''));
  return m ? Number(m[1]) * 12 + Number(m[2]) : 0;
}

// ---------- v2.3 位置推断（主位置 + 副位置）----------
// 背景：2K 数据源的 positions 数组顺序不可靠（如 Jalen Williams 6'5" 被标 C/PF、
//       Alex Caruso 被标 SF/PG 而实际是后场），且数据源给出的"第二位置"此前被引擎丢弃
//       （副位置由 POS_SEC[主位] 机械推导 → 卡鲁索变成 SF/PF）。
// 规则：① 源主位与身高严重冲突（超出典型身高区间 ~3 英寸）→ 取评分最高位置；
//       ② 具备"后卫技能包"且身高 ≤6'6" → 主位置提到 SG/PG；
//       ③ 否则尊重源主位（避免把本来正确的位置改坏）；
//       ④ 副位置 = 与主位相邻的位置中评分最高者（数据源第二位优先参与竞争）。
const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
const POS_FIT = {
  PG: { handle: .28, pass: .24, vision: .18, speed: .14, three: .10, steal: .06 },
  SG: { three: .26, mid: .22, handle: .16, perimeter: .16, speed: .12, steal: .08 },
  SF: { perimeter: .22, three: .18, layup: .14, dr: .14, strength: .13, handle: .10, speed: .09 },
  PF: { dr: .20, strength: .16, layup: .16, interior: .16, three: .14, block: .10, or: .08 },
  C: { interior: .24, block: .20, dr: .18, strength: .13, or: .09, post: .08, three: .08 },
};
// 位置典型身高区间（英寸）
const POS_H = { PG: [70, 78], SG: [73, 80], SF: [76, 82], PF: [79, 85], C: [82, 90] };
function heightFit(pos, h) {
  const [lo, hi] = POS_H[pos];
  if (h >= lo && h <= hi) return 6;
  const d = h < lo ? lo - h : h - hi;
  return 6 - d * 3.5; // 每超出 1 英寸扣 3.5 分
}
function scoreOf(pos, sk, h) {
  const w = POS_FIT[pos];
  let s = 0;
  for (const k of Object.keys(w)) s += sk[k] * w[k];
  return s + heightFit(pos, h);
}
const posAdj = (a, b) => Math.abs(POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)) === 1;
function inferPositions(p) {
  const h = parseHeight(p.height);
  const arr = mapSkills(p);
  const sk = {};
  SKILL_KEYS.forEach((k, i) => { sk[k] = arr[i]; });
  const scored = POS_ORDER.map((pos) => ({ pos, s: scoreOf(pos, sk, h) })).sort((a, b) => b.s - a.s);
  const src = (p.positions ?? []).filter((x) => POS_ORDER.includes(x));
  const srcMain = src[0];
  const guardPack = sk.handle >= 78 && sk.pass >= 72 && (sk.perimeter + sk.steal) / 2 >= 78 && h <= 78;
  let main;
  if (srcMain && heightFit(srcMain, h) <= -4) main = scored[0].pos;
  else if (guardPack) main = scoreOf('PG', sk, h) >= scoreOf('SG', sk, h) ? 'PG' : 'SG';
  else main = srcMain ?? scored[0].pos;
  // 副位置候选：数据源给出的另一位 + 与主位相邻的位置（身高不冲突者）
  const cands = new Set();
  for (const x of src) if (x !== main && posAdj(x, main) && heightFit(x, h) > -4) cands.add(x);
  for (const x of POS_ORDER) if (x !== main && posAdj(x, main) && heightFit(x, h) > -4) cands.add(x);
  let sec = scored.find((x) => cands.has(x.pos))?.pos;
  if (!sec) sec = scored.find((x) => x.pos !== main && posAdj(x.pos, main))?.pos ?? scored.find((x) => x.pos !== main).pos;
  return { pos: main, sec };
}
// 位置推断缓存（同一球员只算一次，保证排序/输出一致）
const posCache = new Map();
const posOf = (p) => {
  const key = p.name;
  if (!posCache.has(key)) posCache.set(key, inferPositions(p));
  return posCache.get(key);
};

// ---------- v2.3.0 位置深度均衡 ----------
// 每隊每個位置至少 2 人：某位置只有 1 人時該球員會打滿 48 分鐘（引擎按位置深度排輪換），
// 真實名單裡湖人 PG 只有東契奇一人時就出現過「場均 48 分鐘、38 分」的異常。
// 做法：人數 >2 的位置裡挑「對缺口位置契合度最高」的球員改打該位置（技能不動，只調主/副位置標籤）。
const skillsOfP = (p) => {
  const arr = mapSkills(p);
  const sk = {};
  SKILL_KEYS.forEach((k, i) => { sk[k] = arr[i]; });
  return sk;
};
function balancePositions(squad) {
  const info = new Map();
  for (const p of squad) {
    const r = posOf(p);
    info.set(p.name, { pos: r.pos, sec: r.sec });
  }
  const cnt = () => {
    const c = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    for (const p of squad) c[info.get(p.name).pos]++;
    return c;
  };
  for (let guard = 0; guard < 60; guard++) {
    const c = cnt();
    const need = POS_ORDER.find((k) => c[k] < 2);
    if (!need) break;
    const pool = squad.filter((p) => c[info.get(p.name).pos] > 2);
    // 优先从"与缺口位置相邻"的位置借人（PG←SG、SF←SG/PF…），避免把控卫改成小前这类离谱调整
    const strict = pool.filter((p) => posAdj(info.get(p.name).pos, need));
    const use = strict.length ? strict : pool;
    const cands = use
      .map((p) => ({ p, cur: info.get(p.name), s: scoreOf(need, skillsOfP(p), parseHeight(p.height)) }))
      .sort((a, b) => b.s - a.s);
    const pick = cands[0];
    if (!pick) break;
    let sec = pick.cur.pos;
    if (!posAdj(sec, need)) {
      const alt = POS_ORDER
        .filter((k) => k !== need && posAdj(k, need))
        .map((k) => ({ k, s: scoreOf(k, skillsOfP(pick.p), parseHeight(pick.p.height)) }))
        .sort((a, b) => b.s - a.s)[0];
      sec = alt ? alt.k : need;
    }
    info.set(pick.p.name, { pos: need, sec });
  }
  return info;
}

// 年龄推导：ratingHistory 长度 = 被 2K 收录的版本数 → 选秀届 ≈ 2027 - len
//   len=0 → 2026 届新秀（历史未回填）；len=2 → 2025 届(Flagg)；len=4 → 2023 届(Wemby)；
//   len=12 → 2015 届(Jokic/KAT)；len=18 → 2009 年前出道的老将(KD/Curry/LBJ，截断)
function estimateAge(p, h) {
  if (VET_AGE[p.name] != null) return VET_AGE[p.name]; // v2.3.0：截断带老将按真实出生年份
  const len = (p.ratingHistory ?? []).length;
  let draft;
  if (len >= 18) draft = 2009; // 老将截断带（未被 VET_AGE 覆盖时的兜底）
  else if (len === 0) draft = 2026;
  else draft = 2027 - len;
  if (draft <= 2009) return 35 + (h % 7); // 35-41（LBJ/KD/Curry 类）
  return 2026 - draft + 18 + (h % 4); // 选秀当年 18-21 岁
}

// 经验年数：ratingHistory 收录数 = 已征战赛季数（len=0 为 2026 届首年新秀）
//   2026-27 赛季：Doncic(len9)=第9年、Flagg(len2)=第2年、Dybantsa(len0)=第1年
function expOf(p) {
  const len = (p.ratingHistory ?? []).length;
  return len === 0 ? 1 : len;
}

function potentialOf(ovr, age, h) {
  let p = ovr;
  if (age <= 21) p = ovr + 8 + (h % 7);
  else if (age <= 23) p = ovr + 4 + (h % 6);
  else if (age <= 25) p = ovr + 1 + (h % 4);
  else if (age >= 31) p = ovr - 2;
  return Math.max(58, Math.min(99, p));
}

function contractOf(ovr) {
  if (ovr >= 88) return 4;
  if (ovr >= 82) return 3;
  return 2;
}

// ---------- 组队 ----------
const byTeam = new Map();
let faList = [];
for (const p of raw) {
  if (!p.team) continue;
  if (p.team === 'Free Agency') { faList.push(p); continue; }
  if (!byTeam.has(p.team)) byTeam.set(p.team, []);
  byTeam.get(p.team).push(p);
}

// 单个球员 → 输出行（c: 合同年数，自由球员为 0）；n 字段 = 中文译名；f 字段 = 大头照 slug（有资源才输出）
const zhMissing = [];
const zhOf = (name) => (ZH[name] ?? (zhMissing.push(name), name));
// v0.3.7 头像资源清单（tools/fetch-player-faces.mjs 产物；不存在则全部无头像 → 占位）
const faceOk = new Set();
try {
  const parsed = JSON.parse(fs.readFileSync(new URL('./raw/faces-ok.json', import.meta.url), 'utf-8'));
  // ⚠️ Set.add 只接受一个参数，不能 spread 展开（否则只加第一个）
  for (const s of parsed.ok) faceOk.add(s);
} catch { /* 无头像清单：先跑 fetch-player-faces.mjs 再重新生成本文件 */ }
function lineOf(p, contract, posOv) {
  const h = fnv(p.name);
  const age = estimateAge(p, h);
  const ovr = fixedOverall(p); // v2.3.0：断崖降分修正
  const { pos, sec } = posOv ?? posOf(p); // v2.3：主/副位置（推断 + 队伍深度均衡）
  const a = mapAttrs(p, pos);
  const b = mapBody(p);
  const s = mapSkills(p);
  const face = faceOk.has(p.slug) ? `, f: ${JSON.stringify(p.slug)}` : '';
  const wt = parseWeight(p.weight);
  const ws = parseWingspan(p.wingspan);
  const meas = `${wt ? `, wt: ${wt}` : ''}${ws ? `, ws: ${ws}` : ''}`;
  return {
    line: `    { n: ${JSON.stringify(zhOf(p.name))}, p: '${pos}', q: '${sec}', o: ${ovr}, a: ${age}, e: ${expOf(p)}, h: ${parseHeight(p.height)}${meas}, v: ${potentialOf(ovr, age, h)}, c: ${contract}${face}, b: [${b.join(',')}], r: [${a.join(',')}], s: [${s.join(',')}] },`,
    overall: ovr,
  };
}

const missing = [];
const out = [];
let total = 0;
let shortTeams = 0;
for (let i = 0; i < TEAM_ORDER.length; i++) {
  const tName = TEAM_ORDER[i];
  const squad = (byTeam.get(tName) ?? []).slice().sort((a, b) => fixedOverall(b) - fixedOverall(a)).slice(0, 15);
  if (squad.length < 15) { shortTeams++; missing.push(`${ABBR[i]} 只有 ${squad.length} 人`); }
  // v2.3.0 位置深度均衡（每位置 ≥2 人），再按 位置(引擎序 PG..C) + ovr 降序 = 引擎轮换深度序
  const posMap = balancePositions(squad);
  const posRank = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  squad.sort((a, b) => {
    const pa = posRank[posMap.get(a.name).pos] ?? 9;
    const pb = posRank[posMap.get(b.name).pos] ?? 9;
    return pa - pb || fixedOverall(b) - fixedOverall(a) || a.name.localeCompare(b.name);
  });
  const lines = squad.map((p) => lineOf(p, contractOf(fixedOverall(p)), posMap.get(p.name)).line);
  total += squad.length;
  out.push(`  // ${ABBR[i]} ${tName} (${squad.length}人)\n  { t: '${ABBR[i]}', players: [\n${lines.join('\n')}\n  ] },`);
}

// ---------- 自由球员（首个休赛期 FA 池；c=0 无合同） ----------
faList.sort((a, b) => fixedOverall(b) - fixedOverall(a));
const faLines = faList.map((p) => lineOf(p, 0).line);

const header = `// ⚠️ 本文件由 tools/build-real-roster.mjs 自动生成，请勿手改。
// 数据源: nba2kapi.com（抓自 2kratings.com 的 NBA 2K27 现役评分，2026-09 更新，对应 2026-27 赛季阵容）
import type { Pos } from './types';

export interface RealPlayerInfo {
  n: string;   // 姓名（中文译名）
  p: Pos;      // 主位置（v2.3：由 inferPositions 依身高+技能推断，不再直接取源 positions[0]）
  q: Pos;      // 副位置（v2.3：源数据第二位置或相邻位置；此前引擎按 POS_SEC 机械推导，已弃用）
  o: number;   // 总评 (2K overall)
  a: number;   // 年龄（按 2K 收录年数推算的估计值）
  e: number;   // 经验年数（ratingHistory 收录数，2026-27 赛季视角）
  h: number;   // 身高（英寸）
  wt?: number; // v2.3.0 体重（磅）
  ws?: number; // v2.3.0 臂展（英寸）
  v: number;   // 潜力上限
  c: number;   // 合同年数（0 = 自由球员）
  f?: string;  // 大头照资源 slug（无 = 占位）
  b: [number, number, number, number, number, number, number]; // 身体: str,spd,sta,ver,agi,dur,hus
  r: [number, number, number, number, number, number, number]; // 属性: three,mid,inside,ath,def,pas,reb
  s: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]; // v1.4 18 项技能（2K 官方属性映射；总评保留 o）
}

// 30 队，顺序与 data.ts TEAMS 一致
export const REAL_ROSTER: { t: string; players: RealPlayerInfo[] }[] = [
`;

const CHECK_ONLY = process.argv.includes('--check');
if (CHECK_ONLY) {
  // 只预览位置修正结果（不写文件）：旧口径 = 源 positions[0] + POS_SEC 推导副位置
  const POS_SEC = { PG: 'SG', SG: 'SF', SF: 'PF', PF: 'C', C: 'PF' };
  const rows = [];
  for (const p of raw) {
    const { pos, sec } = posOf(p);
    const oldMain = p.positions?.[0] ?? 'SF';
    const oldSec = POS_SEC[oldMain] ?? oldMain;
    if (oldMain !== pos || oldSec !== sec) rows.push(`${p.name} | ${p.height} | ${oldMain}/${oldSec} → ${pos}/${sec}  (源 ${(p.positions ?? []).join('/')})`);
  }
  console.log(`位置变化 ${rows.length} / ${raw.length} 人（${(rows.length / raw.length * 100).toFixed(1)}%）`);
  console.log(rows.join('\n'));
  process.exit(0);
}

fs.writeFileSync(new URL('../src/engine/realRoster.ts', import.meta.url),
  header + out.join('\n') + '\n];\n\n' +
  `// 初始自由球员池（2K Free Agency 组，OVR 降序；供首个休赛期 FA 市场）\n` +
  `export const REAL_FA: RealPlayerInfo[] = [\n${faLines.join('\n')}\n];\n\n` +
  `// 原名 → 中文译名（供旧存档迁移改名；键 = 数据源原名，含上游个别 mojibake 字符）\n` +
  `export const ZH_NAME_MAP: Record<string, string> = {\n` +
  Object.keys(ZH).map((en) => `  ${JSON.stringify(en)}: ${JSON.stringify(ZH[en])},`).join('\n') +
  `\n};\n`, 'utf-8');
console.log(`OK: ${total} 名真实球员 + ${faLines.length} 名自由球员 → src/engine/realRoster.ts`);
if (zhMissing.length) console.log('⚠️ 未翻译姓名（已保留英文原文）:', zhMissing.length, '个 →', zhMissing.join('; '));
if (shortTeams) console.log('短名单球队(游戏内将自动补 1-2 名虚构新秀):', missing.join('; '));
const over85 = raw.filter((p) => fixedOverall(p) >= 85).length;
console.log(`全联盟 OVR≥85: ${over85} 人`);
