// 赛季奖项展示（v0.3 + v0.3.7 卡片化 + v2.0 一防二防/数据/球队图放大；FMVP 移出常规奖）
import type { AwardEntry, LeagueState, Player } from '../engine/types';
import { perGame } from '../engine/league';
import { PlayerFace } from './PlayerFace';
import { TeamLogo } from './TeamLogo';
import { teamLogo } from '../assets/teams/index';

function findEntry(l: LeagueState, e: AwardEntry | null): { p: Player; abbr: string } | null {
  if (!e) return null;
  const t = l.teams[e.teamId];
  if (!t) return null;
  const p = t.players.find((q) => q.id === e.playerId);
  if (!p) return null;
  return { p, abbr: t.abbr };
}

function statLine(p: Player): string {
  const pg = perGame(p);
  return `${pg.pts.toFixed(1)}分 ${pg.reb.toFixed(1)}板 ${pg.ast.toFixed(1)}助`;
}

// 一行摘要（冠军卡用；v2.0 常规奖不含 FMVP）
export function AwardsSummary({ l }: { l: LeagueState }) {
  const a = l.awards;
  if (!a || a.season !== l.season) return null;
  const mvp = findEntry(l, a.mvp);
  const dpoy = findEntry(l, a.dpoy);
  const rookie = findEntry(l, a.rookie);
  const sixth = findEntry(l, a.sixth);
  return (
    <div className="awards-summary">
      <span>🏅 MVP：{mvp ? `${mvp.p.name}（${mvp.abbr}）` : '—'}</span>
      <span>DPOY：{dpoy ? dpoy.p.name : '—'}</span>
      <span>最佳新秀：{rookie ? rookie.p.name : '—'}</span>
      <span>最佳第六人：{sixth ? sixth.p.name : '—'}</span>
    </div>
  );
}

// 一张大奖卡：大头照 + 奖项 + 名字 + 队徽 + 场均（v1.1.1 export 供冠军界面 FMVP 复用）
export function AwardCard({ l, label, entry, sub, empty }: { l: LeagueState; label: string; entry: AwardEntry | null; sub?: string; empty?: string }) {
  const x = findEntry(l, entry);
  const mine = x && entry?.teamId === l.userTeamId;
  const logo = x ? teamLogo(x.abbr) : undefined;
  return (
    <div className={`award-card ${x ? '' : 'empty'} ${mine ? 'mine' : ''}`}>
      <div className="award-ph">
        {x ? <PlayerFace p={x.p} size="lg" abbr={x.abbr} /> : <div className="face-ph lg"><span className="face-ph-main">?</span></div>}
        {logo && <img className="award-logo" src={logo} alt={x!.abbr} draggable={false} />}
      </div>
      <div className="award-label">{label}</div>
      {x ? (
        <>
          <div className="award-winner">{x.p.name}</div>
          <div className="award-team">{x.abbr} · {statLine(x.p)}</div>
        </>
      ) : (
        <div className="award-winner dim">{empty ?? '待定'}</div>
      )}
      {mine && <div className="award-mine-tag">我的球员</div>}
      {sub && <div className="award-sub">{sub}</div>}
    </div>
  );
}

// 最佳阵容一行（v2.0：球员小卡带场均数据 + 队徽放大（仍小于大奖卡））
function TeamRow({ l, label, entries, defense }: { l: LeagueState; label: string; entries: AwardEntry[]; defense?: boolean }) {
  const xs = entries
    .map((e) => findEntry(l, e))
    .filter((x): x is { p: Player; abbr: string } => !!x);
  return (
    <div className={`award-line ${defense ? 'defense' : ''}`}>
      <span className="award-team-name">{label}</span>
      <div className="award-line-players">
        {xs.length ? xs.map((x) => (
          <span className={`award-p ${x.abbr === l.teams[l.userTeamId].abbr ? 'mine' : ''}`} key={x.p.id} title={`${x.abbr} · ${statLine(x.p)}`}>
            <PlayerFace p={x.p} size="sm" />
            <span className="award-p-name">{x.p.name}</span>
            <span className="award-p-abbr">
              <TeamLogo abbr={x.abbr} size="sm" />
              <b>{x.abbr}</b>
            </span>
            <span className="award-p-stats">{statLine(x.p)}</span>
          </span>
        )) : <span className="dim">—</span>}
      </div>
    </div>
  );
}

// 完整颁奖面板（卡片化；v1.3 big 模式：弹窗内大奖卡一字排开占主版面）
export function AwardsPanel({ l, big }: { l: LeagueState; big?: boolean }) {
  const a = l.awards;
  if (!a || a.season !== l.season) {
    return <div className="hint">本赛季奖项尚未颁布。</div>;
  }
  const team = l.teams[l.userTeamId];
  const userWon = [a.mvp, a.dpoy, a.sixth, a.rookie].some((e) => e?.teamId === l.userTeamId);
  return (
    <div className="awards-panel">
      <div className="awards-head">
        🏆 {l.year} 赛季年度奖项
        {userWon && <span className="user-gold">（你的 {team.city} {team.name} 有人获奖！）</span>}
      </div>
      <div className={`award-cards ${big ? 'big' : ''}`}>
        <AwardCard l={l} label="最有价值球员 MVP" entry={a.mvp} />
        <AwardCard l={l} label="最佳防守球员 DPOY" entry={a.dpoy} />
        <AwardCard l={l} label="年度最佳新秀" entry={a.rookie} />
        <AwardCard l={l} label="最佳第六人" entry={a.sixth} />
      </div>
      <div className="sec-title">赛季最佳阵容</div>
      {(['一阵', '二阵', '三阵'] as const).map((label, i) => (
        <TeamRow l={l} label={`NBA ${label}`} entries={a.allNba[i] ?? []} key={label} />
      ))}
      <div className="sec-title">最佳防守阵容</div>
      {(['一阵', '二阵'] as const).map((label, i) => (
        <TeamRow l={l} label={`防守 ${label}`} entries={a.allDefense[i] ?? []} defense key={label} />
      ))}
      <div className="sec-title">最佳新秀阵容</div>
      {(['一阵', '二阵'] as const).map((label, i) => (
        <TeamRow l={l} label={`新秀 ${label}`} entries={a.allRookie[i] ?? []} key={label} />
      ))}
    </div>
  );
}

// v0.3.6：颁奖弹窗（ScheduleView 颁奖按钮/冠军卡触发；复用 AwardsPanel 内容）
export function AwardsModal({ l, onClose }: { l: LeagueState; onClose: () => void }) {
  const a = l.awards;
  const closeOnBg = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="modal-mask" onClick={closeOnBg}>
      <div className="modal awards-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="awards-modal-title">🏆 年度颁奖典礼</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <button className="btn sm" onClick={onClose} style={{ marginBottom: 8 }}>关闭</button>
        {a ? <AwardsPanel l={l} big /> : <div className="hint">本赛季奖项尚未颁布。</div>}
      </div>
    </div>
  );
}
