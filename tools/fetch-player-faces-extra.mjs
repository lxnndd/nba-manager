// v1.0 球员头像补齐：30 队 roster 中缺头照者（2026 届新秀等，不在 alexnoob 名单）→ 2kratings 大图
// 运行: node tools/fetch-player-faces-extra.mjs  （需网络；产物 src/assets/players/{slug}.jpg + 合并 faces-ok.json）
import fs from 'node:fs';
import { ZH } from './zh-names.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./raw/nba2k27_curr.json', import.meta.url), 'utf-8'));
const src = fs.readFileSync(new URL('../src/engine/realRoster.ts', import.meta.url), 'utf-8');
const faceDir = new URL('../src/assets/players/', import.meta.url);

// REAL_ROSTER 段中文名集合
const roStart = src.indexOf('export const REAL_ROSTER');
const roEnd = src.indexOf('export const REAL_FA');
const block = src.slice(roStart, roEnd < 0 ? undefined : roEnd);
const rosterZh = new Set([...block.matchAll(/\bn:\s*"([^"]+)"/g)].map((m) => m[1]));
console.log('REAL_ROSTER 中文名条目:', rosterZh.size);

// 缺图者 = roster 中文名能通过 ZH 反查到 raw 条目、且无 png 者
const missing = [];
for (const p of raw) {
  const zh = ZH[p.name];
  if (!zh || !rosterZh.has(zh)) continue;
  const slug = String(p.slug ?? '').trim();
  if (!slug) continue;
  const fp = new URL(`../src/assets/players/${slug}.png`, import.meta.url);
  if (fs.existsSync(fp)) continue;
  if (typeof p.playerImage === 'string' && /^https?:/.test(p.playerImage)) {
    missing.push({ slug, name: p.name, zh, url: p.playerImage });
  } else {
    console.log(`跳过（无 playerImage）: ${p.name} [${zh}]`);
  }
}
console.log(`待下载缺图球员: ${missing.length}`);
if (!missing.length) { console.log('无需下载'); process.exit(0); }

// 并发下载（10 路），落到 {slug}.jpg
const CONC = 10;
let ok = 0, fail = 0;
const okSlugs = [];
const errs = [];
for (let i = 0; i < missing.length; i += CONC) {
  const batch = missing.slice(i, i + CONC);
  await Promise.all(batch.map(async (w) => {
    const fp = new URL(`../src/assets/players/${w.slug}.jpg`, import.meta.url);
    try {
      const res = await fetch(w.url);
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
  process.stdout.write(`\r头像补齐 ${i + batch.length}/${missing.length}（OK ${ok} / FAIL ${fail}）`);
}
console.log();

// 合并 faces-ok.json（转换器据此输出 f 字段）
const facesOkPath = new URL('./raw/faces-ok.json', import.meta.url);
const facesOk = JSON.parse(fs.readFileSync(facesOkPath, 'utf-8'));
const merged = [...new Set([...facesOk.ok, ...okSlugs])].sort();
fs.writeFileSync(facesOkPath, JSON.stringify({ ...facesOk, ok: merged }, null, 1), 'utf-8');
console.log(`完成：新增 ${ok}，失败 ${fail}；faces-ok.json ok=${merged.length}`);
if (errs.length) console.log('失败样例（最多 15）:\n' + errs.slice(0, 15).join('\n'));
