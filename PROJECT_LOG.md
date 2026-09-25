# 🏀 NBA 经理 · 项目迁移档案（PROJECT_LOG）

> 用途：把本项目的**全部对话成果**压缩成一份自包含文档。新会话只需读这份文件 + 仓库源码，
> 即可无缝接手开发，无需重看历史对话。
> 最后更新：v1.0.1 公测版（2026-09）。仓库：**https://github.com/lxnndd/nba-manager**（**已转为公开**）；
> 已发布 Release：**v1.0.1**（Latest，含 `NBA-Manager-1.0.1.exe`）与 v1.0.0（保留可回退）。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 本地路径 | `C:\Users\10709\Desktop\AI\nba-manager` |
| 技术栈 | Electron 33 + React 19 + TypeScript 5.7 + Vite 6（纯离线单机，无后端） |
| 当前版本 | **1.0.1**（公测版；package.json / `src/App.tsx` 顶栏 / `src/ui/ChangelogModal.tsx`） |
| 交付产物 | `release\NBA-Manager-1.0.1.exe`（便携版，双击即玩，89.65 MB）+ GitHub Release v1.0.1（Latest） |
| 目标用户 | 用户的弟弟（玩英文名单的真实 NBA 模式）；玩家=一支 NBA 球队的总经理 |
| 名单模式 | `real`（2K27 真实名单，主力玩法）/ `fictional`（虚构名单，自测基线） |
| 存档 | `%APPDATA%\NBA经理\saves\auto.json`（Electron）或 localStorage 兜底；`SAVE_VERSION = 11` |
| 自测 | `src/engine/selfTest.ts`（虚构 + 真实双跑，390+ 断言，全绿才发版） |
| 本版主题 | **球队定位改看战绩**（20 场后胜率 < 20% 重建；40 场后落后分区第 8 ≥10 胜场也重建）· 移除轮换与战术面板 · 交易搜索器居中且结果全显示 · 数据榜真正居中 · 公告只写本次 · 修单实例锁 |

**本版（v1.0.1）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v1.0.1 行（战绩定位 + UI 精简） |
| §5.7 交易 | `teamPhase(t, l?)` 新增联盟上下文参数：40 场落后第 8 ≥10 胜场 → 重建；20 场后按战绩 |
| §10 经验 | **本机沙箱限制**（workspace-write 写不了 `%APPDATA%`/`%TEMP%`）与 Electron 测试绕行 |

**上一版（v1.0.0）各档案章节更新要点**

**本版（v1.0.0）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v1.0.0 行（公测版：卡片改造 + 背景渐变修复 + 发布） |
| §9 验证链 | 新增 **GitHub 发布步骤**（本机 github.com 被阻断 → 用 `tools/push-via-api.mjs` 走 API 推送） |
| §10 经验 | "CSS 高优先级 :not() 会误伤新加的兄弟类名""版本号回退时 prune 不能按版本排序" |
| §1 版本号 | 2.7.1 → **1.0.0**（用户指定：公测版从 1.0.0 起） |

**上一版（v2.7.1）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.7.1 行（六处反馈修正） |
| §8 UI 地图 | 新增 `src/ui/backdrops.ts`（标题屏与游戏内共用的背景轮换）；`RosterView` 的 `pos-head` 可点选战术发起位置；`.info-modal` 详情弹窗 |
| §10 经验 | "背景铺底不能盖住内容（wrap 控透明度、内层控交叉淡入）" |

**上一版（v2.7.0）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.7.0 行（UI 美化 7 项） |
| §4 数据管线 | 背景图改为 `tools/fetch-nba-photos.ps1`（NBA 官网官方照片 → 50 张 1920×1080） |
| §8 UI 地图 | 标题屏加 `guide`/`rules` 阶段；`.view-full` 全屏列表；筛选按钮统一放 `.card-head .head-tools` |
| §10 经验 | "规则说明集中一处，界面只留功能标签" |

**上一版（v2.6.4）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.6.4 行（usage 只影响持球、不影响出手） |
| §5.2 模拟 | 球权段补注：`uw(p)` 同时乘进**持球权重**与**接球出手权重** |
| §10 经验 | "自定义参数生效面覆盖不全"（用户按 UI 语义用，实现只覆盖了一半链路） |

**上一版（v2.6.3）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.6.3 行（数据榜不再截断 20 人） |
| §7/§8 地图 | `leaders(l, stat, minGp, playoff, limit = Infinity)`；`LeagueView` 数据榜加 `.leaders-count` 人数行 + `.leaders-scroll` 滚动容器 |

**上一版（v2.6.2）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.6.2 行（前二当家溢价 + 估值与位置脱钩） |
| §5.7 交易 | **`TOP2_PREMIUM = 1.5` + `top2Ids`**、**`gen.valueOvr` 位置无关估值口径** |
| §7 源码地图 | `gen.ts` 新增 `valueOvr`；`league.ts` 新增 `TOP2_PREMIUM/top2Ids`，`tradeEff/tradeValue/phaseValue/teamPhase/coreBlockReason` 改用 `valueOvr` |
| §10 经验 | "改 ovr 造 mock 遇到基准制口径会集体失真""位置无关要用生成期不变量" |

**上一版（v2.6.1）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.6.1 行（核心门槛 + 能力档位系数 + 中国新秀 + 国籍显示） |
| §5.7 交易 | **`CORE_OVR = 85` 核心门槛 `coreBlockReason`**、**`ovrValueWeight` 能力档位系数** |
| §7 源码地图 | `league.ts` 新增 `CORE_OVR/coreBlockReason/ovrValueWeight`；`gen.ts` 新增 `DRAFT_CN_BONUS` |
| §10 经验 | "硬门槛与估值系数互补""档位系数要成对设计（压下限 + 抬上限）" |

**上一版（v2.6.0/v2.5.1）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.5.1（估值失衡修正）与 v2.6.0（反向报价 + 签值口径）行 |
| §5.7 交易 | **`tradeEff` 拆 now/future**、`phaseValue` 阶段折算、**`searchTradeTargets` 反向报价**、`pickValue` 新基础值表 |
| §7 源码地图 | `league.ts` 新增 `tradeEff/phaseValue/phaseFutureWeight/searchTradeTargets/TargetSuggestion` |
| §10 经验 | "偏好权重只能乘在可争议的那一段上""估值口径必须与决策口径一致" |

**上一版（v2.5.0）各档案章节更新要点**

| 档案章节 | 更新要点 |
|---|---|
| §3 需求演化史 | 新增 v2.5.0 行（弟弟 16 条需求 → 实现映射） |
| §5.4 成长/加点 | **v2.5.0：休赛期账面处理 `offSeasonBookkeeping`（伤病康复 + 合同年递减）+ 合同到期（放走/自动续约）** |
| §5.2 模拟 | `simulateGame(..., accumulate: boolean \| 'playoff')` 写 `poGp/poStats`；`depthList` 借人替补优先 |
| §5.3 赛季/季后赛 | 常规赛 `gp ≤ 82`（跨队容差）、季后赛独立统计、新秀阵门槛 20 且每阵必 5 人 |
| §5.5 选秀 | `LotteryResult.lotteryIds` + "原属/现属"展示、新秀名字全汉化、休赛期 3 天交易窗口 |
| §5.6 自由市场 | UI 位置筛选（全部 + 五位置） |
| §5.7 交易 | 球队三状态加权（>85/80-85/<80）、`l.lockedPids` 锁定、**Stepien 移除** |
| §6 存档 | `SAVE_VERSION = 11`：`Player.poGp/poStats`、`LeagueState.lottery/lockedPids/offseasonTradeDays` |
| §7/§8 地图 | 行数刷新；`TradeView`（锁定 + 状态徽章）、`LeagueView`（数据榜双季）、`OffseasonView`（休赛期交易窗口）、`FreeMarketView`（位置筛选） |
| §9 验证链 | ui-smoke 增补检查（总计行 / 位置筛选 / 锁定 / 搜索器 / 双季数据榜 / 乐透归属 / 休赛期交易窗口） |
| §10 经验 | 新增"过时断言要跟着决策一起改""个人 gp 跨队可超 82""lottery.order 是 30 队"等 |
| §11 遗留 | 更新 ui-smoke 覆盖清单 |

**核心约束（务必遵守）**
- 引擎**确定性**：所有随机用 `mulberry32(seed)` 种子流；仿真种子公式**不可随意改**（会破坏复现与冻结基线）。
  新增功能的独立流：季中 AI 报价 `l.seed*1301 + day*17 + 5`、乐透抽签 `l.seed*4271 + l.season*613 + 29`、
  下一届新秀 `seed*5501 + 11`（建档）/`l.seed*5501 + l.season*97 + 23`（逐年）、体测 `height*7919 + age*131 + …`。
- 真实名单数值基线（第一季、无成长时）：场均 ~203-207 分/队、FG ~46-49%、3P ~37-37.5%、
  得分王 ~29-30 分、篮板王 ~14 板。改动引擎参数后要复测并记录漂移原因（v2.3.0 记录见 §10.9）。
- 真实球员 `ovr` 保留 **2K 官方 overall 原值**（95+ 传奇档依赖它）；技能加点通过 `baseSkills` 增量模型回写（见 §5.4）。
- 真实球员**主/副位置严格照搬 2K27 的 `positions` 数组**（v2.4.0 用户指定）：
  主位置 = `positions[0]`、副位置 = `positions[1]`（只给 1 个位置时按 `POS_SEC` 补相邻位置）。
  **不再做任何推断、提位或深度均衡**——数据源写什么就是什么（卡鲁索 = SF/PG、德雷蒙德·格林 = PF/C）。
  **唯一例外（v2.5.0 用户指定）**：杰伦·威廉姆斯 = **SG/SF**（`build-real-roster.mjs` 的 `POS_OVERRIDE`）。
  核对命令 `node tools/build-real-roster.mjs --audit`（除该例外应输出 0 处差异）。
  位置深度不足的球队由引擎 `depthList` 在比赛中向相邻位置借人兜底（替补优先）。
  ⚠️ 历史教训：v2.3.0 曾用「身高 + 技能评分」推断位置，虽然修好了卡鲁索/杰伦·威廉姆斯，
  但会与数据源产生大量差异（格林被判成分卫），最终按用户要求改为严格照搬。
