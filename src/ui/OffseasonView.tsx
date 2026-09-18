// 休赛期视图（v0.3.1；v2.1：选秀大会可操作 / 成长自动分配 / 自由市场 7 天 / 风格双组）
// 流程状态存引擎（l.offseasonStep：1 报告+选秀 → 2 自由市场(7 天) → 3 已结算待开季）；
// 选秀进度存 l.draft（玩家持有的签可手动挑选，AI 签自动按最高 OVR 选）。
import { useMemo, useState } from 'react';
import type { Player } from '../engine/types';
import {
  MIN_SALARY, MID_LEVEL, askFor, payrollOf, settleFreeAgency,
  simulateOffseasonAI, simulateAIOffseasonTrades, finishOffseason, cutPlayer,
  draftPickAuto, draftPickUser, draftComplete, draftIsUserTurn, draftRemaining, draftFastToUserPick,
  type FaResult,
} from '../engine/offseason';
import { SALARY_CAP, TAX_LINE, ROSTER_MAX } from '../engine/league';
import { TEAM_STYLES, COACH_STYLES, applyTeamStyle, applyCoachStyle, heightLabel, weightLabel, wingspanLabel } from '../engine/gen';
import { money, ovrClass, POS_CN } from './format';
import { PlayerFace } from './PlayerFace';
import { TeamLogo } from './TeamLogo';
import { TradeOffersPanel } from './TradeOffersPanel';
import { TradeView } from './TradeView';
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

  // 选秀操作（v2.1：玩家持有的签可手动挑选；v2.4.0：快进到我的签 + 选中前确认）
  const [pendingRookie, setPendingRookie] = useState<Player | null>(null);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  // v2.5.0：休赛期交易窗口面板（乐透抽签后 3 天）
  const [showOffseasonTrade, setShowOffseasonTrade] = useState(false);
  const draftAutoOne = () => {
    draftPickAuto(l);
    api.tick();
  };
  // v2.4.0：一键快进到"我持有的签"（中间的 AI 签全部代选）
  const draftFastToMine = () => {
    const steps = draftFastToUserPick(l);
    setPendingRookie(null);
    setDraftMsg(steps > 0
      ? `已快进 ${steps} 个 AI 签位${draftIsUserTurn(l) ? '，轮到你的签了！' : '（选秀已结束）'}`
      : (draftIsUserTurn(l) ? '已经轮到你的签了' : '没有你的签位了'));
    api.tick();
  };
  const draftUserAuto = () => {
    const d = l.draft;
    if (d && draftIsUserTurn(l)) {
      const best = [...d.class].sort((a, b) => b.ovr - a.ovr)[0];
      if (best) draftPickUser(l, best.id);
    }
    setPendingRookie(null);
    api.tick();
  };
  const draftUserPick = (pid: number) => {
    draftPickUser(l, pid);
    setPendingRookie(null);
    setDraftMsg(null);
    api.tick();
  };
  const draftAll = () => {
    draftComplete(l);
    setPendingRookie(null);
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

  // ⚠️ 依赖带 length：引擎就地增删 freeAgents，引用不变时 useMemo 不会重算（签约/裁人后列表不刷新）
  const faSorted = useMemo(
    () => [...l.freeAgents].sort((a, b) => b.ovr - a.ovr),
    [l.freeAgents, l.freeAgents.length],
  );
  const draftPoolSorted = useMemo(
    () => (draft ? [...draft.class].sort((a, b) => b.ovr - a.ovr || a.id - b.id) : []),
    [draft, draft?.class.length, draft?.next],
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
              {/* v2.4.0 乐透抽签可视化展示（此前只有一行文字播报） */}
              {l.lottery && l.lottery.year === draft.year && (
                <div className="lottery-panel">
                  <div className="sec-title">🎲 {l.lottery.year} 年乐透抽签结果（14 支乐透队）</div>
                  <div className="lottery-grid">
                    {l.lottery.order.slice(0, 14).map((tid, i) => {
                      const t = l.teams[tid];
                      const odd = l.lottery!.odds[i] ?? 0;
                      const isTop4 = i < 4;
                      const isMine = tid === l.userTeamId;
                      // v2.5.0：显示该签的"原属球队 → 现在归属"（签可能已被交易）
                      const pk = l.draftPool.find((x) => x.year === l.lottery!.year && x.round === 1 && x.f === tid);
                      const owner = pk ? l.teams[pk.o] : null;
                      const moved = !!owner && owner.id !== tid;
                      return (
                        <div className={`lottery-row ${isTop4 ? 'top4' : ''} ${isMine ? 'mine' : ''}`} key={tid}
                          title={`${t.city} ${t.name}：抽签前状元概率 ${(odd * 100).toFixed(1)}%，最终第 ${i + 1} 顺位${moved ? `；该签原属 ${t.abbr}，现由 ${owner!.abbr} 持有` : ''}`}>
                          <span className="lo-pick">{i + 1}</span>
                          <TeamLogo abbr={t.abbr} size="xs" />
                          <span className="lo-team">
                            {t.abbr}{isMine ? ' ★' : ''}
                          </span>
                          {/* v2.5.0：明确展示"原属球队 · 现属球队"（签位可能已被交易） */}
                          <span className={`lo-owner ${moved ? 'moved' : ''}`}>
                            {moved ? `原属 ${t.abbr} → 现属 ${owner!.abbr}` : `原属 ${t.abbr} · 现属 ${t.abbr}`}
                          </span>
                          <span className="lo-odds">
                            <span className="lo-bar" style={{ width: `${Math.min(100, (odd / 0.14) * 100)}%` }} />
                            <span className="lo-odd-text">{(odd * 100).toFixed(1)}%</span>
                          </span>
                          <span className="lo-record">{t.win}-{t.loss}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dim lottery-note">
                    前 4 顺位由抽签决定（战绩最差 3 队各 14% 概率，其后依次递减），
                    其余乐透队按战绩逆序、非乐透队 15-30 顺位；条形长度 = 抽签前的状元概率。
                  </div>
                </div>
              )}
              <div className="sec-title">🎓 {draft.year} 年选秀大会（共 {draft.order.length} 签：30 首轮 + 30 次轮 · 池内剩余 {draft.class.length} 人）</div>
              <div className="draft-status">
                {curPick
                  ? `当前第 ${draft.next + 1} 顺位（${curPick.round === 1 ? '首轮' : '次轮'}）· ${l.teams[curPick.o] ? `${l.teams[curPick.o].city} ${l.teams[curPick.o].name}` : '?'}${curPick.f !== curPick.o ? `（持有 ${l.teams[curPick.f].abbr} 的签）` : ''}`
                  : '全部签已处理，正在收尾…'}
              </div>
              {userTurn ? (
                <>
                  <div className="btn-row">
                    <button className="btn sm" onClick={draftUserAuto}>🤖 AI 代选（最高 OVR）</button>
                    <span className="dim">轮到你的签！从下方池子选人（点一下先看资料，确认后才算选中）</span>
                  </div>
                  {/* v2.4.0：选中前确认——点卡片只是"选中查看"，右侧显示体测/技能摘要，确认后才真正选走 */}
                  {pendingRookie && (
                    <div className="draft-confirm">
                      <div className="dc-head">
                        <PlayerFace p={pendingRookie} size="sm" />
                        <span className={`ovr-badge ${ovrClass(pendingRookie.ovr)}`}>{pendingRookie.ovr}</span>
                        <div className="dc-info">
                          <div className="dc-name">{pendingRookie.name}</div>
                          <div className="dc-meta">
                            {POS_CN[pendingRookie.pos]} · {pendingRookie.age}岁 · 潜力 {pendingRookie.potential} 星
                            {' · '}{heightLabel(pendingRookie.height)}
                            {pendingRookie.weight ? ` · ${weightLabel(pendingRookie.weight)}` : ''}
                            {pendingRookie.wingspan ? ` · 臂展 ${wingspanLabel(pendingRookie.wingspan)}` : ''}
                            {pendingRookie.nation !== '美国' ? ` · ${pendingRookie.nation}` : ''}
                          </div>
                          <div className="dc-skills">
                            三分 {pendingRookie.skills.three} · 篮下 {pendingRookie.skills.layup} · 控球 {pendingRookie.skills.handle}
                            {' · '}外线防守 {pendingRookie.skills.perimeter} · 篮板 {pendingRookie.skills.dr} · 速度 {pendingRookie.skills.speed}
                          </div>
                        </div>
                        <div className="btn-row">
                          <button className="btn primary" onClick={() => draftUserPick(pendingRookie.id)}>✓ 确认选中</button>
                          <button className="btn" onClick={() => setPendingRookie(null)}>再看看</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="draft-pool">
                    {draftPoolSorted.map((p) => (
                      <button key={p.id} className={`draft-pick-card ${pendingRookie?.id === p.id ? 'pending' : ''}`}
                        onClick={() => setPendingRookie(p)}
                        title={`${p.pos} · OVR ${p.ovr} · ${p.age}岁 · 潜 ${p.potential}星（点击查看后再确认选中）`}>
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
                  <button className="btn primary" onClick={draftFastToMine}>⏩ 快进到我的选秀</button>
                  <button className="btn" onClick={draftAutoOne}>▶ 进行下一签</button>
                  <button className="btn" onClick={draftAll}>⏩⏩ 自动完成全部选秀</button>
                  <span className="dim">中间由 AI 代选，轮到你持有的签会自动停下</span>
                </div>
              )}
              {draftMsg && <div className="verdict ok" style={{ marginTop: 6 }}>{draftMsg}</div>}
            </div>
          )}
          {/* v2.5.0：休赛期交易窗口（乐透抽签后 3 天）——此前休赛期完全无法交易 */}
          {l.offseasonTradeDays > 0 && (
            <div className="action-card">
              <div className="action-title">
                🔁 休赛期交易窗口（乐透抽签后 {l.offseasonTradeDays} 天 · 进入自由市场前关闭）
              </div>
              <div className="mini-lines" style={{ marginBottom: 8 }}>
                趁选秀权落位、自由市场还没开启，和各队谈交易吧：球队定位（重建/补强/争冠）决定对方
                看重选秀权还是即战力。
              </div>
              <div className="btn-row" style={{ marginBottom: 8 }}>
                <button className="btn" onClick={() => setShowOffseasonTrade((v) => !v)}>
                  {showOffseasonTrade ? '收起交易面板' : '展开交易面板'}
                </button>
                {l.offseasonTradeDays > 0 && (
                  <button className="btn sm" onClick={() => { l.offseasonTradeDays = Math.max(0, l.offseasonTradeDays - 1); api.tick(); }}>
                    结束一天（剩 {Math.max(0, l.offseasonTradeDays - 1)} 天）
                  </button>
                )}
              </div>
              {showOffseasonTrade && <TradeView api={api} />}
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
          {/* v2.3：休赛期 AI 也会主动报价（接受/拒绝就在卡片上操作） */}
          <TradeOffersPanel l={l} onAction={() => api.tick()} heading="📨 休赛期 AI 交易报价" />
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
