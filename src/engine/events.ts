// ============ v1.2 球队气质随机事件（每场用户比赛后触发） ============
// v2.0：更衣室不和谐/气氛火热两类事件给处理选项（二选一），由 ScheduleView 渲染按钮，
//       选择后调用 resolveTeamEvent 应用；其余事件仍即时生效。
// 独立 rng 流（不扰动比赛主随机序）。
import type { LeagueState, PendingTeamEvent, Team, TeamEventOption } from './types';
import { clamp, mulberry32, randInt } from './rng';

type MetaKey = 'chemistry' | 'discipline' | 'brand' | 'fans';

interface EventTemplate {
  key: MetaKey;
  lo: number;
  hi: number;
  text: (v: number) => string;
  // v2.0：带选项的事件（chemistry 类）→ 生成 PendingTeamEvent；否则即时生效
  choice?: boolean;
}

const POSITIVE: EventTemplate[] = [
  { key: 'chemistry', lo: 1, hi: 4, text: (v) => `🤝 更衣室气氛火热，赛后全队加练，化学反应 +${v}`, choice: true },
  { key: 'chemistry', lo: 2, hi: 5, text: (v) => `🍕 球队聚餐团建，化学反应 +${v}` },
  { key: 'discipline', lo: 1, hi: 3, text: (v) => `📋 教练组重罚训练迟到者，纪律 +${v}` },
  { key: 'discipline', lo: 1, hi: 2, text: (v) => `🧊 坚持录像回放课，纪律 +${v}` },
  { key: 'brand', lo: 1, hi: 4, text: (v) => `📺 登上周五夜赛直播，商业价值 +${v}` },
  { key: 'brand', lo: 1, hi: 3, text: (v) => `🤝 签下本地赞助合约，商业价值 +${v}` },
  { key: 'fans', lo: 2, hi: 6, text: (v) => `🔥 赢球吸引新球迷，粉丝 +${v} 万` },
  { key: 'fans', lo: 1, hi: 4, text: (v) => `📍 城市巡回活动人气爆棚，粉丝 +${v} 万` },
];

const NEGATIVE: EventTemplate[] = [
  { key: 'chemistry', lo: -5, hi: -1, text: (v) => `😤 更衣室传出不和谐声音，化学反应 ${v}`, choice: true },
  { key: 'discipline', lo: -4, hi: -1, text: (v) => `⏰ 多名球员迟到，球队纪律 ${v}` },
  { key: 'discipline', lo: -3, hi: -1, text: (v) => `📵 球员深夜沉迷游戏被曝光，纪律 ${v}` },
  { key: 'brand', lo: -4, hi: -1, text: (v) => `📉 负面新闻发酵，商业价值 ${v}` },
  { key: 'brand', lo: -3, hi: -1, text: (v) => `😞 门票滞销，商业价值 ${v}` },
  { key: 'fans', lo: -5, hi: -1, text: (v) => `📊 连败让部分球迷流失，粉丝 ${v} 万` },
];

let eventSeq = 1; // 事件 id（内存内，跨休赛期不清零；仅用于键）

// 每场用户比赛后 45% 概率触发一次；赢球偏正面、输球偏负面。
// 返回 null 表示未触发；choice 事件会压入 l.pendingEvents（效果待玩家选择）。
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
  if (tpl.choice) {
    // v2.0 带选项事件：压入待处理队列（效果待选择；news 同步一条标题）
    const ev: PendingTeamEvent = {
      id: eventSeq++,
      title: text,
      options: tpl.key === 'chemistry'
        ? positive
          ? [
              { key: 'chemistry', delta: 3, label: '🍻 乘胜追击：派对庆祝（化学 +3）' },
              { key: 'discipline', delta: 3, label: '🧘 保持专注：加练录像（纪律 +3）' },
            ]
          : [
              { key: 'chemistry', delta: -3, label: '🤝 安抚更衣室：谈心聚餐（化学 -3）' },
              { key: 'discipline', delta: -3, label: '⛓️ 整顿纪律：队内罚款（纪律 -3）' },
            ]
        : [],
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
  team[option.key] = clamp(team[option.key] + option.delta, 0, 100);
  const ev = l.pendingEvents.find((e) => e.id === eventId);
  if (ev) {
    l.pendingEvents = l.pendingEvents.filter((e) => e.id !== eventId);
    l.news.push(`✅ 已处理：${option.label}`);
  }
}
