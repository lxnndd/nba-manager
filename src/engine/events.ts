// ============ v1.2 球队气质随机事件（每场用户比赛后触发） ============
// v2.0：更衣室不和谐/气氛火热两类事件给处理选项（二选一），由 ScheduleView 渲染按钮，
//       选择后调用 resolveTeamEvent 应用；其余事件仍即时生效。
// v2.3：选项升级为「权衡型」——每个选项都有加成项（不再是"两个选项都在扣数值"），
//       玩家按球队当前短板取舍；同时品牌/商业类事件也加入带选项的版本。
// 独立 rng 流（不扰动比赛主随机序）。
import type { LeagueState, MetaKey, PendingTeamEvent, TeamEventOption } from './types';
import { clamp, mulberry32, randInt } from './rng';

interface EventTemplate {
  key: MetaKey;
  lo: number;
  hi: number;
  text: (v: number) => string;
  // v2.0/v2.3：带选项的事件 → 生成 PendingTeamEvent（效果待玩家选择）；否则即时生效
  options?: (positive: boolean) => TeamEventOption[];
}

const fx = (key: MetaKey, delta: number) => ({ key, delta });

// 更衣室类：正面 = 士气高涨；负面 = 传出不和谐声音。两组选项都"有得有失"。
const CHEM_OPTS = (positive: boolean): TeamEventOption[] => (positive
  ? [
      { label: '🍻 乘胜追击：派对庆祝（化学 +3 · 粉丝 +3万）', effects: [fx('chemistry', 3), fx('fans', 3)] },
      { label: '🧘 保持专注：加练录像（纪律 +3 · 化学 +1）', effects: [fx('discipline', 3), fx('chemistry', 1)] },
    ]
  : [
      { label: '🤝 公开力挺球员：谈心聚餐（化学 +4 · 纪律 -2）', effects: [fx('chemistry', 4), fx('discipline', -2)] },
      { label: '⛓️ 队内罚款整顿（纪律 +4 · 化学 -3）', effects: [fx('discipline', 4), fx('chemistry', -3)] },
    ]);

// 商业/品牌类：正面 = 曝光机会；负面 = 负面新闻。同样权衡型。
const BRAND_OPTS = (positive: boolean): TeamEventOption[] => (positive
  ? [
      { label: '📺 趁热加大宣传投入（商业 +3 · 粉丝 +3万）', effects: [fx('brand', 3), fx('fans', 3)] },
      { label: '🎯 婉拒活动专注备战（纪律 +3 · 化学 +2）', effects: [fx('discipline', 3), fx('chemistry', 2)] },
    ]
  : [
      { label: '📢 公开道歉 + 社区公益（粉丝 +4万 · 商业 -2）', effects: [fx('fans', 4), fx('brand', -2)] },
      { label: '🤐 冷处理不回应（商业 +2 · 粉丝 -2万）', effects: [fx('brand', 2), fx('fans', -2)] },
    ]);

const POSITIVE: EventTemplate[] = [
  { key: 'chemistry', lo: 1, hi: 4, text: (v) => `🤝 更衣室气氛火热，赛后全队加练，化学反应 +${v}`, options: CHEM_OPTS },
  { key: 'chemistry', lo: 2, hi: 5, text: (v) => `🍕 球队聚餐团建，化学反应 +${v}` },
  { key: 'discipline', lo: 1, hi: 3, text: (v) => `📋 教练组重罚训练迟到者，纪律 +${v}` },
  { key: 'discipline', lo: 1, hi: 2, text: (v) => `🧊 坚持录像回放课，纪律 +${v}` },
  { key: 'brand', lo: 1, hi: 4, text: (v) => `📺 登上周五夜赛直播，商业价值 +${v}`, options: BRAND_OPTS },
  { key: 'brand', lo: 1, hi: 3, text: (v) => `🤝 签下本地赞助合约，商业价值 +${v}` },
  { key: 'fans', lo: 2, hi: 6, text: (v) => `🔥 赢球吸引新球迷，粉丝 +${v} 万` },
  { key: 'fans', lo: 1, hi: 4, text: (v) => `📍 城市巡回活动人气爆棚，粉丝 +${v} 万` },
];

const NEGATIVE: EventTemplate[] = [
  { key: 'chemistry', lo: -5, hi: -1, text: (v) => `😤 更衣室传出不和谐声音，化学反应 ${v}`, options: CHEM_OPTS },
  { key: 'discipline', lo: -4, hi: -1, text: (v) => `⏰ 多名球员迟到，球队纪律 ${v}` },
  { key: 'discipline', lo: -3, hi: -1, text: (v) => `📵 球员深夜沉迷游戏被曝光，纪律 ${v}` },
  { key: 'brand', lo: -4, hi: -1, text: (v) => `📉 负面新闻发酵，商业价值 ${v}`, options: BRAND_OPTS },
  { key: 'brand', lo: -3, hi: -1, text: (v) => `😞 门票滞销，商业价值 ${v}` },
  { key: 'fans', lo: -5, hi: -1, text: (v) => `📊 连败让部分球迷流失，粉丝 ${v} 万` },
];

let eventSeq = 1; // 事件 id（内存内，跨休赛期不清零；仅用于键）

// 每场用户比赛后 45% 概率触发一次；赢球偏正面、输球偏负面。
// 返回 null 表示未触发；带选项事件会压入 l.pendingEvents（效果待玩家选择）。
export function rollPostGameEvent(l: LeagueState, won: boolean, day: number, gi: number): void {
  const rng = mulberry32(l.seed * 97 + l.season * 131 + day * 373 + gi * 17);
  if (rng() > 0.45) return; // 每场都触发会很快刷满，保持密度可控
  const team = l.teams[l.userTeamId];
  if (!team) return;
  const positive = rng() < (won ? 0.62 : 0.42);
  const pool = positive ? POSITIVE : NEGATIVE;
  const tpl = pool[Math.floor(rng() * pool.length)];
  const v = randInt(rng, tpl.lo, tpl.hi);
  const text = `📰 ${tpl.text(v)}`;
  if (tpl.options) {
    // 带选项事件：压入待处理队列（效果待选择；news 同步一条标题）
    const ev: PendingTeamEvent = {
      id: eventSeq++,
      title: text,
      options: tpl.options(positive),
    };
    // 只保留最近 5 条待处理事件（防积压）
    l.pendingEvents = [...(l.pendingEvents ?? []), ev].slice(-5);
    l.news.push(text);
    return;
  }
  if (tpl.key === 'fans') team.fans = clamp(team.fans + v, 20, 600);
  else team[tpl.key] = clamp(team[tpl.key] + v, 0, 100);
  l.news.push(text);
}

// 玩家选择事件处理方案 → 应用效果并移除事件
export function resolveTeamEvent(l: LeagueState, eventId: number, option: TeamEventOption): void {
  const team = l.teams[l.userTeamId];
  if (!team) return;
  // v2.3：一个选项可含多项效果；旧存档的单效果格式（key/delta）也兼容
  const effects = option.effects ?? (option.key ? [{ key: option.key, delta: option.delta ?? 0 }] : []);
  for (const e of effects) {
    if (e.key === 'fans') team.fans = clamp(team.fans + e.delta, 20, 600);
    else team[e.key] = clamp(team[e.key] + e.delta, 0, 100);
  }
  const ev = l.pendingEvents.find((e) => e.id === eventId);
  if (ev) {
    l.pendingEvents = l.pendingEvents.filter((e) => e.id !== eventId);
    l.news.push(`✅ 已处理：${option.label}`);
  }
}
