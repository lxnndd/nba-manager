// v0.3.7 球队 logo 组件（NBA 官方 CDN SVG 离线打包；无资源时首字母占位）
import { teamLogo } from '../assets/teams/index';

export function TeamLogo({ abbr, size = 'sm' }: { abbr: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const url = teamLogo(abbr);
  if (!url) return <span className={`team-logo ph ${size}`}>{abbr.slice(0, 1)}</span>;
  return <img className={`team-logo ${size}`} src={url} alt={abbr} draggable={false} loading="lazy" />;
}
