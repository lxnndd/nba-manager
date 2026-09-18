// ============ 核心类型 ============

export type Pos = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export interface Attrs {
  three: number; // 三分
  mid: number;   // 中投
  inside: number;// 内线终结
  ath: number;   // 运动能力（攻筐/防外线）
  def: number;   // 防守
  pas: number;   // 组织
  reb: number;   // 篮板
}

// v0.3.7：身体/综合素质（与伤病系统挂钩：耐久低 + 大负荷 → 更容易伤停）
export interface BodyAttrs {
  strength: number;   // 力量
  speed: number;      // 速度
  stamina: number;    // 体能
  vertical: number;   // 弹跳
  agility: number;    // 敏捷
  durability: number; // 耐久（抗伤病）
  hustle: number;     // 拼劲
}

export type Injury = { type: string; games: number };

// v1.4：18 项分组属性（4 组，2K 风格展示面板；总评 = 均值 + 长处补偿，见 gen.ts calcOvr）
export interface Skills18 {
  // 得分能力（5）
  layup: number;    // 篮下终结
  post: number;     // 低位进攻
  three: number;    // 三分投射
  mid: number;      // 中距离
  ft: number;       // 罚球
  // 组织能力（3）
  handle: number;   // 控球
  pass: number;     // 传球
  vision: number;   // 球场视野
  // 防守能力（5）
  perimeter: number; // 外线防守
  interior: number;  // 内线防守
  steal: number;     // 抢断
  block: number;     // 封盖
  iq: number;        // 篮球智商
  // 篮板与身体（5）
  or: number;        // 进攻篮板
  dr: number;        // 防守篮板
  speed: number;     // 速度
  strength: number;  // 力量
  vertical: number;  // 弹跳
}

// v2.0：跨季职业生涯累计（在 beginOffseason 结算入账，退役报道展示）
export interface CareerStat {
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
}

export interface Player {
  id: number;
  name: string;
  pos: Pos;
  // v2.0：第二位置（如 小前/大前）。拖拽换位只能在这两个位置间切换主/副。
  secPos: Pos;
  age: number;
  ovr: number;
  attrs: Attrs;
  body: BodyAttrs;   // v0.3.7 身体属性
  height: number; // 英寸（展示层换算 cm）
  // ---- v2.3.0 体测数据（新秀球探报告 / 球员详情展示）----
  weight?: number;   // 体重（磅；展示层换算 kg）
  wingspan?: number; // 臂展（英寸；展示层换算 cm）
  salary: number; // 年薪（万美元）；自由球员=0
  contractYears: number; // 剩余合同年数；0 = 自由球员
  // v2.0：潜力 1-10（星）：决定每个休赛期可分配成长点数（× 成长阶段 × 出场时间系数）
  potential: number;
  exp: number;    // 生涯经验年数（新秀赛季=1）
  starts: number; // 本赛季首发场次（常规赛累计）
  // ---- v0.3.1 轮换/球权自定义 ----
  min: number | null;    // 自定义场均上场分钟（null=自动按轮换档位）
  usage: number | null;  // 自定义球权权重 0-10（null=按组织能力自动；相对值）
  // ---- v0.3.7 伤病 / 大头照 ----
  injury: Injury | null; // 当前伤停（剩余场次；null = 健康）
  face?: string;         // 大头照资源名（slug；无 = 占位色块）
  // ---- v1.1 位置基准：换位能力适配的确定性基准（反复拖动换位数值不再漂移）----
  basePos: Pos;
  baseAttrs: Attrs;
  baseOvr: number;
  // ---- v1.4 技能基准：真实名单总评 = 官方 OVR + 算法增量（加点后不偏离 2K 量级）----
  baseSkills: Skills18;
  // ---- v1.2 成长率：每位球员随机天赋兑现速率（0.6-1.8）----
  // v2.0 起成长改"潜力星数 × 阶段 × 时间系数"点数制，grow 仅作历史兼容字段保留。
  grow: number;
  // ---- v1.3 球员风格标签（羁绊体系）：ovr≥80 取 1 个、≥90 取 2 个（按属性特征判定）----
  tags: string[];
  // ---- v1.4 18 项分组属性（展示 + 总评 = 均值+长处补偿；真实名单 = 2K 官方属性映射）----
  skills: Skills18;
  // ---- v2.0 成长加点：本休赛期待分配点数（结算/加点后清零）----
  points: number;
  // ---- v2.0 跨季生涯累计 ----
  career: CareerStat;
  // ---- v2.0 国籍（选秀新秀分布：美 70% / 中 5% / 其他均分）----
  nation: string;
  // 赛季累计统计（由比赛模拟累加）
  gp: number;
  stats: SeasonStatLine;
  // ---- v2.5.0 季后赛独立统计（常规赛 / 季后赛分开；常规赛结束后阵容页切换显示季后赛数据）----
  poGp: number;
  poStats: SeasonStatLine;
}

