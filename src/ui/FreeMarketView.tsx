// 赛季中自由球员市场（v0.3.3）：从开档第一赛季即开放
// 规则：帽下自由签 / 帽上底薪（≤300万）或中产（≤1300万，每队每赛季 1 次，超税线无中产）
//       / 硬顶队仅底薪；报价 ≥ 要价 85% 即时成交（无 AI 竞价——AI 只在休赛期行动）。
// 休赛期的竞价式市场见 OffseasonView（另含 AI 竞争与补强）。
import { useMemo, useState } from 'react';
import { askFor, signFreeAgentNow, MIN_SALARY, MID_LEVEL, type FaResult } from '../engine/offseason';
import { SALARY_CAP, TAX_LINE, ROSTER_MAX, payrollOf } from '../engine/league';
import { money, ovrClass, POS_CN } from './format';
import { PlayerFace } from './PlayerFace';
import { PlayerModal } from './PlayerModal';
import type { Player } from '../engine/types';
import type { GameApi } from './useGame';

interface DraftOffer { years: number; salary: number }

export function FreeMarketView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [offers, setOffers] = useState<Record<number, DraftOffer>>({});
  const [lastResult, setLastResult] = useState<FaResult | null>(null);
  const [busy, setBusy] = useState(false);
  // v2.0：点击球员名字查看球员信息（18 项技能/潜力/生涯）
  const [view, setView] = useState<Player | null>(null);

  const payroll = payrollOf(me.players);
  const overCap = payroll > SALARY_CAP;
  const overTax = payroll > TAX_LINE;
  const rosterFull = me.players.length >= ROSTER_MAX;

  // ⚠️ 依赖里必须带 length：引擎对 freeAgents 是"就地增删"（splice/push），
  // 数组引用不变 → 只用 [l.freeAgents] 时 useMemo 不会重算，
  // 表现就是"签约成功后球员没立即消失，切换两次才刷新"。
  const faSorted = useMemo(
    () => [...l.freeAgents].sort((a, b) => b.ovr - a.ovr || b.potential - a.potential || a.id - b.id),
    [l.freeAgents, l.freeAgents.length],
  );

  const toggleOffer = (pid: number) => {
    setOffers((prev) => {
      const next = { ...prev };
      if (next[pid]) delete next[pid];
      else {
        const p = l.freeAgents.find((x) => x.id === pid);
        if (p) next[pid] = { years: 1, salary: askFor(p) };
      }
      return next;
    });
  };

  const doSign = (pid: number) => {
    const o = offers[pid];
    if (!o || busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const r = signFreeAgentNow(l, me.id, pid, o.years, o.salary);
        setLastResult(r);
        if (r.ok) {
          setOffers((prev) => {
            const n = { ...prev };
            delete n[pid];
            return n;
          });
        }
        api.tick();
      } catch (e) {
        setLastResult({ pid, name: '?', ok: false, won: false, teamId: -1, years: 0, salary: 0, note: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(false);
      }
    }, 10);
  };

  const offeredList = Object.entries(offers).map(([pid, o]) => ({ pid: Number(pid), ...o }));

  return (
    <div className="view">
      <div className="status-strip">
        <div className="chip">赛季 {l.season} · {l.year}</div>
        <div className="chip strong">{me.city} {me.name}</div>
        <div className="chip">
          工资单 {money(payroll)}
          {overTax
            ? <span className="warn-text">（超奢侈税线 {money(TAX_LINE)}：只能签底薪 ≤{money(MIN_SALARY)}）</span>
            : overCap && <span className="warn-text">（超工资帽 {money(SALARY_CAP)}：只能签底薪 ≤{money(MIN_SALARY)} 或中产 ≤{money(MID_LEVEL)}）</span>}
        </div>
        <div className="chip">剩余空间 {money(Math.max(0, SALARY_CAP - payroll))} · 自由市场 {l.freeAgents.length} 人</div>
      </div>

      <div className="action-card">
        <div className="action-title">💼 自由球员市场（赛季中 · 即时签约）</div>
        {rosterFull && <div className="warn-text" style={{ marginBottom: 8 }}>⚠️ 名单已满 {ROSTER_MAX} 人：请先裁人/交易腾出名额。</div>}

        <div className="fa-table">
          {faSorted.map((p) => (
            <div key={p.id} className={`fa-row ${offers[p.id] ? 'offered' : ''}`}>
              <PlayerFace p={p} size="xs" />
              <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
              <span className="fa-name" title="点击查看球员信息" onClick={() => setView(p)}>{p.name}</span>
              <span className="fa-pos">{POS_CN[p.pos]}/{POS_CN[p.secPos]}</span>
              <span className="fa-age">{p.age}岁 · 潜 {p.potential}星</span>
              <span className="fa-pot" title={`生涯：${p.career.gp} 场 · ${Math.round(p.career.pts)} 分 · ${Math.round(p.career.reb)} 板`}>{p.career.gp > 0 ? `生涯 ${p.career.gp} 场` : '新人'}</span>
              <span className="fa-ask">要价 {money(askFor(p))}</span>
              {offers[p.id] && <span className="offer-tag">{offers[p.id].years}年×{money(offers[p.id].salary)}</span>}
              <button
                className={`btn ${offers[p.id] ? 'danger' : 'primary'} sm`}
                disabled={rosterFull && !offers[p.id]}
                onClick={() => toggleOffer(p.id)}
              >
                {offers[p.id] ? '取消' : '🤝 报价'}
              </button>
            </div>
          ))}
          {faSorted.length === 0 && <div className="hint">自由市场暂时没人——休赛期选秀落选与市场补员会带来新人。</div>}
        </div>

        {offeredList.length > 0 && (
          <div className="offer-panel">
            <div className="sec-title">📋 报价清单（{offeredList.length} 人）</div>
            {offeredList.map(({ pid, years, salary }) => {
              const p = l.freeAgents.find((x) => x.id === pid);
              if (!p) return null;
              const ask = askFor(p);
              return (
                <div className="offer-item" key={pid}>
                  <span className="fa-name">{p.name} <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span></span>
                  <span className="years-chips">
                    {[1, 2, 3, 4].map((y) => (
                      <button key={y} className={`chip-btn ${y === years ? 'on' : ''}`} onClick={() => setOffers((prev) => ({ ...prev, [pid]: { ...prev[pid], years: y } }))}>{y}年</button>
                    ))}
                  </span>
                  <span className="salary-stepper">
                    <button className="btn sm" onClick={() => setOffers((prev) => ({ ...prev, [pid]: { ...prev[pid], salary: Math.max(250, prev[pid].salary - 100) } }))}>−100</button>
                    <b>{money(salary)}/年</b>
                    <button className="btn sm" onClick={() => setOffers((prev) => ({ ...prev, [pid]: { ...prev[pid], salary: Math.min(4200, prev[pid].salary + 100) } }))}>+100</button>
                    <button className="btn sm" onClick={() => setOffers((prev) => ({ ...prev, [pid]: { ...prev[pid], salary: ask } }))}>按要价</button>
                    <button className="btn sm" onClick={() => setOffers((prev) => ({ ...prev, [pid]: { ...prev[pid], salary: MIN_SALARY } }))}>底薪</button>
                  </span>
                  <button className="btn primary sm" disabled={busy} onClick={() => doSign(pid)}>✍️ 签约</button>
                </div>
              );
            })}
          </div>
        )}

        {lastResult && (
          <div className={`settle-summary`}>
            <div className={`settle-item ${lastResult.ok ? 'ok' : 'no'}`}>
              {lastResult.ok ? '✅' : '❌'} {lastResult.name}：{lastResult.note}
              {lastResult.ok && <span>（{lastResult.years} 年 × {money(lastResult.salary)}/年）</span>}
              <button className="btn sm" style={{ marginLeft: 10 }} onClick={() => setLastResult(null)}>知道了</button>
            </div>
          </div>
        )}
      </div>
      {view && <PlayerModal player={view} team={me} onClose={() => setView(null)} />}
    </div>
  );
}