- 改位置逻辑后必须重跑 `node tools/build-real-roster.mjs` 并跑 `--audit` 核对（见 §10.10）。
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

| **v2.5.0** | 弟弟 16 条：①交易市场按球队三状态（首发 5 人均值 >85 争冠 / 80-85 补强 / <80 重建）定价 ②交易搜索器里（含我方）球员显示能力值与位置 ③去掉交易页"双方总估值" ④去除 Stepien 规则 ⑤自由市场加五位置筛选 ⑥数据榜实时 + 常规赛/季后赛分开、阵容页打完常规赛改记季后赛 ⑦杰伦·威廉姆斯 = 分卫/小前 ⑧交易市场加锁定（锁定球员不被 AI 报价）⑨战报加"总计"行 ⑩乐透抽签后三天可交易 ⑪乐透结果显示原属/现属球队 ⑫杨瀚森 2005 年生 ⑬新秀二阵少一人 ⑭新秀名字全部汉化 ⑮伤病次季自动康复 ⑯合同年随赛季递减 | `teamPhase/phaseLabel/phasePlayerWeight/phasePickWeight`（`league.ts`）；`evaluateTrade` 按阶段加权、Stepien 检查删除；`l.lockedPids` 在 `tryAITradeOfferToUser` 中跳过；`Player.poGp/poStats` + `simulateGame(...,'playoff')` + `leaders(...,poMode)`；`LotteryResult.lotteryIds` + `.lo-owner`"原属→现属"；`l.offseasonTradeDays = 3`（休赛期交易窗口，`OffseasonView` 内嵌 `TradeView`）；`offSeasonBookkeeping`（伤病清空 + 合同年 -1）；`enNameToZh` 让美国新秀也显示中文译名；`POS_OVERRIDE`/`AGE_OVERRIDE`（JW SG/SF、杨瀚森 21 岁）；新秀一二阵 `takeRk` 兜底必 5 人；`SAVE_VERSION=11` |

| **v2.5.1** | 用户看图反馈：搜索器给出的「萨博尼斯（85 · 29岁）单换莫布利（87 · 24岁）」被判"基本对等（争冠中：愿为即战力买单）"，估值 2.0 ↔ 3.3 —— 更强且更年轻的一方反而等价 | 根因 = 阶段权重乘在**整体价值**上（争冠 ×0.75 把莫布利 3.3→2.5、老将 ×1.2 把萨博尼斯 2.0→2.4）。修法：`tradeEff(p)` 把等效能力拆成 `{now, future}`，`phaseValue` 只对未来溢价加权（争冠 0.6 / 补强 0.9 / 重建 1.35），当下战力（ovr + 合同 + 球星稀缺）永不打折；`phasePlayerWeight` 改为折算系数（展示口径）；搜索器 `gain` 改用我方阶段折算；交易页同时显示市场估值与双方折算估值。同一案例现在 2.87 vs 2.00 → 拒绝（selfTest 加了合成球员 + 真实球员双回归断言） |

| **v2.6.0** | ①交易搜索器加「选定对方球员 → 给我发报价」的反向搜索 ②未来三年首轮签初始价值 1.5 / 1.2 / 1，次轮 0.4 / 0.3 / 0.2 | 引擎 `searchTradeTargets(l, wantPids, wantPickIdx)`（目标按现属球队分组 → 价值剪枝 → 单人/单人+签/两人/两人+签四类组合 → 全部经 `evaluateTrade` 校验 → 按**我方阶段折算净收益**排序），返回 `TargetSuggestion extends TradeSuggestion {myGiveVal,myGetVal}`；`pickValue` 改为 `PICK_BASE = {1:[1.5,1.2,1.0], 2:[0.4,0.3,0.2]}` × 战绩质量系数（首轮 0.6-1.4、次轮 0.8-1.2，中性=1.0）；UI 搜索器加模式切换 + 「🎯 生成报价方案」+「📨 发送报价」（目标在右栏勾选，可跨队） |

| **v2.6.1** | ①「每个球队的 85 以上都是中流砥柱，想要换取，也得用 85 以上去置换——争冠球队怎么可能送出自己的组队核心」②「新秀国籍里美国也标出来」③「加强中国新秀，平均加 10 能力」④「应该降低添头的价值，75 以下对半砍，75-80 降 20%」⑤「85-90 涨 20%，90 以上涨 40%」 | ①`CORE_OVR = 85` + `coreBlockReason(ai, want, give)`：核心数量门槛（对方送 N 个核心，你必须送 ≥N 个）+ 不许降级（85 换不走 87）+ 同档不许拿老换少；插在 `evaluateTrade` 的**薪资/签冻结检查之后、估值判定之前**，因此所有交易入口（正向/反向搜索、AI 主动报价、AI 间交易）自动生效 ②`ovrValueWeight(ovr)`：<75 ×0.5 / 75-79 ×0.8 / 80-84 ×1.0 / 85-89 ×1.2 / ≥90 ×1.4，同时乘在 `tradeValue`（市场价）与 `phaseValue`（决策价）上 ③`genRookie(rng, tier, idSeq, ovrBonus = 0)` + `DRAFT_CN_BONUS = 10`：中国新秀在**生成期**抬 target（技能与总评同步；`gauss(rng)` 仍只调一次 → 不扰动随机序，其余 77 人逐位不变），实测平均 +9.17 ④新秀榜 `DraftView` 与选秀面板 `OffseasonView` 的国籍列改为**一律显示**（含美国）；自由市场列表与球员详情维持"非美国才显示"（用户指定只改选秀相关两处）⑤`TradeView` 的估值 tooltip 同步新口径 |

| **v2.6.2** | ①「球队对于自己前两位球员的交易欲望不高，价值的 1.5 倍才能打动」②「换位置不变价值，这个不太公平」（追问后用户选定：**只把交易价值与位置脱钩**） | ①`TOP2_PREMIUM = 1.5` + `top2Ids(t)`（按 OVR 降序取前 2，同分按 id 稳定）：`evaluateTrade` 里 AI 送出的当家球员按 1.5 倍计入 `aiGiveVal`（要价），拒绝理由写明"XX 是队内前二当家：要价按 1.5 倍计"；`searchTradeTargets` 的 `wantVal` 同步 ×1.5（否则筹码剪枝窗口偏小、会漏掉可行方案）②`gen.valueOvr(p)`：位置无关的估值口径 = `baseOvr + calcOvr(skills) − calcOvr(baseSkills)`（换位只改 attrs 与当前 ovr，**不动 skills/baseSkills/baseOvr** → 该值恒定，缺 skills 的部分构造对象回退 `p.ovr`）；`tradeEff/tradeValue/phaseValue`、档位系数 `ovrValueWeight`、核心判定 `coreBlockReason`、`top2Ids`、`teamPhase` 全部改用它。实测 450 人次「主→副」换位：374 人次总评变化（位置适配保留），**交易估值变化 0 人次**、核心身份翻转 0 人次 |

| **v2.6.3** | 「球员数据榜现在只能看见 20 人，现在要看到所有人」 | `leaders()` 去掉写死的 `rows.slice(0, 20)`，签名加 `limit = Infinity` → 默认返回**全部**上榜球员（需要限量时显式传参，`selfTest` 只取 `[0]` 不受影响）；`LeagueView.leadersTable` 外包 `.leaders-box`（新增 `.leaders-count` 人数行"共 N 人上榜"）+ `.leaders-scroll` 滚动容器，`theme.css` 补 `.leaders-scroll thead th` 吸顶。实测真实名单模拟 60 天：得分榜 **379 人 = 全联盟出场 ≥8 场人数**（此前恒为 20），`minGp` 门槛与显式 `limit` 均正常 |

| **v2.6.4** | 「我拉满中锋的球权，压低了其他位置的球权，但是出手次数很低，是什么问题」 | 根因：自定义 `usage` 只在**持球人**选择里生效（`hw` 里 `× (0.35 + usage*0.13)`），而"出手者"那段（持球人自投 35%，其余 65% 由 `tend[pos] × (0.8+three/180) × ability^1.4 × coreBoost` 竞争）**完全没读 usage** → 拉满只换了带球人。修法：把同一系数抽成 `uw(p) = usage != null ? 0.35 + usage*0.13 : 1`，**同时乘进 `w2`（接球出手权重）**；留空者恒为 1 → 默认比赛与既有基线逐位不变。实测（BOS 14 场，首发中锋米切尔·罗宾逊 O80）：默认 7.6 次出手/场 → 中锋 10 + 其余首发 0 = **14.4 次**（18.0 分）→ 只设中锋 10 = 10.4 次 → 中锋设 0 = 3.3 次 |

| **v2.7.0** | ①「进行ui美化」②「开始界面的图片选用真实nba比赛的照片50张，1s轮换一次」③「轮换与战术界面感觉空的地方太大，而且单行太窄」④「自由球员市场应该把列表居中而且放大到全屏」⑤「新秀的界面同理，筛选按钮都放到右上角」⑥「去除所有界面带有说明性的文字，介绍规则应该在主菜单的开始新游戏后、在选择你的球队前加入两个选项，新手则把规则全部呈现出来，老手则进入选择球队界面」⑦「删除导出存档和导入存档功能，不需要」 | ①新增 `tools/fetch-nba-photos.ps1`：爬 NBA 官网各版块页提取 `cdn.nba.com/manage/...` 官方照片 → System.Drawing cover 裁剪压缩为 1920×1080/q80 → `src/assets/backdrops/nba-01..50.jpg`（50 张 13.7 MB，旧 10 张 Pexels 图已删）；`TitleScreen` 轮播 20s → **1s**，双层 `.title-bg`/`.title-bg-alt` 交叉淡入 + `new Image()` 预加载 ②`TitleScreen` 新增 `guide`（我是新手 / 我玩过）与 `rules`（7 板块规则总览）两个阶段，`doNew()` 先进 guide；规则类文字从各界面集中到此 ③CSS：`.view-full` 全屏铺满 + `.card-head`/`.head-tools`（标题在左、筛选右上）+ `.fa-row`/`.db-row` 加大行距字号 + `.rot-grid` 列宽 40/2fr/54/1.8fr/1.4fr、`.rot-grid-wrap` max-height 340px→64vh ④删除 `exportSave/importSave`（`useGame.ts`、`gm.d.ts`、`electron/main.cjs` 的 `file:export`/`file:import`、`preload.cjs`）⑤`ui-smoke.mjs` 增加分流页与规则页断言、筛选按钮选择器 `.fa-filter`→`.head-tools` |

