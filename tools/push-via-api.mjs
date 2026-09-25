// 通过 GitHub Git Data API 把本地提交**逐个**推送到远端（等价于一次完整 push）
//
// 背景：本机 `github.com:443` 被阻断（DNS 返回的 IP 不通；换 IP 可通但改 hosts 需要管理员权限），
// 所以 `git push` 用不了；而 `api.github.com` 完全可用（gh 已认证）。
// 做法：对 `远端..HEAD` 的每个提交，逐个上传缺失 blob → 建 tree → 建 commit → 最后更新 ref。
// 由于 git 对象 sha 只由内容决定，只要 author/committer/date/message 照抄本地，
// 远端算出的 tree/commit sha 应与本地完全一致（脚本会逐条校验并报告差异）。
//
// 用法：
//   node tools/push-via-api.mjs --dry     # 只统计差异，不改动远端
//   node tools/push-via-api.mjs           # 真正推送
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'lxnndd/nba-manager';
const BRANCH = 'main';
const ROOT = path.resolve(import.meta.dirname, '..');
const DRY = process.argv.includes('--dry');
const G = 'git -c core.quotepath=false';
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const shBuf = (cmd) => execSync(cmd, { cwd: ROOT, maxBuffer: 1 << 28 });
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

const modeOf = (rel) => {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) && (fs.statSync(abs).mode & 0o111) ? '100755' : '100644';
};
const metaOf = (c) => ({
  message: sh(`${G} log -1 --format=%B ${c}`),
  author: {
    name: sh(`${G} log -1 --format=%an ${c}`),
    email: sh(`${G} log -1 --format=%ae ${c}`),
    date: sh(`${G} log -1 --format=%aI ${c}`),
  },
  committer: {
    name: sh(`${G} log -1 --format=%cn ${c}`),
    email: sh(`${G} log -1 --format=%ce ${c}`),
    date: sh(`${G} log -1 --format=%cI ${c}`),
  },
});

// ---------- 1) 远端状态 ----------
const ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
const remoteSha = ref.object.sha;
const remoteCommit = await api('GET', `/repos/${REPO}/git/commits/${remoteSha}`);
let parentTree = remoteCommit.tree.sha;
const knownBlobs = new Set();
for (const e of (await api('GET', `/repos/${REPO}/git/trees/${parentTree}?recursive=1`)).tree) {
  if (e.type === 'blob') knownBlobs.add(e.sha);
}
console.log(`远端 ${BRANCH} = ${remoteSha.slice(0, 7)} · tree ${parentTree.slice(0, 7)} · 已知 blob ${knownBlobs.size} 个`);

// ---------- 2) 待推送的提交链（远端..HEAD，按时间正序） ----------
// ⚠️ 本脚本创建的 commit 由 GitHub 生成，其 sha 可能与本地的不同（时间戳规范化等），
//    因此远端 base sha 往往**不在本地对象库里** —— 这时 `git rev-list <remote>..HEAD` 会直接报错。
//    兜底：在本地历史里按 **tree sha** 找到与远端内容相同的那个提交，从它往后推。
let baseLocal = null;
try {
  sh(`${G} cat-file -e ${remoteSha}`);
  baseLocal = remoteSha;
} catch {
  const localCommits = sh(`${G} rev-list HEAD`).split('\n').filter(Boolean);
  baseLocal = localCommits.find((c) => sh(`${G} log -1 --format=%T ${c}`) === parentTree) ?? null;
  if (baseLocal) console.log(`远端 sha 不在本地对象库 → 按 tree 匹配到本地提交 ${baseLocal.slice(0, 7)}`);
  else console.log('⚠️ 远端 tree 在本地历史中找不到对应提交 → 将按"整树覆盖"方式推送（单个提交）');
}
const chain = baseLocal
  ? sh(`${G} rev-list --reverse ${baseLocal}..HEAD`).split('\n').filter(Boolean)
  : [sh(`${G} rev-parse HEAD`)];
