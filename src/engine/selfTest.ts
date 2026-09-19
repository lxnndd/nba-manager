// 引擎数值自测：node 下直接运行（编译后）
// 验证：名单结构、比分分布、全季推进、季后赛、赛季奖项、休赛期（FA/AI交易）、存档迁移
import { createLeague, createRealLeague, repositionPlayer, bodyKeys, genRookie, genDraftClass, genFreeAgent, TEAM_STYLES, COACH_STYLES, applyTeamStyle, applyCoachStyle, assignTags, calcOvr, SKILL_KEYS, genSkills, POS_SEC } from './gen';
import { simulateGame, bondMods, teamEffMods } from './sim';
import { simDay, runPlayoffRound, simPlayoffGame, playoffChampion, evaluateTrade, applyTrade, standings, leaders, nextGameOf, playedCount, migrateSave, teamStrength, pickValue, tradeValue, ROSTER_MAX, payrollOf, SALARY_CAP, TAX_LINE, refreshPlayoffPlaceholders, tryAITradeOfferToUser, acceptTradeOffer, rejectTradeOffer, pickLabel, lotteryOrder, rookieScaleSalary, searchTrades, searchTradeTargets, GP_CAP, GP_TRADE_TOLERANCE, teamPhase, phaseLabel, phasePlayerWeight, phasePickWeight, phaseValue, tradeEff } from './league';
import { computeSeasonAwards, computeFinalsMVP } from './awards';
import { rollPostGameEvent, resolveTeamEvent } from './events';
import type { Player } from './types';
import {
  beginOffseason, settleFreeAgency, simulateOffseasonAI, simulateAIOffseasonTrades,
  finishOffseason, cutPlayer, askFor, signFreeAgentNow, agePlayer, growthPointsFor, timeCoefOf, agingPenaltyOf, spendPoint, autoDistribute, recalcOvr,
  draftComplete, draftIsUserTurn, draftPickUser, draftRemaining, draftFastToUserPick,
} from './offseason';
import { mulberry32 } from './rng';
import type { LeagueState } from './types';

let fails = 0;
function ok(cond: boolean, label: string) {
  if (!cond) { fails++; console.log('  !! 断言失败:', label); }
}
function checkRoster(l: LeagueState, tag: string, max = ROSTER_MAX) {
  for (const t of l.teams) {
    ok(t.players.length >= 13 && t.players.length <= max, `${tag} ${t.abbr} 名单人数 ${t.players.length}`);
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C']) {
      ok(t.players.some((p) => p.pos === pos), `${tag} ${t.abbr} 缺位置 ${pos}`);
    }
  }
}

function fullPlayoffs(l: LeagueState): number {
  // 季后赛不得污染常规赛统计（修复 92/82 bug 的回归断言）
  const before = new Map<number, number>();
  for (const t of l.teams) for (const p of t.players) before.set(p.id, p.gp);
  for (let r = 0; r < 4; r++) {
    runPlayoffRound(l, r);
    for (let i = 0; i < l.playoffRounds[r].series.length; i++) {
      const ser = l.playoffRounds[r].series[i];
      while (ser.awayWins < 4 && ser.homeWins < 4) simPlayoffGame(l, r, i);
    }
  }
  let same = true;
  for (const t of l.teams) for (const p of t.players) if (before.get(p.id) !== p.gp) { same = false; break; }
  ok(same, '季后赛不累计常规统计（gp 不超 82）');
  return playoffChampion(l) ?? -1;
}

// 休赛期全流程（含 FA 报价走查）+ 不变量断言
function runOffseasonFlow(l: LeagueState, tag: string, offerTest: boolean): void {
  computeSeasonAwards(l);
  const aw = l.awards;
  ok(!!aw && aw.season === l.season, `${tag} 奖项已评`);
  ok(!!aw?.mvp, `${tag} MVP 有主`);
  ok(!!aw?.dpoy, `${tag} DPOY 有主`);
  ok(!!aw?.sixth, `${tag} 最佳第六人有主`);
  ok(!!aw?.rookie, `${tag} 最佳新秀有主`);
  // v2.0：常规奖不含 FMVP；FMVP 由总决赛战报独立计算（冠军产生后）
  ok(!Object.prototype.hasOwnProperty.call(aw ?? {}, 'fmvp'), `${tag} 常规奖不含 FMVP 字段`);
  const fm = computeFinalsMVP(l);
  ok(!!fm, `${tag} 总决赛 FMVP 有主（冠军界面展示）`);
  const allNbaIds = aw?.allNba.flat().map((e) => e.playerId) ?? [];
  ok(new Set(allNbaIds).size === allNbaIds.length, `${tag} All-NBA 15 人无重复`);
  ok(!!aw && aw.allNba.every((team) => team.length === 5), `${tag} All-NBA 每阵 5 人`);
  // v2.0 一防二防：每阵 5 人无重复，后场 2 + 前场 3 结构
  ok(!!aw && aw.allDefense?.length === 2 && aw.allDefense.every((t) => t.length === 5), `${tag} All-Defense 两阵 ×5`);
  const defIds = aw?.allDefense.flat().map((e) => e.playerId) ?? [];
  ok(new Set(defIds).size === defIds.length, `${tag} All-Defense 10 人无重复`);
  // v2.5.0：新秀一阵/二阵各 5 人（此前二阵常常只剩 4 人）
  ok(!!aw && aw.allRookie?.length === 2, `${tag} 最佳新秀阵容分两阵`);
  ok(!!aw && aw.allRookie.every((t) => t.length === 5), `${tag} 新秀一阵/二阵各 5 人（${aw?.allRookie.map((t) => t.length).join(' / ')}）`);
  const rkIds = aw?.allRookie.flat().map((e) => e.playerId) ?? [];
  ok(new Set(rkIds).size === rkIds.length, `${tag} 新秀两阵 10 人无重复`);
  if (aw?.sixth) {
    const p = l.teams[aw.sixth.teamId].players.find((q) => q.id === aw.sixth!.playerId)!;
    ok(p.starts < p.gp / 2, `${tag} 第六人非首发（首发 ${p.starts}/${p.gp}）`);
  }
  if (aw?.rookie) {
    const p = l.teams[aw.rookie.teamId].players.find((q) => q.id === aw.rookie!.playerId)!;
    ok(p.exp === 1, `${tag} 最佳新秀为一年级`);
  }
  const mvpName = aw?.mvp ? l.teams[aw.mvp.teamId].players.find((q) => q.id === aw.mvp!.playerId)?.name : null;
  const fmName = fm ? l.teams[fm.teamId].players.find((q) => q.id === fm.playerId)?.name : null;
  console.log(`  ${tag} 奖项: MVP ${mvpName} · DPOY ${aw?.dpoy ? l.teams[aw.dpoy.teamId].players.find((q) => q.id === aw.dpoy!.playerId)?.name : '-'} · 常规 FMVP ${fmName}`);

  // ---------- v2.5.0：常规赛 / 季后赛数据分离 ----------
  {
    const allP = l.teams.flatMap((t) => t.players);
    const poPlayed = allP.filter((p) => p.poGp > 0);
    const maxGp = Math.max(...allP.map((p) => p.gp));
    // 跨队累计（赛季中被交易）会让个人总出场略超 82；92 场那种"季后赛污染常规赛"必须绝迹
    ok(maxGp <= 88, `${tag} 常规赛出场未被季后赛污染（最大 ${maxGp}，上限 82 + 交易容差）`);
    ok(poPlayed.length > 0, `${tag} 季后赛数据独立累计（出场 ${poPlayed.length} 人）`);
    ok(allP.every((p) => p.poGp <= 40), `${tag} 季后赛出场数合理（最大 ${Math.max(...allP.map((p) => p.poGp))}）`);
    ok(allP.every((p) => Object.keys(p.poStats ?? {}).length > 0), `${tag} 人人带 poStats 字段（含未出场者）`);
    const poTop = [...poPlayed].sort((a, b) => b.poStats.pts / Math.max(1, b.poGp) - a.poStats.pts / Math.max(1, a.poGp))[0];
    ok(!!poTop && poTop.poStats.pts > 0, `${tag} 季后赛场均榜可算（${poTop?.name} ${(poTop!.poStats.pts / Math.max(1, poTop!.poGp)).toFixed(1)} 分 / ${poTop?.poGp} 场）`);
    const poLeaders = leaders(l, 'pts', 1, true);
    ok(poLeaders.length > 0 && poLeaders[0].value > 0, `${tag} 季后赛数据榜可查（榜首 ${poLeaders[0]?.player.name} ${poLeaders[0]?.value.toFixed(1)}）`);
  }

  // ---------- v2.5.0：球队三状态（争冠 / 补强 / 重建）----------
  {
    const cnt = (ph: string) => l.teams.filter((t) => teamPhase(t) === ph).length;
    console.log(`  ${tag} 球队状态：争冠 ${cnt('contender')} · 补强 ${cnt('retool')} · 重建 ${cnt('rebuild')}`);
    ok(cnt('contender') + cnt('retool') + cnt('rebuild') === 30, `${tag} 30 队都有交易状态`);
    const mism: string[] = [];
    for (const t of l.teams) {
      const top5 = [...t.players].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
      const avg = top5.length ? top5.reduce((s, p) => s + p.ovr, 0) / top5.length : 0;
      const want = avg > 85 ? 'contender' : avg >= 80 ? 'retool' : 'rebuild';
      if (teamPhase(t) !== want) mism.push(`${t.abbr}(${avg.toFixed(1)})`);
    }
    ok(mism.length === 0, `${tag} 状态判定 = 首发 5 人均值阈值（异常 ${mism.length}）`);
    const young = { age: 22, exp: 1, ovr: 72, potential: 10, salary: 500 } as Player;
    const vet = { age: 32, exp: 9, ovr: 85, potential: 6, salary: 3000 } as Player;
    ok(phasePlayerWeight(young, 'rebuild') > phasePlayerWeight(young, 'contender'), `${tag} 年轻球员在重建队更值钱`);
    ok(phasePlayerWeight(vet, 'contender') > phasePlayerWeight(vet, 'rebuild'), `${tag} 老将在争冠队更值钱`);
    ok(phasePickWeight('rebuild') > phasePickWeight('retool') && phasePickWeight('retool') > phasePickWeight('contender'), `${tag} 选秀权估值 重建 > 补强 > 争冠`);
    // v2.5.1 回归断言：阶段偏好只作用于「未来溢价」，当下战力不打折 ——
    //   「更强且更年轻」的球员在任何球队阶段都必须比「更弱更老」的值钱
    //   （用户实例：争冠骑士眼中 87/24 岁莫布利曾被算成 ≈ 85/29 岁萨博尼斯）
    const better = { age: 24, exp: 3, ovr: 87, potential: 8, salary: 3000 } as Player;
    const worse = { age: 29, exp: 7, ovr: 85, potential: 6, salary: 3000 } as Player;
    const phases = ['contender', 'retool', 'rebuild'] as const;
    const badPh = phases.filter((ph) => phaseValue(better, ph) <= phaseValue(worse, ph));
    console.log(`  ${tag} 更强更年轻者估值：${phases.map((ph) => `${phaseLabel(ph)} ${phaseValue(better, ph).toFixed(2)} vs ${phaseValue(worse, ph).toFixed(2)}`).join(' · ')}`);
    ok(badPh.length === 0, `${tag} 更强更年轻的球员在任何阶段都更值钱（异常阶段 ${badPh.join('/')}）`);
    // 反面：争冠队仍应"愿为即战力买单"——老将的争冠折算价值高于其重建价值，且折算系数 > 1
    const vetHigh = { age: 33, exp: 12, ovr: 88, potential: 6, salary: 3000 } as Player;
    ok(phaseValue(vetHigh, 'contender') > phaseValue(vetHigh, 'rebuild'), `${tag} 同为老将：争冠队估值 > 重建队估值`);
    ok(phasePlayerWeight(vetHigh, 'contender') > 1, `${tag} 争冠队对老将给溢价（折算系数 ${phasePlayerWeight(vetHigh, 'contender')}）`);
    console.log(`  ${tag} 阶段标签：${(['contender', 'retool', 'rebuild'] as const).map((p) => phaseLabel(p)).join(' / ')}`);
  }

  // ---------- v2.5.0：休赛期账面处理快照（合同年递减 / 伤病跨季康复）----------
  const contractBefore = new Map<number, number>();
  for (const t of l.teams) for (const p of t.players) contractBefore.set(p.id, p.contractYears);
  for (const t of l.teams) {
    const p = t.players[0];
    if (p) p.injury = { type: '脚踝扭伤', games: 12 };
  }
  const injuredBefore = l.teams.reduce((s, t) => s + t.players.filter((p) => p.injury).length, 0);

  beginOffseason(l);
  ok(l.offseason && l.offseasonStep === 1, `${tag} 休赛期状态`);
  // v2.5.0：伤病跨季康复 + 合同年递减
  {
    const injuredAfter = l.teams.flatMap((t) => t.players).filter((p) => p.injury).length;
    ok(injuredBefore > 0 && injuredAfter === 0, `${tag} 伤病跨赛季全部康复（${injuredBefore} → ${injuredAfter}）`);
    const still = l.teams.flatMap((t) => t.players).filter((p) => contractBefore.has(p.id));
    // 只有"未到期"（减 1 后仍 > 0）的球员能精确校验递减；到期者会被放走或自动续约
    const notDue = still.filter((p) => (contractBefore.get(p.id) ?? 0) - 1 >= 1);
    const bad = notDue.filter((p) => p.contractYears !== (contractBefore.get(p.id) ?? 0) - 1);
    console.log(`  ${tag} 合同年递减：校验 ${notDue.length} 人，异常 ${bad.length}`);
    ok(bad.length === 0, `${tag} 合同年限随赛季 -1（异常 ${bad.length}: ${bad.slice(0, 3).map((p) => `${p.name} ${contractBefore.get(p.id)}→${p.contractYears}`).join(' / ')}）`);
    // v2.5.0：到期球员必须被处理——要么放走（进 FA），要么自动续约，队内不允许留下 0 年合同
    const zeroYear = l.teams.flatMap((t) => t.players).filter((p) => p.contractYears <= 0);
    ok(zeroYear.length === 0, `${tag} 到期合同已处理（队内 0 年合同 ${zeroYear.length} 人）`);
    const expiredNews = l.news.filter((n) => n.includes('合同到期未续约')).length;
    console.log(`  ${tag} 合同到期放走 ${expiredNews} 人（每队 ≥13 人 + 每位置 ≥1 人安全阀）`);
  }
  // v2.5.0：乐透抽签结果（含赔率与 top4，供"原属球队 → 现属球队"展示）+ 抽签后 3 天交易窗口
  {
    const lt = l.lottery;
    // order/odds 覆盖 30 队（乐透区 14 队抽前 4，其余按战绩倒序），lotteryIds = 乐透区 14 队
    ok(!!lt && lt.order.length === 30 && lt.odds.length === 30 && lt.top4.length === 4, `${tag} 乐透抽签结果完整（${lt?.order.length} 队 / top4 ${lt?.top4.length}）`);
    ok(!!lt && lt.lotteryIds.length === 14, `${tag} 乐透区 14 队（${lt?.lotteryIds.length}）`);
    ok(!!lt && new Set(lt.order).size === 30, `${tag} 30 队顺位无重复`);
    ok(!!lt && lt.order.every((id) => id >= 0 && id < 30), `${tag} 乐透顺序为有效球队 id`);
    ok(!!lt && lt.top4.every((id) => lt.lotteryIds.includes(id)), `${tag} 前 4 顺位都出自乐透区`);
    ok(l.offseasonTradeDays === 3, `${tag} 抽签后开启 3 天交易窗口（${l.offseasonTradeDays} 天）`);
    const owners = new Set(l.draftPool.filter((pk) => pk.year === l.draft?.year && pk.round === 1).map((pk) => pk.o));
    console.log(`  ${tag} 乐透：状元签 ${l.teams[lt?.order[0] ?? 0]?.abbr} · 首轮签归属队 ${owners.size} 支（可显示原属 → 现属）`);
  }
  ok(l.history.length > 0 && l.history[l.history.length - 1].season === l.season, `${tag} history 入账`);
  ok(l.history[l.history.length - 1].finalsMvpId === fm?.playerId, `${tag} history FMVP 记录`);
  // v2.0 休赛期重置字段
  ok(l.faDay === 1 && (l.faOffers?.length ?? 0) === 0 && !l.poffExitShown, `${tag} FA 7 天窗口重置`);
  // v2.1/v2.3 选秀大会：池 80 人 / 60 签（30 首轮 + 30 次轮，均为下一届年份）；轮到玩家签可手动挑选
  const d0 = l.draft;
  ok(!!d0 && d0.class.length === 80 && d0.order.length === 60 && d0.picked.length === 0, `${tag} 选秀池初始化（80 人 / ${d0?.order.length} 签）`);
  ok(!!d0 && d0.order.filter((pk) => pk.round === 1).length === 30 && d0.order.filter((pk) => pk.round === 2).length === 30, `${tag} 选秀签序 = 30 首轮 + 30 次轮`);
  ok(!!d0 && d0.order.every((pk) => pk.year === d0.year) && d0.year === l.year + 1, `${tag} 选秀签年份一致（${d0?.year}）`);
  if (d0 && l.userTeamId >= 0 && draftIsUserTurn(l)) {
    const best = [...d0.class].sort((a, b) => b.ovr - a.ovr)[0];
    ok(!!best && draftPickUser(l, best.id), `${tag} 玩家持有的签可手动挑选`);
  }
  draftComplete(l);
  ok(l.draft === null, `${tag} 选秀全部完成（含玩家签代选兜底）`);
  ok(l.news.some((n) => n.includes('本届选秀共 80 人')), `${tag} 80 人选秀大会报告`);
  console.log(`  ${tag} 退役消息 ${l.news.filter((n) => n.includes('退役')).length} 条；自由市场 ${l.freeAgents.length} 人`);

  if (offerTest && l.freeAgents.length > 0) {
    l.userTeamId = 0;
    const me = l.teams[0];
    // 裁人：最弱（非唯一位置）应成功
    const weakest = [...me.players].sort((a, b) => a.ovr - b.ovr)[0];
    const cutOk = cutPlayer(l, weakest.id);
    ok(cutOk, `${tag} 裁人成功`);
    const solo = me.players.find((p) => me.players.filter((q) => q.pos === p.pos).length === 1);
    if (solo) ok(!cutPlayer(l, solo.id), `${tag} 位置保护：不可裁唯一位置球员`);
    // 低价 FA（要价 250 档）以底薪 300 报价 → 应成交（AI 竞价上限 < ask×1.08）
    const cheap = [...l.freeAgents].sort((a, b) => askFor(a) - askFor(b))[0];
    const ask = askFor(cheap);
    const results = settleFreeAgency(l, [{ pid: cheap.id, years: 2, salary: Math.max(300, ask) }]);
    const r0 = results[0];
    ok(!!r0 && r0.ok && r0.won, `${tag} 底薪报价成交（ask=${ask}）: ${r0?.note}`);
    ok(me.players.length <= ROSTER_MAX, `${tag} 签约后名单 ≤${ROSTER_MAX}`);
    ok(cheap.contractYears === 2, `${tag} 合同年限写入`);
  }
  // ---------- v2.5.0：交易市场锁定（锁定的球员不会被 AI 报价）----------
  if (offerTest) {
    l.userTeamId = 0;
    const me = l.teams[0];
    l.lockedPids = me.players.map((p) => p.id);
    const lockedSet = new Set(l.lockedPids);
    let hits = 0, offers = 0;
    for (let i = 0; i < 80; i++) {
      l.tradeOffers = [];
      if (!tryAITradeOfferToUser(l, mulberry32(9001 + i * 37))) continue;
      offers++;
      for (const of of l.tradeOffers) hits += of.givePids.filter((pid) => lockedSet.has(pid)).length;
    }
    console.log(`  ${tag} 锁定测试：全员锁定 → ${offers} 条报价，涉及锁定球员 ${hits} 次`);
    ok(hits === 0, `${tag} 锁定球员不会被 AI 报价（越权 ${hits} 次）`);
    // 反证：解锁后能正常收到报价，说明锁定确实在起作用
    l.lockedPids = [];
    let got = 0;
    for (let i = 0; i < 150; i++) {
      l.tradeOffers = [];
      if (tryAITradeOfferToUser(l, mulberry32(7001 + i * 53))) got++;
    }
    console.log(`  ${tag} 解锁后 150 次尝试收到报价 ${got} 条`);
    ok(got > 0, `${tag} 解锁后可正常收到 AI 报价（${got} 条）`);
    l.tradeOffers = [];
  }
  simulateOffseasonAI(l);
  simulateAIOffseasonTrades(l);
  const trades = l.news.filter((n) => n.includes('交易：')).length;
  console.log(`  ${tag} AI 补强签约 ${l.news.filter((n) => n.includes('加盟')).length} 条；AI 交易 ${trades} 笔`);
  checkRoster(l, `${tag} FA结算后`);
  finishOffseason(l);
  ok(!l.offseason && l.offseasonStep === 0, `${tag} 休赛期结束`);
  ok(l.day === 0 && l.season >= 2, `${tag} 新赛季重置`);
  ok(l.results.length === 0 && l.playoffRounds.length === 0, `${tag} 季后赛/结果清空`);
  ok(l.schedule.length === 170, `${tag} 新赛程 170 天`);
  checkRoster(l, `${tag} 新赛季`, 15); // 开季裁至 15
  ok(l.teams.every((t) => t.players.every((p) => p.gp === 0 && p.starts === 0)), `${tag} 赛季数据重置`);
  // v2.5.0：新赛季常规赛/季后赛数据同步归零，休赛期交易窗口关闭
  ok(l.teams.every((t) => t.players.every((p) => p.poGp === 0 && p.poStats.pts === 0 && p.poStats.min === 0)), `${tag} 季后赛数据同步归零`);
  ok(l.offseasonTradeDays === 0, `${tag} 休赛期交易窗口已关闭（${l.offseasonTradeDays}）`);
  ok(Array.isArray(l.lockedPids), `${tag} 锁定名单字段常驻（跨赛季保留 ${l.lockedPids.length} 人）`);
  // v2.3：选秀权池 = 每队未来 3 年 × 首轮/次轮 = 180 枚；年份窗口滚动
  ok(l.draftPool.length === 180, `${tag} 选秀权池 180 枚（30 队 × 3 年 × 2 轮，实际 ${l.draftPool.length}）`);
  ok(l.draftPool.every((pk) => pk.year >= l.year + 1 && pk.year <= l.year + 3), `${tag} 签的年份都在未来 3 年内`);
  ok(l.draftPool.filter((pk) => pk.round === 1 && pk.year === l.year + 1).length === 30, `${tag} 下一届首轮 30 枚`);
  ok(l.draftPool.filter((pk) => pk.round === 2 && pk.year === l.year + 1).length === 30, `${tag} 下一届次轮 30 枚`);
  // v2.0 加点兜底：所有人点数清零（未手动分配的被自动分配）
  ok(l.teams.every((t) => t.players.every((p) => (p.points ?? 0) === 0)), `${tag} 加点全部分配/清零`);
  const names = new Set(l.teams.flatMap((t) => t.players).map((p) => p.name));
  ok(names.size > 400, `${tag} 球员池充足（${names.size}）`);
}

