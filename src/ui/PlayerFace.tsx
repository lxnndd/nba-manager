// v0.3.7/v1.0 球员头像组件：有本地资源用真实大头照（png 官方 260x190 / jpg 2kratings 大图），否则色块占位（队缩写 + 位置）
import type { Player } from '../engine/types';

// 构建期收集打包 src/assets/players/*.{png,jpg}（vite glob；小图自动内联 base64，其余作为独立资产）
const facesPng = import.meta.glob('../assets/players/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const facesJpg = import.meta.glob('../assets/players/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const faces: Record<string, string> = { ...facesJpg, ...facesPng };

export function faceUrl(slug: string): string | undefined {
  return faces[`../assets/players/${slug}.png`] ?? faces[`../assets/players/${slug}.jpg`];
}

export function PlayerFace({ p, size = 'sm', abbr }: { p: Player; size?: 'xs' | 'sm' | 'md' | 'lg'; abbr?: string }) {
  const url = p.face ? faceUrl(p.face) : undefined;
  if (url) {
    return <img className={`player-face ${size}`} src={url} alt={p.name} draggable={false} loading="lazy" />;
  }
  // 无头像占位：缩写 + 位置色
  return (
    <div className={`face-ph ${size}`} title={p.name}>
      <span className="face-ph-main">{abbr ?? p.name.slice(0, 1)}</span>
      <span className="face-ph-sub">{p.pos}</span>
    </div>
  );
}
