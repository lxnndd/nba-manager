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

**注意**：本机沙箱是 danger-full-access（不要传 sandbox_permissions）；命令用 `cmd /c node_modules\.bin\<tool>.cmd`；
改完代码要跑完整验证链（档案 §9）并打包 `release\NBA-Manager-<version>.exe`。

我接下来会给你新的需求，请按档案里的工作方式推进（实现 → 全量验证 → 打包 → 更新 Changelog/使用说明 → 交付产物路径）。

---