// 模拟一段常规赛 + 季后赛 + 汇总
function simSeason(l: LeagueState, label: string): void {
  console.log(`== 全季模拟（${label}）==`);
  const t0 = Date.now();
  while (l.day < l.totalDays) simDay(l);
  const agg = { pts: 0, reb: 0, ast: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, games: 0 };
  for (const t of l.teams) for (const p of t.players) {
    const s = p.stats;
    agg.pts += s.pts; agg.reb += s.reb; agg.ast += s.ast; agg.tov += s.tov;
    agg.fgm += s.fgm; agg.fga += s.fga; agg.tpm += s.tpm; agg.tpa += s.tpa;
    agg.ftm += s.ftm; agg.fta += s.fta; agg.games += p.gp;
  }
  const tg = 1230;
  console.log(`耗时 ${Date.now() - t0}ms | 场均 ${(agg.pts / tg).toFixed(1)} 分/队 | FG ${(agg.fgm / agg.fga * 100).toFixed(1)}% | 3P ${(agg.tpm / agg.tpa * 100).toFixed(1)}% | FT ${(agg.ftm / agg.fta * 100).toFixed(1)}%`);
  console.log(`篮板 ${(agg.reb / tg).toFixed(1)} | 助攻 ${(agg.ast / tg).toFixed(1)} | 失误 ${(agg.tov / tg).toFixed(1)}`);
  // v2.3.0：跨队转会后允许略超 82 场（赛程随机铺日 → 各队进度有几天差异），上限 = 82 + 容差
  for (const t of l.teams) for (const p of t.players) ok(p.gp <= GP_CAP + GP_TRADE_TOLERANCE, `${label} ${p.name} gp=${p.gp} 超过 ${GP_CAP + GP_TRADE_TOLERANCE}`);
}

