// 数据分析：检查 nba2k27_curr.json 的完整性（每队人数/位置/字段/评分分布）
import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(new URL('./raw/nba2k27_curr.json', import.meta.url), 'utf-8'));
console.log('total players:', raw.length);

// 字段确认
const sample = raw[0];
console.log('player keys:', Object.keys(sample).join(', '));
console.log('has age?', 'age' in sample || 'dateOfBirth' in sample || 'birthDate' in sample);

// 组队
const byTeam = new Map();
for (const p of raw) {
  const t = p.team ?? '(none)';
  if (!byTeam.has(t)) byTeam.set(t, []);
  byTeam.get(t).push(p);
}
const teamList = [...byTeam.entries()].sort((a, b) => b[1].length - a[1].length);
console.log('\nteams:', teamList.length);
for (const [t, ps] of teamList) {
  const posMissing = ps.filter((p) => !p.positions?.length).length;
  console.log(`  ${t}: ${ps.length} players${posMissing ? ` (${posMissing} no pos)` : ''}`);
}

// 高度样例
console.log('\nheight samples:', raw.slice(0, 5).map((p) => `${p.name}=${p.height}`).join(' | '));

// attrs 键全集
const keys = new Set();
for (const p of raw) if (p.attributes) for (const k of Object.keys(p.attributes)) keys.add(k);
console.log('\nattr keys (%d): %s', keys.size, [...keys].sort().join(', '));

// overall 分布
const ovr = raw.map((p) => p.overall).sort((a, b) => b - a);
console.log('\novr top15:', ovr.slice(0, 15).join(', '));
console.log('ovr >= 90:', ovr.filter((o) => o >= 90).length, '| >=85:', ovr.filter((o) => o >= 85).length, '| <70:', ovr.filter((o) => o < 70).length);

// 名字唯一性
const names = raw.map((p) => p.name);
console.log('unique names:', new Set(names).size, '/', names.length);
