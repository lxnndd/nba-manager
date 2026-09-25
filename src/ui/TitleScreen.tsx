// 标题屏：新游戏（规则分流 → 选队 → 球队风格 → 执教风格）/ 继续游戏
// v2.7.0：
//   · 背景换成 50 张真实 NBA 官方比赛照片，**1 秒轮换**（双层交叉淡入 + 提前预加载）
//   · 新增「新手先看规则 / 老手直接开始」分流页：全部规则集中在这里，各界面不再散落说明文字
//   · 移除导入存档（用户要求：不需要存档导入导出功能）
import { useState } from 'react';
import type { GameApi } from './useGame';
import { TEAMS } from '../engine/data';
import { createRealLeague, TEAM_STYLES, COACH_STYLES, applyTeamStyle, applyCoachStyle, type StyleOption } from '../engine/gen';
import { TeamLogo } from './TeamLogo';
import { useBackdropRotation } from './backdrops';

// 主菜单背景：真实 NBA 官方比赛照片（tools/fetch-nba-photos.ps1 抓取并压缩为 1920×1080）
// v2.7.1：与游戏内共用 src/ui/backdrops.ts 的轮换（5 秒一张）

// 规则页内容：所有规则集中在此
const RULES: { icon: string; title: string; items: string[] }[] = [
  {
    icon: '🎯', title: '目标与赛季流程',
    items: [
      '你是一支 NBA 球队的总经理：82 场常规赛 → 季后赛 → 总决赛。',
      '赛季结束后进入休赛期，依次处理：合同到期与续约 → 乐透抽签 → 选秀大会 → 自由市场。',
      '常规赛期间可随时交易、签约自由球员、调整轮换；交易截止日之后只能签约。',
    ],
  },
  {
    icon: '🏀', title: '阵容与轮换',
    items: [
      '名单上限 17 人（开季前需裁到 15 人）；某个位置缺人时，引擎会自动向相邻位置借人顶上。',
      '轮换页可自定义每人「分钟/场（0-48）」与「球权权重（0-10）」：球权拉满 = 更多持球与出手。',
      '把球员拖到他的主/副位置列 = 主副互换，能力值按新位置适配；交易身价与摆在哪个位置无关。',
    ],
  },
  {
    icon: '💰', title: '工资与签约',
    items: [
      '工资帽 1.54 亿 · 奢侈税线 1.87 亿 · 第二土豪线（硬顶）2.0 亿——任何操作都不能超过硬顶。',
      '帽下有空间可自由签约；超帽后只能签底薪（≤300 万）或中产（≤1300 万，每赛季 1 次，超税线无中产）。',
      '报价达到球员要价的 85% 即当场成交；赛季中的自由市场没有 AI 竞价，休赛期才会有人抢。',
    ],
  },
  {
    icon: '🔁', title: '交易规则',
    items: [
      '双方薪资需匹配，超出奢侈税线的球队交易后薪金不得增加；每笔交易都要过名单与硬顶校验。',
      'OVR ≥ 85 是各队的「中流砥柱」：只能用同等或更强的核心一对一置换——不许降级，也不许拿更老的同档核心换更年轻的。',
      '球队对自己前两位球员要价 1.5 倍：想挖走别人的当家，必须多付 50% 的价值。',
      '能力档位估值：OVR < 75 半价 / 75-79 打 8 折 / 80-84 原价 / 85-89 涨 20% / 90 及以上涨 40%。',
      '可以给球员「上锁」：锁定后不会收到 AI 的交易报价，也不会被搜索器当作筹码。',
    ],
  },
  {
    icon: '🎓', title: '选秀',
    items: [
      '两轮共 60 个签位；14 支乐透队抽签决定前 14 顺位，其余按战绩倒序排列。',
      '新秀榜提前一整年可见（位置 / 年龄 / 身高 / 体重 / 臂展 / 国籍 / 潜力），方便提前做功课。',
      '中国新秀每届整体能力 +10，更容易在首轮被选中、也更容易打出来。',
    ],
  },
  {
    icon: '🩹', title: '伤病与数据',
    items: [
      '受伤球员自动缺席，由同位置替补顶上；出场场次递减归零后复出；每个休赛期统一康复。',
      '数据榜分常规赛 / 季后赛，显示全部上榜球员；场均数据需要最少出场场次（常规赛 8 场）。',
      '季后赛数据独立统计，新赛季开始后归零重新记录。',
    ],
  },
  {
    icon: '🏆', title: '奖项',
    items: [
      '常规赛 MVP / 最佳防守球员 / 最佳阵容 / 最佳防守阵容 / 最佳新秀阵容。',
      '总冠军 + 总决赛 MVP；冠军阵容与历年荣誉记录在「联盟 → 荣誉殿堂」。',
    ],
  },
];