// 轮换档位（min=null 时按深度自动）：首发/主要轮换/边缘
export type RotationSlot = 0 | 1 | 2;

export interface SeasonStatLine {
  min: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  tov: number; pf: number; fgm: number; fga: number; tpm: number; tpa: number;
  ftm: number; fta: number; or: number; dr: number;
}

export interface Team {
  id: number;
  name: string;    // 中文名
  city: string;    // 城市
  en: string;      // 英文队名
  abbr: string;    // 三字缩写
  conf: 'EAST' | 'WEST';
  players: Player[];
  win: number;
  loss: number;
  // 赛季节奏因子 90-104（每场进攻回合数）
  pace: number;
  // v0.3.1：战术发起位置（PlayCall：阵地战优先把球交到该位置的球员）
  initiator: Pos;
  // ---- v1.2 球队气质（0-100；fans 单位：万）----
  chemistry: number;  // 化学反应：提升季后赛表现
  discipline: number; // 球队纪律：提升常规赛稳定性（减少爆冷）
  brand: number;      // 商业价值：粉丝量比拼 → 临时提升表现
  fans: number;       // 粉丝量（万）：主场加成 = 30% × 相对粉丝系数
  // ---- v1.3 球队风格（v2.0 拆分：青春风暴/球星成色 二选一；AI 队由引擎每季重随机）----
  style: TeamStyleId | null;
  // ---- v2.0 执教风格（铁血手腕/更衣室气氛/商业价值 三选一）----
  coachStyle: TeamStyleId | null;
}

// 球队风格（v2.0：style 仅 youth/star；iron/locker/brand 归 coachStyle）
export type TeamStyleId = 'youth' | 'star' | 'iron' | 'locker' | 'brand';

// 未来选秀权：o=持有队(owner) f=签的原始归属(from，顺位质量按 from 战绩)
// v2.3：签带年份与轮次——每队每年 1 首轮 + 1 次轮，交易市场开放未来 3 年（滚动窗口）
export type PickRound = 1 | 2;
export interface DraftPick {
  o: number;
  f: number;
  year: number;     // 选秀年份（现实年份，如 2027）
  round: PickRound; // 1 = 首轮，2 = 次轮
}

export interface GameResult {
  day: number;
  awayId: number;
  homeId: number;
  awayScore: number;
  homeScore: number;
  // 战报（仅含当日自己球队比赛时展示）
  awayBox?: BoxLine[];
  homeBox?: BoxLine[];
}

export interface BoxLine {
  pid: number;
  min: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  tov: number; pf: number; fgm: number; fga: number; tpm: number; tpa: number;
  ftm: number; fta: number; or: number; dr: number; pm: number;
}

// 总决赛累计战报行（带球队归属，FMVP 评选依据）
export interface FinalsLine extends BoxLine {
  tid: number;
}

