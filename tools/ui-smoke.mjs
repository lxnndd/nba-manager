// UI 真机冒烟：真实点击流验证"模拟到下一场/快进"是否推进比赛日
// 用法：node tools/ui-smoke.mjs [port]
const port = Number(process.argv[2] || 9333);
import fs from 'node:fs';

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((p) => p.type === 'page');
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let idc = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++idc; pend.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (expr, timeout = 20000, step = 300) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await ev(expr)) return true;
      await sleep(step);
    }
    return false;
  };
  const dayNow = () => ev(`(()=>{const s=document.querySelector('.status-strip');if(!s)return null;const m=s.textContent.match(/比赛日\\s*(\\d+)\\s*\\/\\s*(\\d+)/);return m?[Number(m[1]),Number(m[2])]:null})()`);
  const bodyText = () => ev('document.body.innerText.slice(0,500)');
  const closeModal = () => ev(`(()=>{const m=document.querySelector('.modal-mask');if(m){m.click();return 'closed'}return 'none'})()`);
  const clickBtn = (label) => ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(label)}));if(!b)return 'notfound';if(b.disabled)return 'disabled';b.click();return 'clicked'})()`);
  const shot = async (name) => {
    try {
      const r = await Promise.race([
        send('Page.captureScreenshot', { format: 'png' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('shot timeouts')), 8000)),
      ]);
      if (r.result?.data) fs.writeFileSync(`C:/Users/10709/Desktop/AI/${name}.png`, Buffer.from(r.result.data, 'base64'));
      return 'ok';
    } catch { return 'skip'; }
  };

  const log = (s) => console.log(s);

  // 1) 等标题屏
  log('1. 等待标题屏...');
  const onTitle = await waitFor(`document.body.innerText.includes('开始新游戏')`);
  log(`   标题屏: ${onTitle ? 'OK' : '超时'}`);
  if (!onTitle) { log('   当前界面: ' + (await bodyText()).slice(0, 300)); return; }
  const bgUrl = await ev(`(()=>{const b=document.querySelector('.title-bg');return b?getComputedStyle(b).backgroundImage.slice(0,60):'none'})()`);
  log(`   v1.1 背景轮播: ${bgUrl.startsWith('url(') ? 'OK ' + bgUrl : '无'}`);
  await shot('ui-smoke-1-title');

  // 1.5) v1.1 更新弹窗（首次启动出现）→ 关闭
  const hasCl = await ev(`!!document.querySelector('.changelog-modal')`);
  if (hasCl) {
    const rCl = await clickBtn('知道了，开始游戏');
    log(`   关闭 v1.1 更新弹窗: ${rCl}`);
    await sleep(400);
  }

  // 2) 开始新游戏 → 选队
  log('2. 点「开始新游戏」...');
  let r = await clickBtn('开始新游戏');
  log(`   结果: ${r}`);
  await sleep(400);
  // 防覆盖确认（有存档时按钮文案变为"再点一次确认新建（会覆盖当前存档）"）
  if (await ev(`document.body.innerText.includes('确认新建')`)) {
    log('   检测到覆盖确认，再点一次');
    r = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('确认新建'));if(b){b.click();return 'clicked'}return 'notfound'})()`);
    log(`   结果: ${r}`);
    await sleep(400);
  }
  const onPick = await waitFor(`!!document.querySelector('.team-card')`, 10000);
  log(`   选队界面: ${onPick ? 'OK' : '超时'}`);
  if (!onPick) { log('   当前界面: ' + (await bodyText()).slice(0, 300)); return; }
  await ev(`document.querySelectorAll('.team-card')[0].click()`);
  await sleep(600);
  // v2.0 建队流程：球队风格二选一（youth/star）→ 执教风格三选一（iron/locker/brand）
  const onCulture = await waitFor(`!!document.querySelector('.culture-card')`, 10000);
  const cultureN = await ev(`document.querySelectorAll('.culture-card').length`);
  log(`   球队风格选择页: ${onCulture ? 'OK' : '超时'}（卡片数=${cultureN}，v2.0 应为 2）`);
  if (onCulture) {
    await ev(`document.querySelectorAll('.culture-card')[0].click()`);
    await sleep(800);
  }
  const onCoach = await waitFor(`(()=>{const t=document.body.innerText;const n=document.querySelectorAll('.culture-card').length;return t.includes('执教风格')&&n===3})()`, 10000);
  const coachN = await ev(`document.querySelectorAll('.culture-card').length`);
  log(`   执教风格选择页: ${onCoach ? 'OK' : '超时'}（卡片数=${coachN}，v2.0 应为 3）`);
  if (onCoach) {
    await ev(`document.querySelectorAll('.culture-card')[0].click()`);
    await sleep(1000);
  }

  // 3) 进入赛程页（默认视图 schedule）
  const inGame = await waitFor(`document.body.innerText.includes('比赛日')`, 15000);
  log(`3. 进入游戏(赛程页): ${inGame ? 'OK' : '超时'}`);
  let d = await dayNow();
  log(`   初始比赛日: ${d ? d[0] + '/' + d[1] : 'null'}`);
  await shot('ui-smoke-2-start');

  // 4) 连点 4 次「模拟到你的下一场」
  log('4. 连点 4 次「模拟到你的下一场」...');
  for (let i = 1; i <= 4; i++) {
    const before = await dayNow();
    await closeModal();
    r = await clickBtn('模拟到你的下一场');
    // 模拟/渲染耗时不定 → 轮询等待比赛日推进（最多 8s）
    const advanced = await waitFor(`(()=>{const s=document.querySelector('.status-strip');const m=s&&s.textContent.match(/比赛日\\s*(\\d+)\\s*\\/\\s*(\\d+)/);return m?Number(m[1])>${before ? before[0] : -1}:false})()`, 8000, 250);
    const after = await dayNow();
    const rows = await ev(`document.querySelectorAll('.score-row').length`);
    log(`   第${i}次: 按钮=${r} 比赛日 ${before ? before[0] : '?'} → ${after ? after[0] : '?'} 推进=${advanced} 当日比分行=${rows}`);
    if (!advanced) { log('   ❌ 未推进！界面文本: ' + (await bodyText()).slice(0, 400)); await shot('ui-smoke-3-stuck'); break; }
    await shot(`ui-smoke-3-click${i}`);
  }

  // 5) 快进 7 天
  log('5. 点「快进 7 天」...');
  const b5 = await dayNow();
  await closeModal();
  r = await clickBtn('快进 7 天');
  const a5ok = await waitFor(`(()=>{const s=document.querySelector('.status-strip');const m=s&&s.textContent.match(/比赛日\\s*(\\d+)\\s*\\/\\s*(\\d+)/);return m?Number(m[1])>${b5 ? b5[0] : -1}:false})()`, 8000, 250);
  const a5 = await dayNow();
  log(`   按钮=${r} 比赛日 ${b5 ? b5[0] : '?'} → ${a5 ? a5[0] : '?'} 推进=${a5ok}`);
  await shot('ui-smoke-4-fast7');

  // 6) 战报可见性：点一个已赛行应弹窗
  await ev(`(()=>{const row=document.querySelector('.score-row:not(.future)');if(row){row.click();return 'clicked'}return 'no-row'})()`);
  await sleep(400);
  const modal = await ev(`!!document.querySelector('.modal-mask')`);
  log(`6. 点已赛行弹战报: ${modal ? 'OK' : '无'}`);
  await shot('ui-smoke-5-modal');
  await closeModal();

  // 7) 阵容页：轮换面板表头与行对齐（v1.0 错位修复验证）+ v1.3 气质面板风格/羁绊
  log('7. 切到阵容页并截图（轮换面板 + 球队气质/羁绊）...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('button, .nav-btn')].find(x=>x.textContent.includes('阵容'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(800);
  const hasRot = await ev(`document.body.innerText.includes('轮换与战术')`);
  const metaChip = await ev(`document.querySelectorAll('.meta-chip').length`);
  const bondChip = await ev(`document.querySelectorAll('.meta-chip.bonds').length`);
  log(`   阵容tab=${r} 轮换面板=${hasRot ? 'OK' : '无'} 气质徽章=${metaChip} 羁绊徽章=${bondChip}`);
  await shot('ui-smoke-6-roster');

  // 8) 交易截止日：切到交易页 → 应为开放状态（常规赛早期）；v1.4 头像+详情
  log('8. 交易页（常规赛早期应开放；v1.4 头像+球员详情）...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('button, .nav-btn')].find(x=>x.textContent.includes('交易'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const tradeOpen = await ev(`document.body.innerText.includes('交易窗口已关闭')`);
  const facesN = await ev(`document.querySelectorAll('.pick-list .pick-row .player-face, .pick-list .pick-row .face-ph').length`);
  const ovrBadgeN = await ev(`document.querySelectorAll('.pick-list .pick-row .rc-ovr').length`);
  log(`   交易页tab=${r} 截止日误关闭=${tradeOpen} 头像行=${facesN} 能力值徽章=${ovrBadgeN}`);
  await shot('ui-smoke-7-trade');
  // v1.4：点击球员名字 → 打开完整详情（18 项技能 4 组）
  const clickName = await ev(`(()=>{const n=document.querySelector('.pick-list .pick-row .pl-name');if(n){n.click();return 'clicked'}return 'none'})()`);
  await sleep(400);
  const pm = await ev(`!!document.querySelector('.player-modal')`);
  const skillGroups = await ev(`document.querySelectorAll('.player-modal .skill-group-title').length`);
  const skillRows = await ev(`document.querySelectorAll('.player-modal .attr-row').length`);
  const ovrLine = await ev(`document.querySelector('.player-modal .skill-ovr-line')?.textContent ?? ''`);
  log(`   点名字=${clickName} 球员弹窗=${pm ? 'OK' : '无'} 技能组=${skillGroups}（应 4）属性行=${skillRows} 总评行="${ovrLine.trim()}"`);
  await shot('ui-smoke-7-trade-detail');
  await closeModal();
  // v2.0 自动预检：点双方各一名球员 → 实时出现 verdict（无需"报价"按钮）
  const selMe = await ev(`(()=>{const r=document.querySelectorAll('.trade-col .pick-row')[10];if(r){r.click();return 'clicked'}return 'none'})()`);
  const selAi = await ev(`(()=>{const r=document.querySelectorAll('.trade-col:nth-child(2) .pick-row')[8];if(r){r.click();return 'clicked'}return 'none'})()`);
  await sleep(500);
  const verdict = await ev(`document.querySelector('.verdict')?.textContent ?? ''`);
  const confirmBtn = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('确认交易'));return b?b.disabled?'disabled':'enabled':'none'})()`);
  log(`   自动预检：选我方=${selMe} 选对方=${selAi} verdict="${verdict.slice(0, 60)}" 确认按钮=${confirmBtn}`);
  await shot('ui-smoke-7-trade-precheck');
  await ev(`(()=>{const r=document.querySelectorAll('.trade-col .pick-row')[10];if(r)r.click();const r2=document.querySelectorAll('.trade-col:nth-child(2) .pick-row')[8];if(r2)r2.click();return 'cleared'})()`);

  // 9) 季后赛：快进常规赛 → 开始季后赛 → 模拟 → 对位图 + 系列弹窗
  log('9. 季后赛对位图（左右向中间）与逐场回看...');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('赛程'));if(b)b.click();return 'ok'})()`);
  await sleep(400);
  await closeModal();
  r = await clickBtn('快进完常规赛');
  log(`   快进常规赛=${r}`);
  await waitFor(`document.body.innerText.includes('开始季后赛')`, 60000, 600);
  await closeModal(); await closeModal();
  r = await clickBtn('开始季后赛');
  log(`   开始季后赛=${r}`);
  await waitFor(`!!document.querySelector('.poff-bracket')`, 15000);
  const bracketCols = await ev(`document.querySelectorAll('.poff-bracket .poff-col').length`);
  const finalCol = await ev(`document.querySelectorAll('.poff-bracket .poff-col.final-col').length`);
  log(`   对位图列数=${bracketCols} 总决列=${finalCol}`);
  await closeModal(); await closeModal();
  r = await clickBtn('模拟本轮季后赛');
  log(`   模拟本轮=${r}`);
  // 等待系列出现比分（模拟为 10ms setTimeout；弹窗/晋级可能并发）
  const gotGames = await waitFor(`(()=>{const s=[...document.querySelectorAll('.series-card:not(.placeholder) .series-score')].map(x=>x.textContent.trim());return s.some(x=>x!=='0 - 0')})()`, 20000, 350);
  log(`   系列比分已出现: ${gotGames ? 'OK' : '超时'}`);
  await sleep(600);
  await closeModal(); await closeModal();
  // 点第一张真实系列卡 → 逐场弹窗
  const clickSeries = await ev(`(()=>{const c=[...document.querySelectorAll('.series-card:not(.placeholder)')][0];if(c){c.click();return 'clicked'}return 'no-card'})()`);
  await sleep(400);
  const seriesModal = await ev(`!!document.querySelector('.series-modal')`);
  const gameRows = await ev(`document.querySelectorAll('.series-game-row').length`);
  log(`   系列卡=${clickSeries} 逐场弹窗=${seriesModal ? 'OK' : '无'} 逐场行=${gameRows}`);
  await shot('ui-smoke-8-poff');
  await closeModal();

  // 10) v1.2 快进到总决赛 + 总冠军界面（冠军球队 + 冠军阵容 + FMVP 卡）
  log('10. 点「⏩ 快进到总决赛」→ 总冠军界面（v2.0 含 FMVP 卡）...');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('赛程'));if(b)b.click();return 'ok'})()`);
  await sleep(400);
  await closeModal(); await closeModal(); await closeModal();
  // 等待快进按钮可用（模拟可能仍在进行/弹窗遮挡）
  const r10 = await waitFor(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('快进到总决赛'));return !!b&&!b.disabled})()`, 30000, 400);
  log(`   快进按钮可用: ${r10}`);
  const r10c = await clickBtn('快进到总决赛');
  log(`   快进按钮点击=${r10c}`);
  const champOk = await waitFor(`!!document.querySelector('.champ-hero')`, 60000, 500);
  log(`   冠军界面出现: ${champOk ? 'OK' : '超时'}`);
  const champHero = await ev(`!!document.querySelector('.champ-hero')`);
  const champCups = await ev(`document.querySelectorAll('.champ-hero-cup').length`);
  const rosterPlayers = await ev(`document.querySelectorAll('.champ-roster .champ-player').length`);
  const awardCards = await ev(`document.querySelectorAll('.champ-awards .award-card').length`);
  const fmvpCards = await ev(`document.querySelectorAll('.champ-fmvp .award-card').length`);
  const sad = await ev(`document.body.innerText.includes('很遗憾')`);
  const champName = await ev(`(()=>{const n=document.querySelector('.champ-hero-name');return n?n.textContent.trim():''})()`);
  log(`   冠军横幅=${champHero} 奖杯=${champCups} 冠军阵容人数=${rosterPlayers} 奖卡=${awardCards} FMVP卡=${fmvpCards}（v2.0 应 1） 很遗憾=${sad} 冠军：${champName}`);
  await shot('ui-smoke-9-champion');
  // 打开完整颁奖典礼弹窗（v2.0 四张常规大奖卡一字排开 + 一防二防/数据/队图放大）
  const rAwards = await clickBtn('查看完整颁奖典礼');
  await sleep(500);
  const awardsModal = await ev(`!!document.querySelector('.awards-modal')`);
  const bigCards = await ev(`document.querySelectorAll('.award-cards.big .award-card').length`);
  const defRows = await ev(`document.querySelectorAll('.award-line.defense').length`);
  const modalW = await ev(`(()=>{const m=document.querySelector('.awards-modal');return m?Math.round(m.getBoundingClientRect().width):0})()`);
  log(`   颁奖典礼弹窗：按钮=${rAwards} 弹窗=${awardsModal} 大奖卡=${bigCards}（v2.0 应 4）防守阵容行=${defRows}（应 2）弹窗宽=${modalW}px`);
  await shot('ui-smoke-10-awards');
  await closeModal();

  // 11) v2.1 休赛期：选秀大会可操作（80 人池 / 自动完成 / 进入自由市场）
  log('11. 开启休赛期 → 选秀大会面板...');
  const rGo = await clickBtn('开启休赛期');
  log(`   开启休赛期=${rGo}`);
  const draftOk = await waitFor(`!!document.querySelector('.draft-panel')`, 20000, 400);
  log(`   选秀面板: ${draftOk ? 'OK' : '超时'}`);
  const status = await ev(`document.querySelector('.draft-status')?.textContent ?? ''`);
  const pickCards = await ev(`document.querySelectorAll('.draft-pick-card').length`);
  log(`   当前顺位="${status.trim()}" 可选新秀卡=${pickCards}（轮到玩家签时=80 池，否则 0）`);
  await shot('ui-smoke-11-draft');
  const rAll = await clickBtn('自动完成全部选秀');
  log(`   自动完成全部选秀=${rAll}`);
  const draftGone = await waitFor(`!document.querySelector('.draft-panel')`, 20000, 400);
  log(`   选秀完成（面板消失）: ${draftGone ? 'OK' : '超时'}`);
  const draftSummary = await ev(`document.body.innerText.includes('本届选秀共 80 人')`);
  log(`   选秀汇总报告: ${draftSummary ? 'OK' : '无'}`);
  const enterOk = await waitFor(`!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入自由市场')&&!x.disabled)`, 10000, 300);
  log(`   进入自由市场按钮可用: ${enterOk ? 'OK' : '超时'}`);

  log('=== UI 冒烟结束 ===');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
