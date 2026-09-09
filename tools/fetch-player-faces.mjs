// v0.3.7 球员大头照收集：2K raw(名称+slug) × alexnoob 2025-26 花名册(名称→NBA playerId) → NBA CDN 260x190 头照
// 运行: node tools/fetch-player-faces.mjs  （需网络；产物 src/assets/players/{slug}.png + tools/raw/faces-ok.json）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raw = JSON.parse(fs.readFileSync(new URL('./raw/nba2k27_curr.json', import.meta.url), 'utf-8'));
const roster = JSON.parse(fs.readFileSync(new URL('./raw/2025-26.NBA.Roster.json', import.meta.url), 'utf-8'));

const OUT_DIR = fileURLToPath(new URL('../src/assets/players/', import.meta.url));
fs.mkdirSync(OUT_DIR, { recursive: true });

// 名字归一化（小写、去变音符、去标点/空格）——两侧统一处理保证匹配
function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[.'’\-\s]/g, '');
}

// alexnoob: name → NBA playerId（仅 ak-static.cms.nba.com 官方头照；imgur 占位跳过）
const idByNorm = new Map();
let official = 0;
for (const p of roster.players) {
  const m = /headshots\/nba\/latest\/260x190\/(\d+)\.png/.exec(String(p.imgURL ?? ''));
  if (!m) continue;
  const id = Number(m[1]);
  if (!Number.isFinite(id)) continue;
  const key = norm(p.name);
  if (!idByNorm.has(key)) idByNorm.set(key, id);
  official++;
}
console.log(`alexnoob 官方头照记录: ${official} 条（可匹配 key ${idByNorm.size}）`);

// 2K 全量球员（648）按 slug 收集待下清单
const wanted = [];
const seen = new Set();
for (const p of raw) {
  const slug = String(p.slug ?? '').trim();
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);
  const id = idByNorm.get(norm(p.name));
  if (id) wanted.push({ slug, name: p.name, id });
  else wanted.push({ slug, name: p.name, id: null });
}
console.log(`2K 球员待处理: ${wanted.length}；可匹配 ID: ${wanted.filter((w) => w.id).length}；无图: ${wanted.filter((w) => !w.id).length}`);

// 并发下载（20 路）
const CDN = (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
let ok = 0, fail = 0, skip = 0;
const okSlugs = [];
const errs = [];
const queue = wanted.filter((w) => w.id);
const CONC = 20;
for (let i = 0; i < queue.length; i += CONC) {
  const batch = queue.slice(i, i + CONC);
  await Promise.all(batch.map(async (w) => {
    const fp = path.join(OUT_DIR, `${w.slug}.png`);
    try {
      const res = await fetch(CDN(w.id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error(`too small ${buf.length}`);
      fs.writeFileSync(fp, buf);
      okSlugs.push(w.slug);
      ok++;
    } catch (e) {
      fail++;
      errs.push(`${w.name}(${w.slug}) ${e.message}`);
    }
  }));
  process.stdout.write(`\r头像下载 ${i + batch.length}/${queue.length}（OK ${ok} / FAIL ${fail}）`);
}
console.log();

// 成功清单 → 转换器用（决定 RealPlayerInfo 是否输出 f 字段）
fs.writeFileSync(new URL('./raw/faces-ok.json', import.meta.url),
  JSON.stringify({ ok: okSlugs.sort(), total: wanted.length, matched: queue.length }, null, 1), 'utf-8');
console.log(`\n完成：下载成功 ${ok}，失败 ${fail}，未匹配 ${wanted.length - queue.length}`);
if (errs.length) console.log('失败样例（最多 15）:\n' + errs.slice(0, 15).join('\n'));
console.log(`faces-ok.json 已写（成功 ${okSlugs.length} 个 slug）`);
