// 阵容视图：五位置深度卡 + 轮换/球权/战术自定义（v0.3.1）+ 位置拖拽换位（v0.3.7）
import { useState } from 'react';
import type { LeagueState, Player, Pos } from '../engine/types';
import { manualRotation, targetMinutes, AUTO_MINUTES } from '../engine/sim';
import { repositionPlayer, TEAM_STYLES, COACH_STYLES } from '../engine/gen';
import { POS_CN, money, ovrClass, perGameLineOf } from './format';
import { PlayerModal } from './PlayerModal';
import { PlayerFace } from './PlayerFace';
import type { GameApi } from './useGame';

const POS_LIST: Pos[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const MIN_MAX = 48;

export function RosterView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const [sel, setSel] = useState<Player | null>(null);
  const [dragPid, setDragPid] = useState<number | null>(null);
  const [dropPos, setDropPos] = useState<Pos | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // v2.7.1：点开"风格 / 执教 / 羁绊"查看详情
  const [info, setInfo] = useState<{ kind: 'team' | 'coach' | 'bond'; id?: string } | null>(null);
  // v2.5.0：常规赛结束后（季后赛进行中/已结束）阵容页切换显示季后赛数据
  const poMode = l.playoffRounds.length > 0;
  // v2.7.1：羁绊统计提到组件层（气质面板与详情弹窗共用）
  const bonds: [string, number][] = (() => {
    const cnt: Record<string, number> = {};
    for (const p of me.players) for (const t of p.tags ?? []) cnt[t] = (cnt[t] ?? 0) + 1;
    return Object.entries(cnt).filter(([, n]) => n >= 2);
  })();

  // v2.7.2：去掉卡片上的 ↑↓ 按钮，改为**拖动**排序（同列拖动=调整轮换顺序；拖到另一列=主副互换）
  const [overCard, setOverCard] = useState<{ pos: Pos; idx: number } | null>(null);
  const autoMinOf = (p: Player) => {
    const same = me.players.filter((q) => q.pos === p.pos);
    const idx = same.indexOf(p);
    return AUTO_MINUTES[Math.min(Math.max(idx, 0), AUTO_MINUTES.length - 1)];
  };
  const dropOnCard = (e: React.DragEvent, pos: Pos, idx: number) => {
    e.preventDefault();
    e.stopPropagation(); // 别冒泡到 .pos-col（那是"拖到列上"的主副互换）
    const pid = Number(e.dataTransfer.getData('text/plain')) || dragPid;
    setDragPid(null);
    setDropPos(null);
    setOverCard(null);
    if (!pid) return;
    const dragged = me.players.find((p) => p.id === pid);
    if (!dragged) return;
    if (dragged.pos === pos) {
      // 同一位置内：拖到第 idx 张卡片处（重新排序）
      const same = me.players.filter((p) => p.pos === pos);
      const from = same.findIndex((p) => p.id === pid);
      if (from === -1 || from === idx) return;
      const arr = [...same];
      const [moved] = arr.splice(from, 1);
      arr.splice(idx, 0, moved);
      const slots = me.players.map((p, i) => (p.pos === pos ? i : -1)).filter((i) => i >= 0);
      slots.forEach((gi, k) => { me.players[gi] = arr[k]; });
      api.tick();
    } else if (dragged.secPos === pos) {
      // 拖到自己能打的另一个位置 → 主副互换
      const res = repositionPlayer(me, pid, pos);
      api.tick();
      setNotice(`🏀 ${res.moved.name} 改打 ${POS_CN[pos]}（${POS_CN[res.moved.secPos]} ↔ ${POS_CN[pos]} 主副互换），能力值已按新位置适配`);
    }
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
          if (!style && !coach && bonds.length === 0) return null;
          return (
            <div className="team-meta-extra">
              {style && (
                <button className="meta-chip clickable" onClick={() => setInfo({ kind: 'team', id: style.id as string })}>
                  {style.icon} 风格：{style.name}<span className="chip-more">详情 ›</span>
                </button>
              )}
              {coach && (
                <button className="meta-chip clickable" onClick={() => setInfo({ kind: 'coach', id: coach.id as string })}>
                  {coach.icon} 执教：{coach.name}<span className="chip-more">详情 ›</span>
                </button>
              )}
              {bonds.length > 0 && (
                <button className="meta-chip bonds clickable" onClick={() => setInfo({ kind: 'bond' })}>
                  🤝 羁绊：{bonds.map(([t, n]) => `${t}×${n}`).join(' · ')}<span className="chip-more">详情 ›</span>
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* v1.0.1：原「轮换与战术」面板已移除——分钟/球权在位置卡片里改，战术发起位置点位置标题即可。
          这里只留一条状态与重置工具条。 */}
      <div className="rot-bar" style={{ marginBottom: 10 }}>
        <span className="dim">{manual ? '⚙️ 自定义分钟/球权生效中' : '⚙️ 自动轮换'}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={resetAll}>↺ 恢复自动轮换</button>
      </div>
      {Object.entries(posTotal).filter(([, sum]) => sum > MIN_MAX).map(([pos, sum]) => (
        <div className="warn-text" key={pos}>⚠️ {POS_CN[pos]} 位置分钟合计 {Math.round(sum)} 超过 48，超出部分不会兑现</div>
      ))}

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
              {/* v2.7.1：战术发起位置与位置卡片合并——点这一列的标题即设为本队战术发起位置 */}
              <div
                className={`pos-head ${me.initiator === pos ? 'initiator' : ''}`}
                onClick={() => { me.initiator = pos; api.tick(); }}
                title={me.initiator === pos ? '当前战术发起位置（点其它位置可切换）' : '点击把这一位置设为战术发起位置'}
              >
                {me.initiator === pos && <span className="pos-init">🎯</span>}
                {POS_CN[pos]} <span className="dim">({pos} ×{list.length})</span>
                {posTotal[pos] != null && <span className="dim"> · {Math.round(posTotal[pos])}min</span>}
                {dropPos === pos && <span className="drop-hint">松开换位</span>}
              </div>
              {list.map((p, i) => (
                <div
                  className={`roster-card ${i === 0 ? 'starter' : ''} ${dragPid === p.id ? 'dragging' : ''} ${injClass(p)} ${overCard && overCard.pos === pos && overCard.idx === i ? 'drop-on' : ''}`}
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onDragEnd={() => { setDragPid(null); setDropPos(null); setOverCard(null); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragPid != null && dragPid !== p.id) setOverCard({ pos, idx: i }); }}
                  onDragLeave={() => setOverCard((c) => (c && c.pos === pos && c.idx === i ? null : c))}
                  onDrop={(e) => dropOnCard(e, pos, i)}
                  onClick={() => setSel(p)}
                  title={`${p.name} 可打 ${POS_CN[p.pos]}/${POS_CN[p.secPos]} · 同列拖动 = 调整轮换顺序，拖到另一列 = 主副互换`}
                >
                  <div className="rc-left">
                    <PlayerFace p={p} size="xs" abbr={me.abbr} />
                    <span className={`rc-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                    <div className="rc-info">
                      <div className="rc-name">{p.name}{i === 0 && <span className="tag-starter">首发</span>}{p.injury && <span className="injury-tag">🏥{p.injury.games}场</span>}</div>
                      <div className="rc-sub">{p.age}岁 · 潜{p.potential}星 · {POS_CN[p.pos]}/{POS_CN[p.secPos]}</div>
                      {(p.tags ?? []).length > 0 && (
                        <div className="rc-tags">
                          {p.tags.map((t) => <span className="tag-badge xs" key={t}>{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`rc-mid ${poMode ? 'po' : ''}`}>
                    {poMode ? `季后赛 ${perGameLineOf(p, true)}` : perGameLineOf(p, false)}
                  </div>
                  {/* v2.7.2：上场时间与球权权重搬进卡片（原在轮换表里），并去掉薪资与 ↑↓ 按钮 */}
                  <div className="rc-foot">
                    <span className="rc-field" onClick={(e) => e.stopPropagation()} title="场均上场时间（0-48）">
                      <span className="rf-label">时间</span>
                      <button className="rf-btn" disabled={(p.min ?? autoMinOf(p)) <= 0} onClick={() => setMin(p, (p.min ?? autoMinOf(p)) - 1)}>−</button>
                      <input
                        type="number" min={0} max={48}
                        value={p.min ?? ''}
                        placeholder={String(autoMinOf(p))}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (e.target.value === '' || Number.isNaN(v)) { p.min = null; api.tick(); return; }
                          setMin(p, v);
                        }}
                      />
                      <button className="rf-btn" disabled={(p.min ?? autoMinOf(p)) >= MIN_MAX} onClick={() => setMin(p, (p.min ?? autoMinOf(p)) + 1)}>+</button>
                    </span>
                    <span className="rc-field" onClick={(e) => e.stopPropagation()} title="球权权重（0-10）：越大越多持球与出手">
                      <span className="rf-label">球权</span>
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
                </div>
              ))}
              {list.length === 0 && <div className="pos-empty">空缺（拖入球员）</div>}
            </div>
          );
        })}
      </div>

      {/* v2.7.1：风格 / 执教 / 羁绊 详情弹窗 */}
      {info && (
        <div className="modal-mask" onClick={() => setInfo(null)}>
          <div className="modal info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                {info.kind === 'team' ? '🌪️ 球队风格' : info.kind === 'coach' ? '⛓️ 执教风格' : '🤝 羁绊'}
              </div>
              <button className="btn-ghost" onClick={() => setInfo(null)}>✕</button>
            </div>
            <div className="info-body">
              {info.kind === 'team' && TEAM_STYLES.map((s) => (
                <div className={`info-row ${s.id === info.id ? 'on' : ''}`} key={s.id}>
                  <div className="ir-title">{s.icon} {s.name}{s.id === info.id ? '（当前）' : ''}</div>
                  <div className="ir-desc">{s.desc}</div>
                </div>
              ))}
              {info.kind === 'coach' && COACH_STYLES.map((s) => (
                <div className={`info-row ${s.id === info.id ? 'on' : ''}`} key={s.id}>
                  <div className="ir-title">{s.icon} {s.name}{s.id === info.id ? '（当前）' : ''}</div>
                  <div className="ir-desc">{s.desc}</div>
                </div>
              ))}
              {info.kind === 'bond' && (
                bonds.length === 0
                  ? <div className="info-row"><div className="ir-desc">当前没有羁绊。</div></div>
                  : bonds.map(([tag, n]) => {
                    const k = Math.min(n - 1, 3);
                    const who = me.players.filter((p) => (p.tags ?? []).includes(tag)).map((p) => p.name).join('、');
                    return (
                      <div className="info-row on" key={tag}>
                        <div className="ir-title">{tag} ×{n}</div>
                        <div className="ir-desc">加成 +{(k * 0.12).toFixed(2)} 进攻 / +{(k * 0.06).toFixed(2)} 防守（比赛内生效）</div>
                        <div className="ir-desc dim">{who}</div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {sel && <PlayerModal player={sel} team={me} onClose={() => setSel(null)} />}
    </div>
  );
}

export type { LeagueState };
