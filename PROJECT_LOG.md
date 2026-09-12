# 🏀 NBA 经理 · 项目迁移档案（PROJECT_LOG）

> 用途：把本项目的**全部对话成果**压缩成一份自包含文档。新会话只需读这份文件 + 仓库源码，
> 即可无缝接手开发，无需重看历史对话。
> 最后更新：v2.3.0（2026-09）。仓库：**https://github.com/lxnndd/nba-manager**（私有）。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 本地路径 | `C:\Users\10709\Desktop\AI\nba-manager` |
| 技术栈 | Electron 33 + React 19 + TypeScript 5.7 + Vite 6（纯离线单机，无后端） |
| 当前版本 | **2.3.0**（package.json / `src/App.tsx` 顶栏 / `src/ui/ChangelogModal.tsx`） |
| 交付产物 | `release\NBA-Manager-2.3.0.exe`（便携版，78.2MB，双击即玩） |
| 目标用户 | 用户的弟弟（玩英文名单的真实 NBA 模式）；玩家=一支 NBA 球队的总经理 |
| 名单模式 | `real`（2K27 真实名单，主力玩法）/ `fictional`（虚构名单，自测基线） |
| 存档 | `%APPDATA%\NBA经理\saves\auto.json`（Electron）或 localStorage 兜底；`SAVE_VERSION = 11` |
| 自测 | `src/engine/selfTest.ts`（虚构 + 真实双跑，300+ 断言，全绿才发版） |
| 本版主题 | 球星得分真实性（文班亚马修正）· 新秀榜与体测数据 · 位置修正 · 三年选秀权 + 次轮 · 乐透抽签/Stepien/新秀薪资 · AI 主动报价 · 事件权衡选项 · 国际新秀国籍与中文译名 · 交易搜索器 |

**本版（v2.3.0）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §4 数据管线 | 新增 `VET_AGE` 老将年龄表、`fixedOverall` 断崖降分修正、体测解析、位置推断与深度均衡、`NATION_POOLS` 国际姓名池 |
| §5.2 模拟 | 球权/出手/三分构成全部重标定（`coreBoost`、`ability^1.4`、`p3Base/p3Max` pull、`depthList`） |
| §5.5 选秀 | 60 签、乐透抽签、Stepien、薪资阶位、入队扩编、`draftComplete` bug 修复、国籍 60/3/17 与中文译名、实力梯度 |
| §5.7 交易 | 签带年份/轮次 + `pickValue` 动态定价 + **交易搜索器 `searchTrades`** |
| §5.6 自由市场 | 老将年龄/评分口径指引 |
| §5.7 交易 | 签带年份/轮次 + `pickValue` 动态定价 |
| §6 存档 | `SAVE_VERSION = 11`：`DraftPick{year,round}`、`tradeOffers`、`nextDraftClass`、`weight/wingspan`、`TeamEventOption.effects` |
| §7/§8 地图 | 行数刷新；新增 `DraftView.tsx`、`TradeOffersPanel.tsx`、`tools/build-real-roster.mjs` |
| §9 验证链 | ui-smoke 补新秀榜与 60 签检查 |
| §11 遗留 | 新增"签位保护/互换""老将年龄表维护""双向合同"等条目 |

**核心约束（务必遵守）**
- 引擎**确定性**：所有随机用 `mulberry32(seed)` 种子流；仿真种子公式**不可随意改**（会破坏复现与冻结基线）。
  新增功能的独立流：季中 AI 报价 `l.seed*1301 + day*17 + 5`、乐透抽签 `l.seed*4271 + l.season*613 + 29`、
  下一届新秀 `seed*5501 + 11`（建档）/`l.seed*5501 + l.season*97 + 23`（逐年）、体测 `height*7919 + age*131 + …`。
- 真实名单数值基线（第一季、无成长时）：场均 ~203-207 分/队、FG ~46-49%、3P ~37-37.5%、
  得分王 ~29-30 分、篮板王 ~14 板。改动引擎参数后要复测并记录漂移原因（v2.3.0 记录见 §10.9）。
- 真实球员 `ovr` 保留 **2K 官方 overall 原值**（95+ 传奇档依赖它）；技能加点通过 `baseSkills` 增量模型回写（见 §5.4）。
- 真实球员**主/副位置由 tools/build-real-roster.mjs 的 `inferPositions` 推断**（源 2K `positions` 顺序不可靠），
  改位置逻辑必须重跑 `node tools/build-real-roster.mjs`，并用 `--check` 预览改动清单（见 §4、§10.10）。
- 每轮改动后跑完整验证链（§9），四路径检查 `%SystemDrive%` 残留（§10.6）。

---

## 2. 五分钟接手

```powershell
cd C:\Users\10709\Desktop\AI\nba-manager
# 1) 类型检查
cmd /c node_modules\.bin\tsc.cmd -p .\tsconfig.json
# 2) 引擎自测（虚构 + 真实全季）
cmd /c node_modules\.bin\esbuild.cmd src/engine/selfTest.ts --bundle --platform=node --format=cjs --outfile=tools/.selfTest.cjs
node tools/.selfTest.cjs
# 3) 构建 + 打包（含自动清理旧版本 exe）
cmd /c node_modules\.bin\vite.cmd build
Get-Process | Where-Object { $_.ProcessName -match 'NBA|electron' } | Stop-Process -Force
cmd /c node_modules\.bin\electron-builder.cmd --win portable
node tools/prune-old-releases.mjs
# 4) 真机冒烟（CDP）
Start-Process release\win-unpacked\NBA经理.exe -ArgumentList '--remote-debugging-port=9333'
node tools/ui-smoke.mjs 9333
```

> 环境前提：沙箱需 `danger-full-access`（workspace-write 下 spawn 命名管道受限 → esbuild/vite/electron-builder 会 EPERM）；
> 本会话审批已关闭，**不要**传 `sandbox_permissions`。git/gh 需要刷新 PATH（§10.7）。

---

## 3. 需求演化史（对话主线，逐版）