| **v2.7.1** | ①「5s轮换，现在太快了，这些背景玩游戏的时候也能看见」②「球员数据榜还是不能实时同步，我都打了3天还是没数据，不要加出场大于8场这种限制，括号里面也去了，这种说明性文字少出现」③「联盟界面的也都居中，按钮变大一点，现在太小了」④「乱换战术界面，我现在想法是和下面的卡片结合起来」⑤「上面的风格执教和羁绊要能点开查看详情」 | ①背景轮播 1s → **5s**；把 `BACKDROPS`/轮播逻辑抽到新文件 `src/ui/backdrops.ts`（`useBackdropRotation()`），`App.tsx` 加 `<GameBackdrop>` —— `.game-bg-wrap` 固定在底层 `opacity:.2` 控整体透明度、内层两层做交叉淡入，**游戏内因此也能看见照片** ②`LeagueView` 改为 `leaders(l, stat, 0, poMode)`（去掉常规赛 8 场 / 季后赛 1 场门槛），`.leaders-count` 去掉括号说明，并删掉"（季后赛独立统计…）/（数据实时更新）"；实测开季榜单从 0 → **450 人**（全联盟） ③`LeagueView` 加 `view-full league-view`，CSS 让 `.tabs`/`.conf-grid`/`.leaders-box` 居中、`.tab` 15px/9×24、`.chip-btn` 与 `.btn.sm` 加大 ④删掉 `.rot-toolbar` 里的发起位按钮组，改为**点位置列标题**（`.pos-head` + `.initiator` 高亮 + 🎯）直接设置 `me.initiator` ⑤球队气质的风格/执教/羁绊 chip 改为按钮 → `.info-modal` 详情弹窗（风格与执教列出全部选项并标出当前所选；羁绊列出每组的实算加成与相关球员名单） |

| **v1.0.0**（公测版） | ①「现在切换背景会黑一会，要的是渐变到下一张，游戏里是对的，但是主菜单有问题」②「把球员上场时间和权值加到下面的卡片里，把卡片做大点来适应新加入的，删掉卡片上的薪资，调整上下的按钮去除，改为拖动来进行」③「完成这些之后这一版上线公测，版本号为1.0.0，上传github并删除之前的版本」 | ①主菜单闪黑有两个原因：`.title-bg-alt` 的 class **不匹配** v1.1 段那条高优先级的 `.title-screen > *:not(.title-bg):not(.title-bg-overlay)` 规则，被强制成 `position:relative` 掉进布局流；且 `.title-bg` 原本写的是 `transition: background-image`（该属性无法过渡）。修法：两条规则都补上 `:not(.title-bg-alt)`、过渡改为 `opacity .55s` ②`RosterView` 位置卡片：把「时间」「球权」输入搬进 `.rc-foot`（`.rc-field` + `.rf-btn`），删掉 `.rc-right` 的薪资与 `.move-btns` 的 ↑↓；改为**拖动排序** —— 卡片自身加 `onDragOver/onDrop`（`stopPropagation`），同列拖动 = 重排，拖到另一列 = 主副互换 ③版本号 2.7.1 → **1.0.0**（公测），打包 + ui-smoke 全绿后发布：`gh api` 建 tag `v1.0.0` + `gh release create` 上传 exe。**注意**：`tools/prune-old-releases.mjs` 原按版本号排序，遇到版本号回退（2.7.1 → 1.0.0）会把刚打出的新版误删，已改为**按构建时间**排序 |

| **v1.0.1** | ①「球队的定位在打了20场之后根据战绩来修正，胜率不足20，直接重建状态」②「打了40场之后，胜场和第八的球队差距大于等于10也进入重建」③「公告不用把之前的都写进去了」④「轮换与战术就可以去了，其功能已经被其他板块瓜分了」⑤「交易搜索器的框也居中，同样去除多余文字解释，不需要展开」⑥「球员数据榜还是没居中」 | ①`teamPhase(t, l?)` 增加**联盟上下文参数**：`gp>=20` 时改按战绩（`wr<0.20`→重建；`wr>=0.55` 或 `wr>=0.45 && avg>85`→争冠；`wr>=0.40 || avg>=80`→补强）；`gp>=40` 且**落后本分区第 8 名 ≥10 个胜场 → 直接重建**；20 场前仍按阵容（valueOvr 前 5 均值）。所有调用点补传 `l`（`league.ts` 4 处 / `TradeView` 3 组 / `selfTest`） ②`ChangelogModal` 的 ITEMS 只保留本次更新（此前累积了 **47 条**历史条目） ③删除 `.rot-panel` 整块，只留一条 `.rot-bar`（自定义状态 + 恢复自动轮换）——分钟/球权已在位置卡片里改、发起位置点位置卡片标题 ④`.trade-search` 加 `max-width:1180px; margin:auto` 并让 `tabs/btn-row/sr-group` 居中；**删掉 `showAllResults` 分页机制**（原来只显示 10 条、要点"显示全部 N 条"才展开），结果直接全部列出 ⑤`.league-view .leaders-tbl { max-width:none; margin:auto }` —— 原来表格被 `max-width:760px` 限制，在 1120px 的容器里是**左对齐**的，这才是"数据榜没居中"的真正原因 ⑥修单实例锁（见 §10.31） |

**迭代工作方式（继续保持）**：用户（转述弟弟反馈）给需求 → 直接实现 → 全量验证链 → 打包 exe → 更新 Changelog/使用说明 → 交付产物路径 + 变更说明；涉及行为改动时在 `使用说明.txt` 顶部加版本段。
⚠️ v2.6.0 起用户要求"**每次测试时间太长，只测试改的功能**"：优先跑 `tsc` + 针对本次改动的定向脚本（`tools/temp-*.ts|mjs`，用完删除），全量 selfTest / ui-smoke 只在发版前或改动涉及全局数值时再跑。
🧹 v2.6.4 起用户要求"**之后也要更新就把旧的删了**"，并进一步明确"**只在自己文件夹下存放，不要超出**"
   （2026-09-20 共清掉 AI 根目录约 253 MB：2.6.0/2.6.3 旧版 exe、4 份旧说明副本、过期文档、
   25 张 ui-smoke 截图、`%SystemDrive%` 残留目录、3 份旧存档）：
   - **所有产物只留在项目自己的文件夹内**：打包产物 = `nba-manager\release\NBA-Manager-<version>.exe`，
     使用说明就是项目里的 `使用说明.txt`；**绝不往上级目录（AI 根目录 / 桌面）复制或另存任何文件**；
   - `npm run dist` = `vite build` → `electron-builder` → `prune-old-releases.mjs`
     （**release 只留最新 1 个 exe**，默认 keep 已由 2 改为 1）；
   - 曾一度加过"自动同步一份到桌面"的 `tools/sync-desktop.mjs`（以及 `npm run sync`），
     因违反"不要超出"**已删除**，不要重新引入这类"往外复制"的步骤；
   - **根因修复**：`tools/ui-smoke.mjs` 的截图此前硬编码写到 `C:/Users/10709/Desktop/AI/`
     （那 25 张 png 的真正来源），现已改写到项目内 `.test-out/ui-smoke/`（`.gitignore` 覆盖），
     冒烟不再污染项目外目录；
   - **项目本体（源码 / 资源 / 配置 / 底层设定）一律不动**，AI 文件夹里其他项目
     （声学论文 / 劫火八荒 / 洛克王国 / 海洋调查等）的文件绝对不要碰。

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
主菜单背景：tools/fetch-nba-photos.ps1（**NBA 官网 cdn.nba.com 官方比赛照片**，抓取后统一压缩）
          → src/assets/backdrops/nba-*.jpg（**50 张 1920×1080，1s 轮播**，共约 13.7 MB）
          （v2.7.0 之前是 tools/fetch-backdrops.mjs 抓的 10 张 Pexels 图，已弃用/删除）
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
      配 taken 集合去重（正常球队行为完全不变）；v2.5.0 起借人顺序 = **先替补/边缘（本位置深度降序）、
      再全位置兜底**（此前借到对方首发 → 该球员 36+12=48 分钟）
v2.5.0 常规赛/季后赛统计分离：simulateGame(away, home, rng, accumulate, injurySeed?, mods?)
      第 4 参 `accumulate`：true = 写 stats/gp（常规赛）；`'playoff'` = 写 poStats/poGp；
      false = 不累计（单场试算）。季后赛由 simPlayoffGame 传 'playoff'，常规赛统计永不被污染
球权（v2.3.1）：持球权重 = pow(pas/70,2) × posW[pos] × ability(p)
                posW = {PG .95, SG .9, SF 1.0, PF 1.0, C .98}（位置差异收窄，内线核心不再被压制）
                ability = clamp(1 + (ovr-75)*0.022, 0.60, 1.75)
                usage 自定义 → ×(0.35 + usage*0.13)；PlayCall 发起位 ×2.6，其余无自定义 ×0.85
                ⚠️ v2.6.4 修复：该系数**必须同时作用于下面"出手者"一段**（`uw(p)`），
                   否则"拉满球权"只改变谁带球、不改变谁出手（用户实测中锋出手 7.6 → 14.4 才正常）