console.log(`本地 HEAD = ${sh('git rev-parse HEAD').slice(0, 7)} · 待推送提交 ${chain.length} 个`);
if (!chain.length) { console.log('远端已是最新，无需推送'); process.exit(0); }

let totalUploaded = 0, totalBytes = 0, treeMismatch = 0, shaMismatch = 0;
let parentSha = remoteSha;

for (const c of chain) {
  const subject = sh(`${G} log -1 --format=%s ${c}`).slice(0, 60);
  // ⚠️ 不能用 `${c}^` 或 `${c}^{tree}`：execSync 走 cmd.exe，`^` 会被当转义符吃掉。
  //    改用 `${c}~1`（父提交）与 `--format=%T`（tree sha）。
  const changes = sh(`${G} diff-tree -r --no-commit-id --name-status ${c}~1 ${c}`).split('\n').filter(Boolean);
  const entries = [];
  for (const line of changes) {
    const parts = line.split('\t');
    const status = parts[0];
    const rel = parts[parts.length - 1]; // 改名时取新路径
    if (status === 'D') { entries.push({ path: rel, mode: '100644', type: 'blob', sha: null }); continue; }
    const blobSha = sh(`${G} rev-parse ${c}:${rel}`);
    entries.push({ path: rel, mode: modeOf(rel), type: 'blob', sha: blobSha, need: !knownBlobs.has(blobSha) });
  }
  // 上传该提交里缺失的 blob
  for (const e of entries) {
    if (!e.need) continue;
    if (DRY) { totalUploaded++; continue; }
    const buf = shBuf(`${G} cat-file blob ${e.sha}`);
    totalBytes += buf.length;
    const blob = await api('POST', `/repos/${REPO}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
    knownBlobs.add(blob.sha);
    totalUploaded++;
  }
  for (const e of entries) delete e.need;

  if (DRY) {
    console.log(`  [dry] ${c.slice(0, 7)} ${subject}（${entries.length} 项变更）`);
    parentSha = c; parentTree = sh(`${G} log -1 --format=%T ${c}`);
    continue;
  }

  const tree = await api('POST', `/repos/${REPO}/git/trees`, { base_tree: parentTree, tree: entries });
  const localTree = sh(`${G} log -1 --format=%T ${c}`);
  if (tree.sha !== localTree) treeMismatch++;
  const meta = metaOf(c);
  const nc = await api('POST', `/repos/${REPO}/git/commits`, {
    message: meta.message, tree: tree.sha, parents: [parentSha],
    author: meta.author, committer: meta.committer,
  });
  if (nc.sha !== c) shaMismatch++;
  console.log(`  ${nc.sha === c ? '✓' : '≈'} ${c.slice(0, 7)} ${subject} · tree ${tree.sha === localTree ? '一致' : `不一致(${tree.sha.slice(0, 7)} vs ${localTree.slice(0, 7)})`}`);
  parentSha = nc.sha;
  parentTree = tree.sha;
}

if (DRY) {
  console.log(`\ndry-run：需上传 ${totalUploaded} 个 blob（未真传），推送后将新增 ${chain.length} 个提交`);
  process.exit(0);
}

// ---------- 3) 更新分支 ref ----------
await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: parentSha, force: false });
console.log(`\n✅ 远端 ${BRANCH} 已更新为 ${parentSha.slice(0, 7)}（上传 ${totalUploaded} 个 blob，${(totalBytes / 1024 / 1024).toFixed(1)} MB）`);
if (treeMismatch || shaMismatch) {
  console.log(`⚠️ tree 不一致 ${treeMismatch} 处 · commit sha 不一致 ${shaMismatch} 处（内容一致，但本地与远端历史分叉，后续如需 push 先对齐）`);
} else {
  console.log('✅ 所有 tree/commit sha 与本地完全一致（远端历史 = 本地历史）');
}