| 版本 | 用户需求要点 | 关键实现 |
|---|---|---|
| **v0.2.0** | 「接入 nba 数据」（给了 nba_api 链接） | 澄清 nba_api 与本架构不合 → 改为**开发期抓一次真实数据固化进游戏**（离线 exe）。数据源最终定为 `api.nba2kapi.com` 公共端点（2K27 评分，648 名现役）→ `tools/fetch-nba2k.mjs` → `tools/raw/nba2k27_curr.json` → `tools/build-real-roster.mjs` → `src/engine/realRoster.ts` |
| **v0.3.0** | 弟弟 5 条：赛季奖项体系 / 评级档位（90 超级球星、95 传奇）/ 弱队也要交易与签 FA / 新增自由球员系统（简化劳资）/ 交易价值重做 | `awards.ts`（MVP/DPOY/6MOY/ROTY/All-NBA/All-Rookie）、`offseason.ts`（老化/退役/选秀/FA/AI 补强/AI 交易）、`tradeValue v2`、`ovrLabel/ovrClass` 新档位 |
| **v0.3.1** | 弟弟 11 条：球员中文名汉化 / 交易估值按真实校准+选秀权筹码 / 名单 13-17（开季 15）/ 战报对齐 / 自定义出场时间+球权 / 日历式回看 / 92-82 场次 bug / 排名对齐+场差整数 / apron 三层线 / 颁奖按钮无反应 | `tools/zh-names.mjs`（564 中文译名）+ `ZH_NAME_MAP` 迁移；`DraftPick`/`draftPool`；`simulateGame(accumulate)` 修 92/82；`min`/`usage`/`initiator` 自定义轮换；薪资表两次压缩（5100→4200 顶）；`SALARY_CAP/TAX_LINE/HARD_CAP` 分层；日历式比赛日回看 |
| **v0.3.2→0.3.6** | 快进后日历停滞 / 季后赛卡第一轮 / 逐场推进 / 颁奖弹窗 / 交易估值指数化（75 基线、+10 翻倍） | `simDay` 空洞天与防重复保险丝；`poffStepOnce` 逐系列一场；NBA 风格 7 列对位图；`tradeValue v4 = 2^((eff-75)/10)` |
| **v0.3.5** | 关键 bug：比赛照常模拟但比赛日数字不动 | 根因 `useGame.tick()` 从 `leagueRef.current` 深拷导致顶层标量丢失 → 改为从 `prev` 重建（**改动 useGame 时务必保留此语义**） |
| **v0.3.7** | 球队图标/球员大头照（联网收集→离线资源）/ 颁奖卡片化 / 季后赛没进总决也要能颁奖 / 阵容拖拽换位+能力变化 / 轮换 UI 错乱 / 能力值全面化（身体属性→伤病） | `src/assets/teams/*.svg`（NBA CDN 30 队）、`tools/fetch-player-faces*.mjs` → `src/assets/players/*.png|jpg`、`Player.body` 7 项、伤病系统（独立 rng 流）、`repositionPlayer` 基准制 |
| **v1.0.0** | 轮换错位真凶（误用 `.action-card` 的 flex）、冠军卡颁奖按钮 disabled、「N年级」文案、补齐头像 | 新增 `.rot-panel`；`.champ-*` 样式；`faceByZh` 迁移补头像 |
| **v1.1.0** | 小数统一 1 位 / 胜率百分比 / 主菜单背景轮播 / 换位数值漂移 / 去说明性文字 / 交易截止日 / 季后赛回看上一轮 / 对位图左右镜像+总决炫酷 / 启动更新公告 | `fmt1`；`TRADE_DEADLINE_DAY=110`；`SeriesDetailModal`；`ChangelogModal`；`TitleScreen` 10 张 Pexels 背景 |
| **v1.1.1** | 公告每次启动都显示 / exe 图标与运行图标一致 / 冠军界面重做 | 公告强制显示；`build/icon.png`（篮球）+ `build.win.icon`；`.champ-hero` 横幅（**教训：portable exe 禁用 rcedit**，图标由 makensis 编译期嵌入） |
| **v1.2.0** | 快进到总决赛 / 冠军界面只放冠军队与阵容 / 新秀压制（≤80、潜力随机、25 岁前黄金期 ×3）/ 球队属性（化学/纪律/商业/粉丝 + 主场 30%）/ 开档三选一理念 / 每场赛后随机事件 | `fastToFinals`；`genRookie` 压制；`Team.chemistry/discipline/brand/fans` + `teamEffMods`；`events.ts`；`CULTURES` |
| **v1.3.0** | 颁奖弹窗五卡占主版面 / 羁绊体系（80+ 1 个、90+ 2 个标签）/ 球队风格五选一 / 属性条拉长 / 成长阶段 ×3、×2 | `Player.tags` + `bondMods`；`TEAM_STYLES`；`agePlayer` 阶段系数；`.award-cards.big` |
| **v1.4.0** | 18 项 2K 属性面板 / 总评=均值+长处补偿算法 / 交易显示头像并可查看信息 | `Skills18` + `calcOvr = clamp(round(avg + (top3-avg)*0.55 + max(0,top1-90)*0.15))`；`build-real-roster.mjs mapSkills`（35→18 项）；交易页头像化 |
| **v2.0.0** | 弟弟 23 条大改版（联盟排名进球队详情 / FA 看信息 / 交易双方薪资+预检 / 对方按薪资战绩拒明星 / 首季选秀权=1 / 潜力并入技能+身高 cm+潜力 1-10 手动加点 / 双位置拖拽 / 一防二防+数据+图放大 / 球队风格二选一+执教风格三选一居中 / 事件处理选项 / 数据统一删效率+卡片三项 / 伤病卡红黄 / 季后赛打完一轮显示下一轮 / 淘汰弹窗 / 常规奖不含 FMVP / 冠军与阵容间加 FMVP / 选秀 80 人 / 报告框+生涯 / AI 截止日前交易 / 薪金空间现有+剩余 / FA 一天 3 份共 7 天） | `Player.secPos`、`potential` 改 **1-10 星** + `points`/`career`/`nation`/`baseSkills`；`TradeView` 自动预检；`evaluateTrade` 明星拒绝与 82 场上限；`DraftState` 雏形（80 人随机分配）；`OffseasonView` 手动加点面板 + FA 7 天；`AwardsPanel` 一防二防；`ScheduleView` FMVP 卡 + 淘汰弹窗；`resolveTeamEvent`；`SAVE_VERSION=9` |
| **v2.1.0** | 新秀保证 1 个 80（未必状元）/ 美国新秀用英文名 / 羁绊显示在小卡片 / 颁奖弹窗可滚动 / 篮板系数下调 / 提前晋级立即显示 / **选秀环节可操作** / 手动加点改自动（优先突出、≤90）/ FA 池素质 55-80 | `genDraftClass` 随机 1 人 ≥80 + `FIRST_EN/LAST_EN` 英文名池；`draftPickUser/draftPickAuto/draftComplete/draftIsUserTurn`；`autoDistribute`（贪心加最高且 <90）；篮板 `orP 0.165`、系数 0.0022、吸附 `pow(reb/70,1.5)`；`refreshPlayoffPlaceholders` + 占位槽 `-1`；`genFreeAgent` 均匀 55-80；`Player.career`（退役报道）、`.awards-modal` 滚动；`SAVE_VERSION=10` |
| **v2.2.0** | 「自己和 AI 球队 SF/PF/C 三位置更多球权，能力球员更多球权，其他降低」 | `sim.ts` `posW {PG .9, SG .85, SF 1.0, PF .95, C .85}`、`tend {.55,.85,1.0,.9,.8}`、`ability = clamp(1+(ovr-75)*0.012, .7, 1.3)`（持球与出手双加权；自定义 usage 与 PlayCall 仍优先）。实测单场前场出手 43 vs 后场 29 |
| **v2.2.1** | 「八强进四强最后一个球队在模拟下一轮前没到下一轮」 | 两个叠加根因：①每轮模拟后只要有任何 4 胜就 `runPlayoffRound(length)` → 把下下轮也提前建了；②占位填充 `refreshPlayoffPlaceholders` 被包在 `length < 4` 条件内，轮次达 4 时刷新被跳过 → 最后晋级者不进入下一轮。修复：仅当 `rIdx === playoffRounds.length - 1` 且本轮出现 4 胜才建下一轮，且 `refresh` **始终**执行 |
| **v2.3.0** | 三批需求：①AI 球队球员位置不对（杰伦·威廉姆斯该打后卫/小前、卡鲁索该打 PG/SG）②选秀权开放到后三年 + 加次轮签 + 签位带年份 ③签价值要随战绩变化 ④AI 打比赛时也要交易球员/选秀权并向玩家报价 ⑤球队动态的选项不能都是扣数值；⑥赛季末就能看 80 人新秀名单（要身高/体重/臂展/年龄）⑦模拟马刺一季后文班亚马得分少了快一半 ⑧自由市场球员数据（威少年龄大了好几岁）⑨选秀规则照真实 NBA 更新 | ①`build-real-roster.mjs` 的 `inferPositions`（身高 + 18 项技能评分 + 相邻约束 + 保守门槛）+ 位置深度均衡；realRoster 增 `q` 字段；`migrateSave` 幂等修正老档（不覆盖玩家手动换位）②`DraftPick` 加 `year/round`，池 180 枚，`freshPickPool/rollPickPool` 滚动窗口 ③`pickValue` 按当季战绩实时 + 年份 ×0.88^off + 次轮低价曲线 ④选秀 60 签（30 首轮先选 + 30 次轮）、80 人池、20 人落选 ⑤`tryAITradeOfferToUser`/`acceptTradeOffer`/`rejectTradeOffer` + UI `TradeOffersPanel` ⑥`TeamEventOption.effects[]` 权衡型选项 ⑦新秀榜：`l.nextDraftClass`（开档即生成 80 人，休赛期直接消耗）+ 新页面 `DraftView` + `weight/wingspan` 体测字段 ⑧得分修复：`posW/tend/ability` 重标定 + `coreBoost` 队内战术地位 + 三分倾向改能力驱动（`p3Base/p3Max` + pull）+ `depthList` 位置借人 ⑨老将 `VET_AGE` 表 + `fixedOverall` 断崖降分修正 ⑩选秀制度：`lotteryOrder` 乐透抽签 + `stepienViolation` Stepien 规则 + `rookieScaleSalary` 薪资阶位 + 休赛期名单扩编到 17；另修 `draftComplete` 撞到用户签提前 break 的老 bug（60 签只签下 37 人） |