function run(): void {
  const seed = Number(process.env.TEST_SEED || 20250906);
  console.log('== 联赛生成（虚构）==');
  const l = createLeague(seed);
  checkRoster(l, '初始');
  ok(l.freeAgents.length >= 55, `虚构开档即有自由市场（${l.freeAgents.length} 人）`);
  console.log('30 队 · 赛程天数', l.totalDays);

  console.log('== v1.2/v1.3 球队气质 · 风格 · 标签羁绊 · 新秀压制 ==');
  ok(l.teams.every((t) => typeof t.chemistry === 'number' && typeof t.discipline === 'number' && typeof t.brand === 'number' && t.fans > 0), '球队气质字段存在');
  ok(l.teams.every((t) => typeof t.style === 'string'), '球队风格字段存在（AI 队同样拥有）');
  ok(l.teams[0].players.every((p) => p.grow >= 0.6 && p.grow <= 1.8), `球员成长率 grow 0.6-1.8（实测 ${l.teams[0].players[0].grow}）`);
  {
    const cl = createLeague(seed + 991);
    cl.userTeamId = 2;
    // v2.0 风格拆分：球队风格二选一 + 执教风格三选一
    applyTeamStyle(cl, 'youth');
    applyCoachStyle(cl, 'iron');
    ok(
      cl.cultureId === 'youth' && cl.teams[2].style === 'youth'
      && cl.teams[2].coachStyle === 'iron' && cl.teams[2].discipline === 58,
      `双风格：青春风暴(youth) + 铁血手腕(discipline 58)（实测 disc=${cl.teams[2].discipline}）`
    );
    ok(cl.teams[2].style !== cl.teams[2].coachStyle, '球队风格与执教风格独立字段');
    // 非用户队不受影响（AI 气质保持随机基线 45-55）
    ok(cl.teams[3].chemistry >= 45 && cl.teams[3].chemistry <= 55, 'AI 队气质保持随机基线');
  }
  {
    // 风格标签：ovr≥80 一个、≥90 两个；低 ovr 无标签
    const mk = (ovr: number, attrs: Partial<import('./types').Attrs> = {}) =>
      ({ ovr, attrs: { three: 60, mid: 60, inside: 60, ath: 60, def: 60, pas: 60, reb: 60, ...attrs } }) as unknown as Player;
    ok(assignTags(mk(75)).length === 0, '75 能力无标签');
    ok(assignTags(mk(80, { three: 80 })).length === 1, '80 能力 1 个标签');
    ok(assignTags(mk(95, { three: 80, pas: 80 })).length === 2, '90+ 能力 2 个标签');
    ok(assignTags(mk(85)).length === 1 && assignTags(mk(85))[0] === '全能战士', '80+ 无突出属性兜底全能战士');
    ok(assignTags(mk(95, { three: 80, pas: 80, def: 80 }))[0] === '三分神射' || assignTags(mk(95, { three: 80, pas: 80, def: 80 })).includes('三分神射'), '标签按属性特征判定');
    // 羁绊：同队同标签 2 人起生效、人数越多越强
    const bTeam = createLeague(seed + 993).teams[0];
    const star = bTeam.players.find((p) => p.ovr >= 80)!;
    const mate = { ...star, id: 999999, name: star.name + '甲' } as unknown as Player;
    bTeam.players.push(mate);
    const b1 = bondMods(bTeam);
    bTeam.players.push({ ...mate, id: 999998, name: star.name + '乙' } as unknown as Player);
    bTeam.players.push({ ...mate, id: 999997, name: star.name + '丙' } as unknown as Player);
    const b3 = bondMods(bTeam);
    ok(b1.off > 0, `羁绊 2 人组生效（off=${b1.off.toFixed(4)}）`);
    ok(b3.off > b1.off * 1.5, `羁绊人数越多越强（2人=${b1.off.toFixed(4)} → 4人=${b3.off.toFixed(4)}）`);
    // 风格对比赛系数：青春风暴（29 岁以下多）> 中性；铁血（执教风格）季后赛防守更低；商业价值（执教）主场加成提升
    const styT = createLeague(seed + 994).teams[7];
    styT.style = null;
    styT.coachStyle = null;
    const base = teamEffMods(styT, false, false, 100);
    styT.style = 'youth';
    const youth = teamEffMods(styT, false, false, 100);
    ok(youth.off > base.off, `青春风暴 29 岁以下战力加成（${base.off.toFixed(4)} → ${youth.off.toFixed(4)}）`);
    styT.style = null;
    styT.coachStyle = 'iron';
    const ironReg = teamEffMods(styT, false, false, 100);
    const ironPoff = teamEffMods(styT, false, true, 100);
    ok(ironPoff.def < ironReg.def, `铁血手腕季后赛防守加成（常规 ${ironReg.def.toFixed(4)} → 季后赛 ${ironPoff.def.toFixed(4)}）`);
    styT.coachStyle = 'brand';
    styT.fans = 140; // 确定性粉丝量（>100 均值 → 主场粉丝系数生效）
    const brandAway = teamEffMods(styT, false, false, 100).off;
    const brandHome = teamEffMods(styT, true, false, 100).off;
    styT.coachStyle = null;
    const normAway = teamEffMods(styT, false, false, 100).off;
    const normHome = teamEffMods(styT, true, false, 100).off;
    ok(brandHome - brandAway > normHome - normAway, '商业价值（执教风格）提升主场粉丝加成');
  }
  {
    // v2.0 成长点数制：潜力星 × 阶段(18-25 ×3 / 26-29 ×2) × 出场时间系数；30+ 无加点+衰减
    const mkP = (age: number, pot = 8, mpg = 22) => {
      const p = genRookie(mulberry32(900 + age), 3, { v: -1 });
      p.age = age;
      p.potential = pot;
      p.gp = 50;
      p.stats.min = mpg * 50;
      return p;
    };
    // 时间系数表
    ok(timeCoefOf(mkP(24, 8, 4)) === 0.8, '出场<5min 系数 0.8');
    ok(timeCoefOf(mkP(24, 8, 7)) === 0.9, '5-10min 系数 0.9');
    ok(timeCoefOf(mkP(24, 8, 12)) === 1, '10-15min 系数 1');
    ok(timeCoefOf(mkP(24, 8, 17)) === 1.1, '15-20min 系数 1.1');
    ok(timeCoefOf(mkP(24, 8, 23)) === 1.2, '20-25min 系数 1.2');
    ok(timeCoefOf(mkP(24, 8, 30)) === 1.3, '25+min 系数 1.3');
    // 加点总量：24 岁 pot8 ×3 ×1.2 ≈ 29；27 岁 ×2 ×1.2 ≈ 19；38 岁 0
    const g24 = growthPointsFor(mkP(24, 8, 22));
    const g27 = growthPointsFor(mkP(27, 8, 22));
    const g38 = growthPointsFor(mkP(38, 8, 30));
    console.log(`  加点量：24岁 pot8 → ${g24} 点 / 27岁 → ${g27} 点 / 38岁 → ${g38} 点`);
    ok(g24 === 29, `18-25 黄金期 ×3（${g24}）`);
    ok(g27 === 19, `26-29 稳步期 ×2（${g27}）`);
    ok(g38 === 0, '30+ 无加点');
    // 老将衰减：30-32 每季 -2 点；以技能总和下降断言（ovr 取整可能不变）
    const oldP = mkP(30, 8, 30);
    oldP.skills = JSON.parse(JSON.stringify(oldP.skills));
    const sumBefore = SKILL_KEYS.reduce((s, k) => s + oldP.skills[k], 0);
    agePlayer(mulberry32(5), oldP, null);
    const sumAfter = SKILL_KEYS.reduce((s, k) => s + oldP.skills[k], 0);
    ok(sumAfter < sumBefore, `30 岁老将每季衰减（技能总 ${sumBefore}→${sumAfter}）`);
    ok(agingPenaltyOf(mkP(31)) === 2 && agingPenaltyOf(mkP(34)) === 4 && agingPenaltyOf(mkP(38)) === 6, '衰减档位 2/4/6');
    ok(agingPenaltyOf(mkP(25)) === 0, '成长期无衰减');
    // 加点操作：spendPoint 消耗点数、技能 +1、总评重算；autoDistribute 清零
    const g24p = mkP(24, 8, 22);
    g24p.skills = JSON.parse(JSON.stringify(g24p.skills));
    g24p.points = g24;
    const sBefore = g24p.skills.three;
    const ovrS = g24p.ovr;
    spendPoint(g24p, 'three', 1);
    ok(g24p.points === g24 - 1 && g24p.skills.three === sBefore + 1, 'spendPoint 消耗点数并加技能');
    ok(g24p.ovr >= ovrS, `加点后总评不回退（${ovrS}→${g24p.ovr}）`);
    autoDistribute(mulberry32(7), g24p);
    ok(g24p.points === 0, 'autoDistribute 清零（AI 兜底分配）');
    // v2.1 自动分配规则：优先加到突出能力、单项 ≤90
    const ap = mkP(22, 10, 30);
    ap.skills = JSON.parse(JSON.stringify(ap.skills));
    // 构造 3 项突出（88）+ 其余 55
    for (const k of SKILL_KEYS) ap.skills[k] = 55;
    ap.skills.three = 88; ap.skills.mid = 87; ap.skills.dr = 86;
    ap.points = 40;
    autoDistribute(mulberry32(9), ap);
    ok(ap.skills.three === 90 && ap.skills.mid === 90 && ap.skills.dr === 90, `优先加突出能力至 90 封顶（three88→${ap.skills.three} mid87→${ap.skills.mid} dr86→${ap.skills.dr}）`);
    ok(ap.points === 0, 'autoDistribute 清空全部点数');
    ok(SKILL_KEYS.every((k) => ap.skills[k] <= 90), '自动分配单项不超过 90');
    // recalcOvr：技能变化 → 真实名单基准制（baseOvr+增量）
    const rp = mkP(24, 8, 22);
    rp.baseOvr = 93; rp.baseSkills = JSON.parse(JSON.stringify(rp.skills));
    const beforeCalc = rp.ovr;
    rp.skills.three += 5;
    recalcOvr(rp);
    ok(rp.ovr >= beforeCalc, `基准制总评：技能+5 → ovr 增量上升（${beforeCalc}→${rp.ovr}）`);
  }
  {
    // 赛后随机事件：40 次必然触发（45%/场），属性变化 + news 记录；v2.0 带选项事件可处理
    const ev = createLeague(seed + 992);
    ev.userTeamId = 0;
    for (let i = 0; i < 40; i++) rollPostGameEvent(ev, i % 2 === 0, 100 + i, i);
    ok(ev.news.some((n) => n.includes('📰')), '赛后事件触发并写入动态');
    ok(ev.teams[0].chemistry >= 0 && ev.teams[0].chemistry <= 100, 'chemistry 保持在 0-100');
    ok(ev.teams[0].fans >= 20 && ev.teams[0].fans <= 600, 'fans 保持在 20-600 万');
    ok((ev.pendingEvents?.length ?? 0) <= 5, `待处理事件不积压（${ev.pendingEvents?.length ?? 0} 条）`);
    // 处理一条带选项事件：多效果应用并移除
    if (ev.pendingEvents && ev.pendingEvents.length > 0) {
      const pend = ev.pendingEvents[0];
      const eff = pend.options[0].effects ?? [];
      const cap = (k: string) => (k === 'fans' ? 600 : 100);
      const before = eff.map((e) => ev.teams[0][e.key]);
      resolveTeamEvent(ev, pend.id, pend.options[0]);
      ok(!ev.pendingEvents?.some((e) => e.id === pend.id), '事件处理后移除');
      ok(eff.every((e, i) => ev.teams[0][e.key] === Math.max(0, Math.min(cap(e.key), before[i] + e.delta))),
        `选项多效果应用（${eff.map((e) => `${e.key} ${e.delta > 0 ? '+' : ''}${e.delta}`).join(' · ')}）`);
      ok(ev.news.some((n) => n.includes('已处理')), '处理结果写入动态');
      // v2.3：每个选项都必须至少含一项加成（不能两个选项都在扣数值）
      ok(pend.options.every((o) => (o.effects ?? []).some((e) => e.delta > 0)), '球队动态选项都含加成项（不再是纯扣数值）');
    }
  }
  {
    // 新秀压制：ovr≤80（<85）、潜力星级 ≤8；v2.1 选秀大会 80 人（美 70% 英文名 / 中 5% 中文名）
    // 恰好 1 名总评 ≥80（不锁定状元：随机顺位）
    const rng = mulberry32(seed + 555);
    let maxOvr = 0, maxPot = 0;
    for (let i = 0; i < 300; i++) {
      const r = genRookie(rng, Math.floor(i / 20), { v: 10000 + i });
      maxOvr = Math.max(maxOvr, r.ovr);
      maxPot = Math.max(maxPot, r.potential);
    }
    ok(maxOvr <= 80 && maxPot <= 8, `新秀 ovr≤80 潜力星级≤8（实测 ${maxOvr}/${maxPot}）`);
    const dc = genDraftClass(mulberry32(seed + 556));
    ok(dc.length === 80, `选秀大会 80 人（${dc.length}）`);
    const over80 = dc.filter((p) => p.ovr >= 80);
    ok(over80.length === 1 && over80[0].ovr <= 83, `恰好 1 名总评 ≥80 且 ≤83（${over80[0]?.name} ${over80[0]?.ovr} @第${dc.indexOf(over80[0]) + 1}顺位）`);
    ok(dc.filter((p) => p.ovr < 80).length === 79, '其余 79 人 <80');
    const nations = new Map<string, number>();
    for (const p of dc) nations.set(p.nation, (nations.get(p.nation) ?? 0) + 1);
    ok(nations.get('美国') === 60 && nations.get('中国') === 3, `国籍配额 美 60 / 中 3（${nations.get('美国')}/${nations.get('中国')}）`);
    // v2.3.0：其他国家必须是具体国家（不能出现"欧洲/南美/亚洲"这类地区名）
    const REGIONS = ['欧洲', '南美', '北美', '非洲', '澳洲', '亚洲', '其他'];
    const intl = dc.filter((p) => p.nation !== '美国' && p.nation !== '中国');
    ok(intl.length === 17, `其他国家新秀 17 人（${intl.length}）`);
    ok(intl.every((p) => !REGIONS.includes(p.nation)), `国际新秀国籍全部具体到国家（${[...new Set(intl.map((p) => p.nation))].slice(0, 8).join('、')}…）`);
    console.log(`  国际新秀样例：${intl.slice(0, 5).map((p) => `${p.nation} ${p.name}`).join(' · ')}`);
    const usNames = dc.filter((p) => p.nation === '美国').map((p) => p.name);
    const cnNames = dc.filter((p) => p.nation === '中国').map((p) => p.name);
    // v2.5.0：新秀名字全部汉化（美国新秀也显示中文译名，如 Jalen Carter → 杰伦·卡特）
    ok(usNames.every((n) => /[\u4e00-\u9fff]/.test(n)), `美国新秀名字已汉化（样例：${usNames.slice(0, 3).join('、')}）`);
    ok(usNames.every((n) => !/^[A-Za-z]/.test(n)), '美国新秀不再出现纯英文名');
    ok(cnNames.every((n) => /[\u4e00-\u9fff]/.test(n)), '中国新秀用中文名');
    const asciiNames = dc.filter((p) => !/[\u4e00-\u9fff]/.test(p.name));
    ok(asciiNames.length === 0, `80 名新秀名字全部含中文（纯英文 ${asciiNames.length} 人）`);
    // 国际新秀名字已译为中文（含间隔号"，"或纯汉字，如"维克托·文班亚马"/"八村塁"）
    ok(intl.every((p) => /^[\u4e00-\u9fff·．]+$/.test(p.name)), `国际新秀名字已译成中文（${intl[0]?.name}…）`);
    ok(new Set(dc.map((p) => p.name)).size === 80, '80 人名字无重复');
    // v2.3.0：新秀实力梯度（此前 tier 在第 30 顺位就触底 → 次轮清一色 55 分）
    const sortedOvr = dc.map((p) => p.ovr).sort((a, b) => b - a);
    console.log(`  新秀实力梯度：第 1 位 ${sortedOvr[0]} · 第 20 位 ${sortedOvr[19]} · 第 50 位 ${sortedOvr[49]} · 末位 ${sortedOvr[79]}`);
    ok(sortedOvr[79] < sortedOvr[49] || sortedOvr[49] < sortedOvr[0], '新秀实力随顺位递减（有梯度，不再清一色）');
    ok(new Set(dc.slice(30).map((p) => p.ovr)).size >= 5, `次轮/后段新秀实力有区分度（${new Set(dc.slice(30).map((p) => p.ovr)).size} 种 OVR）`);
    ok(dc.every((p) => p.secPos === POS_SEC[p.pos]), '新秀双位置齐全');
    // v2.1 自由市场生成均匀 55-80
    const rngF = mulberry32(seed + 557);
    let fMin = 99, fMax = 0;
    for (let i = 0; i < 400; i++) {
      const fa = genFreeAgent(rngF);
      fMin = Math.min(fMin, fa.ovr);
      fMax = Math.max(fMax, fa.ovr);
    }
    ok(fMin >= 54 && fMax <= 81 && fMax - fMin >= 20, `自由球员均匀 55-80（实测 ${fMin}-${fMax}）`);
  }
  {
    // v1.4 总评算法：18 项均值 + 长处补偿（依据用户提供的 2K 截图样本校准）
    const S = (vals: number[]) => {
      const s = {} as Record<(typeof SKILL_KEYS)[number], number>;
      SKILL_KEYS.forEach((k, i) => { s[k] = vals[i]; });
      return s;
    };
    const daniels = S([62, 18, 55, 60, 65, 75, 72, 70, 92, 35, 95, 30, 82, 45, 62, 85, 55, 72]);   // 官方 82
    const egb = S([80, 65, 61, 55, 72, 55, 74, 76, 70, 84, 64, 85, 82, 82, 73, 73, 84, 76]);      // 官方 75
    const okongwu = S([84, 62, 78, 55, 76, 55, 72, 70, 74, 81, 67, 76, 79, 78, 79, 68, 74, 78]); // 官方 81
    const jjohnson = S([82, 72, 68, 72, 68, 68, 72, 70, 72, 68, 58, 52, 78, 68, 85, 85, 82, 95]);// 官方 84
    const naw = S([52, 21, 89, 77, 77, 87, 79, 75, 95, 36, 81, 23, 82, 24, 42, 91, 50, 75]);     // 官方 81
    console.log('  算法总评对照（2K 官方 82/75/81/84/81）:',
      calcOvr(daniels), calcOvr(egb), calcOvr(okongwu), calcOvr(jjohnson), calcOvr(naw));
    ok(calcOvr(daniels) >= 77 && calcOvr(daniels) <= 82, `长处补偿拉高均值（丹尼尔斯 均值62.8 → ${calcOvr(daniels)}）`);
    ok(calcOvr(naw) >= 78 && calcOvr(naw) <= 84, `极端长处补足短板（沃克 均值64.2 → ${calcOvr(naw)}）`);
    ok(calcOvr(jjohnson) >= 80 && calcOvr(okongwu) >= 76, '均衡强队总评贴近均值+补偿');
    // 补偿单调：同均值（65）下 3 项长处越多总评越高
    const flat = S(Array(18).fill(65));
    const spike = S([95, 92, 85, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55]);
    ok(calcOvr(spike) > calcOvr(flat), `长处弥补短板（扁平 ${calcOvr(flat)} → 长处 ${calcOvr(spike)}）`);
    ok(calcOvr(flat) === 65, '无长处时总评=均值');
    // 虚构生成：总评≈target（±4），技能均值低于总评（2K 式分布）
    let worst = 0;
    let meanBelow = 0;
    const rngT = mulberry32(seed + 777);
    for (let i = 0; i < 500; i++) {
      const t = 55 + (i % 36);
      const sk = genSkills(rngT, ['PG', 'SG', 'SF', 'PF', 'C'][i % 5] as import('./types').Pos, t);
      const o = calcOvr(sk);
      worst = Math.max(worst, Math.abs(o - t));
      const avg = SKILL_KEYS.reduce((s, k) => s + sk[k], 0) / SKILL_KEYS.length;
      if (avg < o) meanBelow++;
    }
    ok(worst <= 4, `虚构技能生成总评≈目标（最大偏差 ${worst}）`);
    ok(meanBelow >= 460, `技能均值低于总评（均值<总评 ${meanBelow}/500，2K 式分布）`);
  }

  console.log('== 单场模拟（不累计赛季统计）==');
  const g1 = simulateGame(l.teams[0], l.teams[1], mulberry32(7), false);
  const s1 = g1.result;
  console.log(`场1: ${l.teams[0].abbr} ${s1.awayScore} - ${s1.homeScore} ${l.teams[1].abbr} (OTx${g1.otCount})`);
  ok(l.teams[0].players.every((p) => p.gp === 0), '冒烟比赛不累计常规统计');

  simSeason(l, '虚构名单');
  console.log('得分王:', leaders(l, 'pts')[0]?.player.name, leaders(l, 'pts')[0]?.value.toFixed(1));

  const champ = fullPlayoffs(l);
  console.log('== 季后赛 == 总冠军:', champ >= 0 ? l.teams[champ].abbr : '无');
  ok(champ >= 0, '冠军产生');

  {
    // v2.1 提前晋级：第一轮部分系列完成后即可建下一轮（已晋级 vs 待定），随打随填
    const pl = createLeague(seed + 9001);
    while (pl.day < pl.totalDays) simDay(pl);
    runPlayoffRound(pl, 0);
    // 只打完第一个系列（4 胜）
    const s0 = pl.playoffRounds[0].series[0];
    let g0 = 0;
    while (s0.awayWins < 4 && s0.homeWins < 4 && g0++ < 60) simPlayoffGame(pl, 0, 0);
    ok(s0.awayWins >= 4 || s0.homeWins >= 4, '第一个系列已打完');
    // 提前建下一轮（此时轮次其他系列未完）
    runPlayoffRound(pl, 1);
    const half0 = pl.playoffRounds[1].series[0];
    const half1 = pl.playoffRounds[1].series[1];
    ok(half0.awayId >= 0 || half0.homeId >= 0 || half1.awayId >= 0 || half1.homeId >= 0, '提前建轮：半决赛已有已定方/占位（不依赖整轮完成）');
    // 打完第一轮剩余系列 → 占位自动填实
    for (let i = 1; i < 8; i++) {
      const s = pl.playoffRounds[0].series[i];
      let g = 0;
      while (s.awayWins < 4 && s.homeWins < 4 && g++ < 60) simPlayoffGame(pl, 0, i);
    }
    refreshPlayoffPlaceholders(pl);
    ok(pl.playoffRounds[1].series.every((s) => s.awayId >= 0 && s.homeId >= 0), '第一轮打完后半决赛全部填充为实对位');
  }

  console.log('== 赛季奖项 + 休赛期（虚构）==');
  runOffseasonFlow(l, '虚构', true);

  console.log('== 交易评估（v3 价值模型 + 首轮签）==');
  l.userTeamId = 0;
  const me = l.teams[0];
  // 估值自洽：22 岁潜力小将 ≈ 32 岁老将（确定性构造，避免随机抽样波动）
  const young = { ...me.players[0], ovr: 72, potential: 10, age: 22, salary: 480, contractYears: 3 } as unknown as Player;
  const old = { ...me.players[0], ovr: 85, potential: 5, age: 32, salary: 2100, contractYears: 2 } as unknown as Player;
  if (young && old) {
    console.log(`  young ${young.name} o${young.ovr} p${young.potential}星 a${young.age} → 估值对比老将 ${old.ovr} a${old.age}`);
    ok(young.age <= 25 && young.potential >= 8, '潜力小将特征');
    const yv = tradeValue(young), ov = tradeValue(old);
    console.log(`    young 估值 ${yv} vs 老将估值 ${ov}`);
    // 指数语义：老将（即战力）与潜力小将价值应同量级（0.2-5 倍误差内），体现"价值对等"
    ok(yv / ov > 0.2 && yv / ov < 5, `潜力与即战力价值对等（young/old=${(yv / ov).toFixed(2)}）`);
    // 指数基准：75 能力=1.0、每 +10 翻倍 → 直接用 tradeValue 换算回等效能力检查单调性
    const basePlayer = { ...young, ovr: 75, potential: 5, age: 27, salary: 0, contractYears: 0 } as unknown as Player;
    const base = tradeValue(basePlayer as Player);
    ok(Math.abs(base - 1) < 0.01, `75 能力基线估值≈1（实际 ${base}）`);
  }
  // 指数单调性：高 OVR 同条件估值必须严格更高（75→85→95 约 1→2→4）
  {
    const mk = (ovr: number) => ({ ...me.players[0], ovr, potential: 5, age: 28, salary: 0, contractYears: 0 }) as unknown as Player;
    const v75 = tradeValue(mk(75) as Player), v85 = tradeValue(mk(85) as Player), v95 = tradeValue(mk(95) as Player);
    console.log(`  指数单调: 75→${v75} / 85→${v85} / 95→${v95}`);
    ok(v85 > v75 * 1.7 && v95 > v85 * 1.7, '每 +10 能力估值大致翻倍');
  }
  const v = evaluateTrade(l, me.id, 1, [], [], [], []);
  console.log('  空筹码评估:', JSON.stringify(v));
  ok(!v.accept, '空筹码被拒');
  // 首轮签估值与转移
  const pk0 = l.draftPool[0];
  ok(pk0.o === 0, '首轮签默认归己队');
  const pv = pickValue(l, pk0);
  console.log(`  我的首轮签估值 ${pv}（${l.teams[pk0.f].abbr} 战绩 ${l.teams[pk0.f].win}-${l.teams[pk0.f].loss}）`);
  ok(pv >= 0.4 && pv <= 5.5, '签估值在合理区间（指数尺度）');
  // 用一名球员 + 签换对方球员（对方第 15 人）——只验证规则通道可用（不要求成交）
  const myGuy = [...me.players].sort((a, b) => b.ovr - a.ovr)[6];
  const target15 = [...l.teams[1].players].sort((a, b) => a.ovr - b.ovr)[0];
  const v2 = evaluateTrade(l, me.id, 1, [myGuy.id], [target15.id], [0], []);
  console.log('  球员+首轮签 换 角色球员:', JSON.stringify(v2));
  ok(v2.reason.length > 0, '带签交易可评估');
  // apron 硬顶/税线约束应能进入 reason（队 0 若超税线会有对应文案；不强制 accept）
  ok(v2.reason.includes('估值'), 'reason 含估值明细');

  // ---------- v2.3 选秀权体系（年份 + 次轮 + 随战绩变化的价值） ----------
  console.log('== v2.3 选秀权体系（未来 3 年 × 首轮/次轮）==');
  {
    const pl = createRealLeague(seed + 4242);
    pl.userTeamId = 0;
    const mine = (round: 1 | 2, off: number) =>
      pl.draftPool.find((pk) => pk.o === 0 && pk.round === round && pk.year === pl.year + off);
    const f1 = mine(1, 1), s1 = mine(2, 1), f3 = mine(1, 3);
    ok(pl.draftPool.length === 180, `签池 180 枚（${pl.draftPool.length}）`);
    ok(!!f1 && !!s1 && !!f3, '下一届首轮/次轮 + 最远年份首轮都存在');
    const vF1 = pickValue(pl, f1!), vS1 = pickValue(pl, s1!), vF3 = pickValue(pl, f3!);
    const f2 = mine(1, 2), s2 = mine(2, 2), s3 = mine(2, 3);
    console.log(`  我的签估值：${pl.year + 1} 首轮 ${vF1} / ${pl.year + 1} 次轮 ${vS1} / ${pl.year + 3} 首轮 ${vF3}`);
    console.log(`  签名示例：${pickLabel(pl, f1!)} · ${pickLabel(pl, s1!)}`);
    // v2.6.0：用户指定的"初始价值"（战绩中性时）——首轮 1.5/1.2/1.0，次轮 0.4/0.3/0.2
    ok(vF1 === 1.5 && !!f2 && pickValue(pl, f2) === 1.2 && vF3 === 1.0, `首轮三年初始价值 1.5 / 1.2 / 1.0（${vF1} / ${f2 ? pickValue(pl, f2) : '?'} / ${vF3}）`);
    ok(vS1 === 0.4 && !!s2 && !!s3 && pickValue(pl, s2) === 0.3 && pickValue(pl, s3) === 0.2, `次轮三年初始价值 0.4 / 0.3 / 0.2（${vS1} / ${s2 ? pickValue(pl, s2) : '?'} / ${s3 ? pickValue(pl, s3) : '?'}）`);
    ok(vS1 < vF1, '次轮签价值低于首轮签');
    ok(vF3 < vF1, '越远的年份折价（不确定性折扣）');
    // 战绩变化 → 同一枚签的价值随之变化
    for (const t of pl.teams) { t.win = 41; t.loss = 41; }
    pl.teams[10].win = 5; pl.teams[10].loss = 77;   // 摆烂队
    pl.teams[11].win = 70; pl.teams[11].loss = 12;  // 争冠队
    const pkWeak = pl.draftPool.find((pk) => pk.f === 10 && pk.round === 1 && pk.year === pl.year + 1)!;
    const pkStrong = pl.draftPool.find((pk) => pk.f === 11 && pk.round === 1 && pk.year === pl.year + 1)!;
    const vWeak = pickValue(pl, pkWeak), vStrong = pickValue(pl, pkStrong);
    console.log(`  同期首轮签：摆烂队(5-77) ${vWeak} vs 争冠队(70-12) ${vStrong}`);
    ok(vWeak > vStrong, '签的价值随该队战绩实时变化（摆烂队的签更值钱）');
  }

  // ---------- v2.3 真实球员位置修正 ----------
  console.log('== v2.3 真实球员位置（主/副位置）==');
  {
    const rl = createRealLeague(seed + 4243);
    const find = (n: string) => rl.teams.flatMap((t) => t.players).find((p) => p.name === n);
    const jw = find('杰伦·威廉姆斯'), ac = find('亚历克斯·卡鲁索'), jt = find('杰森·塔图姆');
    const lbj = find('勒布朗·詹姆斯'), jok = find('尼古拉·约基奇');
    console.log(`  杰伦·威廉姆斯 ${jw?.pos}/${jw?.secPos} · 卡鲁索 ${ac?.pos}/${ac?.secPos} · 塔图姆 ${jt?.pos}/${jt?.secPos} · 詹姆斯 ${lbj?.pos}/${lbj?.secPos} · 约基奇 ${jok?.pos}/${jok?.secPos}`);
    // v2.5.0：用户指定例外——杰伦·威廉姆斯改为 SG/SF（2K 原值为 C/PF），其余照搬 2K
    ok(jw?.pos === 'SG' && jw?.secPos === 'SF', `杰伦·威廉姆斯 = SG/SF（用户指定，${jw?.pos}/${jw?.secPos}）`);
    ok(ac?.pos === 'SF' && ac?.secPos === 'PG', `卡鲁索 = 2K 原值 SF/PG（${ac?.pos}/${ac?.secPos}）`);
    ok(jt?.pos === 'PF' && jt?.secPos === 'SF', '塔图姆 = 2K 原值 PF/SF');
    ok(lbj?.pos === 'PF' && lbj?.secPos === 'SF', '詹姆斯 = 2K 原值 PF/SF');
    ok(jok?.pos === 'C' && jok?.secPos === 'PF', '约基奇 = 2K 原值 C/PF（数据只给 C，副位置按相邻位置补）');
    const ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
    const all = rl.teams.flatMap((t) => t.players);
    // 主副位置不再强制相邻（2K 数据本身会出现 SF/PG、PG/C 这类组合），只要求两者不同
    const dup = all.filter((p) => p.pos === p.secPos);
    ok(dup.length === 0, `主副位置不重复（异常 ${dup.length} 人）`);
    // 位置深度允许 <2 人（严格照搬 2K 的必然结果）——由引擎 depthList 在比赛中向相邻位置借人兜底
    const thin: string[] = [];
    for (const t of rl.teams) {
      for (const pos of ORDER) {
        const n = t.players.filter((p) => p.pos === pos).length;
        if (n < 1) thin.push(`${t.abbr}-${pos}(${n})`);
      }
    }
    ok(thin.length === 0, `每队五位置至少各 1 人（缺位：${thin.join(' ') || '无'}）`);
  }

  // ---------- v2.3.0 出手分配（球星战术地位 / 空间型内线三分） ----------
  console.log('== v2.3.0 出手分配与球星产出 ==');
  {
    const sl = createRealLeague(seed + 4245);
    sl.userTeamId = 0;
    while (sl.day < sl.totalDays) simDay(sl);
    const find = (n: string) => sl.teams.flatMap((t) => t.players).find((p) => p.name === n);
    const line = (p: Player | undefined) => (p ? `${p.name} ${(p.stats.pts / Math.max(1, p.gp)).toFixed(1)}分/${(p.stats.fga / Math.max(1, p.gp)).toFixed(1)}次出手` : '?');
    const wemby = find('维克托·文班亚马');
    const doncic = find('卢卡·东契奇');
    console.log(`  ${line(wemby)} · ${line(doncic)}`);
    if (wemby) {
      const g = Math.max(1, wemby.gp);
      const ppg = wemby.stats.pts / g;
      const fga = wemby.stats.fga / g;
      const tpa = wemby.stats.tpa / g;
      console.log(`  文班亚马：${ppg.toFixed(1)}分 / ${fga.toFixed(1)}次出手（三分 ${tpa.toFixed(1)} = ${(tpa / Math.max(1, fga) * 100).toFixed(0)}%）`);
      ok(ppg >= 20 && ppg <= 31, `文班亚马场均得分接近真实（${ppg.toFixed(1)} 分；修复前 17.3）`);
      ok(fga >= 16, `文班亚马出手数达到球队核心水平（${fga.toFixed(1)} 次；修复前 11.5）`);
      ok(tpa >= 3, `空间型内线真的投三分（${tpa.toFixed(1)} 次；修复前 0.6）`);
    }
    // 队内第一人出手必须多于第二人（战术地位）
    const sas = sl.teams.find((t) => t.abbr === 'SAS')!;
    const byFga = [...sas.players].sort((a, b) => b.stats.fga / Math.max(1, b.gp) - a.stats.fga / Math.max(1, a.gp));
    const top = byFga[0], second = byFga[1];
    console.log(`  马刺出手榜：${top.name} ${(top.stats.fga / Math.max(1, top.gp)).toFixed(1)} > ${second.name} ${(second.stats.fga / Math.max(1, second.gp)).toFixed(1)}`);
    ok(top.stats.fga / Math.max(1, top.gp) > second.stats.fga / Math.max(1, second.gp), '球队第一人出手数高于第二人（战术核心）');
    // 无人打满全场（位置深度兜底生效）
    const over = sl.teams.flatMap((t) => t.players).filter((p) => p.gp > 20 && p.stats.min / Math.max(1, p.gp) > 42);
    ok(over.length === 0, `没有球员场均超过 42 分钟（异常 ${over.length} 人：${over.slice(0, 3).map((p) => p.name).join('、')}）`);
  }

  // ---------- v2.3 AI 主动报价（球员 + 选秀权） ----------
  console.log('== v2.3 AI 主动报价 ==');
  {
    const al = createRealLeague(seed + 4244);
    al.userTeamId = 0;
    let made = 0;
    for (let k = 0; k < 60 && al.tradeOffers.length < 3; k++) {
      if (tryAITradeOfferToUser(al, mulberry32(seed + 9000 + k))) made++;
    }
    console.log(`  生成 ${made} 份报价（队列 ${al.tradeOffers.length}/3）`);
    ok(made > 0, `AI 会主动向玩家报价（${made} 份）`);
    ok(al.news.some((n) => n.includes('发来交易报价')), '报价同步写入球队动态');
    if (al.tradeOffers.length >= 2) {
      const of = al.tradeOffers[0];
      console.log(`  样例：${of.note}`);
      const before = al.teams[0].players.map((p) => p.id).join(',');
      const res = acceptTradeOffer(al, of.id);
      console.log(`  接受结果：${res.ok ? '✅' : '❌'} ${res.reason}`);
      ok(res.ok, 'AI 报价可通过接受按钮直接成交（evaluateTrade 已预检）');
      ok(al.teams[0].players.map((p) => p.id).join(',') !== before, '成交后玩家阵容发生变化');
      ok(!al.tradeOffers.some((o) => o.id === of.id), '已处理的报价从队列移除');
      const rest = al.tradeOffers[0];
      rejectTradeOffer(al, rest.id);
      ok(!al.tradeOffers.some((o) => o.id === rest.id), '拒绝后报价从队列移除');
      ok(al.news.some((n) => n.includes('拒绝了')), '拒绝同步写入球队动态');
    }
  }

  // ---------- v2.3.0 新秀榜（开档即可查看的下一届 80 人名单 + 体测数据） ----------
  console.log('== v2.3.0 新秀榜与体测数据 ==');
  {
    const dl = createRealLeague(seed + 4246);
    dl.userTeamId = 0;
    const nd = dl.nextDraftClass ?? [];
    ok(nd.length === 80, `开档即有下一届新秀名单（${nd.length} 人，随时可查看）`);
    const missing = nd.filter((p) => !p.height || !p.weight || !p.wingspan || !p.age);
    ok(missing.length === 0, `新秀体测数据齐全（身高/体重/臂展/年龄；缺失 ${missing.length} 人）`);
    ok(nd.every((p) => (p.wingspan ?? 0) >= p.height), '新秀臂展不短于身高');
    ok(nd.every((p) => (p.weight ?? 0) >= 150 && (p.weight ?? 0) <= 330), '新秀体重在合理区间（150-330 磅）');
    const hot = [...nd].sort((a, b) => b.ovr - a.ovr)[0];
    console.log(`  状元热门：${hot.name} ${hot.pos} ${hot.age}岁 身高 ${hot.height}in 体重 ${hot.weight}lb 臂展 ${hot.wingspan}in OVR${hot.ovr} 潜力${hot.potential}星`);
    // 真实球员体测取自 2K 源数据
    const allReal = dl.teams.flatMap((t) => t.players);
    const wemby = allReal.find((p) => p.name === '维克托·文班亚马');
    const caruso = allReal.find((p) => p.name === '亚历克斯·卡鲁索');
    console.log(`  文班亚马：${wemby?.height}in / ${wemby?.weight}lb / 臂展 ${wemby?.wingspan}in · 卡鲁索：${caruso?.height}in / ${caruso?.weight}lb / 臂展 ${caruso?.wingspan}in`);
    ok(wemby?.weight === 235 && wemby?.wingspan === 96, '真实球员体测取自 2K 源数据（文班 235 磅 / 臂展 8\'0"）');
    ok(allReal.every((p) => p.weight && p.wingspan), '30 队球员全部有体重/臂展');
    // 休赛期选秀沿用同一批人，随后生成新的下一届
    const firstIds = nd.map((p) => p.id).join(',');
    while (dl.day < dl.totalDays) simDay(dl);
    beginOffseason(dl);
    const used = dl.draft?.class ?? [];
    ok(used.length > 0 && used.map((p) => p.id).join(',') === firstIds, '休赛期选秀沿用同一批新秀（玩家整个赛季可提前考察）');
    ok(used.every((p) => p.weight && p.wingspan), '选秀池新秀同样带体测数据');
    const nd2 = dl.nextDraftClass ?? [];
    ok(nd2.length === 80 && nd2[0]?.id !== nd[0]?.id, `选秀开启后自动生成新的下一届名单（${nd2.length} 人）`);
    ok(nd2.every((p) => p.weight && p.wingspan), '下一届新秀体测数据齐全');
  }

  // ---------- v2.3.0 乐透抽签 / 新秀薪资阶位（Stepien 规则已于 v2.5.0 移除）----------
  console.log('== v2.3.0 选秀制度（乐透抽签 · 新秀薪资阶位；Stepien 已移除）==');
  {
    // 乐透抽签：战绩最差不再稳拿状元
    const ll = createRealLeague(seed + 4247);
    ll.userTeamId = 0;
    for (const t of ll.teams) { t.win = 41; t.loss = 41; }
    ll.teams[5].win = 5; ll.teams[5].loss = 77;   // 最差
    ll.teams[6].win = 12; ll.teams[6].loss = 70;
    ll.teams[7].win = 20; ll.teams[7].loss = 62;
    const runs = 400;
    let worstFirst = 0;
    const winners = new Set<number>();
    for (let k = 0; k < runs; k++) {
      const ord = lotteryOrder(ll, mulberry32(seed + 50000 + k));
      if (ord[0] === 5) worstFirst++;
      winners.add(ord[0]);
      if (k === 0) console.log(`  样例签序：${ord.slice(0, 6).map((id) => ll.teams[id].abbr).join(' → ')} …（共 30 签）`);
    }
    const share = worstFirst / runs;
    console.log(`  ${runs} 次抽签：最差队拿到状元 ${worstFirst} 次（${(share * 100).toFixed(1)}%，理论 14%）；状元分散在 ${winners.size} 支球队`);
    ok(worstFirst > 0 && worstFirst < runs, '乐透抽签生效：最差战绩不再稳拿状元签');
    ok(share > 0.07 && share < 0.25, `最差队状元概率接近理论 14%（实测 ${(share * 100).toFixed(1)}%）`);
    ok(winners.size >= 3, `状元签会落在多支球队（${winners.size} 支）`);

    // v2.5.0：Stepien 规则（禁止连续两年无首轮签）已按用户要求彻底移除
    const sl2 = createRealLeague(seed + 4248);
    sl2.userTeamId = 0;
    const myFirsts = sl2.draftPool.map((pk, i) => ({ pk, i })).filter((x) => x.pk.o === 0 && x.pk.round === 1);
    console.log(`  我方首轮签年份：${myFirsts.map((x) => x.pk.year).join(' / ')}`);
    const target = sl2.teams[1].players[0];
    const vAll = evaluateTrade(sl2, 0, 1, [], [target.id], myFirsts.map((x) => x.i), []);
    console.log(`  送出全部 ${myFirsts.length} 枚首轮：${vAll.accept ? '接受' : '拒绝'} — ${vAll.reason.slice(0, 56)}`);
    ok(!vAll.reason.includes('Stepien'), 'Stepien 规则已移除：送走全部首轮不再被该规则拦截');
    const vOne = evaluateTrade(sl2, 0, 1, [], [target.id], [myFirsts[0].i], []);
    console.log(`  只送出 ${myFirsts[0].pk.year} 一枚：${vOne.accept ? '接受' : '拒绝'} — ${vOne.reason.slice(0, 48)}`);
    ok(!vOne.reason.includes('Stepien'), '只送一枚首轮同样无 Stepien 相关提示');

    // 新秀薪资阶位（Rookie Scale）
    console.log(`  首轮薪资阶位：1 号签 ${rookieScaleSalary(1)} 万 · 15 号 ${rookieScaleSalary(15)} 万 · 30 号 ${rookieScaleSalary(30)} 万`);
    ok(rookieScaleSalary(1) === 1200 && rookieScaleSalary(30) === 200, '状元 1200 万 → 30 号秀 200 万');
    ok(rookieScaleSalary(10) > rookieScaleSalary(20), '薪资随顺位递减');

    // 选秀后新秀合同确实按阶位/底薪签订
    const dl2 = createRealLeague(seed + 4249);
    dl2.userTeamId = 0;
    while (dl2.day < dl2.totalDays) simDay(dl2);
    beginOffseason(dl2);
    const classIds = new Set((dl2.draft?.class ?? []).map((p) => p.id));
    const roundOf = new Map((dl2.draft?.order ?? []).map((pk, i) => [i, pk.round]));
    void roundOf;
    draftComplete(dl2);
    const drafted = dl2.teams.flatMap((t) => t.players).filter((p) => classIds.has(p.id));
    const maxSal = Math.max(0, ...drafted.map((p) => p.salary));
    const minSal = Math.min(...drafted.map((p) => p.salary));
    console.log(`  本届入队新秀 ${drafted.length} 人，年薪区间 ${minSal}-${maxSal} 万（状元签应为 ${rookieScaleSalary(1)} 万）`);
    ok(drafted.length > 40, `选秀入队人数正常（${drafted.length} 人）`);
    ok(maxSal === rookieScaleSalary(1), `状元签新秀拿阶位顶薪（${maxSal} 万）`);
    ok(minSal >= 200, `最末位新秀也不低于底薪档（${minSal} 万）`);
    ok(drafted.every((p) => p.contractYears >= 2 && p.contractYears <= 4), '新秀合同年限 2-4 年（首轮 4 年 / 次轮 2 年）');
  }

  // ---------- v2.3.0 交易搜索器 ----------
  console.log('== v2.3.0 交易搜索器（选筹码 → 搜全联盟可行组合）==');
  {
    const tl = createRealLeague(seed + 4250);
    tl.userTeamId = 0;
    const me = tl.teams[0];
    const byOvr = [...me.players].sort((a, b) => b.ovr - a.ovr);
    const t0 = Date.now();
    const res = searchTrades(tl, [byOvr[0].id], [], 3);
    const ms = Date.now() - t0;
    console.log(`  用核心球员（${byOvr[0].name}）搜索：${res.length} 条建议（${ms}ms）`);
    ok(res.length > 0, `搜索器能搜到可行交易（${res.length} 条）`);
    ok(ms < 2000, `搜索性能可接受（${ms}ms）`);
    ok(res.every((s) => s.givePids.length + s.givePickIdx.length > 0), '每条建议都含"你送出"的筹码');
    ok(res.every((s) => s.wantPids.length + s.wantPickIdx.length > 0), '每条建议都含"你得到"的筹码');
    const invalid = res.filter((s) =>
      !evaluateTrade(tl, me.id, s.teamId, s.givePids, s.wantPids, s.givePickIdx, s.wantPickIdx).accept);
    ok(invalid.length === 0, `所有建议都能通过完整规则校验（异常 ${invalid.length} 条）`);
    // 打包多名球员
    const multi = [byOvr[5].id, byOvr[6].id];
    const res2 = searchTrades(tl, multi, [], 3);
    ok(res2.length > 0, `打包多名球员同样能搜到方案（${res2.length} 条）`);
    // 带选秀权的搜索
    const firstPick = tl.draftPool.findIndex((pk) => pk.o === 0 && pk.round === 1);
    const res3 = searchTrades(tl, [], [firstPick], 3);
    ok(res3.length > 0, `用选秀权也能搜到方案（${res3.length} 条）`);
    // "需追加筹码"方案（AI 想要你好几个人）
    const up = [...res, ...res2, ...res3].filter((s) => s.needsMore);
    console.log(`  "需追加筹码"方案 ${up.length} 条${up.length ? `（样例：送你 ${up[0].givePids.length} 人 + ${up[0].givePickIdx.length} 签 → 得 ${up[0].wantPids.length} 人）` : ''}`);
    if (up.length) {
      const s = up[0];
      const base = [res, res2, res3].find((arr) => arr.some((x) => x.teamId === s.teamId)) ?? [];
      const sameTeam = base.find((x) => x.teamId === s.teamId);
      ok(!sameTeam || s.givePids.length >= sameTeam.givePids.length, '"需追加"方案确实比基础方案多要了你的筹码');
    }
    ok(searchTrades(tl, [], [], 3).length === 0, '未勾选筹码时不返回任何建议');
    // 成交后筹码确实转移
    const target = res[0];
    const beforeIds = me.players.map((p) => p.id).join(',');
    const tl2 = createRealLeague(seed + 4250);
    tl2.userTeamId = 0;
    applyTrade(tl2, 0, target.teamId, target.givePids, target.wantPids, target.givePickIdx, target.wantPickIdx);
    ok(tl2.teams[0].players.map((p) => p.id).join(',') !== beforeIds || target.givePids.length === 0, '执行建议后阵容发生变化');

    // ---------- v2.6.0 反向报价搜索器（我想要谁 → 算我要付什么）----------
    console.log('== v2.6.0 反向报价搜索器（选定对方球员 → 生成我方报价）==');
    const rival = tl.teams.slice(1).flatMap((t) => t.players.map((p) => ({ p, t })))
      .filter((x) => x.p.ovr >= 84 && x.p.age <= 30)
      .sort((a, b) => b.p.ovr - a.p.ovr)[0];
    const t1 = Date.now();
    const tres = searchTradeTargets(tl, [rival.p.id], [], 3);
    const tms = Date.now() - t1;
    console.log(`  目标 ${rival.p.name}（${rival.t.abbr} · OVR ${rival.p.ovr} · ${rival.p.age}岁）→ ${tres.length} 条报价（${tms}ms）`);
    ok(tres.length > 0, `反向搜索能给出报价方案（${tres.length} 条）`);
    ok(tms < 2000, `反向搜索性能可接受（${tms}ms）`);
    ok(tres.every((s) => s.wantPids.includes(rival.p.id)), '每条报价都以"我选定的球员"为回报');
    ok(tres.every((s) => s.givePids.length + s.givePickIdx.length > 0), '每条报价都写明我要付出什么');
    ok(tres.every((s) => s.myGiveVal > 0 && s.myGetVal > 0), '每条报价都带"我方折算"数值');
    ok(tres.every((s, i, arr) => i === 0 || arr[i - 1].gain >= s.gain), '报价按我方净收益降序');
    const tInvalid = tres.filter((s) => !evaluateTrade(tl, 0, s.teamId, s.givePids, s.wantPids, s.givePickIdx, s.wantPickIdx).accept);
    ok(tInvalid.length === 0, `所有报价都通过完整规则校验（异常 ${tInvalid.length} 条）`);
    // 锁定球员不会被当作筹码
    {
      const used = new Set(tres.flatMap((s) => s.givePids));
      const lockedPid = [...used][0];
      if (lockedPid != null) {
        tl.lockedPids = [lockedPid];
        const after = searchTradeTargets(tl, [rival.p.id], [], 3);
        ok(!after.some((s) => s.givePids.includes(lockedPid)), '锁定的球员不会出现在反向报价里');
        tl.lockedPids = [];
      }
    }
    ok(searchTradeTargets(tl, [], [], 3).length === 0, '未选目标时不返回报价');
  }

  // ---------- v2.3.0 年龄口径 / 自由市场数组不可变 ----------
  console.log('== v2.3.0 年龄口径与自由市场刷新 ==');
  {
    const al = createRealLeague(seed + 4251);
    const all = [...al.teams.flatMap((t) => t.players), ...al.freeAgents];
    const find = (n: string) => all.find((p) => p.name === n);
    const reese = find('朱利安·里斯');
    const wemby = find('维克托·文班亚马');
    const flagg = find('库珀·弗拉格');
    const castle = find('斯蒂芬·卡斯尔');
    console.log(`  里斯 ${reese?.age}岁 · 文班 ${wemby?.age}岁 · 弗拉格 ${flagg?.age}岁 · 卡斯尔 ${castle?.age}岁`);
    ok((reese?.age ?? 0) >= 22, `大四落选秀年龄修正（里斯 ${reese?.age} 岁，真实 23；旧公式算 19-22）`);
    ok((wemby?.age ?? 0) >= 21 && (wemby?.age ?? 0) <= 23, `文班亚马年龄贴近真实（${wemby?.age} 岁，真实 22）`);
    const avgAge = all.reduce((s, p) => s + p.age, 0) / all.length;
    const young = all.filter((p) => p.age <= 19).length;
    console.log(`  全联盟平均年龄 ${avgAge.toFixed(1)} 岁 · 19 岁以下 ${young} 人（占 ${(young / all.length * 100).toFixed(1)}%）`);
    ok(avgAge > 24 && avgAge < 29, `全联盟平均年龄合理（${avgAge.toFixed(1)} 岁）`);
    ok(young < all.length * 0.06, `"19 岁以下"比例正常（${young}/${all.length}）`);
    // 自由市场数组：必须"换新数组"（useGame 的 tick 是浅拷贝，就地 splice 会让 UI 的 useMemo 不失效）
    al.userTeamId = 0;
    const cheap = [...al.freeAgents].sort((a, b) => a.ovr - b.ovr)[0];
    const beforeRef = al.freeAgents;
    const res = signFreeAgentNow(al, 0, cheap.id, 1, Math.max(250, askFor(cheap)));
    console.log(`  自由市场签约：${res.ok ? '成功' : `失败（${res.note}）`}`);
    if (res.ok) {
      ok(al.freeAgents !== beforeRef, '签约后 freeAgents 换新数组（引用变化 → UI 立即刷新，无需切换页面）');
      ok(!al.freeAgents.some((p) => p.id === cheap.id), '签约球员已从自由市场移除');
    }
    // 裁人同样要换新数组
    const me0 = al.teams[0];
    const cutTarget = [...me0.players].sort((a, b) => a.ovr - b.ovr).find((p) =>
      me0.players.filter((q) => q.pos === p.pos).length > 1);
    if (cutTarget) {
      const faRef = al.freeAgents;
      const done = cutPlayer(al, cutTarget.id);
      ok(done && al.freeAgents !== faRef, '裁人后 freeAgents 换新数组（UI 立即刷新）');
    }
  }

  console.log('== v2.3.0 手动轮换排班（每分钟稳定，攻防同一批人）==');
  {
    const rl = createRealLeague(seed + 4252);
    const sas = rl.teams.find((t) => t.abbr === 'SAS')!;
    const okc = rl.teams.find((t) => t.abbr === 'OKC')!;
    // 复现用户场景：同一位置多人设自定义分钟（合计超 48 会按比例分配）
    for (const t of [sas, okc]) {
      t.players.forEach((p, i) => { p.min = i < 5 ? 36 : 12; });
    }
    const { result } = simulateGame(sas, okc, mulberry32(seed + 777), false, seed + 778);
    const boxOf = (box: typeof result.awayBox) => box ?? [];
    const lines = boxOf(result.awayBox);
    const played = lines.filter((b) => b.min > 0);
    console.log(`  SAS 上场 ${played.length} 人：${played.map((b) => {
      const p = sas.players.find((q) => q.id === b.pid)!;
      return `${p.name.slice(0, 4)}(${b.min}分/${b.fga}投)`;
    }).join(' ')}`);
    // 关键修复点：不再出现"上场 ≥15 分钟却 0 出手"的球员（旧实现里首发 SG 会 0 出手 36 分钟）
    const zeroShot = played.filter((b) => b.min >= 15 && b.fga === 0 && b.fta === 0);
    const names = zeroShot.map((b) => sas.players.find((q) => q.id === b.pid)?.name ?? '?');
    ok(zeroShot.length === 0, `没有"上场 ≥15 分钟却 0 出手"的球员（异常 ${zeroShot.length} 人：${names.join('、')}）`);
    // 出场时间符合设定（36 分钟档 → 约 24 分钟，因为同位置 2-3 人分摊）
    const maxMin = Math.max(...played.map((b) => b.min));
    ok(maxMin <= 48, `单人出场不超过 48 分钟（最高 ${maxMin}）`);
    const totalMin = played.reduce((s, b) => s + b.min, 0);
    ok(Math.abs(totalMin - 240) <= 12, `全队总分钟接近 240（${totalMin}）`);
    // +/- 自洽：全队 +/- 合计 = 5 × 分差（每次得分给场上 5 人各记该分数）
    const pmSum = played.reduce((s, b) => s + b.pm, 0);
    const expect = 5 * (result.awayScore - result.homeScore);
    const worst = Math.max(...played.map((b) => Math.abs(b.pm)));
    console.log(`  SAS +/- 合计 ${pmSum}（理论 5×分差 = ${expect}）· 单人最大 |+/-| = ${worst}（比分 ${result.awayScore}-${result.homeScore}）`);
    ok(Math.abs(pmSum - expect) <= 2, `+/- 合计与分差自洽（${pmSum} vs ${expect}）`);
    // 不再出现"首发 -80 / 替补 +85"那种分裂：单人 |+/-| 不超过 4 倍分差 + 10
    ok(worst <= Math.abs(result.awayScore - result.homeScore) * 4 + 10, `单人 +/- 不极端（最大 ${worst}）`);
  }

  // ---------- v2.4.0 位置审计 / 乐透可视化 / 选秀快进 / 落选秀 ----------
  console.log('== v2.4.0 位置·乐透·选秀流程 ==');
  {
    const al = createRealLeague(seed + 4253);
    al.userTeamId = 0;
    const all2 = al.teams.flatMap((t) => t.players);
    const ORDER2 = ['PG', 'SG', 'SF', 'PF', 'C'];
    const dray = all2.find((p) => p.name === '德雷蒙德·格林');
    const jw2 = all2.find((p) => p.name === '杰伦·威廉姆斯');
    const ac2 = all2.find((p) => p.name === '亚历克斯·卡鲁索');
    console.log(`  德雷蒙德·格林 ${dray?.pos}/${dray?.secPos} · 杰伦·威廉姆斯 ${jw2?.pos}/${jw2?.secPos} · 卡鲁索 ${ac2?.pos}/${ac2?.secPos}`);
    // v2.4.0：位置严格照搬 2K27 的 positions 数组（用户指定，不再推断/修正）
    ok(dray?.pos === 'PF' && dray?.secPos === 'C', `德雷蒙德·格林严格按 2K = PF/C（${dray?.pos}/${dray?.secPos}）`);
    ok(jw2?.pos === 'SG' && jw2?.secPos === 'SF', `杰伦·威廉姆斯 = SG/SF（用户指定例外，${jw2?.pos}/${jw2?.secPos}）`);
    ok(ac2?.pos === 'SF' && ac2?.secPos === 'PG', `卡鲁索严格按 2K = SF/PG（${ac2?.pos}/${ac2?.secPos}）`);
    // 主副位置不再强制相邻（2K 数据本身会出现 SF/PG、PG/C 这类组合）
    const samePos = all2.filter((p) => p.pos === p.secPos);
    ok(samePos.length === 0, `主副位置不重复（异常 ${samePos.length} 人）`);
    // 位置深度允许 <2 人（严格照搬 2K 的必然结果），由引擎 depthList 在比赛中借人兜底
    const thinPos: string[] = [];
    for (const t of al.teams) {
      for (const pos of ORDER2) {
        if (t.players.filter((p) => p.pos === pos).length < 1) thinPos.push(`${t.abbr}-${pos}`);
      }
    }
    ok(thinPos.length === 0, `每队五位置至少各 1 人（缺位：${thinPos.join(' ') || '无'}）`);

    while (al.day < al.totalDays) simDay(al);
    beginOffseason(al);
    ok(!!al.lottery, '乐透抽签结果已记录（供界面可视化展示）');
    if (al.lottery) {
      ok(al.lottery.order.length === 30, `抽签顺位含 30 队（${al.lottery.order.length}）`);
      ok(al.lottery.odds.length === 30 && al.lottery.odds[0] > 0, `含每队状元概率（首位 ${((al.lottery.odds[0] ?? 0) * 100).toFixed(1)}%）`);
      ok(al.lottery.top4.length === 4 && al.lottery.top4[0] === al.lottery.order[0], '前 4 顺位单独记录（用于高亮）');
      console.log(`  抽签：状元签 ${al.teams[al.lottery.order[0]].abbr}（该队抽前概率 ${((al.lottery.odds[0] ?? 0) * 100).toFixed(1)}%）· 乐透队共 ${al.lottery.odds.filter((o) => o > 0).length} 支`);
    }
    const beforeNext = al.draft!.next;
    const steps = draftFastToUserPick(al);
    console.log(`  快进到我的签：跳过 ${steps} 个 AI 签位（${beforeNext} → ${al.draft!.next}）`);
    ok(steps > 0 || draftIsUserTurn(al), '「快进到我的选秀」可用');
    const faRef = al.freeAgents;
    const faBefore = al.freeAgents.length;
    draftComplete(al);
    ok(al.freeAgents !== faRef, '落选秀加入后 freeAgents 换新数组（界面立即刷新，不再"看起来没进市场"）');
    ok(al.freeAgents.length > faBefore, `落选秀确实进入自由市场（${faBefore} → ${al.freeAgents.length} 人）`);
  }

  console.log('== 自定义轮换冒烟（v0.3.1）==');
  const ml = createLeague(seed + 77);
  const mt = ml.teams[0];
  const mPG = [...mt.players].find((p) => p.pos === 'PG')!;
  const mPG2 = [...mt.players].filter((p) => p.pos === 'PG')[1];
  const mPG3 = [...mt.players].filter((p) => p.pos === 'PG')[2];
  mPG.min = 20;
  mPG2.min = 16;
  mPG3.min = 12; // 合计 48
  mt.initiator = 'C';
  const mc = [...mt.players].find((p) => p.pos === 'C')!;
  mc.usage = 10;
  const mg = simulateGame(mt, ml.teams[1], mulberry32(3));
  const line = mg.result.awayBox ?? [];
  const findMin = (pid: number) => line.find((b) => b.pid === pid)?.min ?? 0;
  ok(mPG.gp === 1 && mPG.starts === 1, `手动轮换：PG 首发上场（gp=${mPG.gp}）`);
  console.log(`  手动 PG 轮换分钟: ${mPG.name} ${findMin(mPG.id)} / ${mPG2.name} ${findMin(mPG2.id)} / ${mPG3.name} ${findMin(mPG3.id)}（目标 20/16/12）`);
  ok(findMin(mPG.id) + findMin(mPG2.id) + findMin(mPG3.id) >= 44, '手动轮换分钟总量合理');
  ok(mc.gp === 1, '自定义球权中锋仍出场');
  for (const p of mt.players) { p.min = null; p.usage = null; }
  mt.initiator = 'PG';
  // 恢复自动后：同 seed 两次自动模拟应完全一致（确定性复现；自定义开关只在置位时生效）
  // v0.3.7：伤病由独立 injurySeed 判定，清空双方伤病后两场结果一致
  const clearInj = () => { for (const t of ml.teams) for (const p of t.players) p.injury = null; };
  clearInj();
  const backAuto = simulateGame(mt, ml.teams[1], mulberry32(3), true, 0);
  clearInj();
  const backAuto2 = simulateGame(mt, ml.teams[1], mulberry32(3), true, 0);
  ok(backAuto.result.awayScore === backAuto2.result.awayScore && backAuto.result.homeScore === backAuto2.result.homeScore, '自动轮换路径确定性（自定义清除后与 v0.3 行为一致）');

  console.log('== v0.3.7 伤病系统冒烟 ==');
  {
    // 1) 伤停期间不出场：gp 不增，场次递减，归零复出
    const il = createLeague(seed + 404);
    const injured = il.teams[0].players[0];
    injured.injury = { type: '肌肉拉伤', games: 2 };
    const gpBefore = injured.gp;
    const gA = simulateGame(il.teams[0], il.teams[1], mulberry32(11), true, 7);
    ok(injured.gp === gpBefore, `伤停第 1 场不出场（gp ${gpBefore}→${injured.gp}）`);
    ok(injured.injury!.games === 1, `伤停场次递减（2→${injured.injury!.games}）`);
    const gB = simulateGame(il.teams[0], il.teams[1], mulberry32(12), true, 8);
    ok(injured.injury === null, '伤停归零复出');
    ok(injured.gp === gpBefore + 1, `复出后正常出场（gp=${injured.gp}）`);
    ok(gA.injuries.length === 0 || gB.injuries.length === 0, '伤病事件数组结构可用');
    // 2) 大量比赛产生伤病事件；耐久高者显著更少
    const rl2 = createLeague(seed + 505);
    const hiT = rl2.teams[0];
    const loT = rl2.teams[1];
    for (const p of hiT.players) p.body.durability = 96;
    for (const p of loT.players) p.body.durability = 45;
    let hi = 0, lo = 0;
    for (let i = 0; i < 200; i++) {
      const gi = simulateGame(hiT, loT, mulberry32(1000 + i), false, 5000 + i);
      hi += gi.injuries.filter((x) => x.tid === hiT.id).length;
      lo += gi.injuries.filter((x) => x.tid === loT.id).length;
      for (const t of rl2.teams) for (const p of t.players) p.injury = null; // 每场清空，统计独立事件
    }
    console.log(`  200 场冒烟：高耐久伤停 ${hi} 起 vs 低耐久 ${lo} 起`);
    ok(hi + lo >= 2, `真实伤病事件发生（${hi + lo} 起）`);
    ok(hi <= lo, `高耐久伤停不高于低耐久（${hi} ≤ ${lo}）`);
  }

  console.log('== v0.3.7 位置换位（v2.0 双位置：只能在主/副位间互换，不交换他人）==');
  {
    const pl = createLeague(seed + 606);
    const t1 = pl.teams[0];
    const pg = [...t1.players].find((p) => p.pos === 'PG')!;
    const pgOvrBefore = pg.ovr;
    const sec = pg.secPos; // PG 的副位 = SG
    ok(sec === 'SG', 'PG 默认副位 SG（相邻位置）');
    // 合法：PG → SG（主副互换）
    const res = repositionPlayer(t1, pg.id, 'SG');
    ok(res.moved.id === pg.id && pg.pos === 'SG' && pg.secPos === 'PG', '拖到副位：主副互换成功');
    ok(res.swapped == null, '双位置规则：不与其他球员交换');
    ok(pg.ovr !== pgOvrBefore, `换位后 OVR 适配变化（${pgOvrBefore}→${pg.ovr}）`);
    const posSet = new Set(t1.players.map((p) => p.pos));
    ok(posSet.size === 5, '换位后五位置仍齐全');
    // 非法：拖到第三位置（C）应拒绝
    let threw = false;
    try { repositionPlayer(t1, pg.id, 'C'); } catch { threw = true; }
    ok(threw, '只能拖到 {主,副} 两个位置（C 被拒）');
    // 幂等：换回原位置精确还原
    repositionPlayer(t1, pg.id, 'PG');
    ok(pg.pos === 'PG' && pg.ovr === pgOvrBefore, `换回原位置 OVR 精确还原（应 ${pgOvrBefore}）`);
    // 再反复换：数值稳定
    repositionPlayer(t1, pg.id, 'SG');
    const ovrAfter = pg.ovr;
    repositionPlayer(t1, pg.id, 'PG');
    repositionPlayer(t1, pg.id, 'SG');
    ok(pg.ovr === ovrAfter, '反复换位数值稳定（幂等）');
    ok(bodyKeys().every((k) => typeof pg.body[k] === 'number' && pg.body[k] >= 25 && pg.body[k] <= 99), '身体属性字段完整（25-99）');
  }

  console.log('== v2.2 球权分配（前场 SF/PF/C 更多 · 能力球员更多）==');
  {
    const pl = createLeague(seed + 2022);
    const tA = pl.teams[0];
    const g = simulateGame(tA, pl.teams[1], mulberry32(21), true, 99);
    const box = g.result.awayBox ?? [];
    const fgaOf = (pos: string) => box
      .filter((b) => tA.players.find((p) => p.id === b.pid)?.pos === pos)
      .reduce((s, b) => s + b.fga, 0);
    const front = fgaOf('SF') + fgaOf('PF') + fgaOf('C');
    const back = fgaOf('PG') + fgaOf('SG');
    console.log(`  前场出手 ${front} vs 后场 ${back}；队内最强出手 vs 平均`);
    ok(front > back, `前场（SF/PF/C）出手多于后场（${front} vs ${back}）`);
    const played = box.filter((b) => b.min > 0);
    const topPlayed = [...played].sort((a, b) => {
      const pa = tA.players.find((p) => p.id === a.pid)!;
      const pb = tA.players.find((p) => p.id === b.pid)!;
      return pb.ovr - pa.ovr;
    })[0];
    const avg = played.reduce((s, b) => s + b.fga, 0) / Math.max(1, played.length);
    ok(!!topPlayed && topPlayed.fga >= avg * 0.85, `出场最强球员出手不低于平均 85%（${topPlayed?.fga} vs ${avg.toFixed(1)}）`);
  }

  console.log('== 战力模型 ==');
  const sA = teamStrength(l.teams[0].players);
  const sB = teamStrength(l.teams[1].players);
  ok(sA > 0 && sB > 0, `teamStrength 可用 ${sA} / ${sB}`);

  console.log('== 存档迁移 v1→v9 ==');
  const oldClone = JSON.parse(JSON.stringify(l)) as LeagueState;
  delete (oldClone as unknown as Record<string, unknown>).mode;
  delete (oldClone as unknown as Record<string, unknown>).freeAgents;
  delete (oldClone as unknown as Record<string, unknown>).draftPool;
  delete (oldClone as unknown as Record<string, unknown>).cultureId;
  delete (oldClone as unknown as Record<string, unknown>).faDay;
  delete (oldClone as unknown as Record<string, unknown>).faOffers;
  delete (oldClone as unknown as Record<string, unknown>).poffExitShown;
  delete (oldClone as unknown as Record<string, unknown>).pendingEvents;
  delete (oldClone as unknown as Record<string, unknown>).draft;
  for (const t of oldClone.teams) {
    delete (t as unknown as Record<string, unknown>).initiator;
    delete (t as unknown as Record<string, unknown>).chemistry;
    delete (t as unknown as Record<string, unknown>).discipline;
    delete (t as unknown as Record<string, unknown>).brand;
    delete (t as unknown as Record<string, unknown>).fans;
    delete (t as unknown as Record<string, unknown>).style;
    delete (t as unknown as Record<string, unknown>).coachStyle;
    for (const p of t.players) {
      delete (p as unknown as Record<string, unknown>).exp;
      delete (p as unknown as Record<string, unknown>).min;
      delete (p as unknown as Record<string, unknown>).usage;
      delete (p as unknown as Record<string, unknown>).basePos;
      delete (p as unknown as Record<string, unknown>).baseAttrs;
      delete (p as unknown as Record<string, unknown>).baseOvr;
      delete (p as unknown as Record<string, unknown>).grow;
      delete (p as unknown as Record<string, unknown>).tags;
      delete (p as unknown as Record<string, unknown>).secPos;
      delete (p as unknown as Record<string, unknown>).baseSkills;
      delete (p as unknown as Record<string, unknown>).points;
      delete (p as unknown as Record<string, unknown>).career;
      delete (p as unknown as Record<string, unknown>).nation;
      delete (p as unknown as Record<string, unknown>).potential;
    }
  }
  const nameBefore = oldClone.teams[0].players[0].name;
  migrateSave(oldClone);
  ok(oldClone.mode === 'fictional', '旧档模式识别为虚构');
  ok(oldClone.freeAgents.length >= 50, `老档迁移自动补建初始自由市场（${oldClone.freeAgents.length} 人）`);
  ok(oldClone.teams[0].players.every((p) => p.exp > 0), 'exp 回填');
  ok(oldClone.teams[0].players.every((p) => p.min === null && p.usage === null), 'min/usage 回填 null（自动）');
  ok(oldClone.teams.every((t) => t.initiator === 'PG'), 'initiator 回填 PG');
  ok(oldClone.draftPool.length === 180 && oldClone.draftPool.every((pk) => pk.year && (pk.round === 1 || pk.round === 2)), 'draftPool 回填 180 枚（含年份/轮次）');
  ok(oldClone.teams[0].players[0].name === nameBefore, '虚构档名字不翻译（保持原样）');
  ok(oldClone.teams[0].players.every((p) => p.body && bodyKeys().every((k) => p.body[k] >= 25 && p.body[k] <= 99)), 'migrate 补身体属性（v4）');
  ok(oldClone.teams[0].players.every((p) => p.injury === null), 'migrate 补 injury=null（v4）');
  ok(oldClone.teams[0].players.every((p) => p.face === undefined), '虚构档不补头像（v4）');
  ok(oldClone.teams[0].players.every((p) => p.basePos === p.pos && p.baseAttrs && p.baseOvr === p.ovr), 'migrate 补位置基准（v5，以当前值为基准）');
  ok(oldClone.teams.every((t) => t.chemistry === 50 && t.discipline === 50 && t.brand === 50 && t.fans === 100), 'migrate 补球队气质（v6 中性默认）');
  ok(oldClone.teams[0].players.every((p) => p.grow === 1), 'migrate 补 grow=1（v6）');
  ok(oldClone.cultureId === null, 'migrate 补 cultureId=null（v6）');
  ok(oldClone.teams.every((t) => (t.style === null || ['youth', 'star'].includes(t.style as string)) && (t.coachStyle === null || ['iron', 'locker', 'brand'].includes(t.coachStyle as string))), 'migrate 补球队/执教风格拆分（v7/v9）');
  ok(oldClone.teams[0].players.every((p) => Array.isArray(p.tags)), 'migrate 补标签数组（v7）');
  ok(oldClone.teams[0].players.some((p) => p.ovr >= 80 && p.tags.length >= 1), 'migrate 标签规则：80+ 至少 1 个标签（v7）');
  // v9：双位置 / 潜力星 / 技能基准 / 加点 / 生涯 / 国籍 / 执教风格 / FA 7 天 / 待处理事件
  ok(oldClone.teams[0].players.every((p) => p.secPos && ['PG', 'SG', 'SF', 'PF', 'C'].includes(p.secPos)), 'migrate 补双位置（v9）');
  ok(oldClone.teams[0].players.every((p) => p.potential >= 1 && p.potential <= 10), 'migrate 潜力换算 1-10 星（v9）');
  ok(oldClone.teams[0].players.every((p) => p.baseSkills && typeof p.baseSkills.three === 'number'), 'migrate 补技能基准 baseSkills（v9）');
  ok(oldClone.teams[0].players.every((p) => p.points === 0 && p.career && p.nation === '美国'), 'migrate 补 points/career/nation（v9）');
  ok(oldClone.teams.every((t) => t.coachStyle === null || ['iron', 'locker', 'brand'].includes(t.coachStyle)), 'migrate 补执教风格（v9）');
  ok(oldClone.faDay === 1 && oldClone.faOffers.length === 0 && oldClone.poffExitShown === false, 'migrate 补 FA 7 天/淘汰弹窗字段（v9）');
  ok(Array.isArray(oldClone.pendingEvents), 'migrate 补 pendingEvents（v9）');
  ok(oldClone.draft === null, 'migrate 补 draft=null（v10）');
  if (oldClone.awards) ok(Array.isArray(oldClone.awards.allDefense) && oldClone.awards.allDefense.length === 2, 'migrate 补 allDefense（v9）');

  console.log('== 赛程空洞推进 + 赛季中自由签约（v0.3.3）==');
  // —— 空洞天：清空第 5 天的赛程 → simDay 照常推进，快进不卡死 ——
  const hle = createLeague(seed + 888);
  hle.schedule[4] = [];
  while (hle.day < 4) simDay(hle);
  const holeRep = simDay(hle);
  ok(!!holeRep && holeRep.day === 5 && holeRep.games.length === 0, '空洞天照常推进（不卡死）');
  const afterHole = simDay(hle);
  ok(!!afterHole && afterHole.day === 6, '空洞后继续正常比赛日');
  const mn = nextGameOf(hle, 0);
  ok(!mn || mn.day > hle.day, 'nextGameOf 只指向未来比赛');
  while (hle.day < hle.totalDays) simDay(hle);
  ok(hle.day === hle.totalDays, '含空洞的赛程可一路快进到底');
  // —— v0.3.4 防重复保险丝：同一天已打完 → 再模拟应跳过而非重打 ——
  const fuse = createLeague(seed + 7777);
  const fuseDay0 = fuse.day;
  const r1 = simDay(fuse);
  ok(r1 !== null && fuse.day === fuseDay0 + 1 && fuse.results.length > 0, '保险丝：正常模拟一天');
  const n1 = fuse.results.length;
  fuse.day--; // 模拟外部污染：日期回卷 1 天
  const r2 = simDay(fuse);
  ok(r2 !== null && r2.games.length === 0 && fuse.results.length === n1 && fuse.day === fuseDay0 + 1, '保险丝：同一天不重复模拟（results 不增）');
  // —— 赛季中自由签约（虚构 l：已进第二季、15 人名单、市场就绪）——
  const me2 = l.teams[0];
  const pay = payrollOf(me2.players);
  console.log(`  我的工资单 ${pay}万（帽 ${SALARY_CAP}万 / 税线 ${TAX_LINE}万）`);
  const beforePool = l.freeAgents.length;
  const askHigh = [...l.freeAgents].sort((a, b) => askFor(b) - askFor(a))[0];
  if (askHigh && askFor(askHigh) > 500) {
    const rLow = signFreeAgentNow(l, 0, askHigh.id, 2, 250);
    ok(!rLow.ok && rLow.note.includes('低于'), `报价过低被拒（${rLow.note}）`);
  } else {
    console.log('  （市场无人要价 >500，跳过报价过低断言）');
  }
  const cheap = [...l.freeAgents].sort((a, b) => askFor(a) - askFor(b))[0];
  const rCheap = signFreeAgentNow(l, 0, cheap.id, 2, Math.max(300, askFor(cheap)));
  ok(rCheap.ok, `底薪通道即时签约成交（${rCheap.note}）`);
  ok(me2.players.length === 16, `签后名单 16 人（≤17，实际 ${me2.players.length}）`);
  // 中产通道：仅当工资单在帽上-税线区间才存在（帽下自由签、超税线无中产）
  const midCandidates = [...l.freeAgents].filter((p) => askFor(p) > 500 && askFor(p) <= 1500);
  if (pay > SALARY_CAP && pay < TAX_LINE && midCandidates.length >= 2) {
    const a1 = signFreeAgentNow(l, 0, midCandidates[0].id, 1, askFor(midCandidates[0]));
    const a2 = signFreeAgentNow(l, 0, midCandidates[1].id, 1, askFor(midCandidates[1]));
    ok(a1.ok && l.midUsed[0], `中产特例可用并占用（${a1.note}）`);
    ok(!a2.ok, `中产特例每赛季 1 次：再次使用被拒（${a2.note}）`);
  } else if (pay <= SALARY_CAP) {
    const free1 = midCandidates[0] ?? askHigh;
    if (free1 && free1.id !== cheap.id) {
      const rFree = signFreeAgentNow(l, 0, free1.id, 1, askFor(free1));
      ok(rFree.ok, `帽下空间队自由签约任意价位（${rFree.note}）`);
    }
  } else {
    console.log('  （超税线：只有底薪通道，跳过中产断言）');
  }
  // 名单补满到 17 后：再签被拒
  const cheapish = [...l.freeAgents].sort((a, b) => askFor(a) - askFor(b));
  while (me2.players.length < ROSTER_MAX && cheapish.length) {
    const m = cheapish.shift()!;
    const rr = signFreeAgentNow(l, 0, m.id, 1, 300);
    if (!rr.ok) break;
  }
  ok(me2.players.length <= ROSTER_MAX, `名单不超过 ${ROSTER_MAX}（实际 ${me2.players.length}）`);
  if (me2.players.length >= ROSTER_MAX) {
    const over = cheapish.find((p) => askFor(p) <= 352);
    if (over) {
      const rr2 = signFreeAgentNow(l, 0, over.id, 1, 300);
      ok(!rr2.ok && rr2.note.includes('已满'), `名单满 ${ROSTER_MAX} 时拒绝签约（${rr2.note}）`);
    }
  }
  ok(l.freeAgents.length < beforePool, `市场人数随签约减少（${beforePool} → ${l.freeAgents.length}）`);

  console.log(`== 全部通过 ==（失败数 ${fails}）`);
  if (fails > 0) process.exit(1);
}

