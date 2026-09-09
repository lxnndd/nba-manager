// 阵容视图：五位置深度卡 + 轮换/球权/战术自定义（v0.3.1）+ 位置拖拽换位（v0.3.7）
import { useState } from 'react';
import type { LeagueState, Player, Pos } from '../engine/types';
import { perGame } from '../engine/league';
import { manualRotation, targetMinutes, AUTO_MINUTES } from '../engine/sim';
import { repositionPlayer, TEAM_STYLES, COACH_STYLES } from '../engine/gen';
import { POS_CN, money, ovrClass } from './format';
import { PlayerModal } from './PlayerModal';
import { PlayerFace } from './PlayerFace';
import type { GameApi } from './useGame';

const POS_LIST: Pos[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const MIN_MAX = 48;

export function RosterView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [sel, setSel] = useState<Player | null>(null);
  const [showRot, setShowRot] = useState(true);
  const [dragPid, setDragPid] = useState<number | null>(null);
  const [dropPos, setDropPos] = useState<Pos | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const move = (pos: Pos, idx: number, dir: -1 | 1) => {
    const same = me.players.filter((p) => p.pos === pos);
    const target = idx + dir;
    if (target < 0 || target >= same.length) return;
    // 在完整数组里交换两个同位置球员的位置
    const a = same[idx];
    const b = same[target];
    const ia = me.players.indexOf(a);
    const ib = me.players.indexOf(b);
    const tmp = me.players[ia];
    me.players[ia] = me.players[ib];
    me.players[ib] = tmp;
    api.tick();
  };

  const setMin = (p: Player, v: number) => {
    p.min = Math.max(0, Math.min(MIN_MAX, Math.round(v)));
    api.tick();
  };
  const setUsage = (p: Player, v: number | null) => {
    p.usage = v == null ? null : Math.max(0, Math.min(10, Math.round(v)));
    api.tick();
  };
  const resetAll = () => {
    for (const p of me.players) { p.min = null; p.usage = null; }
    api.tick();
  };
  const depthIdx = (p: Player) => me.players.filter((q) => q.pos === p.pos).indexOf(p);

  // ---- v0.3.7 位置拖拽（v2.0 双位置：只能拖到该球员的 {主,副} 位置，主副互换） ----
  const onDragStart = (e: React.DragEvent, pid: number) => {
    e.dataTransfer.setData('text/plain', String(pid));
    e.dataTransfer.effectAllowed = 'move';
    setDragPid(pid);
  };
  const dragPlayer = me.players.find((q) => q.id === dragPid) ?? null;
  const canDropTo = (pos: Pos) => !!dragPlayer && (dragPlayer.pos === pos || dragPlayer.secPos === pos);
  const onDragOver = (e: React.DragEvent, pos: Pos) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (canDropTo(pos)) setDropPos(pos);
    else setDropPos(null);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPos(null);
  };
  const onDrop = (e: React.DragEvent, pos: Pos) => {
    e.preventDefault();
    const pid = Number(e.dataTransfer.getData('text/plain')) || dragPid;
    setDragPid(null);
    setDropPos(null);
    if (!Number.isFinite(pid) || !pid) return;
    try {
      const res = repositionPlayer(me, pid, pos);
      api.tick();
      setNotice(`🏀 ${res.moved.name} 改打 ${POS_CN[pos]}（${POS_CN[res.moved.secPos]} ↔ ${POS_CN[pos]} 主副互换），能力值已按新位置适配`);
    } catch (err) {
      setNotice(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const manual = manualRotation(me);
  // 每位置目标分钟合计（警告用）
  const posTotal: Record<string, number> = {};
  for (const p of me.players) {
    posTotal[p.pos] = (posTotal[p.pos] ?? 0) + targetMinutes(p, me);
  }
  const injured = me.players.filter((p) => p.injury);
  // v2.0 伤病卡颜色：伤停 ≥1 个完整赛季（82 场）→ 红卡；其余伤停 → 黄卡
  const injClass = (p: Player) => (!p.injury ? '' : p.injury.games >= 82 ? 'inj-season' : 'inj-out');

  return (
    <div className="view">
      <div className="status-strip">
        <div className="chip strong">{me.city} {me.name}</div>
        <div className="chip">战绩 {me.win}-{me.loss}</div>
        <div className="chip">阵容 {me.players.length} 人（交易期 13-17，开季 15）</div>
        {injured.length > 0
          ? <div className="chip injury-chip">🏥 伤停：{injured.map((p) => `${p.name}（${p.injury!.games}场）`).join('、')}</div>
          : <div className="chip">🏥 无伤停</div>}
      </div>

      {notice && <div className="err-banner info" onClick={() => setNotice(null)}>{notice}（点击关闭）</div>}

      {/* v1.2 球队气质：化学反应/纪律/商业价值/粉丝（随赛后随机事件变化） */}
      <div className="team-meta-panel" style={{ marginBottom: 10 }}>
        <div className="action-title" title="化学反应提升季后赛表现 · 纪律提升常规赛稳定性（减少爆冷） · 粉丝量比拼临时提升表现（主场粉丝默认 +30% 加成）">
          📊 球队气质
        </div>
        <div className="team-meta-grid">
          <div className="meta-item">
            <span className="meta-label">🤝 化学反应</span>
            <div className="attr-track"><div className="attr-fill" style={{ width: `${me.chemistry}%` }} /></div>
            <span className="meta-val">{Math.round(me.chemistry)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">📋 纪律</span>
            <div className="attr-track"><div className="attr-fill" style={{ width: `${me.discipline}%` }} /></div>
            <span className="meta-val">{me.discipline}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">💰 商业价值</span>
            <div className="attr-track"><div className="attr-fill" style={{ width: `${me.brand}%` }} /></div>
            <span className="meta-val">{me.brand}</span>
          </div>
          <div className="meta-item fans">
            <span className="meta-label">🔥 粉丝</span>
            <span className="meta-val">{me.fans} 万</span>
          </div>
        </div>
        {(() => {
          const style = TEAM_STYLES.find((s) => s.id === me.style);
          const coach = COACH_STYLES.find((s) => s.id === me.coachStyle);
          const bonds: [string, number][] = (() => {
            const cnt: Record<string, number> = {};
            for (const p of me.players) for (const t of p.tags ?? []) cnt[t] = (cnt[t] ?? 0) + 1;
            return Object.entries(cnt).filter(([, n]) => n >= 2);
          })();
          if (!style && !coach && bonds.length === 0) return null;
          return (
            <div className="team-meta-extra">
              {style && <span className="meta-chip">{style.icon} 风格：{style.name}</span>}
              {coach && <span className="meta-chip">{coach.icon} 执教：{coach.name}</span>}
              {bonds.length > 0 && (
                <span className="meta-chip bonds" title="同队同标签 ≥2 人组成羁绊：每多 1 名队友 +0.12pp 进攻（比赛内生效）">
                  🤝 羁绊：{bonds.map(([t, n]) => `${t}×${n}`).join(' · ')}
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {/* 轮换与战术（v0.3.1 / v1.0 错位修复：不用 action-card 的 flex 布局，改用块级 rot-panel） */}
      <div className="rot-panel" style={{ marginBottom: 10 }}>
        <div className="action-title" style={{ cursor: 'pointer' }} onClick={() => setShowRot(!showRot)}>
          ⏱ 轮换与战术 {showRot ? '▾' : '▸'}
          {manual && <span className="tag-starter" style={{ marginLeft: 8 }}>自定义生效中</span>}
        </div>
        {showRot && (
          <>
            <div className="rot-toolbar">
              <span className="dim">战术发起位置（PlayCall）：</span>
              {POS_LIST.map((pos) => (
                <button
                  key={pos}
                  className={`chip-btn ${me.initiator === pos ? 'on' : ''}`}
                  onClick={() => { me.initiator = pos; api.tick(); }}
                >{POS_CN[pos]}</button>
              ))}
              <span className="spacer" />
              <button className="btn sm" onClick={resetAll} title="清除所有自定义分钟与球权，恢复引擎自动轮换">↺ 恢复自动轮换</button>
            </div>
            {Object.entries(posTotal).map(([pos, sum]) =>
              sum > MIN_MAX ? (
                <div className="warn-text" key={pos} style={{ marginTop: 4 }}>
                  ⚠️ {POS_CN[pos]}位置自定义分钟合计 {Math.round(sum)} 超过 48：引擎会按比例优先满足，超出的部分不会兑现。
                </div>
              ) : null
            )}
            <div className="rot-grid rot-head">
              <span />
              <span>球员</span><span>位置</span><span>分钟/场（0-48）</span><span>球权权重（0-10）</span>
            </div>
            <div className="rot-grid-wrap">
              {me.players.map((p) => {
                const idx = depthIdx(p);
                const auto = AUTO_MINUTES[Math.min(idx, AUTO_MINUTES.length - 1)];
                return (
                  <div className={`rot-grid rot-row ${p.min != null ? 'custom' : ''} ${injClass(p)}`} key={p.id}>
                    <span className={`rc-ovr sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                    <span className="rot-name" title={`NBA 第 ${p.exp} 年 · 潜力 ${p.potential} 星 · 位置 ${p.pos}/${p.secPos}${p.injury ? ` · 🏥伤停${p.injury.games}场` : ''}`}>
                      {p.name}{p.injury && <span className="injury-tag">🏥</span>}
                    </span>
                    <span className="rot-pos">{POS_CN[p.pos]}/{POS_CN[p.secPos]}</span>
                    <span className="rot-min">
                      <button className="btn sm" onClick={() => setMin(p, (p.min ?? auto) - 1)} disabled={(p.min ?? auto) <= 0}>−</button>
                      <input
                        type="number" min={0} max={48}
                        value={p.min ?? ''}
                        placeholder={String(auto)}
                        title={p.min != null ? `自动档约 ${auto} 分钟` : '留空 = 按深度自动'}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (e.target.value === '' || Number.isNaN(v)) { p.min = null; api.tick(); return; }
                          setMin(p, v);
                        }}
                      />
                      <button className="btn sm" onClick={() => setMin(p, (p.min ?? auto) + 1)} disabled={(p.min ?? auto) >= MIN_MAX}>+</button>
                    </span>
                    <span className="rot-usage">
                      <input
                        type="number" min={0} max={10}
                        value={p.usage ?? ''}
                        placeholder="自动"
                        onChange={(e) => {
                          if (e.target.value === '') { setUsage(p, null); return; }
                          setUsage(p, Number(e.target.value));
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="roster-cols">
        {POS_LIST.map((pos) => {
          const list = me.players.filter((p) => p.pos === pos);
          return (
            <div
              className={`pos-col ${dropPos === pos ? 'drop-target' : ''} ${canDropTo(pos) ? 'dropable' : ''}`}
              key={pos}
              onDragOver={(e) => onDragOver(e, pos)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, pos)}
            >
              <div className="pos-head">
                {POS_CN[pos]} <span className="dim">({pos} ×{list.length})</span>
                {posTotal[pos] != null && <span className="dim"> · {Math.round(posTotal[pos])}min</span>}
                {dropPos === pos && <span className="drop-hint">松开换位</span>}
              </div>
              {list.map((p, i) => (
                <div
                  className={`roster-card ${i === 0 ? 'starter' : ''} ${dragPid === p.id ? 'dragging' : ''} ${injClass(p)}`}
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onDragEnd={() => { setDragPid(null); setDropPos(null); }}
                  onClick={() => setSel(p)}
                  title={`${p.name} 可打 ${POS_CN[p.pos]}/${POS_CN[p.secPos]} · 拖到另一位置列可主副互换`}
                >
                  <div className="rc-left">
                    <PlayerFace p={p} size="xs" abbr={me.abbr} />
                    <span className={`rc-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                    <div className="rc-info">
                      <div className="rc-name">{p.name}{i === 0 && <span className="tag-starter">首发</span>}{p.injury && <span className="injury-tag">🏥{p.injury.games}场</span>}</div>
                      <div className="rc-sub">{p.age}岁 · 潜{p.potential}星 · {POS_CN[p.pos]}/{POS_CN[p.secPos]}{p.min != null ? ` · ⏱${p.min}min` : ''}</div>
                      {(p.tags ?? []).length > 0 && (
                        <div className="rc-tags" title="羁绊标签：同队同标签 ≥2 人组成羁绊（比赛内加成）">
                          {p.tags.map((t) => <span className="tag-badge xs" key={t}>{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rc-mid">{perGame(p).pts.toFixed(1)}分 {perGame(p).reb.toFixed(1)}板 {perGame(p).ast.toFixed(1)}助</div>
                  <div className="rc-right">
                    <span className="rc-salary">{money(p.salary)}</span>
                    <span className="move-btns" onClick={(e) => e.stopPropagation()}>
                      <button disabled={i === 0} onClick={() => move(pos, i, -1)}>↑</button>
                      <button disabled={i === list.length - 1} onClick={() => move(pos, i, 1)}>↓</button>
                    </span>
                  </div>
                </div>
              ))}
              {list.length === 0 && <div className="pos-empty">空缺（拖入球员）</div>}
            </div>
          );
        })}
      </div>

      {sel && <PlayerModal player={sel} team={me} onClose={() => setSel(null)} />}
    </div>
  );
}

export type { LeagueState };