export interface PlayoffRound {
  label: string; // '第一轮' | '半决赛' | '分区决赛' | '总决赛'
  series: { awayId: number; homeId: number; awayWins: number; homeWins: number; games: GameResult[] }[];
}

export interface SeasonRecord {
  season: number;
  championId: number;
  mvpId?: number;
  finalsMvpId?: number;
  year?: number; // 现实年份标签（展示用）
}

// ============ 赛季奖项（v0.3；v2.0 一防二防） ============
export interface AwardEntry {
  playerId: number;
  teamId: number;
}

export interface SeasonAwards {
  season: number;             // 对应赛季号
  mvp: AwardEntry | null;
  dpoy: AwardEntry | null;
  sixth: AwardEntry | null;   // 最佳第六人
  rookie: AwardEntry | null;  // 最佳新秀
  allNba: AwardEntry[][];     // [一阵, 二阵, 三阵]，每阵 5 人（2 后场 + 3 前场）
  allRookie: AwardEntry[][];  // [一阵, 二阵]，每阵 5 人
  allDefense: AwardEntry[][]; // v2.0 [最佳防守一阵, 二阵]，每阵 5 人（2 后场 + 3 前场）
  // v2.0：FMVP 移出常规奖项（只在冠军界面显示）——computeFinalsMVP 独立计算
}

// 自由市场报价（v2.0 7 天窗口制：每日 ≤3 份，次日结算）
export interface FaOffer {
  pid: number;
  years: number;  // 1-4
  salary: number; // 万美元/年
}

// ============ v2.0 球队动态待处理事件（更衣室不和谐/气氛火热 → 处理选项二选一） ============
export type MetaKey = 'chemistry' | 'discipline' | 'brand' | 'fans';

// v2.3：一个选项可以同时改变多项数值（权衡型：有得有失，不再"两个选项都在扣"）
export interface TeamEventEffect {
  key: MetaKey;
  delta: number; // 正负点数（如 +3 / -2；fans 单位为万）
}

export interface TeamEventOption {
  label: string; // 按钮文案（已含效果说明）
  effects: TeamEventEffect[];
  // ---- v2.2 及以前的单效果字段（旧存档迁移时折算为 effects，新档不写） ----
  key?: MetaKey;
  delta?: number;
}

export interface PendingTeamEvent {
  id: number;
  title: string; // 事件标题（news 同步展示）
  options: TeamEventOption[];
}

// ============ v2.4.0 乐透抽签结果（休赛期可视化展示） ============
export interface LotteryResult {
  year: number;      // 选秀年份
  order: number[];   // 30 队按选秀顺位排列（前 14 位为乐透队）
  odds: number[];    // 与 order 一一对应的"状元概率"（乐透队按战绩档位给，非乐透队 0）
  top4: number[];    // 抽中前 4 顺位的球队 id（= order 前 4，便于高亮）
  lotteryIds: number[]; // v2.5.0：乐透区 14 支球队 id（UI 只展示乐透区，季后赛队不参与抽签）
}

// ============ v2.1 选秀大会状态（休赛期手动操作：玩家持有的签可挑选 80 人池） ============
export interface DraftState {
  year: number;        // v2.3：本届选秀年份（现实年份）
  class: Player[];     // 本届 80 人池（id 已分配；选中后从池中移除）
  order: DraftPick[];  // 按签的归属队(from)战绩差排好的签序（o=持有队；v2.3 首轮 30 枚在前、次轮 30 枚在后）
  next: number;        // 下一个待处理签的 order 下标
  picked: number[];    // 已选中球员 id（新秀入队/落选）
}

// ============ v2.3 AI 主动向玩家发出的交易报价（球队动态里接受/拒绝） ============
export interface AiTradeOffer {
  id: number;
  fromTeamId: number;    // 报价的 AI 球队
  givePids: number[];    // 玩家送出（球员 id）
  givePickIdx: number[]; // 玩家送出（draftPool 下标）
  wantPids: number[];    // 玩家得到（球员 id）
  wantPickIdx: number[]; // 玩家得到（draftPool 下标）
  day: number;           // 生成时的比赛日
  year: number;          // 生成时的年份（跨季失效）
  note: string;          // AI 的说明（为什么想要/为什么愿意给）
}

