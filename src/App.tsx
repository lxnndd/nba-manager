// NBA 经理 · 主壳：标题屏 / 游戏内导航 / 休赛期衔接
import { useState } from 'react';
import { useGame } from './ui/useGame';
import { TitleScreen } from './ui/TitleScreen';
import { ChangelogModal } from './ui/ChangelogModal';
import { ScheduleView } from './ui/ScheduleView';
import { RosterView } from './ui/RosterView';
import { TradeView } from './ui/TradeView';
import { FreeMarketView } from './ui/FreeMarketView';
import { LeagueView } from './ui/LeagueView';
import { OffseasonView } from './ui/OffseasonView';
import { beginOffseason } from './engine/offseason';

type ViewKey = 'schedule' | 'roster' | 'trade' | 'market' | 'league';

const NAV: { key: ViewKey; label: string }[] = [
  { key: 'schedule', label: '🏀 赛程' },
  { key: 'roster', label: '🧩 阵容' },
  { key: 'trade', label: '🤝 交易' },
  { key: 'market', label: '💼 自由市场' },
  { key: 'league', label: '📊 联盟' },
];

export default function App() {
  const api = useGame();
  const [view, setView] = useState<ViewKey>('schedule');
  // v1.1.1：更新公告每次启动都显示（本地不再记住版本）
  const [showChangelog, setShowChangelog] = useState(true);
  const closeChangelog = () => setShowChangelog(false);

  if (!api.league) {
    return (
      <>
        <TitleScreen api={api} />
        {showChangelog && <ChangelogModal onClose={closeChangelog} />}
      </>
    );
  }

  const l = api.league;
  const me = l.teams[l.userTeamId];
  const seasonOver = l.day >= l.totalDays && (l.playoffRounds.length > 0) && !l.offseason;

  const handleSeasonEnd = () => {
    // 总决结束：颁奖 + 进休赛期（奖项评算幂等；若玩家已先颁奖则跳过）
    beginOffseason(l);
    api.tick();
    setView('schedule');
  };

  const saveClock = api.dirty
    ? '⏳ 保存中…'
    : api.saveTime
      ? `已存档 ${new Date(api.saveTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : '';

  // 休赛期整页接管（导航隐藏，防止赛季中途乱入交易等）
  if (l.offseason) {
    return (
      <div className="shell">
        <header className="topbar">
          <div className="tb-left">
            <span className="logo">🏀 NBA 经理</span>
            <span className="version">v2.2.1</span>
          </div>
          <div className="tb-right">
            <span className="save-state">{saveClock}</span>
            <span className="season-chip">赛季 {l.season} 结束 · 休赛期</span>
            <button className="btn" onClick={() => api.exportSave()} title="把存档导出成文件，发给弟弟就能接着玩">
              📤 导出存档
            </button>
            <button className="btn danger" onClick={() => api.resetToTitle()}>主菜单</button>
          </div>
        </header>
        <main className="main">
          <OffseasonView api={api} onFinished={() => setView('schedule')} />
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="tb-left">
          <span className="logo">🏀 NBA 经理</span>
          <span className="version">v2.2.1</span>
        </div>
        <nav className="tb-nav">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-btn ${view === n.key ? 'on' : ''}`} onClick={() => setView(n.key)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="tb-right">
          <span className="save-state">{saveClock}</span>
          <span className="season-chip">赛季 {l.season} · {l.year}</span>
          <button className="btn" onClick={() => api.exportSave()} title="把存档导出成文件，发给弟弟就能接着玩">
            📤 导出存档
          </button>
          <button className="btn danger" onClick={() => api.resetToTitle()}>主菜单</button>
        </div>
      </header>

      <main className="main">
        {view === 'schedule' && <ScheduleView api={api} onSeasonEnd={handleSeasonEnd} />}
        {view === 'roster' && <RosterView api={api} />}
        {view === 'trade' && <TradeView api={api} />}
        {view === 'market' && <FreeMarketView api={api} />}
        {view === 'league' && <LeagueView api={api} />}
      </main>

      {seasonOver && view !== 'schedule' && (
        <div className="season-banner" onClick={() => setView('schedule')}>
          🏁 本赛季已结束{me.id === l.champion ? '，你们夺冠了！' : ''} · 去「赛程」页颁奖并开启休赛期
        </div>
      )}
    </div>
  );
}
