// 休赛期视图（v0.3.1；v2.1：选秀大会可操作 / 成长自动分配 / 自由市场 7 天 / 风格双组）
// 流程状态存引擎（l.offseasonStep：1 报告+选秀 → 2 自由市场(7 天) → 3 已结算待开季）；
// 选秀进度存 l.draft（玩家持有的签可手动挑选，AI 签自动按最高 OVR 选）。
import { useMemo, useState } from 'react';
import type { Player } from '../engine/types';
import {
  MIN_SALARY, MID_LEVEL, askFor, payrollOf, settleFreeAgency,
  simulateOffseasonAI, simulateAIOffseasonTrades, finishOffseason, cutPlayer,
  draftPickAuto, draftPickUser, draftComplete, draftIsUserTurn, draftRemaining,
  type FaResult,
} from '../engine/offseason';
import { SALARY_CAP, TAX_LINE, ROSTER_MAX } from '../engine/league';
import { TEAM_STYLES, COACH_STYLES, applyTeamStyle, applyCoachStyle } from '../engine/gen';
import { money, ovrClass, POS_CN } from './format';
import { PlayerFace } from './PlayerFace';
import type { GameApi } from './useGame';

export function OffseasonView({ api, onFinished }: { api: GameApi; onFinished: () => void }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [lastResults, setLastResults] = useState<FaResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const payroll = payrollOf(me);
  const overCap = payroll > SALARY_CAP;
  const overTax = payroll > TAX_LINE;
  const rosterFull = me.players.length >= ROSTER_MAX;
  const step = l.offseasonStep;
  const faDay = l.faDay ?? 1;
  const draft = l.draft;

  const enterMarket = () => {
    l.offseasonStep = 2;
    api.tick();
  };

  // 选秀操作（v2.1：玩家持有的签可手动挑选）
  const draftAutoOne = () => {
    draftPickAuto(l);
    api.tick();
  };
  const draftUserAuto = () => {
    const d = l.draft;
    if (d && draftIsUserTurn(l)) {
      const best = [...d.class].sort((a, b) => b.ovr - a.ovr)[0];
      if (best) draftPickUser(l, best.id);
    }
    api.tick();
  };
  const draftUserPick = (pid: number) => {
    draftPickUser(l, pid);
    api.tick();
  };
  const draftAll = () => {
    draftComplete(l);
    api.tick();
  };

  // v2.0 自由市场 7 天：结算"今天已提交"的报价 → AI 补强与交易 → 进入下一天
  const settleDay = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const results = settleFreeAgency(l, l.faOffers ?? []);
        setLastResults((prev) => [...(prev ?? []), ...results]);
        l.faOffers = [];
        if (faDay >= 7) {
          simulateOffseasonAI(l);
          simulateAIOffseasonTrades(l);
          l.offseasonStep = 3;
        } else {
          l.faDay = faDay + 1;
        }
        api.tick();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 10);
  };

  const finish = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        finishOffseason(l);
        api.tick();
        onFinished();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 10);
  };

  const doCut = (pid: number) => {
    cutPlayer(l, pid);
    api.tick();
  };

  const chooseTeamStyle = (id: string) => {
    applyTeamStyle(l, id as 'youth' | 'star');
    api.tick();
  };
  const chooseCoachStyle = (id: string) => {
    applyCoachStyle(l, id as 'iron' | 'locker' | 'brand');
    api.tick();
  };

  // v2.0 报价：加入/撤出待结算清单（每"天"最多 3 份）
  const toggleOffer = (pid: number) => {
    const cur = l.faOffers ?? [];
    const idx = cur.findIndex((o) => o.pid === pid);
    if (idx >= 0) {
      l.faOffers = cur.filter((o) => o.pid !== pid);
    } else {
      if (cur.length >= 3) return; // 每日 3 份上限
      const p = l.freeAgents.find((x) => x.id === pid);
      if (p) l.faOffers = [...cur, { pid, years: 1, salary: askFor(p) }];
    }
    api.tick();
  };

  const setOffer = (pid: number, patch: Partial<{ years: number; salary: number }>) => {
    l.faOffers = (l.faOffers ?? []).map((o) => (o.pid === pid ? { ...o, ...patch } : o));
    api.tick();
  };

  const faSorted = useMemo(() => [...l.freeAgents].sort((a, b) => b.ovr - a.ovr), [l.freeAgents]);
  const draftPoolSorted = useMemo(
    () => (draft ? [...draft.class].sort((a, b) => b.ovr - a.ovr || a.id - b.id) : []),
    [draft],
  );
  const curPick = draft ? draftRemaining(l).current : null;
  const userTurn = draftIsUserTurn(l);

  return (
    <div className="view offseason-view">
      <div className="status-strip">
        <div className="chip">休赛期 · {l.season} 赛季结束</div>
        <div className="chip strong">{me.city} {me.name}</div>
        <div className="chip" title="工资帽 = 1.54 亿；现有工资单 + 剩余空间">
          💵 现有工资单 {money(payroll)} · 剩余空间 {money(Math.max(0, SALARY_CAP - payroll))} / 帽 {money(SALARY_CAP)}
        </div>
        <div className="chip">
          {overTax && <span className="warn-text">已超奢侈税线 {money(TAX_LINE)}（仅可底薪补人）</span>}
          {!overTax && overCap && <span className="warn-text">超帽（仅底薪/中产 ≤{money(MID_LEVEL)}）</span>}
        </div>
        <div className="chip">自由市场 {l.freeAgents.length} 人</div>
      </div>
      {err && <div className="err-banner" onClick={() => setErr(null)}>⚠️ {err}（点击关闭）</div>}

      {step <= 1 && (
        <div className="action-card">
          <div className="action-title">📋 休赛期报告 · 退役与选秀（第 {l.season + 1} 赛季）</div>
          <NewsList l={l} />
          <div className="mini-lines" style={{ marginTop: 8 }}>
            🌱 球员成长已自动分配（优先加突出的能力 · 单项不超过 90）
          </div>
          {draft && (
            <div className="draft-panel">
              <div className="sec-title">🎓 选秀大会（共 {draft.order.length} 签 · 池内剩余 {draft.class.length} 人）</div>
              <div className="draft-status">
                {curPick
                  ? `当前顺位：第 ${draft.next + 1} 签 · ${l.teams[curPick.o] ? `${l.teams[curPick.o].city} ${l.teams[curPick.o].name}` : '?'}${curPick.f !== curPick.o ? `（持有 ${l.teams[curPick.f].abbr} 的签）` : ''}`
                  : '全部签已处理，正在收尾…'}
              </div>
              {userTurn ? (
                <>
                  <div className="btn-row">
                    <button className="btn sm" onClick={draftUserAuto}>🤖 AI 代选（最高 OVR）</button>
                    <span className="dim">轮到你的签！从下方池子点击挑选新秀</span>
                  </div>
                  <div className="draft-pool">
                    {draftPoolSorted.map((p) => (
                      <button key={p.id} className="draft-pick-card" onClick={() => draftUserPick(p.id)} title={`${p.pos} · OVR ${p.ovr} · ${p.age}岁 · 潜 ${p.potential}星`}>
                        <PlayerFace p={p} size="xs" />
                        <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                        <span className="dp-name">{p.name}</span>
                        <span className="dp-pos">{POS_CN[p.pos]}</span>
                        <span className="dp-nation">{p.nation !== '美国' ? p.nation : ''}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="btn-row">
                  <button className="btn" onClick={draftAutoOne}>▶ 进行下一签（AI 自动）</button>
                  <button className="btn primary" onClick={draftAll}>⏩ 自动完成全部选秀</button>
                  <span className="dim">玩家签会在轮到时暂停，等你亲自挑选</span>
                </div>
              )}
            </div>
          )}
          <div className="btn-row">
            <button className="btn primary" disabled={!!draft} onClick={enterMarket}>💰 进入自由市场</button>
            {draft && <span className="dim">先完成选秀（或点「自动完成全部选秀」）</span>}
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="action-card">
            <div className="action-title">🧩 我的阵容（{me.players.length}/{ROSTER_MAX}）· 自由市场第 {faDay}/7 天</div>
            {overTax
              ? <div className="warn-text" style={{ marginBottom: 6 }}>⚠️ 已超奢侈税线：仅可签底薪（≤{money(MIN_SALARY)}）。</div>
              : overCap && <div className="warn-text" style={{ marginBottom: 6 }}>⚠️ 超薪金空间：仅可签底薪 ≤{money(MIN_SALARY)} 或中产 ≤{money(MID_LEVEL)}（每季 1 次{l.midUsed[me.id] ? '，已用' : ''}）。</div>}
            <div className="mini-list">
              {me.players.map((p) => (
                <div className="my-row" key={p.id}>
                  <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                  <span className="fa-name">{p.name}</span>
                  <span className="fa-pos">{POS_CN[p.pos]} · {p.age}岁 · NBA第{p.exp}年</span>
                  <span className="fa-salary">{p.salary > 0 ? `${money(p.salary)}/年` : '自由'}</span>
                  <span className="fa-remain">{p.contractYears > 0 ? `剩 ${p.contractYears} 年` : ''}</span>
                  <button className="btn danger sm" onClick={() => doCut(p.id)} title="裁掉腾出名额（每个位置需至少留 1 人）">✂️ 裁</button>
                </div>
              ))}
            </div>
            {lastResults && lastResults.length > 0 && (
              <div className="settle-summary">
                <div className="sec-title">📝 第 {Math.max(1, faDay - 1)} 天结算 · 你的报价结果</div>
                {lastResults.slice(-12).map((r) => (
                  <div key={r.pid} className={`settle-item ${r.ok && r.won ? 'ok' : 'no'}`}>
                    <span>{r.ok && r.won ? '✅' : '❌'} {r.name}：{r.note}</span>
                    {r.ok && r.won && <span>（{r.years} 年 × {money(r.salary)}/年）</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="action-card">
            <div className="action-title">💼 自由球员市场（今日还可报价 {Math.max(0, 3 - (l.faOffers?.length ?? 0))} 份 · {faDay}/7 天）</div>
            <div className="fa-table">
              {faSorted.map((p) => {
                const off = (l.faOffers ?? []).find((o) => o.pid === p.id);
                return (
                  <div key={p.id} className={`fa-row ${off ? 'offered' : ''}`}>
                    <PlayerFace p={p} size="xs" />
                    <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                    <span className="fa-name">{p.name}</span>
                    <span className="fa-pos">{POS_CN[p.pos]}</span>
                    <span className="fa-age">{p.age}岁{p.nation !== '美国' ? ` · ${p.nation}` : ''}</span>
                    <span className="fa-pot">潜 {p.potential}星</span>
                    <span className="fa-career" title={`生涯：${p.career.gp} 场 · ${Math.round(p.career.pts)} 分 · ${Math.round(p.career.reb)} 板 · ${Math.round(p.career.ast)} 助`}>
                      {p.career.gp > 0 ? `生涯 ${p.career.gp} 场` : '新人'}
                    </span>
                    <span className="fa-ask">要价 {money(askFor(p))}</span>
                    {off && <span className="offer-tag">{off.years}年×{money(off.salary)}</span>}
                    <button
                      className={`btn ${off ? 'danger' : 'primary'} sm`}
                      disabled={rosterFull && !off}
                      onClick={() => toggleOffer(p.id)}
                    >
                      {off ? '撤回报价' : '🤝 报价'}
                    </button>
                  </div>
                );
              })}
            </div>

            {(l.faOffers ?? []).length > 0 && (
              <div className="offer-panel">
                <div className="sec-title">📋 今日报价清单（{l.faOffers!.length}/3）</div>
                {l.faOffers!.map(({ pid, years, salary }) => {
                  const p = l.freeAgents.find((x) => x.id === pid);
                  if (!p) return null;
                  const ask = askFor(p);
                  return (
                    <div className="offer-item" key={pid}>
                      <span className="fa-name">{p.name} <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span></span>
                      <span className="years-chips">
                        {[1, 2, 3, 4].map((y) => (
                          <button key={y} className={`chip-btn ${y === years ? 'on' : ''}`} onClick={() => setOffer(pid, { years: y })}>{y}年</button>
                        ))}
                      </span>
                      <span className="salary-stepper">
                        <button className="btn sm" onClick={() => setOffer(pid, { salary: Math.max(250, salary - 100) })}>−100</button>
                        <b>{money(salary)}/年</b>
                        <button className="btn sm" onClick={() => setOffer(pid, { salary: Math.min(4200, salary + 100) })}>+100</button>
                        <button className="btn sm" onClick={() => setOffer(pid, { salary: ask })}>按要价</button>
                        <button className="btn sm" onClick={() => setOffer(pid, { salary: MIN_SALARY })}>底薪</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="offer-bar">
              <div className="offer-summary">
                我的阵容 {me.players.length}/{ROSTER_MAX}（开季 15）· 今日报价 {l.faOffers?.length ?? 0}/3
                {overCap && !overTax && <span className="warn-text"> ⚠️ 超帽（只能签底薪档）</span>}
                {overTax && <span className="warn-text"> ⚠️ 超税线（仅底薪）</span>}
              </div>
              <button className="btn primary" disabled={busy} onClick={settleDay}>
                {faDay >= 7 ? '💰 第 7 天 · 结算并关闭市场' : `📮 结束第 ${faDay} 天（结算今日 ${l.faOffers?.length ?? 0} 份报价）`}
              </button>
            </div>
          </div>
        </>
      )}

      {step >= 3 && (
        <div className="action-card">
          <div className="action-title">📰 休赛期结果 · 市场与交易</div>
          <div className="offseason-report">
            <NewsList l={l} />
          </div>
          <div className="sec-title" style={{ marginTop: 12 }}>🎨 下赛季球队风格（每赛季归零重选 · AI 队已同步重选）</div>
          <div className="style-grid">
            {TEAM_STYLES.map((s) => (
              <button key={s.id} className={`style-card ${me.style === s.id ? 'on' : ''}`} onClick={() => chooseTeamStyle(s.id)}>
                <span className="sc-icon">{s.icon}</span>
                <span className="sc-name">{s.name}</span>
                <span className="sc-desc">{s.desc}</span>
              </button>
            ))}
          </div>
          <div className="sec-title" style={{ marginTop: 8 }}>🧭 执教风格</div>
          <div className="style-grid">
            {COACH_STYLES.map((s) => (
              <button key={s.id} className={`style-card ${me.coachStyle === s.id ? 'on' : ''}`} onClick={() => chooseCoachStyle(s.id)}>
                <span className="sc-icon">{s.icon}</span>
                <span className="sc-name">{s.name}</span>
                <span className="sc-desc">{s.desc}</span>
              </button>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn primary" disabled={busy} onClick={finish}>🏀 开始新赛季（{l.year + 1}）</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsList({ l }: { l: { news: string[] } }) {
  const list = [...l.news].reverse();
  return (
    <div className="news-list">
      {list.length === 0 && <div className="hint">暂无消息。</div>}
      {list.map((s, i) => <div className="news-item" key={i}>{s}</div>)}
    </div>
  );
}
