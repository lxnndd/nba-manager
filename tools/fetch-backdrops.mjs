// 主菜单背景：Pexels（免费商用）篮球现场照，10 张 1920 宽横图
// 用法：node tools/fetch-backdrops.mjs
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'src', 'assets', 'backdrops');
await mkdir(outDir, { recursive: true });

const IDS = [
  38155497, // 室内球馆扣篮
  37356517, // 室内篮球赛动作
  33410880, // 室内体育赛事拍摄
  6777169,  // 球馆人群
  32600312, // 篮球
  31862569, // 比赛+观众
  34014534, // MrP13
  1752757,  // 篮球
  32900359, // 城市赛场
  33099342, // 户外场
  30382354, // 扣篮
  30619256, // 球场航拍
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const fetchBuf = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

let n = 0;
for (const id of IDS) {
  if (n >= 10) break;
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop`;
  try {
    const buf = await fetchBuf(url);
    if (buf.length < 40000) { console.log(`太小的图跳过 #${id} (${(buf.length / 1024).toFixed(0)}KB)`); continue; }
    const name = `backdrop-${String(n + 1).padStart(2, '0')}.jpg`;
    await writeFile(path.join(outDir, name), buf);
    n++;
    console.log(`✓ ${name} ← photo-${id} (${(buf.length / 1024).toFixed(0)}KB)`);
  } catch (e) {
    console.log(`✗ photo-${id}: ${e.message}`);
  }
}
console.log(`完成 ${n}/10`);
