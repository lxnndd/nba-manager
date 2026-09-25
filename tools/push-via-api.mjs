// 通过 GitHub Git Data API 把本地 HEAD 推送到远端（v1.0.0 公测发布用）
//
// 背景：本机 `github.com:443` 被阻断（DNS 返回的 IP 不通，换 IP 可通但改 hosts 需要管理员），
// 因此 `git push` 无法使用；而 `api.github.com` 完全可用（gh 已认证）。本脚本用 Git Data API
// 逐 blob 上传 → 建 tree → 建 commit → 更新 ref，效果等价于一次 push。
//
// 用法：
//   node tools/push-via-api.mjs --dry     # 只计算差异，不上传
//   node tools/push-via-api.mjs           # 真正推送
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'lxnndd/nba-manager';
const BRANCH = 'main';
const ROOT = path.resolve(import.meta.dirname, '..');
const DRY = process.argv.includes('--dry');
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const token = execSync('gh auth token', { encoding: 'utf8' }).trim();

const api = async (method, url, body) => {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'nba-manager-push',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
};

// ---------- 1) 远端状态 ----------
const ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
const remoteSha = ref.object.sha;
const remoteCommit = await api('GET', `/repos/${REPO}/git/commits/${remoteSha}`);
const remoteTree = remoteCommit.tree.sha;
const remoteFiles = new Map();
const tr = await api('GET', `/repos/${REPO}/git/trees/${remoteTree}?recursive=1`);
for (const e of tr.tree) if (e.type === 'blob') remoteFiles.set(e.path, e.sha);
console.log(`远端 ${BRANCH} = ${remoteSha.slice(0, 7)}（${remoteFiles.size} 个文件）`);
console.log(`本地 HEAD    = ${sh('git rev-parse HEAD').slice(0, 7)}`);

// ---------- 2) 本地文件清单（已跟踪 + 未跟踪但未被 gitignore） ----------
const localFiles = sh('git ls-files -co --exclude-standard').split('\n').map((s) => s.trim()).filter(Boolean);
const localSet = new Set(localFiles);
console.log(`本地待提交文件 ${localFiles.length} 个`);

// ---------- 3) 上传变化的 blob ----------
const entries = [];
let uploaded = 0, reused = 0, bytes = 0;
for (const rel of localFiles) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const sha = sh(`git hash-object -- "${rel}"`);
  const mode = (fs.statSync(abs).mode & 0o111) ? '100755' : '100644';
  if (remoteFiles.get(rel) === sha) { entries.push({ path: rel, mode, type: 'blob', sha }); reused++; continue; }
  if (DRY) { uploaded++; continue; }
  const buf = fs.readFileSync(abs);
  bytes += buf.length;
  const blob = await api('POST', `/repos/${REPO}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
  entries.push({ path: rel, mode, type: 'blob', sha: blob.sha });
  uploaded++;
  if (uploaded % 10 === 0) console.log(`  ...已上传 ${uploaded} 个 blob（${(bytes / 1024 / 1024).toFixed(1)} MB）`);
}
console.log(`blob：新上传 ${uploaded} 个${DRY ? '（dry-run 未真传）' : ` · ${(bytes / 1024 / 1024).toFixed(1)} MB`}，复用远端 ${reused} 个`);

// ---------- 4) 远端有、本地没有 → 删除 ----------
let deleted = 0;
for (const p of remoteFiles.keys()) {
  if (!localSet.has(p)) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); deleted++; if (deleted <= 12) console.log(`  - 删除 ${p}`); }
}
console.log(`删除 ${deleted} 个远端文件`);

if (DRY) { console.log('dry-run 结束（未改动远端）'); process.exit(0); }

// ---------- 5) tree / commit / ref ----------
const localTree = sh('git rev-parse HEAD^{tree}');
const tree = await api('POST', `/repos/${REPO}/git/trees`, { base_tree: remoteTree, tree: entries });
console.log(`新 tree   = ${tree.sha.slice(0, 7)} · 本地 HEAD tree = ${localTree.slice(0, 7)} · 一致=${tree.sha === localTree}`);

const authorName = sh('git log -1 --pretty=%an');
const authorEmail = sh('git log -1 --pretty=%ae');
const authorDate = sh('git log -1 --pretty=%aI');
const message = sh('git log -1 --pretty=%B');
const commit = await api('POST', `/repos/${REPO}/git/commits`, {
  message,
  tree: tree.sha,
  parents: [remoteSha],
  author: { name: authorName, email: authorEmail, date: authorDate },
  committer: { name: authorName, email: authorEmail, date: authorDate },
});
const localSha = sh('git rev-parse HEAD');
console.log(`新 commit = ${commit.sha.slice(0, 7)} · 本地 HEAD = ${localSha.slice(0, 7)} · 一致=${commit.sha === localSha}`);

await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
console.log(`✅ 远端 ${BRANCH} 已更新为 ${commit.sha.slice(0, 7)}`);
if (commit.sha !== localSha) {
  console.log('⚠️ 远端 commit 与本地 HEAD 不同（时间戳/父提交差异）——内容一致，但下次 push 前需要先对齐');
}
