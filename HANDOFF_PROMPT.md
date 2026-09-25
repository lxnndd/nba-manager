# 新会话开场白（复制下面分隔线内的内容，粘贴到新对话第一条消息）

---

我要继续开发 NBA 经理项目（Electron + React + TypeScript 单机游戏）。

**第一步**：先读这两份文件，把项目状态装进上下文：
- `C:\Users\10709\Desktop\AI\nba-manager\PROJECT_LOG.md`（项目迁移档案：需求演化史、引擎规则速查、
  源码/UI 地图、验证链、环境经验、遗留 TODO）
- `C:\Users\10709\Desktop\AI\nba-manager\使用说明.txt`（玩法与规则说明，顶部是最新版本段）

**工作目录**：`C:\Users\10709\Desktop\AI\nba-manager`

**读完请做三件事**：
1. 用 3-5 句话复述：当前版本号、最新 exe 产物路径、引擎关键规则（球权/劳资线/选秀/交易估值）、上一版改了什么；
2. 跑一次基线验证确认没破：
   ```
   cmd /c node_modules\.bin\tsc.cmd -p .\tsconfig.json
   cmd /c node_modules\.bin\esbuild.cmd src/engine/selfTest.ts --bundle --platform=node --format=cjs --outfile=tools/.selfTest.cjs
   node tools/.selfTest.cjs
   ```
   报告结果（tsc 错误数、selfTest 失败数与真实名单场均/得分王等基线数字）；
3. 告诉我你建议的下一步（可选：档案 §11 遗留项）。

**注意（2026-09-20 修订）**：命令一律用 `cmd /c node_modules\.bin\<tool>.cmd`；
本机当前文件策略为 **danger-full-access、审批 never** → 所有命令（含 `vite build` / `electron-builder` /
CDP 冒烟）**直接跑即可，不要传 `sandbox_permissions`**（会被自动拒绝）。
仅当某次会话回到受限沙箱、且报 `spawn EPERM`（esbuild / electron-builder 需经命名管道 spawn 子进程）时，
才按当时的审批策略对同一条命令提权重试一次。
改完代码跑验证链（档案 §9；**v2.6.0 起"只测试改的功能"，全量 selfTest/ui-smoke 仅在发版前或改动涉及全局数值时跑**），
发版打包 `release\NBA-Manager-<version>.exe`。

**发版与清理约定（v2.6.4 起）**：
- **所有产物只留在项目自己的文件夹内，不要超出**：打包产物 =
  `C:\Users\10709\Desktop\AI\nba-manager\release\NBA-Manager-<version>.exe`，使用说明就是项目里的
  `使用说明.txt`；**绝不往上级目录（AI 根目录 / 桌面）复制或另存任何文件**——用户 2026-09-20 明确要求，
  之前加的"自动同步一份到桌面"（`tools/sync-desktop.mjs` / `npm run sync`）已因违反这条被删除，
  不要重新引入；
- `npm run dist` = `vite build` → `electron-builder` → `prune-old-releases.mjs`
  （**release 只留最新 1 个** exe），旧版本不再堆叠；
- **项目本体（源码 / 资源 / 配置 / 底层设定）一律不动**；AI 文件夹里其他项目的文件
  （声学论文 / 劫火八荒 / 洛克王国 / 海洋调查等）也一律不要碰。

我接下来会给你新的需求，请按档案里的工作方式推进（实现 → 全量验证 → 打包 → 更新 Changelog/使用说明 → 交付产物路径）。

---
