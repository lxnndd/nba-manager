// 一次性抓取 nba2kapi 现役球员全量 → tools/raw/nba2k27_curr.json
// 运行: node tools/fetch-nba2k.mjs  (需网络，沙箱需 full access)
const BASE = 'https://api.nba2kapi.com/api/public/players';
const OUT = new URL('./raw/nba2k27_curr.json', import.meta.url);

const all = [];
let cursor = null;
let page = 0;
for (;;) {
  const url = new URL(BASE);
  url.searchParams.set('teamType', 'curr');
  url.searchParams.set('limit', '100');
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url);
  if (!res.ok) {
    console.error('HTTP', res.status, 'at page', page);
    process.exit(1);
  }
  const j = await res.json();
  const list = j.data ?? [];
  all.push(...list);
  page++;
  console.log(`page ${page}: +${list.length} (total ${all.length})`);
  if (!list.length) break;
  const next = j.meta?.pagination?.nextCursor ?? j.meta?.nextCursor ?? j.pagination?.nextCursor;
  if (!next || next === cursor) break;
  cursor = next;
  if (page > 20) { console.error('pagination runaway, abort'); process.exit(1); }
}

const fs = await import('node:fs');
fs.writeFileSync(OUT, JSON.stringify(all, null, 1), 'utf-8');
console.log('saved', all.length, 'players ->', OUT.pathname);