export interface LeagueState {
  version: number;
  seed: number;
  season: number;       // 赛季号（从 1 开始）
  year: number;         // 现实年份标签（展示用）
  day: number;          // 当前已推进到的比赛日（0 = 未开始）
  totalDays: number;
  schedule: GameRef[][]; // schedule[d] = 第 d 天比赛（d: 1..totalDays）
  scheduleIds: number[][];
  teams: Team[];
  playoffRounds: PlayoffRound[];
  champion: number | null;
  results: GameResult[]; // 全部已赛结果（按 day 有序）
  userTeamId: number;
  playerSeq: number;
  history: SeasonRecord[];
  mode: 'real' | 'fictional'; // 名单模式：真实球员（2K27）或虚构
  // ---- v1.2 建队理念：开档三选一（决定起手球队气质）----
  cultureId: string | null;   // 'defense' | 'stars' | 'team' | null(旧档)
  // ---- v0.3 休赛期 / 奖项 ----
  offseason: boolean;     // 是否处于休赛期流程
  offseasonStep: number;  // 0=初始 1=已开启(退役/选秀完成) 2=自由市场进行中 3=已结算待开始新赛季
  midUsed: boolean[];     // 各队是否已用中产特例（每休赛期重置）
  freeAgents: Player[];   // 自由球员池
  awards: SeasonAwards | null; // 本赛季奖项（颁奖后缓存，至新赛季开始前）
  news: string[];         // 休赛期滚动消息（退役/签约/交易）
  finalsAccum: FinalsLine[]; // 总决赛全部场次的累计战报（FMVP 依据）
  // ---- v0.3.1：未来选秀权池（v2.3：每队未来 3 年 × 首轮/次轮 = 180 枚；交易可转移持有者） ----
  draftPool: DraftPick[];
  // ---- v2.0 自由市场 7 天窗口：当前天(1-7) + 玩家待结算报价 ----
  faDay: number;
  faOffers: FaOffer[];
  // ---- v2.0 季后赛淘汰弹窗（每赛季只弹一次）----
  poffExitShown: boolean;
  // ---- v2.0 球队动态待处理事件（需玩家二选一处理）----
  pendingEvents: PendingTeamEvent[];
  // ---- v2.1 休赛期选秀大会（手工操作；正常流程结束后置 null）----
  draft: DraftState | null;
  // ---- v2.3 AI 主动报价（季中/休赛期 AI 会向玩家要人或兜售球员+选秀权；玩家接受或拒绝）----
  tradeOffers: AiTradeOffer[];
  // ---- v2.3.0 下一届选秀预测名单（80 人）：开档即生成，常规赛/休赛期随时可查看，
  //      休赛期选秀时直接作为本届新秀池消耗，然后重新生成下一届 ----
  nextDraftClass: Player[];
  // ---- v2.4.0 乐透抽签结果（休赛期第一步展示：概率 + 顺位 + 前 4 高亮）----
  lottery: LotteryResult | null;
  // ---- v2.5.0 锁定球员（交易市场：被锁定的自有球员不会被 AI 报价 / 不会被搜索器算作筹码）----
  lockedPids: number[];
  // ---- v2.5.0 休赛期交易窗口（乐透抽签后 3 天；offseasonStep=1 期间可用）----
  offseasonTradeDays: number;
}

export interface GameRef {
  awayId: number;
  homeId: number;
}

// ============ 存档 ============
// v11：选秀权带年份/轮次（首轮+次轮，未来 3 年滚动）+ AI 主动报价 + 事件选项多效果
export const SAVE_VERSION = 11;
export interface SaveFile {
  kind: 'nba-manager-save';
  saveVersion: number;
  league: LeagueState;
  updatedAt: number;
}
