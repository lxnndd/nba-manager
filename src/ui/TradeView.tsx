// 交易视图：我方 ↔ 对方（球员 + 未来首轮签筹码），估值/劳资/阵容规则评估后执行
// v0.3.1：估值模型按 2016-2026 真实交易结构校准（潜力成长 vs 即战力折损 + 选秀权资产包）；
//         劳资限制：超奢侈税线（1.87 亿）球队交易后薪金不得增加、不得打包；2 亿美元硬顶。
import { useMemo, useState } from 'react';
import type { LeagueState, Player, Team } from '../engine/types';
import {
  evaluateTrade, applyTrade, tradeValue, pickValue, pickLabel, teamStrength,
  payrollOf, SALARY_CAP, TAX_LINE, HARD_CAP, TRADE_DEADLINE_DAY,
} from '../engine/league';
import { POS_CN, money, perGameLine } from './format';
import { TeamLogo } from './TeamLogo';
import { PlayerFace } from './PlayerFace';
import { PlayerModal } from './PlayerModal';
import type { GameApi } from './useGame';

export function TradeView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const others = l.teams.filter((t) => t.id !== me.id);
  const [targetId, setTargetId] = useState<number>(others[0]?.id ?? -1);
  const target = l.teams.find((t) => t.id === targetId) ?? others[0];
  const [giveIds, setGiveIds] = useState<number[]>([]);
  const [wantIds, setWantIds] = useState<number[]>([]);
  const [givePicks, setGivePicks] = useState<number[]>([]);
  const [wantPicks, setWantPicks] = useState<number[]>([]);
  // v2.0 自动预检：只要双方都选了筹码，就实时评估能否交易（无需再点"报价"）
  const [view, setView] = useState<{ p: Player; t: Team } | null>(null);

  const toggle = (arr: number[], id: number): number[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : arr.length >= 5 ? arr : [...arr, id];
  const togglePick = (arr: number[], idx: number): number[] =>
    arr.includes(idx) ? arr.filter((x) => x !== idx) : [...arr, idx];

  const myGive = me.players.filter((p) => giveIds.includes(p.id));
  const theirGive = target ? target.players.filter((p) => wantIds.includes(p.id)) : [];

  const myPicks = l.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === me.id);
  const theirPicks = target ? l.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === target.id) : [];

  const valuation = useMemo(() => {
    if ((!giveIds.length && !givePicks.length) || (!wantIds.length && !wantPicks.length) || !target) return null;
    const gv = myGive.reduce((s, p) => s + tradeValue(p), 0) + givePicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
    const wv = theirGive.reduce((s, p) => s + tradeValue(p), 0) + wantPicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
    return { gv, wv };
  }, [giveIds, givePicks, wantIds, wantPicks, target, me, l, myGive, theirGive]);

  // 阵容战力（交易前后对比）
  const powerNow = teamStrength(me.players);
  const powerAfter = useMemo(() => {
    if (!giveIds.length && !givePicks.length) return null;
    return teamStrength([...me.players.filter((p) => !giveIds.includes(p.id)), ...theirGive]);
  }, [giveIds, theirGive, me]);
  const targetPowerNow = target ? teamStrength(target.players) : 0;
  const targetPowerAfter = useMemo(() => {
    if (!wantIds.length && !wantPicks.length) return null;
    return teamStrength([...target.players.filter((p) => !wantIds.includes(p.id)), ...myGive]);
  }, [wantIds, myGive, target]);

  // v2.0 自动预检（选中双方筹码即实时求值；按钮只保留"最终确认"）
  const verdict = useMemo(() => {
    if ((!giveIds.length && !givePicks.length) || (!wantIds.length && !wantPicks.length) || !target) return null;
    try {
      return evaluateTrade(l, me.id, target.id, giveIds, wantIds, givePicks, wantPicks);
    } catch {
      return { accept: false, reason: '预检失败：筹码/名单状态异常' };
    }
  }, [giveIds, givePicks, wantIds, wantPicks, target, me, l]);

  const confirmTrade = () => {
    if (!verdict?.accept) return;
    applyTrade(l, me.id, target.id, giveIds, wantIds, givePicks, wantPicks);
    setGiveIds([]);
    setWantIds([]);
    setGivePicks([]);
    setWantPicks([]);
    api.tick();
  };

  if (!target) return null;

  if (l.day >= TRADE_DEADLINE_DAY) {
    return (
      <div className="view">
        <div className="status-strip">
          <div className="chip strong">交易市场</div>
          <div className="chip">⏸ 交易窗口已关闭</div>
        </div>
        <div className="action-card">
          <div className="action-title">本赛季交易截止日已过（第 {TRADE_DEADLINE_DAY} 比赛日）</div>
          <div className="btn-row">
            <span className="dim">下一交易窗口：下赛季常规赛开始后。</span>
          </div>
        </div>
      </div>
    );
  }

  const pay = payrollOf(me.players);
  const payState =
    pay > HARD_CAP ? '⚠️ 超过 2 亿硬顶（规则上不可能）'
      : pay > TAX_LINE ? `超奢侈税线 ${money(pay - TAX_LINE)} · apron 限制生效`
        : pay > SALARY_CAP ? `帽上 ${money(pay - SALARY_CAP)}`
          : `帽下空间 ${money(SALARY_CAP - pay)}`;

  const row = (p: Player, sel: boolean, onPick: () => void, team: Team) => (
    <div className={`pick-row ${sel ? 'sel' : ''}`} key={p.id} onClick={onPick} title={`OVR ${p.ovr} · ${p.age}岁 · 潜力 ${p.potential} · ${p.contractYears > 0 ? `剩${p.contractYears}年合同` : '无合同'}`}>
      <span className="pl-face" title={`OVR ${p.ovr}`}><PlayerFace p={p} size="sm" /></span>
      <span className="pl-name" title="点击查看球员详情" onClick={(e) => { e.stopPropagation(); setView({ p, t: team }); }}>{p.name}</span>
      <span className="pl-pos">{POS_CN[p.pos]}</span>
      <span className="pl-stats">{perGameLine(p)}</span>
      <span className="pl-salary">{money(p.salary)}</span>
      <span className="pl-val" title="交易价值（75 能力=1.0，每 +10 翻倍；含潜力成长/年龄折损±合同性价比）">估值 {tradeValue(p).toFixed(1)}</span>
    </div>
  );

  const pickRow = (idx: number, sel: boolean, onPick: () => void) => {
    const pk = l.draftPool[idx];
    const f = l.teams[pk.f];
    return (
      <div className={`pick-row pick-row-slim ${sel ? 'sel' : ''}`} key={idx} onClick={onPick}
        title={l.history.length === 0 && l.season === 1
          ? '第一次游玩：选秀权为盲盒（价值 1），赛季结束后按战绩评估顺位价值'
          : `首轮签顺位质量按 ${f.abbr}（${f.city} ${f.name}）当季战绩推算`}>
        <span className="pl-ico">🎓</span>
        <span className="pl-name">{pickLabel(l, pk)}</span>
        <span className="pl-pos dim">{f.win}-{f.loss}</span>
        <span className="pl-stats dim">{l.history.length === 0 && l.season === 1 ? '盲盒签' : '未来首轮'}</span>
        <span className="pl-salary" />
        <span className="pl-val">估值 {pickValue(l, pk).toFixed(1)}</span>
      </div>
    );
  };

  const delta = (a: number, b: number | null) =>
    b == null ? '' : `（${b >= a ? '▲' : '▼'} ${Math.abs(Math.round(b - a))}）`;

  return (
    <div className="view">
      <div className="status-strip">
        <div className="chip strong">交易市场</div>
        <div className="chip" title="1.54亿帽 / 1.87亿税线 / 2亿硬顶（简化劳资，详见使用说明）">
          我方工资单 {money(pay)}：{payState}
        </div>
        <div className="chip" title={`${target.city} ${target.name} 的现有工资单`}>
          对方工资单 {money(payrollOf(target.players))}
        </div>
        <div className="chip">{target.abbr} 战绩 {target.win}-{target.loss}</div>
      </div>

      <div className="trade-targets">
        <label className="dim">选择目标球队：</label>
        <TeamLogo abbr={target.abbr} size="sm" />
        <select value={target.id} onChange={(e) => { setTargetId(Number(e.target.value)); setWantIds([]); setWantPicks([]); }}>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.city} {t.name}（{t.win}-{t.loss}）
            </option>
          ))}
        </select>
        {pay > TAX_LINE && <span className="warn-text">⚠️ 已超奢侈税线：成交后工资单不得增加</span>}
        {payrollOf(target.players) > TAX_LINE && <span className="warn-text">⚠️ 对方超税线：成交后对方工资单不得增加</span>}
      </div>

      <div className="trade-grid">
        <div className="trade-col">
          <div className="col-head">
            <span className="strong">我送出的（{myGive.length} 人{givePicks.length ? ` + ${givePicks.length} 签` : ''}）</span>
            <span className="dim">总估值 {valuation ? valuation.gv : '-'}</span>
          </div>
          <div className="pick-list">
            {[...me.players].sort((a, b) => b.ovr - a.ovr).map((p) =>
              row(p, giveIds.includes(p.id), () => { setGiveIds(toggle(giveIds, p.id)); }, me)
            )}
          </div>
          {myPicks.length > 0 && (
            <div className="pick-list picks">
              <div className="col-sub">🎓 我的未来首轮签（可交易）</div>
              {myPicks.map(({ i }) => pickRow(i, givePicks.includes(i), () => { setGivePicks(togglePick(givePicks, i)); }))}
            </div>
          )}
          <div className="power-line">
            我方战力 {powerNow} → {powerAfter == null ? '…' : powerAfter}{delta(powerNow, powerAfter)}
          </div>
        </div>

        <div className="trade-col">
          <div className="col-head">
            <span className="strong">我要的（{theirGive.length} 人{wantPicks.length ? ` + ${wantPicks.length} 签` : ''}）· <TeamLogo abbr={target.abbr} size="xs" />{target.abbr}</span>
            <span className="dim">总估值 {valuation ? valuation.wv : '-'}</span>
          </div>
          <div className="pick-list">
            {[...target.players].sort((a, b) => b.ovr - a.ovr).map((p) =>
              row(p, wantIds.includes(p.id), () => { setWantIds(toggle(wantIds, p.id)); }, target)
            )}
          </div>
          {theirPicks.length > 0 && (
            <div className="pick-list picks">
              <div className="col-sub">🎓 {target.abbr} 持有的未来首轮签（可索要）</div>
              {theirPicks.map(({ i }) => pickRow(i, wantPicks.includes(i), () => { setWantPicks(togglePick(wantPicks, i)); }))}
            </div>
          )}
          <div className="power-line">
            {target.abbr} 战力 {targetPowerNow} → {targetPowerAfter == null ? '…' : targetPowerAfter}{delta(targetPowerNow, targetPowerAfter)}
          </div>
        </div>
      </div>

      <div className="trade-bar">
        <div className="trade-summary">
          {(myGive.length > 0 || givePicks.length > 0) && (theirGive.length > 0 || wantPicks.length > 0) && (
            <span>
              送出 <b>{[...myGive.map((p) => p.name), ...givePicks.map((i) => pickLabel(l, l.draftPool[i]))].join('、') || '…'}</b>
              换取 <b>{[...theirGive.map((p) => p.name), ...wantPicks.map((i) => pickLabel(l, l.draftPool[i]))].join('、') || '…'}</b>
              {valuation && <>（估值 {valuation.gv.toFixed(1)} ↔ {valuation.wv.toFixed(1)}）</>}
            </span>
          )}
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={!verdict?.accept} onClick={confirmTrade}>
            ✓ 确认交易（对方将对等接受后执行）
          </button>
          <span className="dim">点击球员即实时预检；换人后预检自动刷新</span>
        </div>
        {verdict && (
          <div className={`verdict ${verdict.accept ? 'ok' : 'no'}`}>
            {verdict.accept ? '✅ ' : '❌ '}{verdict.reason}
          </div>
        )}
        {!verdict && (giveIds.length > 0 || givePicks.length > 0 || wantIds.length > 0 || wantPicks.length > 0) && (
          <div className="verdict no">请在左右两边各至少选择一名球员/一枚签。</div>
        )}
      </div>

      {view && <PlayerModal player={view.p} team={view.t} onClose={() => setView(null)} />}
    </div>
  );
}

export type { Player };