**迭代工作方式（继续保持）**：用户（转述弟弟反馈）给需求 → 直接实现 → 全量验证链 → 打包 exe → 更新 Changelog/使用说明 → 交付产物路径 + 变更说明；涉及行为改动时在 `使用说明.txt` 顶部加版本段。

---

## 4. 数据管线（离线资源）

```
2K 官方评分站 → api.nba2kapi.com/api/public/players?teamType=curr（免 key，分页 nextCursor）
  → tools/fetch-nba2k.mjs  → tools/raw/nba2k27_curr.json（648 人：30 队 533 + Free Agency 115，1.3MB）
  → tools/zh-names.mjs（564 个中文译名，含 20 处 mojibake 修正）
  → tools/build-real-roster.mjs（mapAttrs 7 维 + mapSkills 35→18 项 + estimateAge/potentialOf/contractOf）
  → src/engine/realRoster.ts（AUTO-GENERATED：REAL_ROSTER 30×15=449 人 + REAL_FA 115 人 + ZH_NAME_MAP）

球员头照：tools/fetch-player-faces.mjs（alexnoob 2025-26 rosters 的 imgURL 取 playerId → cdn.nba.com 260x190）
          + tools/fetch-player-faces-extra.mjs（2kratings 1280x720 大图补齐）→ src/assets/players/（572 张）
球队队徽：NBA 官方 CDN → src/assets/teams/*.svg（30 队；**SAS 的正确 teamID = 1610612759**）
主菜单背景：tools/fetch-backdrops.mjs（Pexels 免费商用）→ src/assets/backdrops/*.jpg（10 张，20s 轮播）
```

**年龄推导（2K 数据无年龄字段）**：`ratingHistory.length = len` → `draftYear = 2027 - len`（len=0 → 2026 届新秀），`age = 2026 - draftYear + 18 + hash%4`。
  ⚠️ 2K 只保留最近 18 个版本，`len >= 18` 是"截断带"（2009 年及以前进联盟），旧公式给 `35 + hash%7` 随机年龄。
  v2.3.0 起这 17 人按真实出生年份硬编码在 `build-real-roster.mjs` 的 `VET_AGE` 表（威少 37 / 库里 38 / 杜兰特 37 /
  詹姆斯 41 / 洛瑞 40 / 乐福 38 / 康利 38 / 小乔丹 38 / 霍福德 40 / 大洛 38 / 巴图姆 37 / 戈登 37 / 杰夫·格林 40 /
  泰·吉布森 41 / 德罗赞 37 / 哈登 37 / 霍勒迪 36）。**新增老将时记得补表**。
**评分断崖修正（`fixedOverall`）**：数据源对已离队老将会断崖降分（威少 2K26=80 → 2K27=42，delta -38）。
  若 `ratingHistory[0].delta <= -15` → 用 `hist[1].overall - 3` 替代。
**数值压缩（勿动）**：2K 属性 → 引擎 7 维用 `c(v,s) = 25 + (v-25)*s`，`three×0.72 / mid·inside×0.82 / ath·def·pas·reb×0.88`；`ovr` 保留 2K 官方值不压缩。
**体测数据（v2.3.0）**：2K 源有 `weight: "235 lbs"` / `wingspan: "8'0\""` → 解析为磅/英寸写入 `wt`/`ws`；
  缺失时用 `weightFor` / `wingspanFor` 按身高位置推定（独立确定性流，不扰动主随机序）。

---

## 5. 引擎规则速查（改动前必读）

### 5.1 薪资 / 劳资（`league.ts` 常量 + `offseason.ts` canSign/chargeSign）
```
salaryFor(ovr)（万美元/年）: ≥93→4200, 90→3400, 87→2700, 84→2100, 81→1500, 78→1050,
                            75→700, 72→480, 69→320, 66→240, 63→170, else→110
SALARY_CAP = 15400（1.54 亿）  TAX_LINE = 18700（1.87 亿）  HARD_CAP = 20000（2 亿）
ROSTER_MIN = 13   ROSTER_MAX = 17（开季裁至 15）   TRADE_DEADLINE_DAY = 110
MIN_SALARY = 300（底薪）   MID_LEVEL = 1300（中产，每队每休赛期 1 次，仅 ≤ 税线队）
签约通道：payroll+salary ≤ CAP 自由签；> TAX 仅底薪；> HARD 仅底薪；帽上可底薪或中产
交易 apron：任一方 payroll > TAX → 成交后薪金不得增加、不得打包多人、首轮签冻结；双方成交后 ≤ HARD
球员单赛季最多 82 场：evaluateTrade 校验「已出场 + 对方剩余赛程」> 82 直接拒绝
```

