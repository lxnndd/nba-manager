// UI 数值格式化辅助
import type { Player } from '../engine/types';

// OVR 星级配色（2K 风格）：95+ 传奇 / 90-94 超级球星 / 85-89 全明星 / 80-84 首发级 / 70-79 轮换级
export function ovrClass(ovr: number): string {
  if (ovr >= 95) return 'ovr-legend';
  if (ovr >= 90) return 'ovr-superstar';
  if (ovr >= 85) return 'ovr-allstar';
  if (ovr >= 80) return 'ovr-starter';
  if (ovr >= 70) return 'ovr-role';
  return 'ovr-fringe';
}

export function ovrLabel(ovr: number): string {
  if (ovr >= 95) return '传奇';
  if (ovr >= 90) return '超级球星';
  if (ovr >= 85) return '全明星';
  if (ovr >= 80) return '首发级';
  if (ovr >= 70) return '轮换级';
  return '边缘人';
}

// 薪资（万美元）→ 显示文本
export function money(w: number): string {
  if (w >= 10000) return (w / 10000).toFixed(1) + '亿';
  return Math.round(w) + '万';
}

export const POS_CN: Record<string, string> = { PG: '控卫', SG: '分卫', SF: '小前', PF: '大前', C: '中锋' };

export const ATTR_CN: Record<string, string> = {
  three: '三分', mid: '中投', inside: '内线', ath: '运动', def: '防守', pas: '组织', reb: '篮板',
};

export const STAT_CN: Record<string, string> = {
  pts: '得分', reb: '篮板', ast: '助攻', stl: '抢断', blk: '盖帽', tov: '失误', tpm: '三分命中', effic: '效率',
};

// 场均一行
export function perGameLine(p: Player): string {
  const g = Math.max(1, p.gp);
  const s = p.stats;
  return `${(s.pts / g).toFixed(1)}分 ${((s.or + s.dr) / g).toFixed(1)}板 ${(s.ast / g).toFixed(1)}助`;
}

// v2.5.0：按"常规赛 / 季后赛"取场均（季后赛数据独立统计，poGp/poStats）
export interface PerGameView {
  gp: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number;
  fg: number; tp: number; ft: number;
}
export function perGameOf(p: Player, playoff = false): PerGameView {
  const gp = playoff ? (p.poGp ?? 0) : p.gp;
  const s = playoff ? (p.poStats ?? p.stats) : p.stats;
  const g = Math.max(1, gp);
  return {
    gp,
    min: s.min / g,
    pts: s.pts / g,
    reb: (s.or + s.dr) / g,
    ast: s.ast / g,
    stl: s.stl / g,
    blk: s.blk / g,
    tov: s.tov / g,
    fg: (s.fgm / Math.max(1, s.fga)) * 100,
    tp: (s.tpm / Math.max(1, s.tpa)) * 100,
    ft: (s.ftm / Math.max(1, s.fta)) * 100,
  };
}
export function perGameLineOf(p: Player, playoff = false): string {
  const d = perGameOf(p, playoff);
  if (d.gp === 0) return playoff ? '季后赛未出场' : '暂无出场';
  return `${d.pts.toFixed(1)}分 ${d.reb.toFixed(1)}板 ${d.ast.toFixed(1)}助`;
}

export function fmt1(v: number): string {
  return v.toFixed(1);
}

export function teamNameShort(abbr: string): string {
  return abbr;
}

export const attrKeysOrder = ['three', 'mid', 'inside', 'ath', 'def', 'pas', 'reb'] as const;
