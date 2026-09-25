// 真实 NBA 官方比赛照片背景（tools/fetch-nba-photos.ps1 抓取并压缩为 1920×1080 × 50 张）
// v2.7.1：标题屏与**游戏内**共用同一套背景（用户要求"玩游戏的时候也能看见"），5 秒轮换。
import { useEffect, useState } from 'react';

const FILES = import.meta.glob('../assets/backdrops/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
export const BACKDROPS: string[] = Object.values(FILES).sort();
const BG_MS = 5000; // 5 秒轮换一次

/**
 * 双层交叉淡入的轮换状态：返回两层当前该显示的图片与哪一层在最上面。
 * 用法：<div className="title-bg" style={{backgroundImage:url(srcs[0]), opacity: active===0?1:0}} />
 *       <div className="title-bg-alt" style={{backgroundImage:url(srcs[1]), opacity: active===1?1:0}} />
 */
export function useBackdropRotation(): { srcs: string[]; active: number } {
  const [srcs, setSrcs] = useState<string[]>(() => [BACKDROPS[0] ?? '', BACKDROPS[0] ?? '']);
  const [active, setActive] = useState(0);

  useEffect(() => {
    // 预加载全部照片，避免切换时出现空白
    for (const s of BACKDROPS) { const im = new Image(); im.src = s; }
  }, []);

  useEffect(() => {
    if (BACKDROPS.length < 2) return;
    let n = 0;
    const t = window.setInterval(() => {
      n = (n + 1) % BACKDROPS.length;
      const layer = n % 2; // 交替写入另一层再切过去 → CSS 过渡出交叉淡入
      setSrcs((prev) => {
        const next = [...prev];
        next[layer] = BACKDROPS[n];
        return next;
      });
      setActive(layer);
    }, BG_MS);
    return () => window.clearInterval(t);
  }, []);

  return { srcs, active };
}