### 5.2 模拟（`sim.ts`）
```
pace：93-104/队；每场回合数 max(80, round(paceAvg + gauss*3))；分钟 scale = 240/(totalSeq*5)
轮换：AUTO_MINUTES = [36, 12, 0]（按位置深度）；REST 窗口每位置两段，休息时用同位置第 2 人
      自定义 min 生效时按剩余目标贪心；|分差| ≥ 14 且 min ≥ 40 → 垃圾时间上第 3 阵容
      加时最多 3 个；v2.3.1 depthList：某位置可用 <2 人时从相邻位置借人（防"独苗打满 48 分钟"），
      配 taken 集合去重（正常球队行为完全不变）
球权（v2.3.1）：持球权重 = pow(pas/70,2) × posW[pos] × ability(p)
                posW = {PG .95, SG .9, SF 1.0, PF 1.0, C .98}（位置差异收窄，内线核心不再被压制）
                ability = clamp(1 + (ovr-75)*0.022, 0.60, 1.75)
                usage 自定义 → ×(0.35 + usage*0.13)；PlayCall 发起位 ×2.6，其余无自定义 ×0.85
出手者：35% 持球人自投；否则 tend[pos] × (0.8 + three/180) × ability^1.4 × coreBoost
        tend = {PG .7, SG .9, SF 1.0, PF 1.0, C 1.0}
        coreBoost（v2.3.1 队内战术地位）：队内 OVR 最高 ×1.5、第二 ×1.2、其余 ×1
          （缓存 roleCache：key = 队内人数 + 最高 OVR，交易/成长后自动失效）
投篮构成（v2.3.1 改为能力驱动）：pull = clamp((three-45)/32, 0, 1)
        p3 = p3Base[pos] + (p3Max[pos]-p3Base[pos]) × pull；持球人自投 ×0.82；clamp 0.02-0.72
        p3Base={PG .38,SG .40,SF .30,PF .14,C .08}  p3Max={PG .66,SG .68,SF .62,PF .52,C .48}
        posIn = {PG .12, SG .13, SF .28, PF .6, C .76}（+ (inside-70)*0.003）
        ⚠️ v2.2 及以前是纯位置表 pos3={PG .56,…,C .1} → 文班亚马这类空间型内线三分占比仅 5%、
           场均 17.3 分（真实 24.3）；改后 26.1 分 / 三分占比 31%
命中率：baseMake = {three .33, mid .49, inside .62} + 攻方属性项 − 守方 def 项（+ 二次进攻 +0.08）
犯规→罚球概率：{three .06, mid .10, inside .17}；罚球率 0.775 + (mid-70)*0.002
盖帽：近筐 rimFactor=1 / 中投 .2 / 三分 0
篮板（v2.1 下调）：orP = 0.165 + (offReb-70)*0.0022 − (defReb-70)*0.0022 +（罚球 −0.08），clamp 0.05-0.30
                  抢板人权重 = pow(reb/70, 1.5)（原 2.2，吸附降低 → 分布更平均）
伤病：risk = 0.004 × clamp((100-durability)/60, .35, 1.6) × clamp(0.55+avg/48, .55, 1.6) × (1+usage*0.02)
      独立 rng 流（injurySeed = l.seed*31 + day*97 + gi*13），不扰动比赛主随机序
球队气质/风格系数：teamEffMods(team,isHome,poff,avgFans)
      fan =（主场 0.30 / 0.36 brand 教练风格）× (fans/avgFans − 1) × 0.05
      chem = (chemistry-50) × (poff ? 0.0011 : 0.0007)；disc = (discipline-50) × (poff ? 0.0003 : 0.0007)
      羁绊 bondMods：同标签 ≥2 人，每多 1 人 off += 0.0012、def += 0.0006
```

### 5.3 赛季 / 季后赛（`league.ts`）
```
赛程：170 天，每队 82 场（同分区 4 场、同半区异分区 3-4、异半区 2），随机铺日
simDay：user 场次保留 box；空赛日照常推进；防重复保险丝（同一天已打完则跳过）
        day % 13 === 0 且 day < 110 → tryAISeasonTrade（季中 AI 交易，消息进 l.news）
季后赛轮次：0=第一轮(8 组，每区 1v8/4v5/2v7/3v6) → 1=半决赛(4) → 2=分区决赛(2) → 3=总决赛(1)
提前晋级（v2.1/v2.2.1）：占位槽 awayId/homeId = -1；refreshPlayoffPlaceholders 只填未开打系列
        （games.length > 0 绝不覆盖）；「模拟本轮」= 每未完成系列各一场；
        建下一轮条件：rIdx === playoffRounds.length - 1 && 本轮有 4 胜 && length < 4；
        refresh 必须无条件执行（v2.2.1 修复的就是这条）
总决：每场双方 box 全量累进 l.finialsAccum（→ computeFinalsMVP）；非用户场次 box 不保留
奖项门槛：MVP/All-NBA gp ≥ 65；DPOY/All-Defense ≥ 60；6MOY ≥ 50 且 starts < gp/2；ROTY ≥ 40；新秀阵 ≥ 30
奖项公式：lineScore = 场均(pts + ast*1.5 + reb + stl*2.2 + blk*2.2 − tov*1.4)
        rankScore = line × winFactor(0.8+胜率*0.55) × min(1, gp/70) + ovr*0.25
        dpoyScore = def*0.55 + (stl+blk)/g*2.8 + reb/g*0.25 + max(0,height-78)*0.3 + winFactor*2
        All-NBA/All-Defense 每阵 2 后场 + 3 前场；常规奖**不含 FMVP**（computeFinalsMVP 独立）
```

### 5.4 成长 / 加点（`offseason.ts`）
```
潜力 = 1-10 星（potentialToStar(0-99 旧值)）；每休赛期发点：
  points = potential × stage × timeCoef，stage = age ≤ 25 ? 3 : age ≤ 29 ? 2 : 0
  timeCoef（按上季场均分钟）：<5 → 0.8, <10 → 0.9, <15 → 1, <20 → 1.1, <25 → 1.2, ≥25 → 1.3
  30+ 无加点，改为衰减：30-32 → −2 点 / 33-35 → −4 / >35 → −6（star 风格 & ovr ≥ 90 减半）
分配（v2.1 起全自动，玩家不再手动）：autoDistribute 贪心加「当前最高且 < 90」的技能
recalcOvr（基准制）：ovr = clamp(baseOvr + (calcOvr(skills) − calcOvr(baseSkills)), 40, 99)
  → 真实球员保留 2K 官方 ovr，加点只施加「算法增量」，不脱离 2K 量级
```

### 5.5 选秀（`gen.ts` + `offseason.ts`，v2.1 起可操作）
```
genDraftClass(rng)：80 人 = **美国 60 / 中国 3 / 其他国家 17**（v2.3.0 配额）
  姓名规则：美国 = `makeEnName`（FIRST_EN/LAST_EN 英文名）；中国 = 中文姓名池；
  其他国家 = `NATION_POOLS`（data.ts，21 个具体国家：法国/塞尔维亚/西班牙/德国/澳大利亚/加拿大/
  尼日利亚/南苏丹/喀麦隆/立陶宛/拉脱维亚/土耳其/希腊/斯洛文尼亚/克罗地亚/意大利/日本/韩国/
  菲律宾/新西兰/格鲁吉亚）→ 按该国本土姓名生成后译为中文常见译名
  （nameOrder: 'west' = 名·姓 / 'east' = 姓+名，如 八村塁、朴贤宇）
  ⚠️ 绝不再用"欧洲/南美/亚洲"这类地区名（selfTest 有 REGIONS 黑名单断言）
  实力梯度：tier = (i/80)*5.4 平滑递减 → target ≈ 76 → 54（状元级 ~76 / 首轮末 ~66 / 次轮末 ~55）
  ⚠️ 旧实现 tier = Math.floor(i/3) 在第 30 顺位就触底 → 次轮秀清一色 55 分
  恰好 1 人 ovr 80-83，其余全部 <80；天骄从 ovr ≥ 72 的池子里抽（潜力 ≥ 7 星）
DraftState { year, class: Player[](80 人池), order: DraftPick[](60 签 = 30 首轮 + 30 次轮), next, picked }
接口：draftIsUserTurn / draftRemaining / draftPickAuto(AI 选池中最高 ovr) / draftPickUser(玩家点选) /
     draftComplete(代选全部 + 落选进 FA + 汇总 news + draft=null)
选秀顺位（v2.3.0 乐透抽签，`league.ts lotteryOrder`）：14 支未进季后赛球队按
      LOTTERY_ODDS=[.14,.14,.14,.125,.105,.095,.086,.075,.064,.055,.045,.032,.024,.018] 抽前 4 顺位，
      其余乐透队 5-14 按战绩逆序、进季后赛的 16 队 15-30 按战绩逆序；次轮无乐透（纯战绩逆序）。
      rng 独立流：l.seed*4271 + l.season*613 + 29（不扰动休赛期既有随机序）
新秀合同（v2.3.0）：首轮 rookieScaleSalary(n) = clamp(1200-(n-1)*34.5, 200, 1200) 万 · 4 年；
      次轮 clamp(salaryFor(ovr), 200, MIN_SALARY) · 2 年
入队规则（v2.3.0）：休赛期上限 ROSTER_MAX(17)，选中直接扩编（此前 15 人就裁人 → 刚选中的新秀
      常被自己球队裁掉，一届 60 签只留下 36 人）；满 17 裁最弱冗余位腾位；开季前统一裁到 15
      ⚠️ 另修：draftComplete 撞到"用户持有的签"曾直接 break（60 签只签下 37 人），现已改为循环内代选
```

