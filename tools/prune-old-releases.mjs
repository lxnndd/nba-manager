// 自动清理 release 目录的历史版本 exe：只保留最近 KEEP 个版本，其余删除。
// 用法：node tools/prune-old-releases.mjs [keep]
// 集成：package.json 的 dist 脚本在 electron-builder 之后调用（新版本产出后再清理）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const keep = Number(process.argv[2] || 2); // 保留最近 N 个版本（默认 2）
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');

if (!fs.existsSync(releaseDir)) {
  console.log('release 目录不存在，跳过清理');
  process.exit(0);
}

const RE = /^NBA-Manager-(\d+)\.(\d+)\.(\d+)\.exe$/;
const files = fs.readdirSync(releaseDir)
  .filter((f) => RE.test(f))
  .map((f) => ({
    name: f,
    ver: f.match(RE).slice(1, 4).map(Number),
  }))
  // 按版本号降序（最新在前）
  .sort((a, b) => (b.ver[0] - a.ver[0]) || (b.ver[1] - a.ver[1]) || (b.ver[2] - a.ver[2]));

const toDelete = files.slice(keep);
const kept = files.slice(0, keep);

if (toDelete.length === 0) {
  console.log(`已保留最新 ${kept.length} 个版本：${kept.map((f) => f.name).join('、')}（无历史版本可删）`);
  process.exit(0);
}

let freed = 0;
for (const f of toDelete) {
  const p = path.join(releaseDir, f.name);
  try {
    freed += fs.statSync(p).size;
    fs.unlinkSync(p);
    console.log(`🗑️  删除 ${f.name}`);
  } catch (e) {
    console.log(`⚠️  删除失败 ${f.name}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`✅ 保留最新 ${keep} 个版本：${kept.map((f) => f.name).join('、')}`);
console.log(`释放空间：${(freed / 1024 / 1024).toFixed(1)} MB`);
