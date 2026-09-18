// UI 真机冒烟：真实点击流验证"模拟到下一场/快进"是否推进比赛日
// 用法：node tools/ui-smoke.mjs [port]
const port = Number(process.argv[2] || 9333);
import fs from 'node:fs';

async function main() {
  const pageErrors = [];
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((p) => p.type === 'page');
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let idc = 0;
  const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    // v2.3.0：收集页面控制台错误（引擎异常会在这里现形，用于定位"模拟无反应"类问题）
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params?.type)) {
      const txt = (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (txt) pageErrors.push(`[console.${m.params.type}] ${txt}`.slice(0, 400));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails;
      pageErrors.push(`[exception] ${(d?.exception?.description ?? d?.text ?? '').slice(0, 500)}`);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++idc; pend.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable'); // 开启异常/console 事件订阅
  // v2.3.0：把窗口置前——Electron 窗口在后台时计时器会被 Chromium 节流，
  // 表现为"点了模拟没反应 / busy 卡死"（实为 10ms 的 setTimeout 被拖到几十秒）
  await send('Page.enable');
  await send('Page.bringToFront');
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (expr, timeout = 45000, step = 400) => {
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
  // v2.5.0：战报末尾"总计"行（全队合计）
  const totalRow = await ev(`(()=>{const r=document.querySelector('.box-total-row');return r?r.textContent.replace(/\\s+/g,' ').trim().slice(0,90):'无'})()`);
  const boxRows = await ev(`document.querySelectorAll('.box-tbl tbody tr').length`);
  log(`   战报总计行: ${String(totalRow).startsWith('无') ? '缺失' : 'OK — ' + totalRow}`);
  log(`   战报明细行=${boxRows}`);
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

  // 7.5) v2.5.0 自由市场：五个位置筛选按钮
  log('7.5 自由市场位置筛选（全部 + PG/SG/SF/PF/C）...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('自由市场'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(600);
  const faBtns = await ev(`[...document.querySelectorAll('.fa-filter button')].map(b=>b.textContent.trim()).join(' | ')`);
  const faBtnN = await ev(`document.querySelectorAll('.fa-filter button').length`);
  const faAll = await ev(`document.querySelectorAll('.fa-table .fa-row').length`);
  log(`   自由市场tab=${r} 筛选按钮=${faBtnN}（应 6）：${faBtns}`);
  log(`   未筛选行数=${faAll}`);
  const faCenter = await ev(`(()=>{const b=[...document.querySelectorAll('.fa-filter button')].find(x=>x.textContent.includes('中锋'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const faCenterN = await ev(`document.querySelectorAll('.fa-table .fa-row').length`);
  const faPosOk = await ev(`[...document.querySelectorAll('.fa-table .fa-row .fa-pos')].every(e=>e.textContent.includes('中锋'))`);
  log(`   点「中锋」=${faCenter} 行数=${faCenterN}（应 ≤ ${faAll}）全部含中锋 = ${faPosOk}`);
  await shot('ui-smoke-6_5-fa-filter');
  const faReset = await ev(`(()=>{const b=[...document.querySelectorAll('.fa-filter button')].find(x=>x.textContent.includes('全部'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(300);
  const faBackN = await ev(`document.querySelectorAll('.fa-table .fa-row').length`);
  log(`   点「全部」=${faReset} 行数回到 ${faBackN}`);

  // 8) 交易截止日：切到交易页 → 应为开放状态（常规赛早期）；v1.4 头像+详情
  log('8. 交易页（常规赛早期应开放；v1.4 头像+球员详情）...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('button, .nav-btn')].find(x=>x.textContent.includes('交易'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const tradeOpen = await ev(`document.body.innerText.includes('交易窗口已关闭')`);
  const facesN = await ev(`document.querySelectorAll('.pick-list .pick-row .player-face, .pick-list .pick-row .face-ph').length`);
  const ovrBadgeN = await ev(`document.querySelectorAll('.trade-col .pick-row .pl-ovr .ovr-badge').length`);
  log(`   交易页tab=${r} 截止日误关闭=${tradeOpen} 头像行=${facesN} 能力值徽章=${ovrBadgeN}`);
  // v2.5.0：三状态徽章 / 位置列 / 去掉双方总估值 / 锁定按钮
  const phaseChips = await ev(`[...document.querySelectorAll('.chip[class*=phase-]')].map(e=>e.textContent.trim()).join(' | ')`);
  const posCells = await ev(`document.querySelectorAll('.trade-col .pick-row .pl-pos, .pick-list .pick-row .pl-pos').length`);
  const hasTotalVal = await ev(`document.body.innerText.includes('总估值')`);
  const lockBtns = await ev(`document.querySelectorAll('.lock-btn').length`);
  log(`   球队状态徽章：${phaseChips || '无'}（应含争冠/补强/重建之一）`);
  log(`   球员行位置列=${posCells}（应 >0）· 页面出现"总估值"=${hasTotalVal}（v2.5.0 应为 false）`);
  log(`   锁定按钮=${lockBtns}（应 >0）`);
  const lockFirst = await ev(`(()=>{const b=document.querySelector('.trade-col .lock-btn');if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(300);
  const lockedRows = await ev(`document.querySelectorAll('.pick-list .pick-row.locked').length`);
  const lockOn = await ev(`document.querySelectorAll('.lock-btn.on').length`);
  log(`   点锁=${lockFirst} 锁定行=${lockedRows} 锁定态按钮=${lockOn}（应 ≥1）`);
  await shot('ui-smoke-7-trade-lock');
  const unlockFirst = await ev(`(()=>{const b=document.querySelector('.trade-col .lock-btn.on');if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(300);
  const lockedRows2 = await ev(`document.querySelectorAll('.pick-list .pick-row.locked').length`);
  log(`   再点解锁=${unlockFirst} 剩余锁定行=${lockedRows2}（应 0）`);
  await shot('ui-smoke-7-trade');
  // v2.3：选秀权（每队未来 3 年 × 首轮/次轮 = 6 枚，带年份标识）；v2.5.0 交易页有两列 → 只数我方那列
  const myPickRows = await ev(`document.querySelectorAll('.trade-col:first-child .pick-list.picks .pick-row').length`);
  const pickLabels = await ev(`[...document.querySelectorAll('.trade-col:first-child .pick-list.picks .pick-row .pl-name')].map(e=>e.textContent).join(' | ')`);
  log(`   我的选秀权 ${myPickRows} 枚（应 6）：${pickLabels}`);
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

  // 8.2) v2.5.0 交易搜索器：结果里每个球员都带位置与能力值（含我方筹码）
  log('8.2 交易搜索器（结果显示位置 + 能力值）...');
  const srPick = await ev(`(()=>{const r=document.querySelectorAll('.trade-col .pick-row')[5];if(r){r.click();return 'clicked'}return 'none'})()`);
  const srBtn = await clickBtn('搜索可行交易');
  const srOk = await waitFor(`document.querySelectorAll('.search-row').length > 0`, 25000, 400);
  const srN = await ev(`document.querySelectorAll('.search-row').length`);
  const srOut = await ev(`document.querySelector('.search-row .sr-out')?.textContent?.trim() ?? ''`);
  const srIn = await ev(`document.querySelector('.search-row .sr-in')?.textContent?.trim() ?? ''`);
  const srHasOvr = /OVR/.test(srOut + ' ' + srIn) && /\//.test(srOut + ' ' + srIn);
  log(`   选筹码=${srPick} 搜索=${srBtn} 出结果=${srOk} 结果行=${srN} 含位置+OVR=${srHasOvr}`);
  log(`   送出 "${srOut.slice(0, 80)}"`);
  log(`   得到 "${srIn.slice(0, 80)}"`);
  const srPhase = await ev(`document.querySelector('.search-row .sr-phase')?.textContent?.trim() ?? '无'`);
  log(`   结果中的球队状态标签：${srPhase}`);
  await shot('ui-smoke-7-trade-search');
  const srClear = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('清空结果'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await ev(`(()=>{const r=document.querySelectorAll('.trade-col .pick-row')[5];if(r)r.click();return 'ok'})()`);
  log(`   清空搜索结果=${srClear}`);

  // 8.5) v2.3.0 新秀榜（常规赛期间即可查看下一届 80 人名单 + 身高/体重/臂展/年龄）
  log('8.5 新秀榜（下一届新秀名单 + 体测数据）...');
  const draftTab = await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('新秀'));if(b){b.click();return 'clicked'}return 'none'})()`);
  await sleep(500);
  const boardRows = await ev(`document.querySelectorAll('.db-row').length`);
  const boardHead = await ev(`document.querySelector('.db-head')?.textContent ?? ''`);
  const firstRow = await ev(`document.querySelector('.db-row')?.textContent ?? ''`);
  log(`   新秀榜: tab=${draftTab} 名单行数=${boardRows}（应 80）`);
  log(`   表头: ${boardHead.trim()}`);
  log(`   榜首: ${firstRow.trim()}`);
  await shot('ui-smoke-8_5-draft-board');
  await ev(`(()=>{const r=document.querySelector('.db-row');if(r)r.click();return 'ok'})()`);
  await sleep(400);
  const measLine = await ev(`document.querySelector('.player-modal .player-sub.meas')?.textContent ?? ''`);
  log(`   新秀体测行: "${measLine.trim()}"`);
  await shot('ui-smoke-8_5-draft-detail');
  await closeModal();
  await closeModal();
  // 回到赛程页（后续步骤依赖赛程页按钮）
  await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('赛程'));if(b)b.click();return 'ok'})()`);
  await sleep(300);

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
  // v2.3.0：点击前先看按钮状态（disabled = React busy 卡死，是"模拟无反应"的典型症状）
  const simBtnState = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('模拟本轮季后赛'));return b?(b.disabled?'disabled':'enabled'):'notfound'})()`);
  const errBanner = await ev(`document.querySelector('.err-banner')?.textContent ?? ''`);
  log(`   模拟本轮按钮=${simBtnState} 页面错误横幅="${String(errBanner).slice(0, 120)}"`);
  r = await clickBtn('模拟本轮季后赛');
  log(`   模拟本轮=${r}`);
  // 等待系列出现比分（模拟为 10ms setTimeout；弹窗/晋级可能并发）
  const gotGames = await waitFor(`(()=>{const s=[...document.querySelectorAll('.series-card:not(.placeholder) .series-score')].map(x=>x.textContent.trim());return s.some(x=>x!=='0 - 0')})()`, 45000, 500);
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

  // 9.5) v2.5.0 数据榜：常规赛 / 季后赛分开（季后赛期间应为独立统计）
  log('9.5 联盟页数据榜：常规赛 / 季后赛切换...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('联盟'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(600);
  const leagueTab = await ev(`(()=>{const b=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent.includes('球员数据榜'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const regHead = await ev(`document.querySelector('.leaders-tbl thead')?.textContent?.replace(/\\s+/g,' ') ?? ''`);
  const regRows = await ev(`document.querySelectorAll('.leaders-tbl tbody tr').length`);
  const poSwitch = await ev(`(()=>{const b=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent.includes('季后赛数据'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const poHead = await ev(`document.querySelector('.leaders-tbl thead')?.textContent?.replace(/\\s+/g,' ') ?? ''`);
  const poRows = await ev(`document.querySelectorAll('.leaders-tbl tbody tr').length`);
  const poNote = await ev(`document.body.innerText.includes('季后赛独立统计')`);
  log(`   联盟tab=${r} 数据榜tab=${leagueTab} 常规赛表头="${regHead.trim()}"（${regRows} 行）`);
  log(`   季后赛切换=${poSwitch} 季后赛表头="${poHead.trim()}"（${poRows} 行）独立统计说明=${poNote}`);
  await shot('ui-smoke-8_5-leaders-po');
  await ev(`(()=>{const b=[...document.querySelectorAll('.tabs button')].find(x=>x.textContent.includes('常规赛数据'));if(b)b.click();return 'ok'})()`);
  await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('赛程'));if(b)b.click();return 'ok'})()`);
  await sleep(400);

  // 9.6) v2.5.0 阵容页：常规赛打完 → 切换记录季后赛数据
  log('9.6 阵容页季后赛数据（季后赛期间显示季后赛场均）...');
  r = await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('阵容'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(700);
  const poCells = await ev(`document.querySelectorAll('.rc-mid.po').length`);
  const poSample = await ev(`[...document.querySelectorAll('.rc-mid.po')].map(e=>e.textContent.trim()).slice(0,3).join(' | ')`);
  log(`   阵容tab=${r} 季后赛数据行=${poCells} 示例："${poSample}"`);
  await shot('ui-smoke-8_6-roster-po');
  await ev(`(()=>{const b=[...document.querySelectorAll('.tb-nav button')].find(x=>x.textContent.includes('赛程'));if(b)b.click();return 'ok'})()`);
  await sleep(400);

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
  // v2.5.0：最佳新秀阵容一阵/二阵各 5 人（此前二阵常缺人）
  const rkRowN = await ev(`[...document.querySelectorAll('.awards-modal .award-line')].filter(e=>e.textContent.includes('新秀')).map(e=>e.querySelectorAll('.award-p').length).join(' / ')`);
  log(`   新秀阵容人数（一阵 / 二阵 应 5 / 5）：${rkRowN}`);
  await shot('ui-smoke-10-awards');
  await closeModal();

  // 11) v2.1 休赛期：选秀大会可操作（80 人池 / 自动完成 / 进入自由市场）
  log('11. 开启休赛期 → 选秀大会面板...');
  const rGo = await clickBtn('开启休赛期');
  log(`   开启休赛期=${rGo}`);
  const draftOk = await waitFor(`!!document.querySelector('.draft-panel')`, 45000, 500);
  log(`   选秀面板: ${draftOk ? 'OK' : '超时'}`);
  const status = await ev(`document.querySelector('.draft-status')?.textContent ?? ''`);
  const pickCards = await ev(`document.querySelectorAll('.draft-pick-card').length`);
  log(`   当前顺位="${status.trim()}" 可选新秀卡=${pickCards}（轮到玩家签时=80 池，否则 0）`);
  // v2.3：本届选秀 = 60 签（30 首轮 + 30 次轮），面板标题会写明
  // v2.4.0：抽签面板也是 .sec-title，需按文本定位"选秀大会"那一条
  const draftTitle = await ev(`[...document.querySelectorAll('.draft-panel .sec-title')].map(e=>e.textContent).find(t=>t.includes('选秀大会')) ?? ''`);
  const lotteryTitle = await ev(`[...document.querySelectorAll('.draft-panel .sec-title')].map(e=>e.textContent).find(t=>t.includes('乐透抽签')) ?? ''`);
  const lotteryRows = await ev(`document.querySelectorAll('.lottery-row').length`);
  // v2.5.0：每行的"原属球队 · 现属球队"
  const loOwnerN = await ev(`document.querySelectorAll('.lottery-row .lo-owner').length`);
  const loOwnerTxt = await ev(`document.querySelector('.lottery-row .lo-owner')?.textContent?.trim() ?? ''`);
  const loMovedN = await ev(`document.querySelectorAll('.lottery-row .lo-owner.moved').length`);
  const isSixty = /60 签/.test(draftTitle) && /30 首轮 \+ 30 次轮/.test(draftTitle);
  log(`   选秀签结构: ${isSixty ? 'OK' : '异常'} — "${draftTitle.trim()}"`);
  log(`   乐透抽签展示: ${lotteryRows === 14 ? 'OK' : '异常'} — "${lotteryTitle.trim()}"（${lotteryRows} 行，应 14）`);
  log(`   乐透签归属标签 ${loOwnerN} 行（应 14）· 已易主 ${loMovedN} 行 · 示例 "${loOwnerTxt}"`);
  await shot('ui-smoke-11-draft');

  // 11.5) v2.5.0 休赛期交易窗口（乐透抽签后 3 天）
  log('11.5 休赛期交易窗口（抽签后 3 天，可在休赛期做交易）...');
  const offWinTxt = await ev(`(()=>{const m=document.body.innerText.match(/休赛期交易窗口（乐透抽签后 (\\d+) 天/);return m?Number(m[1]):null})()`);
  log(`   窗口剩余天数=${offWinTxt}（应 3）`);
  const openTrade = await clickBtn('展开交易面板');
  await sleep(800);
  const offTradeCols = await ev(`document.querySelectorAll('.trade-grid .trade-col').length`);
  const offLocks = await ev(`document.querySelectorAll('.trade-grid .lock-btn').length`);
  const offClosed = await ev(`document.body.innerText.includes('交易窗口已关闭')`);
  log(`   展开=${openTrade} 交易栏=${offTradeCols}（应 2）锁定按钮=${offLocks} 误显已关闭=${offClosed}`);
  await shot('ui-smoke-11_5-offseason-trade');
  const offLockClick = await ev(`(()=>{const b=document.querySelector('.trade-grid .lock-btn');if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(300);
  const offLockedRows = await ev(`document.querySelectorAll('.trade-grid .pick-row.locked').length`);
  log(`   休赛期锁定=${offLockClick} 锁定行=${offLockedRows}（应 1）`);
  log(`   收起=${await clickBtn('收起交易面板')}`);
  const endDay = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('结束一天'));if(!b)return 'notfound';b.click();return 'clicked'})()`);
  await sleep(500);
  const offWinTxt2 = await ev(`(()=>{const m=document.body.innerText.match(/休赛期交易窗口（乐透抽签后 (\\d+) 天/);return m?Number(m[1]):null})()`);
  log(`   结束一天=${endDay} 剩余天数=${offWinTxt2}（应 2）`);
  const rAll = await clickBtn('自动完成全部选秀');
  log(`   自动完成全部选秀=${rAll}`);
  const draftGone = await waitFor(`!document.querySelector('.draft-panel')`, 45000, 500);
  log(`   选秀完成（面板消失）: ${draftGone ? 'OK' : '超时'}`);
  const draftSummary = await ev(`document.body.innerText.includes('本届选秀共 80 人')`);
  log(`   选秀汇总报告: ${draftSummary ? 'OK' : '无'}`);
  // v2.5.0：合同到期播报（伤病康复 + 合同年递减的可见结果）
  const expireNews = await ev(`(()=>{const m=document.body.innerText.match(/合同到期未续约/g);return m?m.length:0})()`);
  const faPool = await ev(`(()=>{const m=document.body.innerText.match(/自由市场\\s*(\\d+)\\s*人/);return m?Number(m[1]):null})()`);
  log(`   合同到期播报 ${expireNews} 条（v2.5.0 应有）· 自由市场 ${faPool} 人`);
  const enterOk = await waitFor(`!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入自由市场')&&!x.disabled)`, 10000, 300);
  log(`   进入自由市场按钮可用: ${enterOk ? 'OK' : '超时'}`);

  log('=== UI 冒烟结束 ===');
  if (pageErrors.length) {
    log(`=== 页面错误/警告 ${pageErrors.length} 条（前 12 条）===`);
    for (const e of pageErrors.slice(0, 12)) log('   ' + e);
  } else {
    log('=== 页面无 console 错误 ===');
  }
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