出手者：35% 持球人自投；否则 tend[pos] × (0.8 + three/180) × ability^1.4 × coreBoost × uw(p)
        tend = {PG .7, SG .9, SF 1.0, PF 1.0, C 1.0}
        uw(p) = p.usage != null ? 0.35 + p.usage*0.13 : 1（v2.6.4；留空 = 1，不影响默认与基线）
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
v2.5.0 统计口径：常规赛 gp ≤ 82（**跨队累计可略超 82**——赛季中被交易后两队场次相加，selfTest 上限设 88）；
       季后赛单独记 `poGp/poStats`（≤40 场），`leaders(l, stat, minGp, playoff)` 取用；
       `finishOffseason` → `resetSeasonStats` 把两套统计一起清零
奖项门槛：MVP/All-NBA gp ≥ 65；DPOY/All-Defense ≥ 60；6MOY ≥ 50 且 starts < gp/2；ROTY ≥ 40；新秀阵 ≥ 20（v2.5.0 下调）
       v2.5.0：All-Rookie / All-Defense 用 takeRk(按位置取人)，位置池不足时**按总排名补位** → 每阵必定 5 人
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
【休赛期账面处理 v2.5.0】`offSeasonBookkeeping(p)`（对球队球员与自由球员各跑一遍）：
  `p.injury = null`（伤病跨季康复）+ `contractYears--`（>0 才减）。
  随后**合同到期处理**：`contractYears <= 0` 的球员——安全阀内（每队最多放走 3 人、
  名单 ≥13、每个位置 ≥1 人）放走 OVR 最低的几名进自由市场（`salary=0` + news 播报），
  其余按 `salaryFor(ovr)` 自动续约（≥32 岁 1 年 / 29-31 岁 2 年 / 其余 3 年）。
  ⚠️ 顺序：必须放在 `l.freeAgents = faLeft` **之后**（否则释放的球员会被 FA 清理覆盖掉）。
  ⚠️ 真实名单的 `contractOf(ovr, age)` 已加年龄项（≥35 岁 1 年、≥33 岁 2 年），
     否则所有人都 ≥2 年，真实模式第一季结束看不到任何到期（实测：改后放走 10 人）。
```

### 5.5 选秀（`gen.ts` + `offseason.ts`，v2.1 起可操作）
```
genDraftClass(rng)：80 人 = **美国 60 / 中国 3 / 其他国家 17**（v2.3.0 配额）
  姓名规则：美国 = `makeEnName`（FIRST_EN/LAST_EN 英文名池防重）；
  **v2.5.0：名字一律经 `enNameToZh` 输出中文译名**（Jalen Carter → 杰伦·卡特），
  英文名仅作为"防重键"保留在 `usedEnNames`；`FIRST_EN_ZH`(40) / `LAST_EN_ZH`(80) 认不出的部分原样保留
  中国 = 中文姓名池；
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
选秀顺位（乐透抽签，`league.ts lotteryDraw`）：14 支未进季后赛球队按
      LOTTERY_ODDS=[.14,.14,.14,.125,.105,.095,.086,.075,.064,.055,.045,.032,.024,.018] 抽前 4 顺位，
      其余乐透队 5-14 按战绩逆序、进季后赛的 16 队 15-30 按战绩逆序；次轮无乐透（纯战绩逆序）。
      rng 独立流：l.seed*4271 + l.season*613 + 29
      v2.4.0：`lotteryDraw` 返回 { order, odds, lotteryIds } → 存入 `l.lottery`
      （LotteryResult{year,order,odds,top4,lotteryIds}）供休赛期界面可视化（`.lottery-panel`：顺位 + 概率条 +
      前 4 高亮 + 我方 ★ + **每行"原属球队 · 现属球队"**）；`lotteryOrder` 保留为只取顺位的兼容包装
      ⚠️ `order/odds` 都是 **30 队**（前 14 位为乐透队），UI 只渲染 `order.slice(0, 14)`；
      `lotteryIds` = 乐透区 14 队 id（断言用）
      v2.5.0 休赛期交易窗口：`beginOffseason` 置 `l.offseasonTradeDays = 3`，`finishOffseason` 归 0；
      `TradeView` 的 `offseasonWindow = l.offseason && l.offseasonStep <= 1 && offseasonTradeDays > 0`
      → 期间绕过交易截止日检查（`.offseason-trade` 卡片在 `OffseasonView` 内，可展开/收起）
新秀合同（v2.3.0）：首轮 rookieScaleSalary(n) = clamp(1200-(n-1)*34.5, 200, 1200) 万 · 4 年；
      次轮 clamp(salaryFor(ovr), 200, MIN_SALARY) · 2 年
入队规则（v2.3.0）：休赛期上限 ROSTER_MAX(17)，选中直接扩编（此前 15 人就裁人 → 刚选中的新秀
      常被自己球队裁掉，一届 60 签只留下 36 人）；满 17 裁最弱冗余位腾位；开季前统一裁到 15
      ⚠️ 另修：draftComplete 撞到"用户持有的签"曾直接 break（60 签只签下 37 人），现已改为循环内代选
落选秀（v2.4.0 修复）：**必须用 `l.freeAgents = [...l.freeAgents, ...added]`**——用 push 就地修改时
      界面 useMemo 依赖不失效，玩家会以为"落选秀没进自由市场"
玩家选秀 UI（v2.4.0）：点新秀卡片 = **选中查看**（`.draft-confirm` 显示体测/潜力/技能摘要），
      点「✓ 确认选中」才真正 draftPickUser；「⏩ 快进到我的选秀」按钮走 draftFastToUserPick
```

### 5.6 自由市场（`offseason.ts`，7 天窗口）
```
要价 askFor = salaryFor(ovr) × 0.8（≤24 岁且潜力高 → ×(1+(potential-ovr)*0.02)；≥33 → ×0.7；≥30 → ×0.9）
             clamp 250-4200
7 天窗口：l.faDay 1→7；每天最多 3 份报价（l.faOffers 持久）；点「结束第 X 天」结算当天报价
AI 竞价：ask × (0.93 ~ 1.08)；star 风格且 ovr ≥ 88 → 接受门槛 0.85 → 0.78
池：保底 55 + randInt(0,10) 人；genFreeAgent 能力**均匀 55-80**；30+ 岁 8% 去海外
赛季中「自由市场」页：signFreeAgentNow 即时签约（无 AI 竞价，≥ 要价 85% 成交）
v2.5.0 UI 位置筛选：`.fa-filter`（全部 + PG/SG/SF/PF/C，带人数统计），
       过滤条件 `posFilter === 'ALL' || p.pos === posFilter || p.secPos === posFilter`
       （能打副位置的球员也会被筛出来）；`useMemo` 依赖含 `l.freeAgents.length`
⚠️ 老将年龄/评分口径见 §4（VET_AGE 表 + fixedOverall 断崖降分修正）——自由市场里的
   威少 37 岁 / 77 分（修正前 41 岁 / 42 分）
```

### 5.7 交易（`league.ts`）
```
【前二当家溢价 v2.6.2（用户指定）】TOP2_PREMIUM = 1.5，`top2Ids(t)` = 按 OVR 降序的前 2 人。
  evaluateTrade 里 AI 送出的当家球员按 `wPlayer(p) × 1.5` 计入 aiGiveVal（即要价），
  拒绝理由带"（XX 是队内前二当家：要价按 1.5 倍计）"；反向搜索的 wantVal 同样 ×1.5。
  与核心门槛互补：核心门槛管"能不能换"，本溢价管"要多少才换"。
  实测：塔图姆(93·5.22) 单换伦纳德(93·要价 6.11) → 拒绝；塔图姆+怀特(6.96 ≥ 6.11) → 成交。
【位置无关估值口径 v2.6.2（用户指定）】`gen.valueOvr(p)` = `baseOvr + (calcOvr(skills) − calcOvr(baseSkills))`
  （与 offseason.recalcOvr 同式）。tradeEff/tradeValue/phaseValue、档位系数 ovrValueWeight、
  核心判定、队内前二、球队阶段全部按它算 → 在阵容页换位（能力仍按新位置适配）**不会**改变
  球员的交易身价，也不能靠换位规避"85+ 核心"或"前二当家"规则。未换位时 ≡ p.ovr（基线不变）。
【核心门槛 v2.6.1（用户指定）】CORE_OVR = 85 = 各队"中流砥柱"。
  `coreBlockReason(ai, want, give)` 在 evaluateTrade 里**先于估值判定**执行（位置：签冻结检查之后、
  明星拒绝之前），因此所有交易入口自动生效（正向/反向搜索、AI 主动报价、AI 间交易）。三条判定：
    ① 数量：对方送出 N 名 OVR ≥ 85，你必须送出 ≥ N 名 OVR ≥ 85（选秀权/低能力添头不能替代）；
    ② 不许降级：按 ovr 降序一一配对，你给出核心的 ovr 不得低于对方核心（85 换不走 87）；
    ③ 同档不许拿老换少：ovr 相同时，你给出核心的 age 不得大于对方核心。
  拒因文案统一含"中流砥柱"三个字（selfTest 据此断言）。
【能力档位系数 v2.6.1（用户指定）】`ovrValueWeight(ovr)` 同时乘在 tradeValue（市场价）与
  phaseValue（决策价）上，保证"展示口径 = 判定口径"：
    OVR < 75 → ×0.5 · 75-79 → ×0.8 · 80-84 → ×1.0 · 85-89 → ×1.2 · ≥90 → ×1.4
  （分段不连续是用户指定的口径，**勿擅自改成平滑插值**）。选秀权 pickValue 不受影响。
  实测（真实名单，salary=0/age=27）：75→0.8 · 80→1.41 · 85→2.4 · 90→4.24 · 95→6.01。
