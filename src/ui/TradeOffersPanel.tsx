// v2.3 AI 主动报价卡（球队动态 / 休赛期共用）：显示 AI 想怎么换，玩家一键接受或拒绝
import { useState } from 'react';
import type { LeagueState } from '../engine/types';
import { acceptTradeOffer, rejectTradeOffer, pickLabel, pickValue, tradeValue } from '../engine/league';
import { POS_CN, money } from './format';
import { TeamLogo } from './TeamLogo';
import { PlayerFace } from './PlayerFace';

export function TradeOffersPanel({ l, onAction, heading }: {
  l: LeagueState; onAction: () => void; heading?: string;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const offers = l.tradeOffers ?? [];
  if (!offers.length) return null;
  const me = l.teams[l.userTeamId];

  const playerVal = (teamId: number, pid: number) => {
    const p = l.teams[teamId].players.find((q) => q.id === pid);
    return p ? tradeValue(p) : 0;
  };
  const pickVal = (idx: number) => (l.draftPool[idx] ? pickValue(l, l.draftPool[idx]) : 0);

  return (
    <div className="trade-offers">
      <div className="section-title">{heading ?? `📨 AI 交易报价（${offers.length}）`}</div>
      {msg && <div className={`verdict ${msg.ok ? 'ok' : 'no'}`} onClick={() => setMsg(null)}>{msg.text}（点击关闭）</div>}
      {offers.map((of) => {
        const ai = l.teams[of.fromTeamId];
        const giveV = of.givePids.reduce((s, pid) => s + playerVal(me.id, pid), 0)
          + of.givePickIdx.reduce((s, i) => s + pickVal(i), 0);
        const wantV = of.wantPids.reduce((s, pid) => s + playerVal(ai.id, pid), 0)
          + of.wantPickIdx.reduce((s, i) => s + pickVal(i), 0);
        const giveNames = [
          ...of.givePids.map((pid) => me.players.find((q) => q.id === pid)?.name ?? '?'),
          ...of.givePickIdx.map((i) => pickLabel(l, l.draftPool[i])),
        ];
        const wantNames = [
          ...of.wantPids.map((pid) => ai.players.find((q) => q.id === pid)?.name ?? '?'),
          ...of.wantPickIdx.map((i) => pickLabel(l, l.draftPool[i])),
        ];
        return (
          <div className="trade-offer-card" key={of.id}>
            <div className="to-head">
              <TeamLogo abbr={ai.abbr} size="sm" />
              <span className="to-title">{ai.city} {ai.name}</span>
              <span className="dim">{ai.win}-{ai.loss} · 第 {of.day || '—'} 比赛日提出</span>
            </div>
            <div className="to-note">{of.note}</div>
            <div className="to-body">
              <div className="to-side out">
                <div className="to-label">你送出（估值 {giveV.toFixed(1)}）</div>
                {of.givePids.map((pid) => {
                  const p = me.players.find((q) => q.id === pid);
                  if (!p) return null;
                  return (
                    <div className="to-item" key={pid}>
                      <PlayerFace p={p} size="xs" />
                      <span className="to-name">{p.name}</span>
                      <span className="to-meta">{POS_CN[p.pos]} {p.pos}/{p.secPos} · OVR {p.ovr} · {p.age}岁 · {money(p.salary)}</span>
                    </div>
                  );
                })}
                {of.givePickIdx.map((i) => (
                  <div className="to-item" key={`pk${i}`}>
                    <span className="to-ico">🎓</span>
                    <span className="to-name">{pickLabel(l, l.draftPool[i])}</span>
                    <span className="to-meta">估值 {pickVal(i).toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <div className="to-arrow">⇄</div>
              <div className="to-side in">
                <div className="to-label">你得到（估值 {wantV.toFixed(1)}）</div>
                {of.wantPids.map((pid) => {
                  const p = ai.players.find((q) => q.id === pid);
                  if (!p) return null;
                  return (
                    <div className="to-item" key={pid}>
                      <PlayerFace p={p} size="xs" />
                      <span className="to-name">{p.name}</span>
                      <span className="to-meta">{POS_CN[p.pos]} {p.pos}/{p.secPos} · OVR {p.ovr} · {p.age}岁 · {money(p.salary)}</span>
                    </div>
                  );
                })}
                {of.wantPickIdx.map((i) => (
                  <div className="to-item" key={`pk${i}`}>
                    <span className="to-ico">🎓</span>
                    <span className="to-name">{pickLabel(l, l.draftPool[i])}</span>
                    <span className="to-meta">估值 {pickVal(i).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="to-foot">
              <span className={`to-diff ${wantV >= giveV ? 'good' : 'bad'}`}>
                {wantV >= giveV ? `赚 ${(wantV - giveV).toFixed(1)}` : `亏 ${(giveV - wantV).toFixed(1)}`}（估值口径 75=1.0，每 +10 翻倍）
              </span>
              <div className="btn-row">
                <button
                  className="btn primary sm"
                  onClick={() => {
                    const r = acceptTradeOffer(l, of.id);
                    setMsg({ ok: r.ok, text: r.ok ? `✅ ${r.reason}` : `❌ ${r.reason}` });
                    onAction();
                  }}
                >
                  ✓ 接受交易
                </button>
                <button
                  className="btn danger sm"
                  onClick={() => {
                    rejectTradeOffer(l, of.id);
                    setMsg({ ok: false, text: `❌ 已拒绝 ${ai.name} 的报价` });
                    onAction();
                  }}
                >
                  ✕ 拒绝
                </button>
              </div>
            </div>
            <div className="to-hint dim">送出：{[...giveNames].join('、') || '—'} · 得到：{[...wantNames].join('、') || '—'}</div>
          </div>
        );
      })}
    </div>
  );
}