### 5.6 自由市场（`offseason.ts`，7 天窗口）
```
要价 askFor = salaryFor(ovr) × 0.8（≤24 岁且潜力高 → ×(1+(potential-ovr)*0.02)；≥33 → ×0.7；≥30 → ×0.9）
             clamp 250-4200
7 天窗口：l.faDay 1→7；每天最多 3 份报价（l.faOffers 持久）；点「结束第 X 天」结算当天报价
AI 竞价：ask × (0.93 ~ 1.08)；star 风格且 ovr ≥ 88 → 接受门槛 0.85 → 0.78
池：保底 55 + randInt(0,10) 人；genFreeAgent 能力**均匀 55-80**；30+ 岁 8% 去海外
赛季中「自由市场」页：signFreeAgentNow 即时签约（无 AI 竞价，≥ 要价 85% 成交）
⚠️ 老将年龄/评分口径见 §4（VET_AGE 表 + fixedOverall 断崖降分修正）——自由市场里的
   威少 37 岁 / 77 分（修正前 41 岁 / 42 分）
```

### 5.7 交易（`league.ts`）
```
【交易搜索器 v2.3.0】searchTrades(l, givePids, givePickIdx, maxPerTeam=3) → TradeSuggestion[]
  入参 = 玩家勾选的自有筹码（1-N 名球员 / 选秀权）；遍历 29 队，四类搜索：
    ① 单换单 ② 对方「球员 + 选秀权」 ③ 对方打包两人 ④ 追加我方筹码
       （④ 既做"当前筹码换不动"的兜底，也做"再加一点换更好的"升级 → 标 needsMore）
  候选裁剪：对方球员价值 ∈ [0.45×gv, 1.9×gv] 取前 8、签取前 4；pickValue 结果预计算（否则循环里上千次排序）
  每队最多返回 maxPerTeam 条普通方案 + 1 条"需追加"升级方案；全部经 evaluateTrade 完整校验
  实测性能：4-11ms / 次（29 队全扫），单次返回 70-105 条建议
  返回结构 TradeSuggestion{ teamId, givePids, givePickIdx, wantPids, wantPickIdx, reason, gain, needsMore, note }

tradeValue = max(0.1, round(2^((eff-75)/10), 2))（75 基线、每 +10 翻倍）
  eff = ovr
      + (≤25 岁且潜力高) (potential-5)*3 * 0.55 * clamp(1+(25-age)*0.08, 0.6, 1.6)
      − (age ≥ 31) (age-30)*0.8
      ± 合同：salary > fair*1.15 → −1.5；salary < fair*0.9 → +1
      + ovr ≥ 90 → +1
pickValue：第 1 赛季（history 空）恒为 1（盲盒签）；否则按 f 队战绩排名 r 换算期望能力再入曲线
明星拒绝：ovr ≥ 88 且 廉价合同（< fair*0.9）→ 拒；ovr ≥ 90 且对方胜率 ≥ .55（争冠）→ 拒；
         ovr ≥ 90 且对方胜率 < .42 且帽下有空间 → 拒（招牌卖票）
AI 休赛期交易：重建（<.42）出清 29+ 老将 ↔ 争冠（≥.55）补即战力，估值差 ≤ 20% 成交，≤ 8 笔
```

### 5.8 球队风格 / 事件
```
球队风格 style（二选一）：youth 青春风暴（≤29 岁人数 × 0.0004 进攻 / 成长再 ×1.25）
                        star 球星成色（90+ 人数 × 0.0005 进攻 / 衰退减半 / 球星签约门槛降低）
执教风格 coachStyle（三选一）：iron 铁血（纪律 +8，季后赛 def −0.001）
                            locker 更衣室（化学 +8，每场赛后 chemistry +0.15）
                            brand 商业（fans ≥140，主场加成 0.30 → 0.36）
赛后事件：45% 触发（rollPostGameEvent，独立 rng）；带选项事件 → l.pendingEvents（≤5 条）
        → resolveTeamEvent(l, eventId, option) 二选一应用
```

---

## 6. 存档 / 类型（`src/engine/types.ts`，SAVE_VERSION = 10）

**Player**：`id, name, pos, secPos(双位置), age, ovr, attrs(7), body(7), height(英寸), salary, contractYears,
potential(1-10 星), exp, starts, min|null, usage|null, injury|null, face, basePos/baseAttrs/baseOvr,
baseSkills, grow(遗留), tags(羁绊), skills(18), points(待分配), career{gp,pts,reb,ast,stl,blk}, nation,
gp, stats(16 项)`

**Team**：`id, name, city, en, abbr, conf, players, win, loss, pace, initiator, chemistry, discipline, brand,
fans(万), style(youth|star|null), coachStyle(iron|locker|brand|null)`

**LeagueState**：`version, seed, season, year, day, totalDays(170), schedule, scheduleIds, teams,
playoffRounds, champion, results, userTeamId, playerSeq, history, mode, cultureId, offseason, offseasonStep(0-3),
midUsed, freeAgents, awards, news, finalsAccum, draftPool(30 枚), faDay(1-7), faOffers, poffExitShown,
pendingEvents, draft(DraftState|null)`

**SeasonAwards**：`season, mvp, dpoy, sixth, rookie, allNba[3][5], allRookie[2][5], allDefense[2][5]`（无 fmvp 字段）

**migrateSave（league.ts）** 处理 v1→v10：模式启发识别 → `ZH_NAME_MAP` 中文名（幂等）→ exp/starts/min/usage
→ body/injury/face → basePos/baseAttrs/baseOvr → grow/tags → skills → **secPos/potential 星/baseSkills/points/
career/nation** → 球队 style/coachStyle 拆分 → FA 池补建（REAL_FA 或 genFreeAgent×60）→ draftPool →
faDay/faOffers/poffExitShown/pendingEvents/draft。新档为幂等 no-op。

**确定性 rng 种子（勿改）**：`simDay = mulberry32(l.seed + day*7919)`；`simPlayoffGame = mulberry32(l.seed*101 + l.season*10007 + roundIdx*977 + seriesIdx*131 + games.length)`；`beginOffseason/finishOffseason = l.seed + l.season*77777 + 13`；`settleFreeAgency = l.seed*977 + l.season*1009 + 7`；`simulateOffseasonAI = l.seed*31 + l.season*577 + 3`；`AI 交易 = l.seed*1013 + l.season*599 + 11`；伤病独立流见 §5.2。