【交易搜索器 v2.3.0】searchTrades(l, givePids, givePickIdx, maxPerTeam=3) → TradeSuggestion[]
  入参 = 玩家勾选的自有筹码（1-N 名球员 / 选秀权）；遍历 29 队，四类搜索：
    ① 单换单 ② 对方「球员 + 选秀权」 ③ 对方打包两人 ④ 追加我方筹码
       （④ 既做"当前筹码换不动"的兜底，也做"再加一点换更好的"升级 → 标 needsMore）
  候选裁剪：对方球员价值 ∈ [0.45×gv, 1.9×gv] 取前 8、签取前 4；pickValue 结果预计算（否则循环里上千次排序）
  每队最多返回 maxPerTeam 条普通方案 + 1 条"需追加"升级方案；全部经 evaluateTrade 完整校验
  实测性能：4-11ms / 次（29 队全扫），单次返回 60-105 条建议
  返回结构 TradeSuggestion{ teamId, givePids, givePickIdx, wantPids, wantPickIdx, reason, gain, needsMore, note }

【反向报价搜索器 v2.6.0】searchTradeTargets(l, wantPids, wantPickIdx, maxPerTeam=3) → TargetSuggestion[]
  方向相反：入参 = 玩家**想要**的对方球员/签（可跨队多选），输出 = 各队愿意接受的"我方筹码组合"
  目标按现属球队分组（球员看所在队、选秀权看 pk.o）→ 对每队：
    对方要价 wantVal（用**对方阶段**折算）→ 我方候选筹码按 [0.4, 2.6]×wantVal 剪枝取前 10 人 / 前 4 签
    （被 `l.lockedPids` 锁定的球员直接排除）→ 枚举四类组合：单人 / 单人+1 签 / 两人 / 两人+1 签
    → 全部经 evaluateTrade 校验 → 按**我方阶段折算净收益** gain 降序，每队最多 maxPerTeam 条
  返回 TargetSuggestion extends TradeSuggestion { myGiveVal, myGetVal }
  UI：搜索器模式切换「① 我出筹码 → 各队给什么」「② 我想要谁 → 算我要付什么」，
      模式②在右栏勾选目标 → 「🎯 生成报价方案」→ 每条报价可「填入筹码」或「📨 发送报价」直接成交
  实测性能：单目标 0-2ms；4 个真实球星目标均能给出 1-3 条可行报价

tradeValue = max(0.1, round(2^((eff-75)/10), 2))（75 基线、每 +10 翻倍）
  v2.5.1：等效能力拆成两段（`tradeEff(p)`）
    now    = ovr ± 合同（溢价 −1.5 / 廉价 +1）+ (ovr ≥ 90 ? +1 : 0)      ← 当下战力，任何阶段都不打折
    future = 潜力溢价（≤25 岁：(potEff−ovr)×0.55×clamp(1+(25-age)×0.08, 0.6, 1.6)，
             或 ≤25 岁无潜力空间 +0.5）− 年龄折损（≥31 岁：(age−30)×0.8）
    tradeValue = value(now + future)；phaseValue(p, phase) = value(now + future × 阶段系数)
  ⚠️ 历史坑（v2.5.0→v2.5.1）：早期把阶段系数乘在**整体价值**上，争冠 ×0.75 会把
     「87/24 岁」算成 2.5、把「85/29 岁」×1.2 算成 2.4 → 更强更年轻的球员反而等价甚至更便宜。
     凡是"偏好/风格类权重"，都必须只作用在**可争议的那一部分**（这里是未来溢价）上。
pickValue：v2.6.0 起 = `PICK_BASE[round][距今届数]` × 战绩质量系数
  PICK_BASE = { 1: [1.5, 1.2, 1.0], 2: [0.4, 0.3, 0.2] }（用户指定：未来三年首轮 1.5/1.2/1、次轮 0.4/0.3/0.2）
  质量系数：按 `pick.f`（**原属球队**）当季战绩排名 → q ∈ [0,1]（1 = 联盟最差）→
            首轮 0.6 + q×0.8（0.6-1.4）、次轮 0.8 + q×0.4（0.8-1.2）；战绩样本 < 8 场按中性 1.0
  → 开档（0-0）恰好等于用户给的初始价值；实测：摆烂队首轮 2.1 / 中游 1.5 / 强队 0.9
  ⚠️ 旧口径（v2.3-v2.5）= 期望能力曲线 ×0.88^off，开档首轮仅 0.93、摆烂队 1.87、强队 0.44；已废弃
【球队三状态 v2.5.0/v2.5.1】`teamPhase(t)` = 队内最强 5 人平均 OVR：> 85 = contender 争冠 / ≥ 80 = retool 补强 / else 重建
  `phaseFutureWeight(phase)`：争冠 0.6 / 补强 0.9 / 重建 1.35（作用于 future 段）
  `phasePickWeight(phase)`：选秀权 0.7 / 0.9 / 1.35（选秀权 100% 是未来资产）
  `phasePlayerWeight(p, phase)` = phaseValue / tradeValue（仅作 UI 展示的"折算系数"）
  evaluateTrade 用 phaseValue 汇总，容忍度 tol = 0.06 × aiGiveVal，
  再按阶段给 ±0.04~0.10 的情境加成（争冠"愿为即战力买单" +0.04、重建收年轻资产 +0.10 等）；
  理由文本同时给出「原始估值」与「折算后 你给 X / 他给 Y，差 Z」
【锁定 v2.5.0】`l.lockedPids`（跨赛季保留）：`tryAITradeOfferToUser` 里 `locked.has(p.id)` 直接跳过；
  UI 上只有自家球员行有 `.lock-btn`（🔓/🔒），点击切换；`.pick-row.locked` 高亮
【Stepien 移除 v2.5.0】`stepienViolation` 已删除；`evaluateTrade` 不再有"连续两年无首轮签"检查
  （selfTest 现在的断言是"理由里不再出现 Stepien"）
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

## 6. 存档 / 类型（`src/engine/types.ts`，SAVE_VERSION = 11）

**Player**：`id, name, pos, secPos(双位置), age, ovr, attrs(7), body(7), height(英寸), salary, contractYears,
potential(1-10 星), exp, starts, min|null, usage|null, injury|null, face, basePos/baseAttrs/baseOvr,
baseSkills, grow(遗留), tags(羁绊), skills(18), points(待分配), career{gp,pts,reb,ast,stl,blk}, nation,
gp, stats(16 项), **poGp, poStats(季后赛独立 16 项，v2.5.0)**`

**Team**：`id, name, city, en, abbr, conf, players, win, loss, pace, initiator, chemistry, discipline, brand,
fans(万), style(youth|star|null), coachStyle(iron|locker|brand|null)`

**LeagueState**：`version, seed, season, year, day, totalDays(170), schedule, scheduleIds, teams,
playoffRounds, champion, results, userTeamId, playerSeq, history, mode, cultureId, offseason, offseasonStep(0-3),
midUsed, freeAgents, awards, news, finalsAccum, draftPool, faDay(1-7), faOffers, poffExitShown,
pendingEvents, draft(DraftState|null), lottery(LotteryResult|null), lockedPids(number[]),
offseasonTradeDays(number, 0-3), nextDraftClass`

**LotteryResult**（v2.5.0）：`year, order(30 队), odds(30 项), top4(前 4 队 id), lotteryIds(乐透区 14 队 id)`

**SeasonAwards**：`season, mvp, dpoy, sixth, rookie, allNba[3][5], allRookie[2][5], allDefense[2][5]`（无 fmvp 字段）

**migrateSave（league.ts）** 处理 v1→v11：模式启发识别 → `ZH_NAME_MAP` 中文名（幂等）→ exp/starts/min/usage
→ body/injury/face → basePos/baseAttrs/baseOvr → grow/tags → skills → **secPos/potential 星/baseSkills/points/
career/nation** → 球队 style/coachStyle 拆分 → FA 池补建（REAL_FA 或 genFreeAgent×60）→ draftPool →
faDay/faOffers/poffExitShown/pendingEvents/draft → **v2.5.0：`poGp/poStats` 初始化、`lockedPids=[]`、
`offseasonTradeDays=0`、`lottery.lotteryIds` 回填（旧档 = order.slice(0,14)）、
英文名球员经 `enNameToZh` 翻译（`^[A-Za-z]` 才动手）**。新档为幂等 no-op。

**确定性 rng 种子（勿改）**：`simDay = mulberry32(l.seed + day*7919)`；`simPlayoffGame = mulberry32(l.seed*101 + l.season*10007 + roundIdx*977 + seriesIdx*131 + games.length)`；`beginOffseason/finishOffseason = l.seed + l.season*77777 + 13`；`settleFreeAgency = l.seed*977 + l.season*1009 + 7`；`simulateOffseasonAI = l.seed*31 + l.season*577 + 3`；`AI 交易 = l.seed*1013 + l.season*599 + 11`；伤病独立流见 §5.2。

---

## 7. 源码地图

