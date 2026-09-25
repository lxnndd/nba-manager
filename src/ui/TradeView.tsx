// 交易视图：我方 ↔ 对方（球员 + 未来首轮签筹码），估值/劳资/阵容规则评估后执行
// v0.3.1：估值模型按 2016-2026 真实交易结构校准（潜力成长 vs 即战力折损 + 选秀权资产包）；
//         劳资限制：超奢侈税线（1.87 亿）球队交易后薪金不得增加、不得打包；2 亿美元硬顶。
import { useMemo, useState } from 'react';
import type { DraftPick, LeagueState, Player, Team } from '../engine/types';
import {
  evaluateTrade, applyTrade, tradeValue, pickValue, pickLabel, teamStrength,
  payrollOf, SALARY_CAP, TAX_LINE, HARD_CAP, TRADE_DEADLINE_DAY, searchTrades, searchTradeTargets,
  teamPhase, phaseLabel, phaseValue, phasePickWeight,
  type TradeSuggestion, type TargetSuggestion,
} from '../engine/league';
import { POS_CN, money, perGameLine, ovrClass } from './format';
import { TeamLogo } from './TeamLogo';
import { PlayerFace } from './PlayerFace';
import { PlayerModal } from './PlayerModal';
import type { GameApi } from './useGame';