---

## 7. 源码地图

| 文件（行数） | 职责 / 关键导出 |
|---|---|
| `src/engine/types.ts` (325) | 全部类型 + `SAVE_VERSION`；`DraftPick{year,round}`/`DraftState.year`/`AiTradeOffer`/`TeamEventOption.effects`/`Player.weight,wingspan` |
| `src/engine/data.ts` (91) | 30 队 `TEAMS`、`POS_ORDER`、中文姓名池 `FIRST_NAMES/LAST_NAMES`、英文名池 `FIRST_EN/LAST_EN` |
| `src/engine/realRoster.ts` (1251) | AUTO-GENERATED：`REAL_ROSTER`（30 队 449 人）、`REAL_FA`（115）、`ZH_NAME_MAP`；球员含 `p/q`（主/副位置）、`wt/ws`（体重/臂展） |
| `src/engine/gen.ts` (912) | `genPlayer`/`genTeamRoster`/`genRookie`/`genDraftClass`/`genFreeAgent`/`realFaPlayer`、`createLeague`/`createRealLeague`/`finishLeague`、`makeSchedule`、`calcOvr/calcLin/genSkills/attrsFromSkills/deriveSkills/fromRealSkills`、`salaryFor`、`potentialToStar`/`POS_SEC`、`heightLabel/weightLabel/wingspanLabel/lbsLabel/feetLabel`、`weightFor/wingspanFor/ensureMeasure`、`freshPickPool/rollPickPool/PICK_YEARS`、`makeNextDraftClass`、`repositionPlayer`、`assignTags`、`TEAM_STYLES`/`COACH_STYLES`/`applyTeamStyle`/`applyCoachStyle` |
| `src/engine/sim.ts` (650) | `simulateGame(away,home,rng,accumulate=true,injurySeed?,mods?)`、`possession`/`reboundAfterMiss`、`coreBoost`（队内战术地位）、`depthList`（位置深度借人）、`teamEffMods`/`bondMods`、轮换 `manualRotation/targetMinutes/sideLineup/AUTO_MINUTES`、伤病 `injuryRisk/pregameInjury` |
| `src/engine/league.ts` (1088) | `simDay`、`standings`/`leaders`/`perGame`、季后赛 `runPlayoffRound/simPlayoffGame/playoffDone/playoffChampion/refreshPlayoffPlaceholders`、`playerScore`、`migrateSave`、`sortRoster`、`tradeValue/pickValue/pickLabel/evaluateTrade/applyTrade/teamStrength`、`lotteryOrder`/`stepienViolation`/`rookieScaleSalary`、`tryAITradeOfferToUser`/`acceptTradeOffer`/`rejectTradeOffer`、劳资常量、`payrollOf`、`tryAISeasonTrade`、`nextGameOf/playedCount` |
| `src/engine/offseason.ts` (848) | `timeCoefOf/growthPointsFor/agingPenaltyOf/recalcOvr/spendPoint/autoDistribute`、`agePlayer`、`beginOffseason`（乐透抽签 + 建选秀 + 下一届新秀）、`settleFreeAgency/signFreeAgentNow/cutPlayer`、`simulateOffseasonAI/simulateAIOffseasonTrades`、`finishOffseason`、选秀 `draftIsUserTurn/draftRemaining/draftPickAuto/draftPickUser/draftComplete/assignRookie`、`askFor/canSign`、`MIN_SALARY/MID_LEVEL` |
| `src/engine/awards.ts` (162) | `computeSeasonAwards`（幂等，常规奖）、`computeFinalsMVP`（独立 FMVP）、`lineScore` |
| `src/engine/events.ts` (109) | `rollPostGameEvent`（含带选项事件）、`resolveTeamEvent`（多效果）、`CHEM_OPTS`/`BRAND_OPTS` 权衡型选项 |
| `src/engine/rng.ts` (52) | `mulberry32/gauss/randInt/pick/shuffle/clamp` |
| `src/engine/selfTest.ts` (1029) | 全量自测（虚构 + 真实双跑，300+ 断言）；`TEST_SEED` 可覆盖 |
| `src/ui/*.tsx` | 见 §8 |
| `src/theme.css` (946) | 深色主题（#0d1117 系）+ 全部组件样式（含 `.award-cards.big`/`.draft-*`/`.db-*`（新秀榜）/`.to-*`（AI 报价卡）/`.rot-*`/`.series-card.partial`/`.event-*`） |
| `tools/build-real-roster.mjs` | 2K 数据 → realRoster.ts：`VET_AGE`（老将年龄表）、`fixedOverall`（断崖降分修正）、`inferPositions`（位置推断）、`balancePositions`（位置深度均衡）、`parseWeight/parseWingspan`；`--check` 只预览位置改动 |
| `electron/main.cjs` | 主进程：`process.chdir(exe 目录)`、`%SystemDrive%` 清理循环、存档 read/write/list、文件导出导入、单实例锁 |

---

## 8. UI 地图（`src/ui/`）

- **App.tsx**：顶栏（版本号 ×2 处）、5+1 个 tab（🏀赛程 / 🧩阵容 / 🤝交易 / 💼自由市场 / 📊联盟 / 🎓新秀）、
  `l.offseason` 为真时整页切 `OffseasonView`、赛季结束横幅、`ChangelogModal`（每次启动强制显示）。
- **TitleScreen.tsx**：菜单 → 选队（30 队卡片）→ **球队风格二选一**（居中）→ **执教风格三选一** → 开局；
  背景 10 张图 20s 轮播（`.title-bg` 需 `:not()` 选择器避免被 `>*` 覆盖）。
- **DraftView.tsx**（v2.3.0 新页面）：下一届新秀榜（`l.nextDraftClass` 80 人），表格列 = 预测顺位/
  头像/姓名/位置/年龄/身高/体重/臂展/OVR/潜力星/国籍，支持按实力·年龄·身高排序，点行开 `PlayerModal`；
  顶部显示我的签与选秀时间。`.draft-board`/`.db-*`。
- **TradeOffersPanel.tsx**（v2.3.0 新组件）：AI 主动报价卡（`.trade-offer-card`/`.to-*`）——双方筹码、
  估值差（赚/亏）、AI 理由、「✓ 接受交易」/「✕ 拒绝」；被 `ScheduleView`（球队动态）与
  `OffseasonView`（休赛期 step3）共用。
- **ScheduleView.tsx**（577 行，最复杂）：`doSim`（分批推进）、日历式回看（`manualDay`，注意 `dayGames`
  useMemo 依赖要含 `l.results.length`）、`poffStepOnce`（逐系列一场 + 提前建轮 + refresh）、
  `fastToFinals`、`PlayoffBracket`（7 列左右镜像，`SeriesCell` 支持占位/半成品）、`SeriesDetailModal`、
  冠军卡（`.champ-hero` → `.champ-fmvp` FMVP 卡 → `.champ-roster` 15 人）、`AwardsModal` 触发、
  淘汰弹窗（`.elim-modal`，`l.poffExitShown` 每季一次）、球队动态（news + 待处理事件按钮）。