| 文件（行数） | 职责 / 关键导出 |
|---|---|
| `src/engine/types.ts` (343) | 全部类型 + `SAVE_VERSION`；`DraftPick{year,round}`/`DraftState.year`/`AiTradeOffer`/`TeamEventOption.effects`/`Player.weight,wingspan`/**`Player.poGp,poStats`**/**`LotteryResult.lotteryIds`**/**`LeagueState.lockedPids,offseasonTradeDays`** |
| `src/engine/data.ts` (250) | 30 队 `TEAMS`、`POS_ORDER`、中文姓名池 `FIRST_NAMES/LAST_NAMES`、英文名池 `FIRST_EN/LAST_EN` + **`FIRST_EN_ZH/LAST_EN_ZH` + `enNameToZh`（新秀名汉化）**、`NATION_POOLS` |
| `src/engine/realRoster.ts` (1251) | AUTO-GENERATED：`REAL_ROSTER`（30 队 449 人）、`REAL_FA`（115）、`ZH_NAME_MAP`；球员含 `p/q`（主/副位置）、`wt/ws`（体重/臂展） |
| `src/engine/gen.ts` (956) | `genPlayer`/`genTeamRoster`/`genRookie`/`genDraftClass`/`genFreeAgent`/`realFaPlayer`、`createLeague`/`createRealLeague`/`finishLeague`、`makeSchedule`、`calcOvr/calcLin/genSkills/attrsFromSkills/deriveSkills/fromRealSkills`、`salaryFor`、`potentialToStar`/`POS_SEC`、`heightLabel/weightLabel/wingspanLabel/lbsLabel/feetLabel`、`weightFor/wingspanFor/ensureMeasure`、**`freshStatLine`（常规+季后赛两套）**/`resetSeasonStats`、`freshPickPool/rollPickPool/PICK_YEARS`、`makeNextDraftClass`、`repositionPlayer`、`assignTags`、`TEAM_STYLES`/`COACH_STYLES`/`applyTeamStyle`/`applyCoachStyle` |
| `src/engine/sim.ts` (716) | `simulateGame(away,home,rng,accumulate=true \| 'playoff',injurySeed?,mods?)`、`possession`/`reboundAfterMiss`、`coreBoost`（队内战术地位）、`depthList`（位置深度借人，**替补优先**）、`teamEffMods`/`bondMods`、轮换 `rotationPlan/manualRotation/targetMinutes/sideLineup/AUTO_MINUTES`、伤病 `injuryRisk/pregameInjury` |
| `src/engine/league.ts` (1301) | `simDay`、`standings`/`leaders(stat,minGp,playoff)`/`perGame`、季后赛 `runPlayoffRound/simPlayoffGame/playoffDone/playoffChampion/refreshPlayoffPlaceholders`、`playerScore`、`migrateSave`、`sortRoster`、**`tradeEff`（now/future 拆分）**、`tradeValue/pickValue/pickLabel/evaluateTrade/applyTrade/teamStrength`、**`teamPhase/phaseLabel/phaseValue/phaseFutureWeight/phasePlayerWeight/phasePickWeight`**、`lotteryDraw/lotteryOrder`/`rookieScaleSalary`、`searchTrades`、`tryAITradeOfferToUser`（跳过 `lockedPids`）/`acceptTradeOffer`/`rejectTradeOffer`、劳资常量、`payrollOf`、`tryAISeasonTrade`、`nextGameOf/playedCount` |
| `src/engine/offseason.ts` (877) | `timeCoefOf/growthPointsFor/agingPenaltyOf/recalcOvr/spendPoint/autoDistribute`、`agePlayer`、**`offSeasonBookkeeping`（伤病清空 + 合同年 -1）**、`beginOffseason`（乐透抽签 + 建选秀 + 下一届新秀 + **3 天交易窗口**）、`settleFreeAgency/signFreeAgentNow/cutPlayer`、`simulateOffseasonAI/simulateAIOffseasonTrades`、`finishOffseason`（清窗口）、选秀 `draftIsUserTurn/draftRemaining/draftPickAuto/draftPickUser/draftFastToUserPick/draftComplete/assignRookie`、`askFor/canSign`、`MIN_SALARY/MID_LEVEL` |
| `src/engine/awards.ts` (189) | `computeSeasonAwards`（幂等，常规奖；All-Rookie/All-Defense 每阵必 5 人）、`computeFinalsMVP`（独立 FMVP）、`lineScore` |
| `src/engine/events.ts` (109) | `rollPostGameEvent`（含带选项事件）、`resolveTeamEvent`（多效果）、`CHEM_OPTS`/`BRAND_OPTS` 权衡型选项 |
| `src/engine/rng.ts` (52) | `mulberry32/gauss/randInt/pick/shuffle/clamp` |
| `src/engine/selfTest.ts` (1326) | 全量自测（虚构 + 真实双跑，360+ 断言）；`TEST_SEED` 可覆盖；v2.5.0 断言：三状态/锁定/双季统计/乐透字段/合同年/伤病康复/新秀汉化 |
| `src/ui/*.tsx` | 见 §8 |
| `src/theme.css` (1020) | 深色主题（#0d1117 系）+ 全部组件样式（含 `.award-cards.big`/`.draft-*`/`.db-*`（新秀榜）/`.to-*`（AI 报价卡）/`.rot-*`/`.series-card.partial`/`.event-*`/**`.chip.phase-*`/`.lock-btn`/`.box-total-row`/`.fa-filter`/`.lo-owner`**） |
| `tools/build-real-roster.mjs` (445) | 2K 数据 → realRoster.ts：`VET_AGE`（老将年龄表）、`AGE_OVERRIDE`（杨瀚森 2005 年生）、`fixedOverall`（断崖降分修正）、**位置严格取 `positions[0]/[1]` + `POS_OVERRIDE`（杰伦·威廉姆斯 SG/SF）**、`parseWeight/parseWingspan`；`--audit` 核对 449 人差异 |
| `electron/main.cjs` | 主进程：`process.chdir(exe 目录)`、`%SystemDrive%` 清理循环、存档 read/write/list、文件导出导入、单实例锁 |

---

## 8. UI 地图（`src/ui/`）

- **App.tsx**：顶栏（版本号 ×2 处）、5+1 个 tab（🏀赛程 / 🧩阵容 / 🤝交易 / 💼自由市场 / 📊联盟 / 🎓新秀）、
  `l.offseason` 为真时整页切 `OffseasonView`、赛季结束横幅、`ChangelogModal`（每次启动强制显示）。
- **TitleScreen.tsx**：菜单 → **「我是新手 / 我玩过」分流页（v2.7.0）** → 选队（30 队卡片）→
  **球队风格二选一**（居中）→ **执教风格三选一** → 开局；
  v2.7.0：背景 **50 张真实 NBA 官方照片、1 秒轮换**（双层 `.title-bg` / `.title-bg-alt` 交叉淡入 + 预加载）；
  新手路径进入 `.rules-card` 规则总览（7 个板块，规则文字全部集中在此），老手直接进选队；
  **已移除导入存档按钮**（存档导入导出功能整体删除，连同 `useGame` 与 Electron IPC）。
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
  **v2.5.0：季后赛期间 `.rc-mid.po` 显示"季后赛 X分 X板 X助"**、伤病红黄 `.inj-season`/`.inj-out`）。
- **OffseasonView.tsx**：step1 = 休赛期报告 + **选秀面板**（`.draft-panel`、轮到玩家签显示 `.draft-pick-card` 池、
  AI 代选/自动完成/快进到我的签）+ **乐透抽签面板**（`.lottery-panel`，每行 `.lo-owner` 显示"原属 · 现属"）
  + **🔁 休赛期 3 天交易窗口**（`l.offseasonTradeDays > 0` 时显示，可「展开交易面板」内嵌 `TradeView`、
  「结束一天」递减）+ 「进入自由市场」（选秀未完成时禁用）；step2 = 阵容裁人 + FA 7 天市场（报价 ≤3/天、
  `.offer-panel`、结束当天结算）；step3 = 结果报告（`.offseason-report`）+ 双风格重选 + 开始新赛季。
- **TradeView.tsx**：双方工资单/战绩状态条 + **球队三状态徽章**（`.chip.phase-contender/retool/rebuild`）、
  两列球员 + 选秀权筹码（球员行含位置 `.pl-pos` 与 OVR 徽章，右上角**不再显示"双方总估值"**）、
  **锁定按钮**（`.lock-btn`，仅自家球员；锁定行 `.pick-row.locked`）、**实时预检**（点球员即 `evaluateTrade`，
  verdict 自动刷新；「确认交易」只做最终执行）、战力前后对比、`.pick-row` 头像 + 点名字开 `PlayerModal`；
  底部 **🔍 交易搜索器**（v2.3.0）：勾选自有筹码 → `searchTrades` 全联盟扫描 → 结果按
  「✓ 用当前筹码即可成交」/「⚠ 对方还想多要人（需追加筹码）」两组展示（`.search-row`/`.sr-*`，
  行内含对方状态 `.sr-phase`、球员描述带"位置 · OVR · 年龄"），每条可「填入筹码」或「✓ 直接成交」；
  默认每组显示 10 条，可展开全部。**休赛期窗口期（`offseasonWindow`）绕过交易截止日检查。**
- **FreeMarketView.tsx**：赛季中即时签约（点名字看详情、要价、底薪/中产通道提示、剩余空间）+
  **v2.5.0 位置筛选条 `.fa-filter`**（全部/控卫/分卫/小前/大前/中锋，带人数，含副位置可打者）。
- **LeagueView.tsx**：排名（行可点进 `TeamDetail`：队徽/战绩/排名/工资单/战力/风格 + 15 人列表）/
  数据榜（无「效率」；**v2.5.0 顶部「常规赛数据 / 季后赛数据」双 tab**，季后赛表用 `poGp/poStats`，
  表头列名变「季后赛出场」；**v2.6.3 起显示全部上榜球员**——`leaders()` 不再 `slice(0,20)`，
  顶部 `.leaders-count` 标出总人数，`.leaders-scroll`（max-height 74vh）滚动 + 表头吸顶）/
  荣誉殿堂（`AwardsPanel` + 历届冠军 MVP FMVP）。
- **AwardsPanel.tsx**：`AwardCard`（大奖卡，冠军界复用 FMVP）、`AwardsPanel`（4 大奖卡 + All-NBA 3 阵 +
  防守 2 阵 + 新秀 2 阵，均带场均数据与队徽）、`AwardsModal`（`big` 模式 + 可滚动）。
- **PlayerModal.tsx**：头像/基准信息（cm 身高、潜力星、双位置、国籍仅非美国显示、生涯数据）+ 7 维属性 +
  18 项技能 4 组 + 赛季数据（9 格）+ 合同 + 定位（深度/伤病/待分配点数）。
- **BoxScoreModal.tsx**（14 列战报 + **v2.5.0 `<tfoot>` 全队"总计"行 `.box-total-row`**）、
  **PlayerFace.tsx**（572 张头像 glob 合并 png/jpg，无则占位）、
  **TeamLogo.tsx**（`import.meta.glob` 30 SVG）、**format.ts**（`ovrClass/ovrLabel/money/fmt1/perGameLine/perGameOf/perGameLineOf/POS_CN/ATTR_CN/STAT_CN`）、
  **useGame.ts**（**tick 必须从 `prev` 重建**；900ms 防抖自动存档；`migrateSave` 在读档/导入后调用）。

