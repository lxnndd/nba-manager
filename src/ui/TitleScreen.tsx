// 标题屏：新游戏（选队 → 球队风格二选一 → 执教风格三选一）/ 继续 / 导入存档（v1.1：NBA 现场照片背景 20s 轮播）
import { useEffect, useState } from 'react';
import type { GameApi } from './useGame';
import { TEAMS } from '../engine/data';
import { createRealLeague, TEAM_STYLES, COACH_STYLES, applyTeamStyle, applyCoachStyle, type StyleOption } from '../engine/gen';
import { TeamLogo } from './TeamLogo';

// 主菜单背景：Pexels 免费商用 NBA 现场照片（tools/fetch-backdrops.mjs 下载，10 张 1920×1080）
const BACKDROP_FILES = import.meta.glob('../assets/backdrops/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const BACKDROPS = Object.values(BACKDROP_FILES).sort();

export function TitleScreen({ api }: { api: GameApi }) {
  const [stage, setStage] = useState<'menu' | 'pick' | 'style' | 'coach'>('menu');
  const [chosenTeam, setChosenTeam] = useState<number | null>(null);
  const [teamStyle, setTeamStyle] = useState<'youth' | 'star' | null>(null);
  const [busy, setBusy] = useState(false);
  const [armNew, setArmNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    if (BACKDROPS.length < 2) return;
    const t = window.setInterval(() => setBgIdx((i) => (i + 1) % BACKDROPS.length), 20000);
    return () => window.clearInterval(t);
  }, []);

  const fmtTime = api.saveTime
    ? new Date(api.saveTime).toLocaleString('zh-CN', { hour12: false })
    : null;

  // v2.0 选队 → 球队风格二选一 → 执教风格三选一（UI 居中）
  const pickTeam = (teamId: number) => {
    setChosenTeam(teamId);
    setTeamStyle(null);
    setStage('style');
  };

  const pickTeamStyle = (c: StyleOption) => {
    setTeamStyle(c.id as 'youth' | 'star');
    setStage('coach');
  };

  const startNew = (coach: StyleOption) => {
    if (chosenTeam == null) return;
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const l = createRealLeague(seed);
    l.userTeamId = chosenTeam;
    applyTeamStyle(l, teamStyle);
    applyCoachStyle(l, coach.id as 'iron' | 'locker' | 'brand');
    api.startNew(l);
  };

  const doContinue = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await api.continueGame();
    setBusy(false);
    if (!ok) setErr('没有找到可继续的存档');
  };

  const doImport = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await api.importSave();
    setBusy(false);
    if (!ok) setErr('导入失败：文件格式不正确');
  };

  const doNew = () => {
    if (api.hasSave && !armNew) {
      setArmNew(true);
      window.setTimeout(() => setArmNew(false), 2500);
      return;
    }
    setArmNew(false);
    setStage('pick');
  };

  if (stage === 'pick') {
    return (
      <div className="pick-screen">
        <div className="title-bg" style={{ backgroundImage: `url(${BACKDROPS[bgIdx % BACKDROPS.length]})` }} />
        <div className="title-bg-overlay" />
        <div className="pick-head">
          <button className="btn" onClick={() => setStage('menu')}>← 返回</button>
          <div className="pick-title">选择你的球队</div>
        </div>
        <div className="pick-scroll">
          <div className="conf-sec-title east">🏀 东部联盟</div>
          <div className="team-grid">
            {TEAMS.filter((t) => t.conf === 'EAST').map((t, i) => (
              <button className="team-card" key={t.abbr} onClick={() => pickTeam(i)}>
                <TeamLogo abbr={t.abbr} size="md" />
                <span className="tc-abbr">{t.abbr}</span>
                <span className="tc-name">{t.city} {t.name}</span>
                <span className="tc-city">{t.en}</span>
                <span className="tc-conf conf-east">东部</span>
              </button>
            ))}
          </div>
          <div className="conf-sec-title west">🔥 西部联盟</div>
          <div className="team-grid">
            {TEAMS.filter((t) => t.conf === 'WEST').map((t, i) => (
              <button className="team-card" key={t.abbr} onClick={() => pickTeam(15 + i)}>
                <TeamLogo abbr={t.abbr} size="md" />
                <span className="tc-abbr">{t.abbr}</span>
                <span className="tc-name">{t.city} {t.name}</span>
                <span className="tc-city">{t.en}</span>
                <span className="tc-conf conf-west">西部</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'style' || stage === 'coach') {
    const t = chosenTeam != null ? TEAMS[chosenTeam] : null;
    const isStyle = stage === 'style';
    const options = isStyle ? TEAM_STYLES : COACH_STYLES;
    return (
      <div className="pick-screen culture-screen">
        <div className="title-bg" style={{ backgroundImage: `url(${BACKDROPS[bgIdx % BACKDROPS.length]})` }} />
        <div className="title-bg-overlay" />
        <div className="pick-head">
          <button className="btn" onClick={() => setStage(isStyle ? 'pick' : 'style')}>← 返回{isStyle ? '选队' : '球队风格'}</button>
          <div className="pick-title">
            {isStyle ? '选择球队风格' : '选择执教风格'}{t ? `（${t.city} ${t.name}）` : ''}
          </div>
        </div>
        <div className="culture-grid center-col">
          {options.map((c) => (
            <button
              className="culture-card"
              key={c.id}
              onClick={() => (isStyle ? pickTeamStyle(c) : startNew(c))}
            >
              <div className="cc-icon">{c.icon}</div>
              <div className="cc-name">{c.name}</div>
              <div className="cc-desc">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="title-screen">
      <div className="title-bg" style={{ backgroundImage: `url(${BACKDROPS[bgIdx % BACKDROPS.length]})` }} />
      <div className="title-bg-overlay" />
      <div className="title-card">
        <div className="title-logo">🏀</div>
        <h1 className="title-name">NBA 经理</h1>
        <div className="menu-stack">
          {api.hasSave && (
            <button className="menu-btn primary" disabled={busy} onClick={doContinue}>
              ▶ 继续游戏
            </button>
          )}
          <button className="menu-btn" disabled={busy} onClick={doNew}>
            {api.hasSave && armNew ? '再点一次确认新建（会覆盖当前存档）' : '✨ 开始新游戏'}
          </button>
          <button className="menu-btn ghost" disabled={busy} onClick={doImport}>
            📥 导入存档
          </button>
        </div>
        <div className="save-line">
          {fmtTime ? `上次自动保存：${fmtTime}` : '暂无存档'}
        </div>
        {err && <div className="error-line">{err}</div>}
      </div>
    </div>
  );
}