- **RosterView.tsx**：球队气质面板（`.team-meta-panel` + 风格/执教/羁绊 chip）、轮换与战术面板
  （`.rot-panel`，PlayCall + min/usage 输入，**不可用 `.action-card`**）、五位置拖拽列
  （`dropable` 只高亮该球员 `{pos, secPos}` 两列）、球员卡（`.rc-tags` 羁绊标签、三项数据、
  伤病红黄 `.inj-season`/`.inj-out`）。
- **OffseasonView.tsx**：step1 = 休赛期报告 + **选秀面板**（`.draft-panel`、轮到玩家签显示 `.draft-pick-card` 池、
  AI 代选/自动完成）+ 「进入自由市场」（选秀未完成时禁用）；step2 = 阵容裁人 + FA 7 天市场（报价 ≤3/天、
  `.offer-panel`、结束当天结算）；step3 = 结果报告（`.offseason-report`）+ 双风格重选 + 开始新赛季。
- **TradeView.tsx**：双方工资单/战绩状态条、两列球员 + 选秀权筹码、**实时预检**（点球员即 `evaluateTrade`，
  verdict 自动刷新；「确认交易」只做最终执行）、战力前后对比、`.pick-row` 头像 + 点名字开 `PlayerModal`；
  底部 **🔍 交易搜索器**（v2.3.0）：勾选自有筹码 → `searchTrades` 全联盟扫描 → 结果按
  「✓ 用当前筹码即可成交」/「⚠ 对方还想多要人（需追加筹码）」两组展示（`.search-row`/`.sr-*`），
  每条可「填入筹码」或「✓ 直接成交」；默认每组显示 10 条，可展开全部。
- **FreeMarketView.tsx**：赛季中即时签约（点名字看详情、要价、底薪/中产通道提示、剩余空间）。
- **LeagueView.tsx**：排名（行可点进 `TeamDetail`：队徽/战绩/排名/工资单/战力/风格 + 15 人列表）/
  数据榜（无「效率」）/ 荣誉殿堂（`AwardsPanel` + 历届冠军 MVP FMVP）。
- **AwardsPanel.tsx**：`AwardCard`（大奖卡，冠军界复用 FMVP）、`AwardsPanel`（4 大奖卡 + All-NBA 3 阵 +
  防守 2 阵 + 新秀 2 阵，均带场均数据与队徽）、`AwardsModal`（`big` 模式 + 可滚动）。
- **PlayerModal.tsx**：头像/基准信息（cm 身高、潜力星、双位置、国籍仅非美国显示、生涯数据）+ 7 维属性 +
  18 项技能 4 组 + 赛季数据（9 格）+ 合同 + 定位（深度/伤病/待分配点数）。
- **BoxScoreModal.tsx**（14 列战报）、**PlayerFace.tsx**（572 张头像 glob 合并 png/jpg，无则占位）、
  **TeamLogo.tsx**（`import.meta.glob` 30 SVG）、**format.ts**（`ovrClass/ovrLabel/money/fmt1/perGameLine/POS_CN/ATTR_CN/STAT_CN`）、
  **useGame.ts**（**tick 必须从 `prev` 重建**；900ms 防抖自动存档；`migrateSave` 在读档/导入后调用）。

---

## 9. 验证链（每轮必跑，全绿才发版）

1. `tsc -p .\tsconfig.json` → **0 错**
2. esbuild 打包 `selfTest.ts` → `node tools/.selfTest.cjs` → **0 失败**（虚构 + 真实；会打印场均/FG/3P/FT、得分王、奖项、退役/AI 交易、迁移断言）
3. `vite build` → dist 产物正常（JS ~557KB）
4. `electron-builder --win portable` → `release\NBA-Manager-x.y.z.exe`（先杀 NBA*/electron 进程）
5. **CDP 真机冒烟** `tools/ui-smoke.mjs 9333`（步骤：标题屏/背景 → 关公告 → 选队 → 双风格 2+3 卡 →
   模拟到下一场 ×4 推进 → 快进 7 天 → 战报弹窗 → 阵容轮换+气质 → 交易头像/详情/自动预检 →
   **选秀权 6 枚/队（未来 3 年 × 首轮/次轮）** → **新秀榜 80 行 + 体测行** →
   季后赛对位图 7 列 + 逐场弹窗 → 快进总决 + 冠军 15 人 + FMVP 卡 + 颁奖弹窗 4 卡/2 防守阵 →
   **休赛期选秀面板（60 签：30 首轮 + 30 次轮）+ 自动完成 + 进入市场**）
6. portable exe 冒烟：`$env:DSH_AUTOQUIT_MS='8000'; Start-Process release\NBA-Manager-x.y.z.exe -Wait`
7. 四路径 `%SystemDrive%` 残留检查（§10.6）
8. `node tools/prune-old-releases.mjs`（保留最近 2 个版本 exe）；更新 Changelog/使用说明/版本号

**版本号修改三处**：`package.json`（**必须用 node `fs.writeFileSync`**，PS 会写 BOM 导致 builder 报错）、
`src/App.tsx`（顶栏 ×2）、`src/ui/ChangelogModal.tsx`（VERSION + ITEMS），另加 `使用说明.txt` 顶部版本段与尾部 exe 名。

---

## 10. 环境与运维经验（踩过的坑）

1. **沙箱**：文件策略 `danger-full-access`；命令可直接执行，**不要**传 `sandbox_permissions`（审批已关闭）。
   workspace-write 下 spawn 命名管道受限 → esbuild/vite/electron-builder/Electron 会 EPERM。
2. **工具路径**：`cmd /c node_modules\.bin\<tool>.cmd`（`.ps1` 被执行策略禁）；`npm` 用 `npm.cmd`；
   tsc 必须在项目目录（否则 `Cannot find module`）。
3. **PowerShell**：读 UTF-8 文件用 `[System.IO.File]::ReadAllText`（PS 5.1 默认 GBK 会 mojibake）；
   管道 `| Select-Object` 有时导致输出被吞/看起来"卡死"——怀疑卡死时用 `node tools/xxx.mjs` 直接跑；
   中文输出前设 `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`。
4. **临时脚本**：命名 `tools/temp-*.mjs`（`.gitignore` 已排除），**用完删除**；`.mjs` 里不能写 TS 类型注解/
   `import type`（esbuild 按 JS 解析），需要类型就用 `.ts` 并配 `import`。
5. **调试实例与 CDP**：`release\win-unpacked\NBA经理.exe --remote-debugging-port=9333`；
   `Page.captureScreenshot` **偶发挂起**（ui-smoke 的 `shot()` 已加 8s 超时兜底）；
   调试模式会产 `%SystemDrive%` 残留（见 6）。
6. **%SystemDrive% 残留**（历史遗留问题）：Windows 组件在进程启动瞬间按调用者 cwd 创建缓存目录，
   字面量 `%SystemDrive%` 会落在桌面/项目目录。`electron/main.cjs` 顶部 `process.chdir(dirname(execPath))`
   + 3s 清理循环兜底；检查四路径：`nba-manager`、`release`、`release\win-unpacked`、`Desktop`（过滤 `*SystemDrive*`）。