---

## 9. 验证链（每轮必跑，全绿才发版）

1. `tsc -p .\tsconfig.json` → **0 错**
2. esbuild 打包 `selfTest.ts` → `node tools/.selfTest.cjs` → **0 失败**（虚构 + 真实；会打印场均/FG/3P/FT、得分王、奖项、退役/AI 交易、球队三状态分布、乐透、锁定测试、迁移断言）
3. `vite build` → dist 产物正常（JS ~557KB）
4. `electron-builder --win portable` → `release\NBA-Manager-x.y.z.exe`（先杀 NBA*/electron 进程）
5. **CDP 真机冒烟** `tools/ui-smoke.mjs 9333`（步骤：标题屏/背景 → 关公告 → 选队 → 双风格 2+3 卡 →
   模拟到下一场 ×4 推进 → 快进 7 天 → 战报弹窗 + **总计行** → 阵容轮换+气质 →
   **自由市场位置筛选（6 按钮 + 中锋筛选后全部含中锋）** → 交易页：**三状态徽章 / 无"总估值" / 位置列 /
   锁定→解锁 / 搜索器结果含位置+OVR** → 选秀权 6 枚/队 → 新秀榜 80 行 + 体测行 →
   季后赛对位图 7 列 + 逐场弹窗 → **数据榜常规赛/季后赛双表头** + **阵容页 `.rc-mid.po`** →
   快进总决 + 冠军 15 人 + FMVP 卡 + 颁奖弹窗（4 卡/2 防守阵/**新秀两阵 5+5**）→
   **休赛期选秀面板（60 签）+ 乐透 14 行（含"原属·现属"）+ 休赛期交易窗口展开/锁定/结束一天** +
   自动完成 + 进入市场）
6. portable exe 冒烟：`$env:DSH_AUTOQUIT_MS='9000'; Start-Process release\NBA-Manager-x.y.z.exe -Wait`
7. 四路径 `%SystemDrive%` 残留检查（§10.6）
8. `node tools/prune-old-releases.mjs`（**v2.6.4 起只保留最新 1 个版本 exe**，v1.0.0 起按**构建时间**排序）；
   更新 Changelog/使用说明/版本号
9. **GitHub 发布（v1.0.0 起）**：本机 `github.com:443` 被阻断（DNS 返回的 IP 不通；换 IP 可通但改 hosts
   需要管理员权限），所以 `git push` 用不了；而 `api.github.com` 与 `uploads.github.com` 均可用、`gh` 已认证。
   流程（`tools/push-via-api.mjs` 走 Git Data API 等价于一次 push）：
   ```
   git add -A && git commit -m "..."        # 先本地提交
   node tools/push-via-api.mjs --dry        # 看差异：待推提交数 / 需上传 blob 数
   node tools/push-via-api.mjs              # 逐提交上传 blob → 建 tree → 建 commit → 更新 ref
   gh api repos/lxnndd/nba-manager/git/refs -f ref="refs/tags/vX.Y.Z" -f sha=<远端 main sha>
   gh release create vX.Y.Z "release\NBA-Manager-X.Y.Z.exe" --title "..." --notes-file <notes.md>
   ```
   注意：API 生成的 commit sha 可能与本地不同（时间戳规范化），但脚本会校验并报告 ——
   **tree 一致即内容完全一致**；脚本也能处理"远端 sha 不在本地对象库"（按 tree 反查本地提交）。

**版本号修改三处**：`package.json`（**必须用 node `fs.writeFileSync`**，PS 会写 BOM 导致 builder 报错）、
`src/App.tsx`（顶栏 ×2）、`src/ui/ChangelogModal.tsx`（VERSION + ITEMS），另加 `使用说明.txt` 顶部版本段与尾部 exe 名。

---

## 10. 环境与运维经验（踩过的坑）

1. **沙箱（2026-09-19 接管会话实测修订）**：当前会话为 `workspace-write` + 审批 `ask`。
   在该模式下 `tsc` / `esbuild` 打包 / `node tools/.selfTest.cjs` **实测全部正常，无 EPERM、未申请提权**。
   仍未实测的：`vite build` / `electron-builder` / `Electron + CDP ui-smoke`（历史记录称这些会因
   spawn 命名管道受限而 EPERM）。因此：
   - 不要再默认"必须 `danger-full-access`"——先按现状直接跑；
   - 若发版时真的遇到 EPERM，**按当前审批策略（`ask`）对同一条命令提权重试一次**
     （与旧记录"审批已关闭、不要传 `sandbox_permissions`"相反，旧说法已作废）。
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
   **v2.5.0 记录**：真实名单 **206.0 分/队**（FG 47.9%，3P 37.0%，FT 77.8%，篮板 94.7，失误 31.6，
   得分王塔图姆 28.8 / 篮板王 14.0）——引擎数值未动，仅统计口径与休赛期账面处理变化，基线稳。
   **v2.6.1 记录**：真实名单 **206.1 分/队**（FG 47.9%，3P 36.8%，FT 77.9%，得分王塔图姆 29.7）；
   虚构 **203.6 分/队**。本次只改交易估值与选秀生成、未动模拟参数 → 基线维持在 206 附近（±0.1，
   属 AI 交易笔数变化带来的阵容微扰，非引擎参数漂移）。
   **v2.6.2 记录**：真实名单 **206.1 分/队**（FG 47.9%，3P 36.8%，FT 77.9%，得分王塔图姆 29.7）、
   虚构 **203.6 分/队** —— 与 v2.6.1 **逐位相同**。原因：未换位时 `valueOvr(p) ≡ p.ovr`，
   位置无关口径在默认阵容下等价于旧算法；前二溢价只影响交易成交与否，不进入比赛模拟。
10. **位置口径的历史（已按用户最终决定收敛）**：
    - v2.3.0 曾用「身高 + 技能评分」推断位置（修好卡鲁索/杰伦·威廉姆斯，但把格林判成分卫）；
    - **v2.4.0 起按用户要求严格照搬 2K `positions` 数组**，推断/均衡代码全部删除；
      `--audit` 应输出"核对 449 人，不一致 0 人"（唯一例外：`POS_OVERRIDE` 里杰伦·威廉姆斯 = SG/SF）。
    - **教训（v2.5.0）**：用户的"照搬数据"决定会**推翻**上一轮为此写的断言与文档——改决策时必须同步清理
      selfTest 断言、Changelog、使用说明与 §10 经验，否则下一轮会拿旧断言当"回归失败"排查半天。
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
15. **"数据变了"与"规则没生效"要分清（v2.5.0 三条踩坑）**：
    - **个人常规赛出场可以超 82**：赛季中被交易后两队场次相加（实测 83）。断言上限要给容差（88），
      别把它当成"季后赛污染常规赛"的回归（那个 bug 的特征是 92 场）；
    - **`lotteryDraw().order` 是 30 队**（不是 14），`odds` 同长；UI 只渲染 `order.slice(0, 14)`，
      `lotteryIds` 才是乐透区 14 队（且顺序与 `order` 前 14 **不同**，别拿它去索引 odds）；
    - **季后赛出场者未必有常规赛出场**（赛季末签下/边缘人）——这类"看起来矛盾"的断言先查数据口径。
16. **借人轮换要"替补优先"（v2.4.0）**：某位置只剩 1 人时会从相邻位置借人打替补时间；
    若借到的是**对方首发**，那人就会变成 36+12=48 分钟（实测 CLE 的 PG 被 AI 交易成独苗后，
    首发 SG 米切尔兼职场均 43.7 分钟）。`depthList` 现在按"在本位置的深度"降序借人（替补/边缘优先）。
17. **"某功能没生效"先查数组引用与状态归属（v2.5.0）**：
    - 锁定（`l.lockedPids`）是**联赛级**字段：UI 直接 `l.lockedPids = [...]` 后必须 `api.tick()` 触发重渲染；
    - 休赛期交易窗口靠 `l.offseasonTradeDays > 0` 判定，**只有 `beginOffseason` 置 3、`finishOffseason` 置 0**，
      中途没有别的地方改它（`OffseasonView` 的「结束一天」是唯一的 UI 递减入口）。
18. **休赛期账面处理集中在一个函数里（v2.5.0）**：`offSeasonBookkeeping(p)` = 伤病清空 + 合同年 -1，
    在 `beginOffseason` 里对**球队球员与自由球员**各跑一遍。此前这两件事**完全没做**，
    表现就是"上赛季的伤带到下赛季""合同年永远不变"。新增任何"每季一次"的账面字段都往这里加。
19. **偏好/风格类权重只能乘在"可争议的那一段"上（v2.5.1 用户实例）**：
    用户截图指出「萨博尼斯 85/29 岁 单换 莫布利 87/24 岁」被判基本对等——因为 v2.5.0 把
    球队阶段系数乘在**球员整体价值**上（争冠 ×0.75 / 老将 ×1.2），于是"更强 + 更年轻"的
    莫布利被算成 2.5、"更弱 + 更老"的萨博尼斯被算成 2.4。修法：`tradeEff` 拆出
    `now`（当下战力）与 `future`（潜力 − 年龄折损），阶段系数只作用于 `future`。
    **通用教训**：任何"按偏好/风格/阶段加权"的价值模型，先问"这个偏好到底该影响哪一段"，
    整值乘法几乎一定会造出反直觉结论。回归断言用一句可判定的公理表达：
    **更强的同时更年轻的球员，在任何阶段都必须更值钱**。
20. **估值口径必须和决策口径一致（v2.5.1）**：搜索器原先用市场价算"你赚/你亏"，
    但成交判定用折算价 → 会出现"显示你亏 1.3，却提示可以成交"。现在两侧都用同一套
    `phaseValue`（搜索器用**我方**阶段、判定用**对方**阶段），并在理由里同时给出两种数值。
21. **硬门槛与估值系数互补，不能只上一种（v2.6.1 实测）**：用户要求"85 以上是中流砥柱"，
    最初只靠"添头折价"（下半价）实现——实测真实名单 **27 组「85 核心 + 2 添头 换 87+ 核心」仍有
    11 笔成交**，其中就包括用户截图里的骑士莫布利（萨博尼斯 2.0 + 0.54 + 0.38 = 2.92 ≈
    莫布利争冠折算 2.9，差 0.0 → 落在容忍区间内成交）。加上"核心只能用同等/更强的核心换"后归零。
    **通用教训：估值类调整只能改变"划不划算"，改变不了"该不该"。凡是规则性的市场行为
    （非卖品、锁定、名单/薪资限制），必须用独立于估值的硬门槛表达，二者叠加才稳。**
22. **低能力"折价"与高能力"溢价"要成对设计（v2.6.1）**：只压低下限（<75 半价）会让高能力球员
    相对变便宜——同一笔"1 核心 + 添头"反而更容易凑够。必须同时抬高上限（85-89 ×1.2 / ≥90 ×1.4）
    才能把核心与添头真正拉开。另外档位系数是**分段**的，边界会跳档（74→75、79→80 之间），
    这是用户明确指定的口径，不要"顺手"改成平滑插值。
23. **"改 ovr 造 mock"的测试遇到"基准制"口径会集体失真（v2.6.2 实测）**：交易估值改用
    `valueOvr = baseOvr + (calcOvr(skills) − calcOvr(baseSkills))` 后，selfTest 里 8 条档位断言
    全部报同一个数（4.24）——因为 `mk(ovr) = {...me.players[0], ovr}` 只是浅拷贝，带着**原球员的
    baseOvr 与 baseSkills**，`valueOvr` 自然无视被改写的 ovr。修法：mock 必须同时写
    `baseOvr: <目标值>` **且** `baseSkills: {...skills}`（清零继承来的技能增量）。
    同一轮还暴露另一半：`valueOvr` 直接读 `p.skills`，而部分 mock 只有 ovr/salary →
    抛 `Cannot read properties of undefined (reading 'layup')`，所以它对缺 skills 的对象必须回退 `p.ovr`。
    **教训：新口径只要引入新的字段依赖，就要同时检查"部分构造对象"与"mock 伪造字段"两条路径。**
24. **"与位置无关"要用生成期的不变量，而不是事后逆运算（v2.6.2）**：用户要求交易身价与阵容摆位
    脱钩。现成可用的锚点是 `baseOvr/baseSkills`（生成期写入、换位不碰），于是 `valueOvr` 天然恒定；
    若改用"换位后用 baseAttrs 反算回基准位置"，会因换位时 ovr 已按 baseOvr 缩放而**丢掉成长增量**，
    越算越偏。**优先找生命周期里的不变量，而不是事后做逆运算。**
25. **自定义参数的"生效面"要覆盖整条决策链（v2.6.4 用户实测）**：轮换页的"球权权重（0-10）"
    在实现里只乘在**持球人**选择上，而每回合 65% 的出手来自"接球出手"竞争那一段——那段没读
    `usage`。用户按 UI 语义操作（"拉满中锋球权、压低其他位置"），得到的却是"只换了带球人、
    出手数几乎不变"。**教训：玩家可调的参数，必须在它语义覆盖的每一段决策里都出现**；
    只改一段，在玩家眼里就等于"这个功能没生效"。另外注意叠加效应：中锋还有两处天然劣势
    （持球权重 `pow(pas/70,2)`、出手权重 `(0.8+three/180)`），所以参数修好后要跑一次
    "拉满 / 归零"的对照实验确认效果量级（本次 7.6 → 14.4 → 3.3 次出手/场）。
26. **规则说明集中到一处，界面只留功能标签（v2.7.0 用户要求）**：用户要求"去除所有界面带有说明性的
    文字"，规则统一收进主菜单新增的规则页。清理时用的判断标准：**段落式叙述、操作指引、规则解释**
    一律删（如"勾选自己队里 1 名或多名球员…""点击球员即实时预检"）；**数据标签（"工资单""要价"
    "场次"）、状态警报（"名单已满""超税线"）、按钮文字与 `title` 悬停提示**保留——否则界面失去可用性。
    这类改动会跨多个 UI 文件，改完**必须跑 ui-smoke**（它在多处点按钮、读文本、依赖选择器：
    本次把自由市场筛选从 `.fa-filter` 改成 `.head-tools`，冒烟脚本要同步改）。
27. **"铺底背景"要两层元素分工（v2.7.1）**：用户要求游戏内也能看见照片。背景层直接写 `opacity`
    会和交叉淡入抢同一个属性——内联 `opacity`（淡入用）会覆盖 CSS 里的透明度设置。正确做法：
    **外层 wrap 控整体透明度**（`.game-bg-wrap { opacity:.2 }`），**内层两层控交叉淡入**
    （各自 `opacity` 0/1 + transition）。另外固定背景层要 `z-index:0` 并把 `.topbar`/`.main`/
    `.season-banner` 提到 `z-index:1`——否则要么被内容盖住、要么反过来压住点击。
    另有可读性经验：卡片本身是**不透明**的（`var(--panel)`），所以背景只从页面底色透出来，
    透明度 0.2 已足够"看得见照片"且不干扰读数据。
    ⚠️ **轮播 state 绝不能放在 `App` 层（v2.7.1 实测踩坑）**：第一版把 `useBackdropRotation()`
    写在 `App` 里，每 5 秒一次 `setState` 会让**整页重渲染**——数据榜此时有 450 行表格，
    结果 ui-smoke 里"系列比分 / 冠军界面 / 选秀面板 / 进入自由市场"**连续四步超时**
    （页面没崩、也没报错，就是被重渲染拖慢）。把轮播 state 收进 `<GameBackdrop />` 子组件后
    全部恢复。**通用规则：高频定时器 state 必须放在最小的叶子组件里**；看到"多步操作集体超时
    但无 console 错误"，先怀疑有没有全局级的高频重渲染源。
28. **高优先级 `:not()` 选择器会误伤"后来加的兄弟类名"（v1.0.0 实测）**：v1.1 段写过
    `.title-screen > *:not(.title-bg):not(.title-bg-overlay) { position: relative; z-index: 1 }`，
    后来加 `.title-bg-alt` 做交叉淡入——它**不匹配** `.title-bg`，于是被这条特异性更高的规则强制成
    `relative`，淡入层掉进布局流，表现就是"主菜单切图黑一下"（游戏内那套没这写法，所以只坏一半）。
    **教训：给老组件加"同族新类名"时，先 grep 所有 `:not(.老类名)` 这类排除式选择器**；
    另外 `transition: background-image` 是**无效过渡**（浏览器不支持该属性动画），换图只能用 opacity/transform。
29. **版本号回退时，别用版本号排序做清理（v1.0.0 实测）**：`prune-old-releases.mjs` 原按 semver 降序
    保留"最新"，而公测版把 2.7.1 回退成 1.0.0 —— 脚本于是把刚构建出来的 1.0.0 当旧版删了。
    **改为按文件 mtime 排序**（保留"最近构建的"），与"更新就删旧的"这个真实意图一致。
    通用规则：**"新旧"的判据要用生成时间，不要用可能回退的编号。**
30. **本机 DSH 沙箱会挡住 Electron 测试（v1.0.1 实测，重要）**：本会话的沙箱策略是 `workspace-write`
    （记录在 `~/.dsh/storages/session_projcache.json`；**会话首轮即冻结、会话内改不了**），后果是
    **能写工作目录、但写不了 `%APPDATA%` / `%TEMP%`**。这直接毁掉两件日常事：
    - `electron-builder` 报 `EPERM: mkdtemp '%TEMP%\t-XXXXXX'` → 解决：把 `$env:TEMP` / `$env:TMP` 指到项目内目录；
    - Electron 起不来（app 初始化必须写 userData，写不了就在**启动阶段崩溃/黑屏**）→ 解决：
      `Start-Process exe -ArgumentList "--user-data-dir=<项目内目录>"`。
    ⚠️ **千万别把沙箱造成的黑屏误判成"exe 坏了 / 用户电脑有问题"**——本次为此绕了很大一圈，
    实际上交付的 exe 一直是好的（弟弟能正常游玩就是证据）。要根治：让用户把沙箱改成
    `danger-full-access` 并**开新会话**（当前会话内改了不生效）。
31. **单实例锁不能配 `process.exit()`（v1.0.1 踩坑）**：为修"第二个实例会先建出黑窗口再退出"，
    曾在 `requestSingleInstanceLock()` 失败分支写 `app.quit(); process.exit(0);` —— 但在**受限环境里
    锁本来就容易返回 false**，于是表现为"双击毫无反应、连窗口都没有"；**事件日志里没有任何崩溃记录
    （= 进程正常退出）正是判断这条的线索**。正确写法：只 `app.quit()`，另存 `gotLock` 标志，
    在 `app.whenReady()` 里 `if (!gotLock) return;` 挡住建窗。调试可用 `NBA_SKIP_SINGLE_INSTANCE=1` 跳过锁。

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
- **ui-smoke 覆盖**：v2.5.0 已补：战报总计行 / 自由市场位置筛选 / 交易锁定与三状态徽章 / 搜索器位置+OVR /
  数据榜双季切换 / 阵容页季后赛数据 / 乐透"原属·现属" / 休赛期交易窗口（展开+锁定+结束一天）。
  仍未覆盖"玩家签轮到时的 80 池点选"UI（引擎路径已由 selfTest 断言）；
  可按需在 ui-smoke 中构造"玩家持有第 1 签"的场景补测。
- **球队三状态在虚构名单里没有"争冠"队**：虚构球员 OVR 上限低（首发 5 人均值 < 86），
  三状态只会出现"补强/重建"。真实名单正常（实测 争冠 9 / 补强 19 / 重建 2）。如需虚构模式也有争冠队，
  得抬高 `genPlayer` 的 OVR 上限（会动基线，谨慎）。
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
