// 把 nba2k27_curr.json（2K27 评分，2026-27 赛季阵容）转成游戏名单 src/engine/realRoster.ts
// 运行: node tools/build-real-roster.mjs
import fs from 'node:fs';
import { ZH } from './zh-names.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./raw/nba2k27_curr.json', import.meta.url), 'utf-8'));

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
function mapAttrs(p) {
  const at = p.attributes;
  const g = (k, d = 55) => (at && at[k] != null ? at[k] : d);
  const pos = p.positions?.[0] ?? 'SF';
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

function parseHeight(h) {
  const m = /^(\d+)'(\d{1,2})"/.exec(String(h ?? ''));
  if (!m) return 79; // 6'7" 兜底
  return Number(m[1]) * 12 + Number(m[2]);
}

// 年龄推导：ratingHistory 长度 = 被 2K 收录的版本数 → 选秀届 ≈ 2027 - len
//   len=0 → 2026 届新秀（历史未回填）；len=2 → 2025 届(Flagg)；len=4 → 2023 届(Wemby)；
//   len=12 → 2015 届(Jokic/KAT)；len=18 → 2009 年前出道的老将(KD/Curry/LBJ，截断)
function estimateAge(p, h) {
  const len = (p.ratingHistory ?? []).length;
  let draft;
  if (len >= 18) draft = 2009; // 老将截断带
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
function lineOf(p, contract) {
  const h = fnv(p.name);
  const age = estimateAge(p, h);
  const a = mapAttrs(p);
  const b = mapBody(p);
  const s = mapSkills(p);
  const pos = p.positions[0];
  const face = faceOk.has(p.slug) ? `, f: ${JSON.stringify(p.slug)}` : '';
  return {
    line: `    { n: ${JSON.stringify(zhOf(p.name))}, p: '${pos}', o: ${p.overall}, a: ${age}, e: ${expOf(p)}, h: ${parseHeight(p.height)}, v: ${potentialOf(p.overall, age, h)}, c: ${contract}${face}, b: [${b.join(',')}], r: [${a.join(',')}], s: [${s.join(',')}] },`,
    overall: p.overall,
  };
}

const missing = [];
const out = [];
let total = 0;
let shortTeams = 0;
for (let i = 0; i < TEAM_ORDER.length; i++) {
  const tName = TEAM_ORDER[i];
  const squad = (byTeam.get(tName) ?? []).slice().sort((a, b) => b.overall - a.overall).slice(0, 15);
  if (squad.length < 15) { shortTeams++; missing.push(`${ABBR[i]} 只有 ${squad.length} 人`); }
  // 同队按 位置(引擎序 PG..C) + ovr 降序排列 = 引擎轮换深度序
  const posRank = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
  squad.sort((a, b) => {
    const pa = posRank[a.positions?.[0]] ?? 9;
    const pb = posRank[b.positions?.[0]] ?? 9;
    return pa - pb || b.overall - a.overall || a.name.localeCompare(b.name);
  });
  const lines = squad.map((p) => lineOf(p, contractOf(p.overall)).line);
  total += squad.length;
  out.push(`  // ${ABBR[i]} ${tName} (${squad.length}人)\n  { t: '${ABBR[i]}', players: [\n${lines.join('\n')}\n  ] },`);
}

// ---------- 自由球员（首个休赛期 FA 池；c=0 无合同） ----------
faList.sort((a, b) => b.overall - a.overall);
const faLines = faList.map((p) => lineOf(p, 0).line);

const header = `// ⚠️ 本文件由 tools/build-real-roster.mjs 自动生成，请勿手改。
// 数据源: nba2kapi.com（抓自 2kratings.com 的 NBA 2K27 现役评分，2026-09 更新，对应 2026-27 赛季阵容）
import type { Pos } from './types';

export interface RealPlayerInfo {
  n: string;   // 姓名（中文译名）
  p: Pos;      // 位置（2K 主位）
  o: number;   // 总评 (2K overall)
  a: number;   // 年龄（按 2K 收录年数推算的估计值）
  e: number;   // 经验年数（ratingHistory 收录数，2026-27 赛季视角）
  h: number;   // 身高（英寸）
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
const over85 = raw.filter((p) => p.overall >= 85).length;
console.log(`全联盟 OVR≥85: ${over85} 人`);