export function TitleScreen({ api }: { api: GameApi }) {
  const [stage, setStage] = useState<'menu' | 'guide' | 'rules' | 'pick' | 'style' | 'coach'>('menu');
  const [chosenTeam, setChosenTeam] = useState<number | null>(null);
  const [teamStyle, setTeamStyle] = useState<'youth' | 'star' | null>(null);
  const [busy, setBusy] = useState(false);
  const [armNew, setArmNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 背景轮播：与游戏内共用同一套照片（5 秒一张，双层交叉淡入 + 预加载）
  const { srcs, active } = useBackdropRotation();

  const fmtTime = api.saveTime
    ? new Date(api.saveTime).toLocaleString('zh-CN', { hour12: false })
    : null;

  const pickTeam = (teamId: number) => {
    setChosenTeam(teamId);
    setTeamStyle(null);
    setStage('style');
  };

  const pickTeamStyle = (c: StyleOption) => {
    setTeamStyle(c.id as 'youth' | 'star');
    setStage('coach');
  };

  const startNew = (coach: StyleOption) => {
    if (chosenTeam == null) return;
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const l = createRealLeague(seed);
    l.userTeamId = chosenTeam;
    applyTeamStyle(l, teamStyle);
    applyCoachStyle(l, coach.id as 'iron' | 'locker' | 'brand');
    api.startNew(l);
  };

  const doContinue = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await api.continueGame();
    setBusy(false);
    if (!ok) setErr('没有找到可继续的存档');
  };

  const doNew = () => {
    if (api.hasSave && !armNew) {
      setArmNew(true);
      window.setTimeout(() => setArmNew(false), 2500);
      return;
    }
    setArmNew(false);
    setStage('guide'); // v2.7.0：先进"新手看规则 / 老手直接开始"分流页
  };

  // 背景（所有子页面共用）
  const bg = (
    <>
      <div className="title-bg" style={{ backgroundImage: `url(${srcs[0]})`, opacity: active === 0 ? 1 : 0 }} />
      <div className="title-bg-alt" style={{ backgroundImage: `url(${srcs[1]})`, opacity: active === 1 ? 1 : 0 }} />
      <div className="title-bg-overlay" />
    </>
  );

  // ① 规则分流：新手看规则 / 老手直接选队
  if (stage === 'guide') {
    return (
      <div className="pick-screen">
        {bg}
        <div className="pick-head">
          <button className="btn" onClick={() => setStage('menu')}>← 返回</button>
          <div className="pick-title">开始之前</div>
        </div>
        <div className="guide-grid">
          <button className="guide-card" onClick={() => setStage('rules')}>
            <div className="gc-icon">📖</div>
            <div className="gc-name">我是新手</div>
            <div className="gc-desc">先看一遍完整规则：赛季流程 · 工资帽 · 交易 · 选秀 · 阵容轮换</div>
          </button>
          <button className="guide-card" onClick={() => setStage('pick')}>
            <div className="gc-icon">⚡</div>
            <div className="gc-name">我玩过</div>
            <div className="gc-desc">跳过规则，直接选择球队开始</div>
          </button>
        </div>
      </div>
    );
  }

  // ② 规则全文
  if (stage === 'rules') {
    return (
      <div className="pick-screen rules-screen">
        {bg}
        <div className="pick-head">
          <button className="btn" onClick={() => setStage('guide')}>← 返回</button>
          <div className="pick-title">规则总览</div>
          <button className="btn primary" onClick={() => setStage('pick')}>我懂了，去选队 →</button>
        </div>
        <div className="rules-wrap">
          {RULES.map((sec) => (
            <div className="rules-card" key={sec.title}>
              <div className="rc-title">{sec.icon} {sec.title}</div>
              <ul className="rc-list">
                {sec.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'pick') {
    return (
      <div className="pick-screen">
        {bg}
        <div className="pick-head">
          <button className="btn" onClick={() => setStage('guide')}>← 返回</button>
          <div className="pick-title">选择你的球队</div>
        </div>
        <div className="pick-scroll">
          <div className="conf-sec-title east">🏀 东部联盟</div>
          <div className="team-grid">
            {TEAMS.filter((t) => t.conf === 'EAST').map((t, i) => (
              <button className="team-card" key={t.abbr} onClick={() => pickTeam(i)}>
                <TeamLogo abbr={t.abbr} size="md" />
                <span className="tc-abbr">{t.abbr}</span>
                <span className="tc-name">{t.city} {t.name}</span>
                <span className="tc-city">{t.en}</span>
                <span className="tc-conf conf-east">东部</span>
              </button>
            ))}
          </div>
          <div className="conf-sec-title west">🔥 西部联盟</div>
          <div className="team-grid">
            {TEAMS.filter((t) => t.conf === 'WEST').map((t, i) => (
              <button className="team-card" key={t.abbr} onClick={() => pickTeam(15 + i)}>
                <TeamLogo abbr={t.abbr} size="md" />
                <span className="tc-abbr">{t.abbr}</span>
                <span className="tc-name">{t.city} {t.name}</span>
                <span className="tc-city">{t.en}</span>
                <span className="tc-conf conf-west">西部</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'style' || stage === 'coach') {
    const t = chosenTeam != null ? TEAMS[chosenTeam] : null;
    const isStyle = stage === 'style';
    const options = isStyle ? TEAM_STYLES : COACH_STYLES;
    return (
      <div className="pick-screen culture-screen">
        {bg}
        <div className="pick-head">
          <button className="btn" onClick={() => setStage(isStyle ? 'pick' : 'style')}>← 返回{isStyle ? '选队' : '球队风格'}</button>
          <div className="pick-title">
            {isStyle ? '选择球队风格' : '选择执教风格'}{t ? `（${t.city} ${t.name}）` : ''}
          </div>
        </div>
        <div className="culture-grid center-col">
          {options.map((c) => (
            <button
              className="culture-card"
              key={c.id}
              onClick={() => (isStyle ? pickTeamStyle(c) : startNew(c))}
            >
              <div className="cc-icon">{c.icon}</div>
              <div className="cc-name">{c.name}</div>
              <div className="cc-desc">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="title-screen">
      {bg}
      <div className="title-card">
        <div className="title-logo">🏀</div>
        <h1 className="title-name">NBA 经理</h1>
        <div className="menu-stack">
          {api.hasSave && (
            <button className="menu-btn primary" disabled={busy} onClick={doContinue}>
              ▶ 继续游戏
            </button>
          )}
          <button className="menu-btn" disabled={busy} onClick={doNew}>
            {api.hasSave && armNew ? '再点一次确认新建（会覆盖当前存档）' : '✨ 开始新游戏'}
          </button>
        </div>
        <div className="save-line">
          {fmtTime ? `上次自动保存：${fmtTime}` : '暂无存档'}
        </div>
        {err && <div className="error-line">{err}</div>}
      </div>
    </div>
  );
}
