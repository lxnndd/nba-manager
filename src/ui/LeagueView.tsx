// 联盟视图：排名（可点进球队详情）+ 数据榜（无效率）+ 荣誉殿堂
import { useState } from 'react';
import type { LeagueState, Player, SeasonRecord, Team } from '../engine/types';
import { standings, leaders, payrollOf, teamStrength } from '../engine/league';
import { POS_CN, STAT_CN, ovrClass, money, perGameLine } from './format';
import { AwardsPanel } from './AwardsPanel';
import { PlayerFace } from './PlayerFace';
import { PlayerModal } from './PlayerModal';
import { TeamLogo } from './TeamLogo';
import { TEAM_STYLES, COACH_STYLES } from '../engine/gen';
import type { GameApi } from './useGame';

type LeaderStat = 'pts' | 'reb' | 'ast' | 'stl' | 'blk';

const LEADER_TABS: { key: LeaderStat; label: string }[] = [
  { key: 'pts', label: '得分' },
  { key: 'reb', label: '篮板' },
  { key: 'ast', label: '助攻' },
  { key: 'stl', label: '抢断' },
  { key: 'blk', label: '盖帽' },
];

export function LeagueView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [tab, setTab] = useState<'standings' | 'leaders' | 'trophy'>('standings');
  const [stat, setStat] = useState<LeaderStat>('pts');
  // v2.5.0：数据榜的"常规赛 / 季后赛"切换
  const [statSeason, setStatSeason] = useState<'reg' | 'po'>('reg');
  const [detailTeam, setDetailTeam] = useState<number | null>(null);
  const [view, setView] = useState<{ p: Player; t: Team } | null>(null);

  const s = standings(l);

  const renderConf = (rows: ReturnType<typeof standings>['east'], conf: string) => (
    <div className="conf-col">
      <div className="conf-head">{conf === 'east' ? '东部联盟' : '西部联盟'}</div>
      <table className="tbl">
        <thead>
          <tr>
            <th className="rank">#</th><th>球队</th>
            <th className="num">胜</th><th className="num">负</th><th className="num">胜率</th><th className="num">场差</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const inPlayoff = r.rank <= 8;
            const isMe = r.team.id === me.id;
            const gb = Number.isInteger(r.gamesBehind) ? String(r.gamesBehind) : r.gamesBehind.toFixed(1);
            return (
              <tr key={r.team.id} className={`${isMe ? 'row-me' : ''} ${inPlayoff ? 'row-playoff' : ''} clickable`}
                onClick={() => setDetailTeam(r.team.id)}>
                <td className="rank">{r.rank}</td>
                <td className="team-cell">
                  <TeamLogo abbr={r.team.abbr} size="xs" />
                  <span className="abbr">{r.team.abbr}</span>
                  <span className="city">{r.team.city}</span>
                  {isMe && <span className="you-tag">你</span>}
                </td>
                <td className="num">{r.team.win}</td>
                <td className="num">{r.team.loss}</td>
                <td className="num">{((r.team.win / Math.max(1, r.team.win + r.team.loss)) * 100).toFixed(1)}%</td>
                <td className="num">{gb}</td>
                <td className="status-cell">{inPlayoff ? (r.rank <= 4 ? '🏠 首轮主场' : '季后赛') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // v2.5.0：数据榜分"常规赛 / 季后赛"，季后赛榜用独立统计（poGp/poStats）
  const poMode = statSeason === 'po';
  const ls = leaders(l, stat, poMode ? 1 : 8, poMode);
  const leadersTable = (title: string) => (
    <table className="tbl leaders-tbl">
      <thead>
        <tr>
          <th className="rank">#</th><th>球员</th><th>球队</th><th>位置</th>
          <th className="num">{poMode ? '季后赛出场' : '场次'}</th><th className="num">{title}</th>
        </tr>
      </thead>
      <tbody>
        {ls.map((r, i) => (
          <tr key={r.player.id} className={r.player.id ? (findTeam(l, r.player) === me.id ? 'row-me' : '') : ''}>
            <td className="rank">{i + 1}</td>
            <td className="pl">
              <span className="pl-inner">
                <PlayerFace p={r.player} size="xs" abbr={findAbbr(l, r.player)} />
                <span>{r.player.name}</span>
              </span>
            </td>
            <td><span className="team-cell"><TeamLogo abbr={findAbbr(l, r.player)} size="xs" />{findAbbr(l, r.player)}</span></td>
            <td>{POS_CN[r.player.pos]}</td>
            <td className="num">{poMode ? (r.player.poGp ?? 0) : r.player.gp}</td>
            <td className="num hot">{r.value.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="view">
      <div className="tabs">
        <button className={`tab ${tab === 'standings' ? 'on' : ''}`} onClick={() => setTab('standings')}>球队排名</button>
        <button className={`tab ${tab === 'leaders' ? 'on' : ''}`} onClick={() => setTab('leaders')}>球员数据榜</button>
        <button className={`tab ${tab === 'trophy' ? 'on' : ''}`} onClick={() => setTab('trophy')}>🏆 荣誉殿堂</button>
      </div>

      {tab === 'standings' && (detailTeam == null ? (
        <div className="conf-grid">
          {renderConf(s.east, 'east')}
          {renderConf(s.west, 'west')}
        </div>
      ) : (
        <TeamDetail l={l} teamId={detailTeam} onBack={() => setDetailTeam(null)} onView={(p, t) => setView({ p, t })} />
      ))}

      {tab === 'leaders' && (
        <div className="leaders-wrap">
          {/* v2.5.0：常规赛 / 季后赛数据分开（季后赛为独立统计） */}
          <div className="tabs small">
            <button className={`tab ${statSeason === 'reg' ? 'on' : ''}`} onClick={() => setStatSeason('reg')}>
              常规赛数据
            </button>
            <button className={`tab ${statSeason === 'po' ? 'on' : ''}`} onClick={() => setStatSeason('po')}>
              季后赛数据
            </button>
            <span className="dim" style={{ marginLeft: 8, fontSize: 11.5 }}>
              {poMode ? '（季后赛独立统计，与常规赛数据分开）' : '（数据实时更新）'}
            </span>
          </div>
          <div className="tabs small">
            {LEADER_TABS.map((t) => (
              <button key={t.key} className={`tab ${stat === t.key ? 'on' : ''}`} onClick={() => setStat(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          {leadersTable(STAT_CN[stat])}
        </div>
      )}

      {tab === 'trophy' && (
        <div className="trophy-wrap">
          <div className="sec-title">本赛季奖项</div>
          <AwardsPanel l={l} />
          <div className="sec-title">历届总冠军与 MVP（最新在前）</div>
          <table className="tbl trophy-tbl">
            <thead>
              <tr><th className="num">赛季</th><th className="num">年份</th><th>总冠军</th><th>MVP</th><th>FMVP</th></tr>
            </thead>
            <tbody>
              {[...l.history].reverse().map((h: SeasonRecord) => {
                const champion = h.championId >= 0 ? l.teams[h.championId] : null;
                const isMe = h.championId === me.id;
                return (
                  <tr key={h.season} className={isMe ? 'row-me' : ''}>
                    <td className="num">第 {h.season} 季</td>
                    <td className="num">{h.year ?? 2025 + h.season}</td>
                    <td>{champion ? <span className="team-cell"><TeamLogo abbr={champion.abbr} size="xs" />{champion.abbr} {champion.name}</span> : '—'}{isMe ? ' 🏆(你)' : ''}</td>
                    <td>{nameOfId(l, h.mvpId)}</td>
                    <td>{nameOfId(l, h.finalsMvpId)}</td>
                  </tr>
                );
              })}
              {l.history.length === 0 && (
                <tr><td colSpan={5} className="hint">还未打完一个赛季。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view && <PlayerModal player={view.p} team={view.t} onClose={() => setView(null)} />}
    </div>
  );
}

// v2.0 球队详情：队徽 / 战绩 / 排名 / 薪资 / 风格 / 球员列表（含总评与场均，可点球员）
function TeamDetail({ l, teamId, onBack, onView }: {
  l: LeagueState; teamId: number; onBack: () => void; onView: (p: Player, t: Team) => void;
}) {
  const t = l.teams[teamId];
  if (!t) return null;
  const s = standings(l);
  const all = [...s.east, ...s.west];
  const row = all.find((r) => r.team.id === teamId);
  const style = TEAM_STYLES.find((x) => x.id === t.style);
  const coach = COACH_STYLES.find((x) => x.id === t.coachStyle);
  const pay = payrollOf(t.players);
  const strength = teamStrength(t.players);
  return (
    <div className="team-detail">
      <div className="detail-head">
        <button className="btn" onClick={onBack}>← 返回排名</button>
        <TeamLogo abbr={t.abbr} size="lg" />
        <div className="detail-title">
          <div className="detail-name">{t.city} {t.name}（{t.en}）</div>
          <div className="detail-meta">
            排名 第{row?.rank} 名 · 战绩 {t.win}-{t.loss}（{((t.win / Math.max(1, t.win + t.loss)) * 100).toFixed(1)}%） · 战力 {strength}
          </div>
          <div className="detail-meta">
            工资单 {money(pay)} · 剩余空间 {money(Math.max(0, 15400 - pay))}
            {style && <span className="meta-chip">{style.icon} {style.name}</span>}
            {coach && <span className="meta-chip">{coach.icon} 执教：{coach.name}</span>}
          </div>
        </div>
      </div>
      <div className="roster-cols detail-roster">
        {(['PG', 'SG', 'SF', 'PF', 'C'] as const).map((pos) => {
          const list = t.players.filter((p) => p.pos === pos);
          return (
            <div className="pos-col" key={pos}>
              <div className="pos-head">{POS_CN[pos]} <span className="dim">({pos} ×{list.length})</span></div>
              {list.map((p, i) => (
                <div className={`roster-card ${i === 0 ? 'starter' : ''}`} key={p.id} onClick={() => onView(p, t)} title="点击查看球员信息">
                  <div className="rc-left">
                    <PlayerFace p={p} size="xs" abbr={t.abbr} />
                    <span className={`rc-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                    <div className="rc-info">
                      <div className="rc-name">{p.name}{i === 0 && <span className="tag-starter">首发</span>}</div>
                      <div className="rc-sub">{p.age}岁 · 潜{p.potential}星 · {POS_CN[p.pos]}/{POS_CN[p.secPos]}</div>
                    </div>
                  </div>
                  <div className="rc-mid">{perGameLine(p)}</div>
                  <div className="rc-right"><span className="rc-salary">{money(p.salary)}</span></div>
                </div>
              ))}
              {list.length === 0 && <div className="pos-empty">空缺</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 全联盟 + 自由市场找球员名
function nameOfId(l: LeagueState, pid?: number): string {
  if (pid == null) return '—';
  for (const t of l.teams) {
    const p = t.players.find((x) => x.id === pid);
    if (p) return `${p.name}（${t.abbr}）`;
  }
  for (const p of l.freeAgents) {
    if (p.id === pid) return `${p.name}（已离队）`;
  }
  return '（已退役）';
}

function findTeam(l: LeagueState, p: Player): number {
  for (const t of l.teams) if (t.players.some((x) => x.id === p.id)) return t.id;
  return -1;
}
function findAbbr(l: LeagueState, p: Player): string {
  for (const t of l.teams) if (t.players.some((x) => x.id === p.id)) return t.abbr;
  return '-';
}

export type { LeaderStat };
