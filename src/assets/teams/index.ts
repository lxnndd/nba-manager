// v0.3.7 球队 logo：NBA 官方 CDN SVG 离线打包（src/assets/teams/{ABBR}.svg）
// 构建期收集（vite glob）→ { ABBR: url }；未匹配的队（无 logo 文件）返回 undefined
const logos = import.meta.glob('./*.svg', { eager: true, import: 'default' }) as Record<string, string>;

const TEAM_LOGOS: Record<string, string> = {};
for (const [k, v] of Object.entries(logos)) {
  const abbr = /\/([A-Z0-9]{3})\.svg$/.exec(k)?.[1];
  if (abbr) TEAM_LOGOS[abbr] = v;
}

export function teamLogo(abbr: string): string | undefined {
  return TEAM_LOGOS[abbr];
}