export function TradeView({ api }: { api: GameApi }) {
  const l = api.league!;
  const me = l.teams[l.userTeamId];
  const others = l.teams.filter((t) => t.id !== me.id);
  // v2.3：选秀权按「年份 → 轮次 → 原属队」排序展示（每队未来 3 年 × 首轮/次轮 = 6 枚）
  const sortPicks = (arr: { pk: DraftPick; i: number }[]) =>
    [...arr].sort((a, b) => a.pk.year - b.pk.year || a.pk.round - b.pk.round || a.pk.f - b.pk.f);
  const [targetId, setTargetId] = useState<number>(others[0]?.id ?? -1);
  const target = l.teams.find((t) => t.id === targetId) ?? others[0];
  const [giveIds, setGiveIds] = useState<number[]>([]);
  const [wantIds, setWantIds] = useState<number[]>([]);
  const [givePicks, setGivePicks] = useState<number[]>([]);
  const [wantPicks, setWantPicks] = useState<number[]>([]);
  // v2.0 自动预检：只要双方都选了筹码，就实时评估能否交易（无需再点"报价"）
  const [view, setView] = useState<{ p: Player; t: Team } | null>(null);
  // v2.3.0 交易搜索器：勾选自己的筹码 → 搜出全联盟愿意接受的组合
  const [searchResults, setSearchResults] = useState<TradeSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  // v1.0.1：搜索器结果不再分页/折叠，直接全部显示（原"显示全部 N 条"按钮已移除）
  // v2.6.0：搜索器两种模式 —— give = 我出筹码看各队给什么；want = 我想要谁、算我要付什么
  const [searchMode, setSearchMode] = useState<'give' | 'want'>('give');
  const [targetResults, setTargetResults] = useState<TargetSuggestion[] | null>(null);

  const toggle = (arr: number[], id: number): number[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : arr.length >= 5 ? arr : [...arr, id];
  const togglePick = (arr: number[], idx: number): number[] =>
    arr.includes(idx) ? arr.filter((x) => x !== idx) : [...arr, idx];

  const myGive = me.players.filter((p) => giveIds.includes(p.id));
  const theirGive = target ? target.players.filter((p) => wantIds.includes(p.id)) : [];

  const myPicks = sortPicks(l.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === me.id));
  const theirPicks = target
    ? sortPicks(l.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === target.id))
    : [];

  const valuation = useMemo(() => {
    if ((!giveIds.length && !givePicks.length) || (!wantIds.length && !wantPicks.length) || !target) return null;
    const gv = myGive.reduce((s, p) => s + tradeValue(p), 0) + givePicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
    const wv = theirGive.reduce((s, p) => s + tradeValue(p), 0) + wantPicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]), 0);
    // v2.5.1：同时给出「按我方/对方球队阶段折算后」的价值（决策用的就是折算值）
    const myPh = teamPhase(me, l), theirPh = teamPhase(target, l);
    const myPhaseVal = myGive.reduce((s, p) => s + phaseValue(p, myPh), 0)
      + givePicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]) * phasePickWeight(myPh), 0);
    const theirPhaseVal = theirGive.reduce((s, p) => s + phaseValue(p, theirPh), 0)
      + wantPicks.reduce((s, i) => s + pickValue(l, l.draftPool[i]) * phasePickWeight(theirPh), 0);
    return { gv, wv, myPhaseVal, theirPhaseVal };
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
    setSearchResults(null);
    api.tick();
  };

  // v2.3.0 交易搜索：以"我送出的筹码"为输入，遍历全联盟找可成交组合
  const runSearch = () => {
    if (searching) return;
    if (!giveIds.length && !givePicks.length) {
      setSearchMsg('先在左侧勾选至少一名球员或一枚选秀权（可以多选），再点搜索。');
      return;
    }
    setSearching(true);
    setSearchMsg(null);
    setTimeout(() => {
      try {
        const res = searchTrades(l, giveIds, givePicks, 3);
        setSearchResults(res);
        setSearchMsg(res.length
          ? `找到 ${res.length} 个可行组合（${new Set(res.map((r) => r.teamId)).size} 支球队）`
          : '没有球队愿意接受当前筹码——试试换更值钱的筹码，或勾选多几名球员（AI 常常想要打包）。');
      } catch (e) {
        setSearchMsg(`搜索失败：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSearching(false);
      }
    }, 10);
  };

  // 采用搜索结果：填入左右两栏（不直接成交，玩家可再核对）
  const applySuggestion = (s: TradeSuggestion) => {
    setTargetId(s.teamId);
    setGiveIds(s.givePids);
    setGivePicks(s.givePickIdx);
    setWantIds(s.wantPids);
    setWantPicks(s.wantPickIdx);
    setSearchResults(null);
    setSearchMsg('已填入下方筹码，核对后点「确认交易」执行。');
    api.tick();
  };

  // 直接成交（evaluateTrade 已验证过，且再次确认）
  const executeSuggestion = (s: TradeSuggestion) => {
    const v = evaluateTrade(l, me.id, s.teamId, s.givePids, s.wantPids, s.givePickIdx, s.wantPickIdx);
    if (!v.accept) { setSearchMsg(`该方案已不可行：${v.reason}`); setSearchResults(null); setTargetResults(null); return; }
    applyTrade(l, me.id, s.teamId, s.givePids, s.wantPids, s.givePickIdx, s.wantPickIdx);
    setSearchResults(null);
    setTargetResults(null);
    setSearchMsg(`✅ 交易完成：${s.note}`);
    setGiveIds([]); setWantIds([]); setGivePicks([]); setWantPicks([]);
    api.tick();
  };

  // v2.6.0 反向报价搜索：选定"我想要的对方球员/签" → 算出我需要付什么
  const runTargetSearch = () => {
    if (searching) return;
    if (!wantIds.length && !wantPicks.length) {
      setSearchMsg('先在右侧「我要的」里点选你想要的球员或选秀权（可多选），再点「生成报价方案」。');
      return;
    }
    setSearching(true);
    setSearchMsg(null);
    setTimeout(() => {
      try {
        const res = searchTradeTargets(l, wantIds, wantPicks, 3);
        setTargetResults(res);
        setSearchMsg(res.length
          ? `对方愿意接受 ${res.length} 种报价（${new Set(res.map((r) => r.teamId)).size} 支球队）——可直接「📨 发送报价」成交`
          : '对方不愿意放人：他可能是非卖品（核心/招牌球员），或你的筹码与他的身价不匹配——试试加一枚首轮签，或换成更值钱的球员。');
      } catch (e) {
        setSearchMsg(`搜索失败：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSearching(false);
      }
    }, 10);
  };

  // v2.6.0：搜索结果行（正向/反向搜索共用同一套渲染）
  const suggestionRow = (s: TradeSuggestion, i: number) => {
    const t = l.teams[s.teamId];
    // v2.5.0：搜索器里的球员都要显示位置与能力值（我方也显示）
    const pDesc = (team: Team, pid: number) => {
      const p = team.players.find((q) => q.id === pid);
      return p ? `${p.name}（${p.pos}/${p.secPos} · OVR ${p.ovr} · ${p.age}岁）` : '?';
    };
    const outNames = [
      ...s.givePids.map((pid) => pDesc(me, pid)),
      ...s.givePickIdx.map((idx) => pickLabel(l, l.draftPool[idx])),
    ];
    const inNames = [
      ...s.wantPids.map((pid) => pDesc(t, pid)),
      ...s.wantPickIdx.map((idx) => pickLabel(l, l.draftPool[idx])),
    ];
    const tv = s as Partial<TargetSuggestion>;
    return (
      <div className={`search-row ${s.needsMore ? 'needs-more' : ''}`} key={`${s.teamId}-${i}`}>
        <div className="sr-head">
          <TeamLogo abbr={t.abbr} size="xs" />
          <b>{t.city} {t.name}</b>
          <span className="dim">{t.win}-{t.loss}</span>
          <span className={`chip phase-${teamPhase(t, l)} sr-phase`}>{phaseLabel(teamPhase(t, l))}</span>
          {s.needsMore && <span className="sr-tag">需追加筹码</span>}
          <span className={`sr-gain ${s.gain >= 0 ? 'good' : 'bad'}`}>
            {s.gain >= 0 ? `你赚 ${s.gain.toFixed(1)}` : `你亏 ${(-s.gain).toFixed(1)}`}
          </span>
        </div>
        <div className="sr-body">
          <span className="sr-out">送出 {outNames.join('、')}</span>
          <span className="sr-arrow">⇄</span>
          <span className="sr-in">得到 {inNames.join('、')}</span>
        </div>
        {tv.myGiveVal != null && tv.myGetVal != null && (
          <div className="sr-vals dim">
            我方折算：付出 {tv.myGiveVal.toFixed(1)} ↔ 得到 {tv.myGetVal.toFixed(1)}（净值 {s.gain >= 0 ? '+' : ''}{s.gain.toFixed(1)}）
          </div>
        )}
        <div className="sr-foot">
          <span className="dim">{s.reason}</span>
          <div className="btn-row">
            <button className="btn sm" onClick={() => applySuggestion(s)}>填入筹码</button>
            <button className="btn primary sm" onClick={() => executeSuggestion(s)}>
              {searchMode === 'want' ? '📨 发送报价' : '✓ 直接成交'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!target) return null;

  // v2.5.0：休赛期交易窗口（乐透抽签后 3 天，offseasonStep=1 期间）也开放交易
  const offseasonWindow = l.offseason && l.offseasonStep <= 1 && (l.offseasonTradeDays ?? 0) > 0;
  if (!offseasonWindow && l.day >= TRADE_DEADLINE_DAY) {
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
  // v2.5.0：对方球队阶段（争冠 >85 / 补强 80-85 / 重建 <80，按队内最强 5 人平均 OVR）
  const targetPhase = teamPhase(target, l);
  const myPhase = teamPhase(me, l);
  const phaseHint = targetPhase === 'contender'
    ? '争冠队：看重当下战力，只把球员的"未来溢价"（潜力/年龄）算 6 折——愿意用选秀权和潜力股换即战力；当下更弱的球员不会因为年轻就被高估'
    : targetPhase === 'retool'
      ? '补强队：较为看重即时战力（未来溢价 9 折、选秀权 9 折）'
      : '重建队：非常重视未来资产——未来溢价与选秀权都按 1.35 倍算，老将的年龄折损按 1.35 倍放大（更不值钱）';
  const payState =
    pay > HARD_CAP ? '⚠️ 超过 2 亿硬顶（规则上不可能）'
      : pay > TAX_LINE ? `超奢侈税线 ${money(pay - TAX_LINE)} · apron 限制生效`
        : pay > SALARY_CAP ? `帽上 ${money(pay - SALARY_CAP)}`
          : `帽下空间 ${money(SALARY_CAP - pay)}`;

  // v2.5.0：锁定球员（锁定的不会被 AI 报价 / 搜索器不会把他算作可动筹码）
  const locked = new Set(l.lockedPids ?? []);
  const toggleLock = (pid: number) => {
    const cur = l.lockedPids ?? [];
    l.lockedPids = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
    api.tick();
  };

  const row = (p: Player, sel: boolean, onPick: () => void, team: Team) => {
    const isMine = team.id === me.id;
    const isLocked = locked.has(p.id);
    return (
      <div className={`pick-row ${sel ? 'sel' : ''} ${isLocked ? 'locked' : ''}`} key={p.id}
        onClick={onPick}
        title={`OVR ${p.ovr} · ${p.pos}/${p.secPos} · ${p.age}岁 · 潜力 ${p.potential} · ${p.contractYears > 0 ? `剩${p.contractYears}年合同` : '无合同'}${isLocked ? '（已锁定：不会被 AI 报价）' : ''}`}>
        <span className="pl-face" title={`OVR ${p.ovr}`}><PlayerFace p={p} size="sm" /></span>
        <span className="pl-name" title="点击查看球员详情" onClick={(e) => { e.stopPropagation(); setView({ p, t: team }); }}>{p.name}</span>
        <span className="pl-ovr"><span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span></span>
        <span className="pl-pos">{POS_CN[p.pos]}{p.secPos && p.secPos !== p.pos ? `/${POS_CN[p.secPos]}` : ''}</span>
        <span className="pl-stats">{perGameLine(p)}</span>
        <span className="pl-salary">{money(p.salary)}</span>
        <span className="pl-val" title="交易价值：75 能力=1.0、每 +10 翻倍，含潜力成长/年龄折损±合同性价比；能力档位 <75 半价 / 75-79 八折 / 85-89 涨 20% / ≥90 涨 40%；按球员的基准位置计算，与你在阵容里把他摆在哪个位置无关">估值 {tradeValue(p).toFixed(1)}</span>
        {isMine && (
          <button
            className={`lock-btn ${isLocked ? 'on' : ''}`}
            title={isLocked ? '已锁定：AI 不会向你报价这名球员（点击解锁）' : '锁定：禁止 AI 为这名球员向你报价'}
            onClick={(e) => { e.stopPropagation(); toggleLock(p.id); }}
          >{isLocked ? '🔒' : '🔓'}</button>
        )}
      </div>
    );
  };

  const pickRow = (idx: number, sel: boolean, onPick: () => void) => {
    const pk = l.draftPool[idx];
    const f = l.teams[pk.f];
    return (
      <div className={`pick-row pick-row-slim ${sel ? 'sel' : ''}`} key={idx} onClick={onPick}
        title={`${pickLabel(l, pk)}：顺位质量按 ${f.abbr}（${f.city} ${f.name}）当季战绩实时推算；年份越远折价（不确定性）`}>
        <span className="pl-ico">{pk.round === 1 ? '🎓' : '🎫'}</span>
        <span className="pl-name">{pickLabel(l, pk)}</span>
        <span className="pl-pos dim">{f.win}-{f.loss}</span>
        <span className="pl-stats dim">{pk.round === 1 ? '首轮' : '次轮'}</span>
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
        {/* v2.5.0：对方球队阶段（重建/补强/争冠）——决定它看重未来资产还是即时战力 */}
        <div className={`chip phase-${targetPhase}`} title={phaseHint}>
          {target.abbr} 定位：{phaseLabel(targetPhase)}
        </div>
        {offseasonWindow && (
          <div className="chip strong">🔁 休赛期交易窗口（乐透抽签后 {l.offseasonTradeDays} 天）</div>
        )}
        <div className={`chip phase-${myPhase}`} title="你的球队定位（按队内最强 5 人平均 OVR）">
          我方定位：{phaseLabel(myPhase)}
        </div>
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
          <span className="dim"></span>
          </div>
          <div className="pick-list">
            {[...me.players].sort((a, b) => b.ovr - a.ovr).map((p) =>
              row(p, giveIds.includes(p.id), () => { setGiveIds(toggle(giveIds, p.id)); }, me)
            )}
          </div>
          {myPicks.length > 0 && (
            <div className="pick-list picks">
              <div className="col-sub">🎓 我的选秀权（未来 3 年 · 首轮/次轮 · 可交易）</div>
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
            <span className="dim">按 {phaseLabel(targetPhase)} 定位估值</span>
          </div>
          <div className="pick-list">
            {[...target.players].sort((a, b) => b.ovr - a.ovr).map((p) =>
              row(p, wantIds.includes(p.id), () => { setWantIds(toggle(wantIds, p.id)); }, target)
            )}
          </div>
          {theirPicks.length > 0 && (
            <div className="pick-list picks">
              <div className="col-sub">🎓 {target.abbr} 持有的选秀权（未来 3 年 · 可索要）</div>
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
              {valuation && (
                <>
                  （市场估值 {valuation.gv.toFixed(1)} ↔ {valuation.wv.toFixed(1)}
                  ；我方折算 {valuation.myPhaseVal.toFixed(1)} ↔ 对方折算 {valuation.theirPhaseVal.toFixed(1)}）
                </>
              )}
            </span>
          )}
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={!verdict?.accept} onClick={confirmTrade}>
            ✓ 确认交易（对方将对等接受后执行）
          </button>
          <span className="dim"></span>
        </div>
        {verdict && (
          <div className={`verdict ${verdict.accept ? 'ok' : 'no'}`}>
            {verdict.accept ? '✅ ' : '❌ '}{verdict.reason}
          </div>
        )}
      </div>

      {/* ===== v2.3.0 交易搜索器（v2.6.0 加反向报价：想要谁 → 算我要付什么）===== */}
      <div className="action-card trade-search">
        <div className="action-title">🔍 交易搜索器</div>
        <div className="tabs small" style={{ marginBottom: 8 }}>
          <button className={`tab ${searchMode === 'give' ? 'on' : ''}`}
            onClick={() => { setSearchMode('give'); setSearchMsg(null); }}>
            ① 我出筹码 → 各队给什么
          </button>
          <button className={`tab ${searchMode === 'want' ? 'on' : ''}`}
            onClick={() => { setSearchMode('want'); setSearchMsg(null); }}>
            ② 我想要谁 → 算我要付什么（发送报价）
          </button>
        </div>
        {searchMode === 'give' ? (
          <>
            <div className="btn-row">
              <button className="btn primary" disabled={searching} onClick={runSearch}>
                {searching ? '⏳ 搜索中…' : '🔍 搜索可行交易'}
              </button>
              <span className="dim">当前筹码：{giveIds.length} 名球员 + {givePicks.length} 枚签</span>
              {searchResults && <button className="btn sm" onClick={() => setSearchResults(null)}>清空结果</button>}
            </div>
          </>
        ) : (
          <>
            <div className="btn-row">
              <button className="btn primary" disabled={searching} onClick={runTargetSearch}>
                {searching ? '⏳ 计算中…' : '🎯 生成报价方案'}
              </button>
              <span className="dim">目标：{wantIds.length} 名球员 + {wantPicks.length} 枚签</span>
              {targetResults && <button className="btn sm" onClick={() => setTargetResults(null)}>清空结果</button>}
            </div>
          </>
        )}
        {searchMsg && (
          <div className={`verdict ${(searchMode === 'give' ? searchResults?.length : targetResults?.length) ? 'ok' : 'no'}`}>
            {searchMsg}
          </div>
        )}
        {/* 模式 ①：按「当前筹码即可成交 / 需追加筹码」分组 */}
        {searchMode === 'give' && searchResults && searchResults.length > 0 && (() => {
          const direct = searchResults.filter((s) => !s.needsMore);
          const upgrade = searchResults.filter((s) => s.needsMore);
          return (
            <div className="search-list">
              {direct.length > 0 && (
                <div className="sr-group">✓ 用当前筹码即可成交（{direct.length} 条）</div>
              )}
              {direct.map(suggestionRow)}
              {upgrade.length > 0 && (
                <div className="sr-group warn">
                  ⚠ 对方还想多要人（{upgrade.length} 条）
                </div>
              )}
              {upgrade.map(suggestionRow)}
            </div>
          );
        })()}
        {/* 模式 ②：反向报价（按我方净收益排序） */}
        {searchMode === 'want' && targetResults && targetResults.length > 0 && (
          <div className="search-list">
            <div className="sr-group">
              ✅ 对方愿意接受这些报价（{targetResults.length} 条，按你的净收益排序）
            </div>
            {targetResults.map(suggestionRow)}
          </div>
        )}
      </div>

      {view && <PlayerModal player={view.p} team={view.t} onClose={() => setView(null)} />}
    </div>
  );
}

export type { Player };
