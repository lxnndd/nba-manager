// 赛程视图：模拟比赛 / 日历式查看 / 季后赛推进 / 赛季颁奖 / 球队动态事件处理
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameResult, LeagueState, Team } from '../engine/types';
import { simDay, simPlayoffGame, nextGameOf, playedCount, runPlayoffRound, playoffDone, playoffChampion, standings, perGame, refreshPlayoffPlaceholders } from '../engine/league';
import { computeSeasonAwards, computeFinalsMVP } from '../engine/awards';
import { resolveTeamEvent } from '../engine/events';
import { AwardsPanel, AwardsSummary, AwardsModal, AwardCard } from './AwardsPanel';
import { BoxScoreModal } from './BoxScoreModal';
import { TeamLogo } from './TeamLogo';
import { PlayerFace } from './PlayerFace';
import { TradeOffersPanel } from './TradeOffersPanel';
import { fmt1 } from './format';
import type { GameApi } from './useGame';

type Mode = 'regular' | 'poff';

// 一个季后赛系列（对位图元素类型）
type PlayoffSeries = { awayId: number; homeId: number; awayWins: number; homeWins: number; games: GameResult[] };

export function ScheduleView({ api, onSeasonEnd }: { api: GameApi; onSeasonEnd: () => void }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [report, setReport] = useState<{ userGame?: GameResult; day: number; simmed: number; label: string } | null>(null);
  const [showAwards, setShowAwards] = useState(false);
  const [seriesView, setSeriesView] = useState<PlayoffSeries | null>(null);
  const [showEliminated, setShowEliminated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const poffStarted = l.playoffRounds.length > 0;
  const regularDone = l.day >= l.totalDays;
  const champion = playoffChampion(l);
  const phase: Mode = regularDone && poffStarted ? 'poff' : 'regular';

  const myNext = useMemo(() => nextGameOf(l, me.id), [l, me]);
  const played = playedCount(l, me.id);
  const wins = me.win, losses = me.loss;

  // v2.0 颁奖时机：常规赛结束（季后赛开始前）立即自动颁奖并弹窗一次。
  // 常规赛奖项不含 FMVP（FMVP 在冠军界面独立展示）。
  const autoAwards = useRef(false);
  useEffect(() => {
    const l2 = api.league;
    if (!l2 || l2.day < l2.totalDays) return;
    if (l2.playoffRounds.length > 0 && champion == null) return; // 季后赛进行中不重复弹
    if (l2.awards && l2.awards.season === l2.season) return;
    try {
      computeSeasonAwards(l2); // 幂等
    } catch { /* 兜底不阻断游玩 */ }
    api.tick();
    if (!autoAwards.current) {
      autoAwards.current = true;
      setShowAwards(true); // 自动弹出颁奖典礼弹窗
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, regularDone, champion, l.awards?.season, l.playoffRounds.length]);

  const guard = (fn: () => void) => {
    try { fn(); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const doSim = (days: number) => {
    if (busy) return;
    setBusy(true);
    // 让 UI 能感知状态更新：分批推进
    setTimeout(() => {
      let simmed = 0;
      let lastUser: GameResult | undefined;
      let lastDay = 0;
      try {
        for (let k = 0; k < days; k++) {
          const rep = simDay(l);
          if (!rep) break;
          simmed++;
          lastDay = rep.day;
          if (rep.userGame) lastUser = rep.userGame;
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        api.tick();
        setBusy(false);
        setManualDay(null);
        if (lastUser) {
          setReport({ userGame: lastUser, day: lastDay, simmed, label: `第 ${lastDay} 比赛日 · 你的球队` });
        } else {
          setReport(null);
        }
      }
    }, 10);
  };

  const finishRegular = () => doSim(l.totalDays - l.day);

  // 引擎步进：找到未完成的那一轮（已建但仍有系列没打满 4 胜）→ 每个未结束系列各模拟一场
  // v2.1 提前晋级：本轮只要有系列完成，就立即建立下一轮（"已晋级 vs 待定"先行显示），
  // 不等待整轮所有人晋级；占位槽位在后续模拟后自动填充。
  const poffStepOnce = (target: LeagueState): { label: string; lastUser?: GameResult; ended: boolean } => {
    refreshPlayoffPlaceholders(target);
    let rIdx = -1;
    for (let r = 0; r < target.playoffRounds.length; r++) {
      const rd = target.playoffRounds[r];
      const unfinished = rd.series.some(
        (s) => s.awayId >= 0 && s.homeId >= 0 && s.awayWins < 4 && s.homeWins < 4,
      );
      if (unfinished) { rIdx = r; break; }
    }
    if (rIdx === -1) {
      if (target.playoffRounds.length < 4) {
        // 所有已建轮都无未完成系列 → 若上一轮已有晋级者则继续建下一轮（占位允许）
        const prev = target.playoffRounds[target.playoffRounds.length - 1];
        const anyDone = prev?.series.some((s) => s.awayWins >= 4 || s.homeWins >= 4) ?? false;
        if (!anyDone) return { label: '🏆 季后赛即将开始', ended: false };
        rIdx = target.playoffRounds.length;
        while (target.playoffRounds.length <= rIdx) runPlayoffRound(target, target.playoffRounds.length);
        refreshPlayoffPlaceholders(target);
      } else return { label: '🏆 季后赛已全部结束', ended: true };
    }
    const rd = target.playoffRounds[rIdx];
    let lastUser: GameResult | undefined;
    for (let si = 0; si < rd.series.length; si++) {
      const s = rd.series[si];
      if (s.awayId < 0 || s.homeId < 0) continue; // 占位槽（对手未定）不可模拟
      if (s.awayWins < 4 && s.homeWins < 4) {
        const g = simPlayoffGame(target, rIdx, si);
        if (g && (s.awayId === target.userTeamId || s.homeId === target.userTeamId)) lastUser = g;
      }
    }
    // v2.1 提前晋级：仅当"刚模拟的轮就是最后一轮"且出现 4 胜时才建立下一轮（严禁提前把下下轮也建出来）；
    // 占位填充始终执行（否则最后一个晋级者不会在再点模拟前进入下一轮）
    if (rIdx === target.playoffRounds.length - 1 && target.playoffRounds.length < 4) {
      const anyDone = rd.series.some((s) => s.awayWins >= 4 || s.homeWins >= 4);
      if (anyDone) runPlayoffRound(target, target.playoffRounds.length);
    }
    refreshPlayoffPlaceholders(target);
    return { label: rd.label, lastUser, ended: playoffDone(target) };
  };

  const checkEliminated = () => {
    if (l.poffExitShown) return;
    const ch = playoffChampion(l);
    const eliminated = ch != null
      ? ch !== l.userTeamId
      : (() => {
          for (const rd of l.playoffRounds) {
            for (const s of rd.series) {
              if (s.awayId === l.userTeamId || s.homeId === l.userTeamId) {
                const done = s.awayWins >= 4 || s.homeWins >= 4;
                if (done) {
                  const winner = s.awayWins >= 4 ? s.awayId : s.homeId;
                  if (winner !== l.userTeamId) return true;
                }
              }
            }
          }
          return false;
        })();
    if (eliminated) {
      l.poffExitShown = true;
      setShowEliminated(true);
    }
  };

  const simOneRound = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const st = poffStepOnce(l);
        api.tick();
        checkEliminated();
        if (st.ended) {
          setReport({ userGame: st.lastUser, day: 0, simmed: 0, label: '🏆 季后赛结束' });
        } else if (st.lastUser) {
          setReport({ userGame: st.lastUser, day: 0, simmed: 0, label: `${st.label} · 你的球队` });
        } else {
          setReport(null);
        }
      } finally {
        setBusy(false);
        setManualDay(null);
      }
    }, 10);
  };

  // v1.2 一键快进：模拟剩余季后赛直到冠军产生（你的球队出局后快速看结局）
  const fastToFinals = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        let lastUser: GameResult | undefined;
        let label = '🏆 季后赛结束';
        let guard = 0;
        while (!playoffDone(l) && guard++ < 600) {
          const st = poffStepOnce(l);
          if (st.lastUser) lastUser = st.lastUser;
          if (st.ended) { label = '🏆 季后赛结束'; break; }
          label = `⏩ ${st.label} · 你的球队`;
        }
        api.tick();
        checkEliminated();
        setReport(lastUser ? { userGame: lastUser, day: 0, simmed: 0, label } : null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setManualDay(null);
      }
    }, 10);
  };

  const startPlayoffs = () => guard(() => {
    if (l.playoffRounds.length === 0) runPlayoffRound(l, 0);
    api.tick();
    setReport(null);
  });

  const giveAwards = () => guard(() => {
    computeSeasonAwards(l); // 幂等；常规赛奖项（不含 FMVP）
    api.tick();
  });

  const goOffseason = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        onSeasonEnd();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 10);
  };

  // v2.0 FMVP：冠军产生后由总决赛累计战报独立计算（冠军卡展示）
  const fmvp = champion != null ? computeFinalsMVP(l) : null;

  // ---- 日历式查看（v0.3.1）：默认跟随最新比赛日，也可手动翻页回溯 ----
  const [manualDay, setManualDay] = useState<number | null>(null);
  const calDay = Math.max(1, Math.min(l.totalDays, manualDay ?? Math.min(l.day, l.totalDays)));
  const dayGames = useMemo(() => {
    const map = new Map<number, GameResult[]>();
    for (const g of l.results) {
      const arr = map.get(g.day) ?? [];
      arr.push(g);
      map.set(g.day, arr);
    }
    return map;
  }, [l.results, l.results.length, l.day]);
  const gotoDay = (d: number) => setManualDay(Math.max(1, Math.min(l.totalDays, d)));
  const gotoMine = () => {
    if (myNext) { setManualDay(null); doSim(myNext.day - l.day); }
  };

  return (
    <div className="view">
      <div className="status-strip">
        <div className="chip">赛季 {l.season} · {l.year}</div>
        <div className="chip">比赛日 {Math.min(l.day, l.totalDays)} / {l.totalDays}</div>
        <div className="chip strong">你的球队：{me.city} {me.name}</div>
        <div className="chip">战绩 {wins} - {losses} · 已赛 {played}/82</div>
      </div>

      {err && <div className="err-banner" onClick={() => setErr(null)}>⚠️ 操作出错了：{err}（点击关闭）</div>}

      {phase === 'regular' && !regularDone && (
        <div className="action-card">
          <div className="action-title">
            {myNext
              ? <>下一场：<b>{l.teams[myNext.awayId].abbr}</b> @ <b>{l.teams[myNext.homeId].abbr}</b>（第 {myNext.day} 比赛日）</>
              : '常规赛已全部打完'}
          </div>
          <div className="btn-row">
            <button className="btn primary" disabled={busy || !myNext} onClick={() => doSim(myNext ? myNext.day - l.day : 1)}>
              ▶ 模拟到你的下一场
            </button>
            <button className="btn" disabled={busy} onClick={() => doSim(7)}>快进 7 天</button>
            <button className="btn" disabled={busy} onClick={finishRegular}>快进完常规赛</button>
          </div>
        </div>
      )}

      {regularDone && !poffStarted && (
        <div className="action-card">
          <div className="action-title">常规赛结束！最终排名见「联盟」页 · 年度奖项已自动颁发</div>
          <div className="btn-row">
            <button className="btn" onClick={() => { giveAwards(); setShowAwards(true); }}>🏅 查看赛季奖项</button>
            <button className="btn primary" onClick={startPlayoffs}>🏆 开始季后赛</button>
          </div>
        </div>
      )}

      {poffStarted && !champion && (
        <div className="action-card">
          <PlayoffBracket l={l} onSeries={setSeriesView} />
          <div className="btn-row">
            <button className="btn primary" disabled={busy} onClick={simOneRound}>▶ 模拟本轮季后赛（各系列一场）</button>
            <button className="btn" disabled={busy} onClick={fastToFinals} title="你的球队出局后，一键模拟剩余季后赛直到冠军产生">⏩ 快进到总决赛</button>
            <button className="btn" onClick={() => { giveAwards(); setShowAwards(true); }} title="常规赛奖项（MVP/DPOY等）常规赛结束已评出，可随时打开弹窗查看">🏅 赛季奖项</button>
          </div>
        </div>
      )}

      {champion !== null && (
        <div className="action-card champ-card">
          <div className="champ-hero">
            <TeamLogo abbr={l.teams[champion].abbr} size="lg" />
            <div className="champ-hero-info">
              <div className="champ-hero-cap">🏆 {l.year} 赛季 NBA 总冠军</div>
              <div className="champ-hero-name">{l.teams[champion].city} {l.teams[champion].name}</div>
              <div className="champ-hero-sub">
                {champion === me.id ? '恭喜！你的球队登顶联盟！' : '夺冠之路充满汗水与荣耀，下赛季再战！'}
              </div>
            </div>
            <div className="champ-hero-cup">🏆</div>
          </div>
          {/* v2.0 FMVP 卡：夹在总冠军横幅与冠军阵容之间（总决赛战报独立评选） */}
          <div className="champ-fmvp">
            <AwardCard l={l} label="总决赛 MVP（FMVP）" entry={fmvp} sub="按总决赛系列场均贡献评选" />
          </div>
          <div className="champ-roster">
            <div className="champ-roster-title">🏆 {l.teams[champion].abbr} 冠军阵容</div>
            <div className="champ-roster-grid">
              {l.teams[champion].players.map((p) => {
                const pg = perGame(p);
                return (
                  <div className="champ-player" key={p.id}>
                    <PlayerFace p={p} size="sm" />
                    <div className="cp-name" title={p.name}>{p.name}</div>
                    <div className="cp-pos">{p.pos} · OVR {p.ovr}</div>
                    <div className="cp-stats">{fmt1(pg.pts)}分 · {fmt1(pg.reb)}板 · {fmt1(pg.ast)}助</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={() => { giveAwards(); setShowAwards(true); }} title="常规赛奖项（MVP/DPOY/最佳阵容等）">🏅 查看完整颁奖典礼</button>
            <button className="btn primary" disabled={busy} onClick={goOffseason}>开启休赛期 → 新赛季</button>
          </div>
        </div>
      )}

      <div className="cal-bar">
        <div className="section-title" style={{ margin: 0 }}>📅 比赛日历</div>
        <div className="cal-nav">
          <button className="btn sm" onClick={() => gotoDay(calDay - 1)} disabled={calDay <= 1}>‹ 前一天</button>
          <span className="cal-day-label">
            第 <b>{calDay}</b> / {l.totalDays} 比赛日
            {manualDay != null && l.day !== calDay && calDay < l.day && <span className="dim">（已赛）</span>}
          </span>
          <button className="btn sm" onClick={() => gotoDay(calDay + 1)} disabled={calDay >= l.totalDays}>后一天 ›</button>
          <button className="btn sm" onClick={() => setManualDay(null)}>回到最新</button>
          {!regularDone && calDay > l.day && (
            <button className="btn sm primary" disabled={busy} onClick={() => doSim(calDay - l.day)}>
              ⚡ 快进到这一天（结束第 {calDay} 天前全部比赛）
            </button>
          )}
          {!regularDone && <button className="btn sm primary" disabled={busy || !myNext} onClick={gotoMine}>▶ 模拟到我的下一场（D{myNext?.day ?? '?'}）</button>}
        </div>
      </div>
      <div className="score-list cal-list">
        {(() => {
          const done = dayGames.get(calDay);
          if (done && done.length) {
            return done.map((g, i) => {
              const involvesMe = g.awayId === me.id || g.homeId === me.id;
              const hasBox = involvesMe && g.awayBox;
              return (
                <div
                  className={`score-row ${involvesMe ? 'mine' : ''}`}
                  key={i}
                  onClick={() => hasBox && setReport({ userGame: g, day: g.day, simmed: 0, label: `第 ${g.day} 比赛日 · 战报` })}
                >
                  <span className="score-day">D{g.day}</span>
                  <span className={`team ${g.awayScore > g.homeScore ? 'win' : ''}`}><TeamLogo abbr={l.teams[g.awayId].abbr} size="xs" />{l.teams[g.awayId].abbr}</span>
                  <span className="score-num">{g.awayScore}</span>
                  <span className="score-dash">-</span>
                  <span className="score-num">{g.homeScore}</span>
                  <span className={`team ${g.homeScore > g.awayScore ? 'win' : ''}`}><TeamLogo abbr={l.teams[g.homeId].abbr} size="xs" />{l.teams[g.homeId].abbr}</span>
                  {involvesMe && <span className="mine-tag">{hasBox ? '点击看战报' : '你的比赛'}</span>}
                </div>
              );
            });
          }
          const upcoming = calDay > l.day && calDay <= l.totalDays ? (l.schedule[calDay - 1] ?? []) : [];
          if (upcoming.length) {
            return upcoming.map((ref, i) => {
              const involvesMe = ref.awayId === me.id || ref.homeId === me.id;
              return (
                <div className={`score-row ${involvesMe ? 'mine' : ''} future`} key={i}>
                  <span className="score-day">D{calDay}</span>
                  <span className="team"><TeamLogo abbr={l.teams[ref.awayId].abbr} size="xs" />{l.teams[ref.awayId].abbr}</span>
                  <span className="score-num">-</span>
                  <span className="score-dash">vs</span>
                  <span className="score-num">-</span>
                  <span className="team"><TeamLogo abbr={l.teams[ref.homeId].abbr} size="xs" />{l.teams[ref.homeId].abbr}</span>
                  {involvesMe && <span className="mine-tag">你的比赛</span>}
                  {i === 0 && <span className="future-tag">未开赛</span>}
                </div>
              );
            });
          }
          return <div className="hint">这一天没有比赛安排。</div>;
        })()}
      </div>

      {/* v1.2 球队动态：伤病 + 球队气质随机事件（v2.0 事件带处理选项；v2.3 AI 报价也在这里） */}
      {(l.news.length > 0 || (l.pendingEvents?.length ?? 0) > 0 || (l.tradeOffers?.length ?? 0) > 0) && (
        <div className="news-panel">
          <div className="section-title">📰 球队动态</div>
          <TradeOffersPanel l={l} onAction={() => api.tick()} />
          {l.pendingEvents && l.pendingEvents.length > 0 && (
            <div className="event-pending">
              {l.pendingEvents.map((ev) => (
                <div className="event-item" key={ev.id}>
                  <div className="event-title">{ev.title}</div>
                  <div className="event-options">
                    {ev.options.map((opt) => (
                      <button
                        key={opt.label}
                        className="btn sm"
                        onClick={() => guard(() => { resolveTeamEvent(l, ev.id, opt); api.tick(); })}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="news-list">
            {l.news.slice(-10).reverse().map((n, i) => (
              <div className="news-item" key={i}>{n}</div>
            ))}
          </div>
        </div>
      )}

      {report?.userGame && report.userGame.awayBox && (
        <BoxScoreModal
          l={l}
          game={report.userGame}
          title={report.label}
          onClose={() => setReport(null)}
        />
      )}
      {showAwards && <AwardsModal l={l} onClose={() => setShowAwards(false)} />}
      {showEliminated && (
        <div className="modal-mask" onClick={() => setShowEliminated(false)}>
          <div className="modal elim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="elim-title">😞 你已被淘汰</div>
              <button className="btn-ghost" onClick={() => setShowEliminated(false)}>✕</button>
            </div>
            <div className="elim-body">
              <p>很遗憾，你的球队 {me.city} {me.name} 本赛季季后赛之旅到此为止。</p>
              <p>你可以继续看完剩余季后赛（点「⏩ 快进到总决赛」），或直接查看联盟战况。</p>
            </div>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => { setShowEliminated(false); fastToFinals(); }}>⏩ 快进到总决赛</button>
              <button className="btn" onClick={() => setShowEliminated(false)}>继续观看</button>
            </div>
          </div>
        </div>
      )}
      {seriesView && (
        <SeriesDetailModal
          l={l}
          series={seriesView}
          onClose={() => setSeriesView(null)}
          onOpenBox={(g) => {
            setSeriesView(null);
            setReport({ userGame: g, day: g.day, simmed: 0, label: `季后赛 · 战报` });
          }}
        />
      )}
    </div>
  );
}

function PlayoffBracket({ l, onSeries }: { l: LeagueState; onSeries: (s: PlayoffSeries) => void }) {
  if (!l.playoffRounds.length) return null;
  const meId = l.userTeamId;
  // 各路种子排名（常规赛战绩 → 1-8 号种子），用于对位图种子标注
  const seedMap = useMemo(() => {
    const s = standings(l);
    const m = new Map<number, number>();
    [...s.east, ...s.west].forEach((r) => m.set(r.team.id, r.rank));
    return m;
  }, [l]);
  const seedOf = (tid: number) => seedMap.get(tid) ?? 0;
  const empty: PlayoffSeries = { awayId: -1, homeId: -1, awayWins: 0, homeWins: 0, games: [] };

  // 一轮内一个系列的对位格；点击打开该系列逐场结果
  // v2.1 支持半成品槽位：一方已晋级 vs 待定（提前显示下一轮）
  const SeriesCell = ({ s, label, side }: { s: PlayoffSeries; label: string; side: 'east' | 'west' | 'final' }) => {
    if (s.awayId < 0 && s.homeId < 0) {
      return (
        <div className="series-card placeholder">
          <div className="series-team"><span className="series-abbr">待定</span></div>
          <div className="series-score dim">-</div>
          <div className="series-team"><span className="series-abbr">待定</span></div>
        </div>
      );
    }
    const done = s.awayWins >= 4 || s.homeWins >= 4;
    const aw = s.awayId, hw = s.homeId;
    const awMe = aw === meId, hwMe = hw === meId;
    const partial = aw < 0 || hw < 0; // 半成品槽
    const clickable = !partial;
    const teamRow = (tid: number, me: boolean) => (
      <div className={`series-team ${me ? 'me' : ''}`}>
        <span className="series-seed">({seedOf(tid)})</span>
        <TeamLogo abbr={l.teams[tid].abbr} size="xs" />
        <span className="series-abbr">{l.teams[tid].abbr}</span>
      </div>
    );
    return (
      <div
        className={`series-card ${done ? 'done' : ''} ${partial ? 'partial' : ''} ${side === 'final' ? 'final' : ''}`}
        onClick={() => clickable && onSeries(s)}
        title={clickable ? '点击查看该系列逐场比分' : '等待该系列对手产生（提前晋级的球队先行占位）'}
      >
        {aw >= 0 ? teamRow(aw, awMe) : <div className="series-team"><span className="series-abbr dim">待定</span></div>}
        <div className={`series-score ${awMe || hwMe ? 'mine' : ''}`}>{partial ? (done ? '✓ 晋级' : '-') : `${s.awayWins} - ${s.homeWins}`}</div>
        {hw >= 0 ? teamRow(hw, hwMe) : <div className="series-team"><span className="series-abbr dim">待定</span></div>}
        {done && !partial && <div className="series-win-tag">✓ 晋级</div>}
        {side === 'final' && !done && <div className="series-final-tag">🏆 总决</div>}
      </div>
    );
  };

  // v1.1 左右向中间晋级：东部从左侧、西部从右侧，向中间汇入总决赛。
  // 数据轮次：0=第一轮(8 组，东 4+西 4) → 1=半决赛(4) → 2=分区决赛(2) → 3=总决赛(1)
  const sideSeries = (roundIdx: number, idxInSide: number, side: 0 | 1): PlayoffSeries => {
    const round = l.playoffRounds[roundIdx];
    if (!round) return empty;
    const half = Math.ceil(round.series.length / 2);
    return round.series[side === 0 ? idxInSide : half + idxInSide] ?? empty;
  };
  const finalSeries = (): PlayoffSeries => l.playoffRounds[3]?.series[0] ?? empty;

  const col = (title: string, items: PlayoffSeries[], side: 'east' | 'west') => (
    <div className={`poff-col ${side}`}>
      <div className="poff-col-title">{title}</div>
      <div className="poff-col-body">{items.map((s, i) => <SeriesCell s={s} label={title} side={side} key={i} />)}</div>
    </div>
  );

  return (
    <div className="poff-bracket">
      {col('🌅 东部联盟 · 第一轮', [0, 1, 2, 3].map((i) => sideSeries(0, i, 0)), 'east')}
      {col('半决赛', [0, 1].map((i) => sideSeries(1, i, 0)), 'east')}
      {col('东部决赛', [sideSeries(2, 0, 0)], 'east')}
      <div className="poff-col final-col">
        <div className="poff-col-title">🏆 总决赛</div>
        <div className="poff-col-body"><SeriesCell s={finalSeries()} label="总决赛" side="final" /></div>
      </div>
      {col('西部决赛', [sideSeries(2, 0, 1)], 'west')}
      {col('半决赛', [0, 1].map((i) => sideSeries(1, i, 1)), 'west')}
      {col('🌇 西部联盟 · 第一轮', [0, 1, 2, 3].map((i) => sideSeries(0, i, 1)), 'west')}
    </div>
  );
}

// v1.1：系列赛逐场比分弹窗（回看上一轮/进行中的每一场）
function SeriesDetailModal({ l, series, onClose, onOpenBox }: {
  l: LeagueState; series: PlayoffSeries; onClose: () => void; onOpenBox: (g: GameResult) => void;
}) {
  const a = l.teams[series.awayId];
  const h = l.teams[series.homeId];
  const meId = l.userTeamId;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal series-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="box-title">
            <div className="series-modal-title">
              {a.abbr} <span className="big">{series.awayWins}</span> - <span className="big">{series.homeWins}</span> {h.abbr}
            </div>
            <div className="box-sub">{a.name} VS {h.name}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="series-games">
          {series.games.length === 0 && <div className="hint">双方尚未开打。</div>}
          {series.games.map((g, i) => {
            const mine = g.awayId === meId || g.homeId === meId;
            const hasBox = mine && !!g.awayBox;
            return (
              <div className={`series-game-row ${mine ? 'mine' : ''}`} key={i}>
                <span className="sg-idx">G{i + 1}</span>
                <TeamLogo abbr={l.teams[g.awayId].abbr} size="xs" />
                <span className="sg-abbr">{l.teams[g.awayId].abbr}</span>
                <span className="sg-score">{g.awayScore} - {g.homeScore}</span>
                <span className="sg-abbr">{l.teams[g.homeId].abbr}</span>
                <TeamLogo abbr={l.teams[g.homeId].abbr} size="xs" />
                {hasBox && <button className="btn sm" onClick={() => onOpenBox(g)}>📄 战报</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { Team };