7. **git / gh（本机）**：已用 winget 安装 Git 2.55 与 gh 2.100；PATH 需从 Machine+User 刷新：
   `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')`。
   **GitHub 连接状态会变**（GitHub 直连时常被墙；本机代理常见端口 `127.0.0.1:7897`，但代理软件可能随时关闭）：
   - 先判断：`Test-NetConnection 127.0.0.1 -Port 7897`（代理是否活着）、`Test-NetConnection github.com -Port 443`（直连是否通）
   - 走代理时：`gh` 需在命令前设 `$env:HTTPS_PROXY='http://127.0.0.1:7897'`；`git` 用 `git -c http.proxy=http://127.0.0.1:7897 push`（或用完即 `git config --unset http.proxy` 恢复直连）
   - 认证：`gh auth login --hostname github.com --git-protocol https --web`（浏览器打开 https://github.com/login/device 输入设备码）。账号 `lxnndd`，凭据已在 keyring。
   - 仓库：`https://github.com/lxnndd/nba-manager`（**私有**）；改公开：`gh repo edit lxnndd/nba-manager --visibility public`
   - **当前状态（截至本档案编写）**：本地已有 2 个提交（`489b3b7` 源码、`abf7537` 本档案），
     `origin` 已配置但**尚未推送最新提交**（用户指示"先不管 GitHub，有需要再连接"）。
     需要时执行：`git push`（若失败，按上面步骤判断代理/直连）。
8. **打包注意**：`build.win.signAndEditExecutable = false`（winCodeSign 符号链接解压失败，勿改）；
   `portable.artifactName = "NBA-Manager-${version}.exe"`；**严禁对 portable exe 用 rcedit**（会丢 NSIS overlay 变 53KB 损坏）；
   exe 图标由 `build/icon.png`（篮球）在 makensis 编译期嵌入。打包前必须杀掉旧实例，否则 electron-builder 占用失败。
9. **冻结基线**：真实名单第一季场均约 200-207 分/队；改动引擎参数（球权/篮板/命中率）后数值会漂移，
   需在验收时说明原因（例：v2.2.0 球权前场化 + v2.1 篮板下调 → 207.6；v2.2.1 → 205.5）。
   **v2.3.0 记录**：205.5 → **206.3 分/队**（FG 48.0%，3P 37.1%，得分王 32.8）。漂移原因：①球权向球星集中
   （`coreBoost`）②三分倾向改能力驱动 ③位置口径修正 ④手动轮换改「每分钟排班表」。**均为有意为之的方向性调整**。
10. **位置推断的三条铁律（v2.3.0 血泪教训）**：
    - 数据源的 `positions` 顺序**不可信**（Jalen Williams 6'5" 被标 C/PF、Caruso 被标 SF/PG），必须用身高 + 技能推断；
    - **别用身高硬过滤**：最初按身高把 6'11" 的杜兰特限成 PF/C（错得离谱）。要用「技能契合分 + 身高契合分」联合评分，
      且身高契合用**软惩罚**（每超 1 英寸 −3.5 分）而非硬性排除；
    - **改动前先自动预览**：`node tools/build-real-roster.mjs --check` 会列出全部位置改动，逐条核对名人案例再落盘；
    - 位置推断改完必须做**队伍位置深度均衡**（每队每位置 ≥2 人），否则"某队某位置独苗 → 打满 48 分钟"。
11. **引擎简化的补偿系数要标定，不要凭直觉**：v2.3.0 的 `coreBoost`（队内第一选择 ×2.5）看似激进，
    但它是对"回合模型过于平均主义"的补偿——按真实 2025-26 赛季 8 位球星的场均得分标定后，
    6 位误差在 1-2 分内（文班 24.3→26.1、塔图姆 26.8→28.5、库里 24.5→25.7）。改这类系数前先跑对照表。
12. **轮换必须"分钟级稳定"，不能"每回合重算"（v2.3.0 最隐蔽的 bug）**：
    症状是"首发 36 分钟 0 出手、替补包办出手、+/- 首发 -53 / 替补 +43"。
    根因：`sideLineup` 每个回合用「剩余目标时间」重新选人 → 同一位置的两人被**进攻回合/防守回合**分开
    （防守回合选走 A、进攻回合选走 B）→ A 只在防守时在场（永不投篮）。
    修法：`rotationPlan` 预计算 48 分钟固定排班（最小余额法交错），攻防同一分钟同一批人。
    **教训：任何"按剩余量贪心"的调度都要检查"同一时间片内是否稳定"。**
13. **WeakMap 做引擎缓存（v2.3.0）**：`roleCache` 曾用 `team.id` 作 key → 重开一局时命中上一局的缓存，
    加成给错球员。凡是以"联赛内对象"为缓存键的场景，一律用 `WeakMap<对象, ...>`（新联赛 = 新对象 → 自动失效）。
14. **列表 UI 的 memo 依赖要带 length（v2.3.0）**：`useGame.tick` 是浅拷贝，而引擎对 `freeAgents` 等数组
    用 `splice/push` 就地修改 → 引用不变 → `useMemo(..., [l.freeAgents])` 不重算，
    表现是"签约后球员不消失，切换两次才刷新"。修法：引擎改为替换新数组（`l.freeAgents = [...]`）
    **且** UI 依赖加 `.length`。新增列表型 memo 时务必照做。

---

## 11. 已知遗留 / 后续可做（TODO）

- **场均得分**：当前两队合计约 206 分（≈103 分/队），略低于现代 NBA（~230）。
  v2.3.0 球权集中化 + 三分结构修正后已明显改善（三分占比更接近真实），若要进一步贴近真实需上调节奏或命中率基准（改动后须复测全季基线）。
- **选秀权保护与互换**：真实 NBA 的"前 8 保护""签位互换"尚未实现（当前签位为无保护）。
- **选秀权年限**：当前开放未来 3 年（用户指定）；真实规则允许交易未来 7 年首轮，如需放宽改 `PICK_YEARS`。
- **exe 图标**：已用 `build/icon.png` 篮球图标；如需自定义更精致图标替换该文件即可（勿用 rcedit）。
- **真实名单 ovr 与算法总评差异**：真实球员保留 2K 官方值（如塔图姆官方 93 / 算法 84），面板会显示对照说明。
- **未实现的劳资细节**：奢侈税罚款、球员选项/球队选项、交易否决权、双向合同（每队 3 人 / 最多 50 场）、
  10 天短合同、买断。
- **老将年龄表维护**：`VET_AGE` 只覆盖 17 位"截断带"老将；若数据源更新（新的 2K 版本）需重新检查该表（§4）。
- **ui-smoke 覆盖**：尚未覆盖"玩家签轮到时的 80 池点选"UI（引擎路径已由 selfTest 断言）；
  可按需在 ui-smoke 中构造"玩家持有第 1 签"的场景补测。
- **球队详情/合同**：暂无球员合同年限逐年在 UI 上的明细表（仅显示剩余年限与年薪）。
- **数据版权**：2K 评分 + NBA CDN 头像仅个人娱乐，仓库保持**私有**。

---

## 12. 交接检查清单（新会话第一件事）

1. `cd C:\Users\10709\Desktop\AI\nba-manager` → 读本文件 + `package.json`（版本/脚本）+ `使用说明.txt` 顶部版本段。
2. 跑 §9 的 1-2 步确认基线未破（tsc 0 错、selfTest 0 失败）。
3. 若涉及 UI：起调试实例 + `node tools/ui-smoke.mjs 9333` 跑一遍，确认无回归再动代码。
4. 改动引擎数值 → 记录前后基线差异（场均/FG/3P/FT/得分王/篮板王）。
5. 发版流程：版本号三处 + Changelog + 使用说明 → 验证链 1-8 → 交付 `release\NBA-Manager-x.y.z.exe` 路径。
6. 收尾：删临时脚本、杀调试进程、检查 `%SystemDrive%` 残留、必要时 `git add/commit/push`。
