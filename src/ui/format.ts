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

export function fmt1(v: number): string {
  return v.toFixed(1);
}

export function teamNameShort(abbr: string): string {
  return abbr;
}

export const attrKeysOrder = ['three', 'mid', 'inside', 'ath', 'def', 'pas', 'reb'] as const;