// ---------- 真实名单（2K27 评分 · 2026-27 阵容）专项验证 ----------
function findPlayer(l: LeagueState, name: string) {
  for (const t of l.teams) {
    const p = t.players.find((x) => x.name === name);
    if (p) return { p, abbr: t.abbr };
  }
  return null;
}

function runReal(): void {
  const seed = Number(process.env.TEST_SEED || 20250906);
  console.log('\n== 真实名单联赛（2026-27 赛季 · 2K27 评分 · 中文名）==');
  const l = createRealLeague(seed);
  checkRoster(l, '真实初始');
  ok(l.freeAgents.length >= 110, `真实开档即有自由市场（${l.freeAgents.length} 人）`);
  ok(l.freeAgents.some((p) => p.name === '约纳斯·瓦兰丘纳斯'), '真实市场含瓦兰丘纳斯');
  ok(l.freeAgents.some((p) => p.name === '布鲁斯·布朗'), '真实市场含布鲁斯·布朗');
  console.log('球员总数', l.teams.reduce((s, t) => s + t.players.length, 0), '；年份', l.year, '；模式', l.mode);
  const checks: [string, (o: number, a: number) => boolean][] = [
    ['尼古拉·约基奇', (o) => o >= 95],
    ['维克托·文班亚马', (o) => o >= 95],
    ['杰森·塔图姆', (o) => o >= 90],
    ['勒布朗·詹姆斯', (_o, a) => a >= 34],
    ['斯蒂芬·库里', (o) => o >= 90],
    ['库珀·弗拉格', (_o, a) => a <= 21],
    ['杨瀚森', (_o, a) => a >= 18],
    ['八村塁', (_o, a) => a >= 18],
  ];
  for (const [n, cond] of checks) {
    const hit = findPlayer(l, n);
    console.log(`  ${hit ? '✓' : '✗ 缺'} ${n}: ${hit ? `${hit.p.pos} o${hit.p.ovr} a${hit.p.age}岁 e${hit.p.exp} ${hit.abbr}` : ''}${hit && !cond(hit.p.ovr, hit.p.age) ? ' ← 数值可疑' : ''}`);
    if (hit) ok(cond(hit.p.ovr, hit.p.age), `${n} 数值区间`);
  }
  // 中文名应已内置（保留"OG/V.J."这类常见字母缩写前缀是正常的）
  const noZh = [...l.teams.flatMap((t) => t.players)].filter((p) => !/[\u4e00-\u9fff]/.test(p.name));
  ok(noZh.length === 0, `真实名单球员名均含中文（异常 ${noZh.length}: ${noZh.slice(0, 3).map((p) => p.name).join('/')}）`);
  // v2.5.0：杨瀚森 = 2005 年生（出生年校正，此前年龄偏大）
  const yhs = findPlayer(l, '杨瀚森');
  console.log(`  杨瀚森：${yhs ? `${yhs.p.age}岁 · ${yhs.p.pos} · OVR ${yhs.p.ovr} · ${yhs.abbr}` : '不在名单'}`);
  if (yhs) ok(yhs.p.age <= 21, `杨瀚森年龄按 2005 年生修正（${yhs.p.age}岁）`);
  // v2.5.0：杰伦·威廉姆斯 = 分卫/小前（用户指定例外）
  const jwA = findPlayer(l, '杰伦·威廉姆斯');
  ok(jwA?.p.pos === 'SG' && jwA?.p.secPos === 'SF', `杰伦·威廉姆斯 = SG/SF（${jwA?.p.pos}/${jwA?.p.secPos}）`);
  // v2.5.1 用户实例回归：萨博尼斯(85/29) 单换 莫布利(87/24) —— 更强且更年轻的一方必须更值钱，交易必须被拒
  {
    const dom = findPlayer(l, '多曼塔斯·萨博尼斯')?.p;
    const mob = findPlayer(l, '埃文·莫布利')?.p;
    if (dom && mob) {
      const cle = l.teams.find((t) => t.players.some((p) => p.id === mob.id));
      const sac = l.teams.find((t) => t.players.some((p) => p.id === dom.id));
      if (cle && sac) {
        const ph = teamPhase(cle);
        const vMob = phaseValue(mob, ph), vSab = phaseValue(dom, ph);
        const tr = evaluateTrade(l, sac.id, cle.id, [dom.id], [mob.id], [], []);
        console.log(`  实例回归：${cle.abbr}(${phaseLabel(ph)}) 眼中 莫布利 ${vMob.toFixed(2)} vs 萨博尼斯 ${vSab.toFixed(2)} → ${tr.accept ? '成交（异常！）' : '拒绝'}`);
        console.log(`    理由：${tr.reason.slice(0, 96)}`);
        ok(vMob > vSab, `更强更年轻的莫布利在争冠队眼中更值钱（${vMob.toFixed(2)} > ${vSab.toFixed(2)}）`);
        ok(!tr.accept, '萨博尼斯单换莫布利被对方拒绝（旧算法曾判"基本对等"）');
      }
    }
  }
  // 旧档改名迁移：英文名 → 中文
  const clone = JSON.parse(JSON.stringify(l)) as LeagueState;
  const en1 = clone.teams[0].players.find((p) => p.name === '杰森·塔图姆') ?? clone.teams[0].players[0];
  en1.name = 'Jayson Tatum';
  delete (clone as unknown as Record<string, unknown>).draftPool;
  delete (clone as unknown as Record<string, unknown>).awards;
  // v1.4 旧档无 18 项技能 → migrate 按中文名从 2K 数据重建
  delete (en1 as Partial<Player>).skills;
  migrateSave(clone);
  ok(clone.teams[0].players.some((p) => p.name === '杰森·塔图姆'), 'migrate 将英文名还原为中文');
  ok(clone.teams[0].players.every((p) => p.skills), 'migrate 补 18 项技能（真实球员按中文名重建）');
  ok(clone.draftPool.length === 180, 'migrate 补 draftPool（180 枚）');
  ok(clone.teams[0].players.every((p) => p.min === null && p.usage === null), 'migrate 补 min/usage 默认值');
  ok(clone.teams[0].initiator === 'PG', 'migrate 补 initiator');
  const all = [...l.teams.flatMap((t) => t.players)];
  const withFace = all.filter((p) => p.face).length;
  console.log(`真实球员大头照 ${withFace}/${all.length}（无头像用队徽占位）`);
  ok(withFace > 440, `30队出战球员全有真实照片（${withFace}/${all.length}）`);
  ok(all.every((p) => p.body && bodyKeys().every((k) => p.body[k] >= 25 && p.body[k] <= 99)), '真实球员身体属性完整（25-99）');
  ok(all.every((p) => p.skills && SKILL_KEYS.every((k) => p.skills[k] >= 25 && p.skills[k] <= 99)), '真实球员 18 项技能完整（25-99）');
  ok(all.every((p) => p.potential >= 1 && p.potential <= 10), '真实球员潜力 1-10 星');
  ok(all.every((p) => p.secPos && ['PG', 'SG', 'SF', 'PF', 'C'].includes(p.secPos)), '真实球员双位置字段');
  ok(all.every((p) => p.career && typeof p.nation === 'string'), '真实球员生涯/国籍字段');
  const jt = findPlayer(l, '杰森·塔图姆')?.p;
  if (jt) console.log(`  塔图姆技能：三分 ${jt.skills.three} · 篮下 ${jt.skills.layup} · 防守板 ${jt.skills.dr} · 弹性 ${jt.skills.vertical} · 均值/算法总评/官方 ${Math.round(SKILL_KEYS.reduce((s, k) => s + jt.skills[k], 0) / 18)}/${calcOvr(jt.skills)}/${jt.ovr}`);
  ok(all.every((p) => p.injury === null), '新档伤病初始为空');
  const top5 = [...all].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  console.log('联盟前五:', top5.map((p) => `${p.name} ${p.ovr}`).join(' / '));
  console.log('OVR≥90:', all.filter((p) => p.ovr >= 90).length, '人；≥85:', all.filter((p) => p.ovr >= 85).length, '人；35岁+:', all.filter((p) => p.age >= 35).length, '人');

  simSeason(l, '真实名单');
  console.log('得分王:', leaders(l, 'pts')[0]?.player.name, leaders(l, 'pts')[0]?.value.toFixed(1),
    '| 篮板王:', leaders(l, 'reb')[0]?.player.name, leaders(l, 'reb')[0]?.value.toFixed(1));

  const champ = fullPlayoffs(l);
  console.log('== 总冠军:', champ >= 0 ? l.teams[champ].abbr : '无');

  console.log('== 赛季奖项 + 休赛期（真实名单）==');
  ok(l.finalsAccum.length > 0, '总决赛战报已累计');
  runOffseasonFlow(l, '真实', true);
  // 真实模式首个休赛期池应含 2K 自由球员
  const faReal = l.freeAgents.filter((p) => p.name === '约纳斯·瓦兰丘纳斯' || p.name === '布鲁斯·布朗');
  ok(l.mode === 'real', '真实模式');
  ok(l.season >= 2, '进入第二季');
  const all2 = [...l.teams.flatMap((t) => t.players)];
  console.log('次季球员数', all2.length, '；35岁+', all2.filter((p) => p.age >= 35).length, '人；fa 真实残余:', faReal.map((p) => p.name).join('/') || '已签或退役');
  console.log(`== 全部通过 ==（失败数 ${fails}）`);
  if (fails > 0) process.exit(1);
}

run();
runReal();
