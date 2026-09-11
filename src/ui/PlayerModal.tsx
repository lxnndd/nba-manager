// 球员详情弹窗（全局共用）：18 项技能面板 + 赛季数据 + 合同 + 定位（v2.0 潜力星/生涯/双位置）
import type { Player, Team } from '../engine/types';
import { perGame } from '../engine/league';
import { heightLabel, weightLabel, wingspanLabel, lbsLabel, feetLabel } from '../engine/gen';
import { ATTR_CN, POS_CN, attrKeysOrder, money, ovrClass, ovrLabel, fmt1 } from './format';

export function PlayerModal({
  player, team, onClose,
}: { player: Player; team: Team; onClose: () => void }) {
  const pg = perGame(player);
  const attrs = attrKeysOrder.map((k) => ({ k, v: player.attrs[k] }));
  const c = player.career;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className={`ovr-badge ${ovrClass(player.ovr)}`}>{player.ovr}</div>
          <div>
            <div className="player-name">{player.name}</div>
            <div className="player-sub">
              {team.abbr} · {POS_CN[player.pos]}/{POS_CN[player.secPos]} · {player.age}岁 · {heightLabel(player.height)} · 潜力 {player.potential} 星
            </div>
            {/* v2.3.0 体测数据（体重/臂展；旧档自动补全） */}
            <div className="player-sub meas" title={`${feetLabel(player.height)}${player.weight ? ` · ${lbsLabel(player.weight)}` : ''}${player.wingspan ? ` · 臂展 ${feetLabel(player.wingspan)}` : ''}`}>
              📏 体测：身高 {heightLabel(player.height)}
              {player.weight ? ` · 体重 ${weightLabel(player.weight)}` : ''}
              {player.wingspan ? ` · 臂展 ${wingspanLabel(player.wingspan)}` : ''}
            </div>
            <div className="player-sub dim">
              {player.nation !== '美国' ? `${player.nation} · ` : ''}NBA 第 {player.exp} 年 · 生涯 {c.gp} 场 {Math.round(c.pts)}分 {Math.round(c.reb)}板 {Math.round(c.ast)}助
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-col">
            <div className="sec-title">能力</div>
            {attrs.map(({ k, v }) => (
              <div className="attr-row" key={k}>
                <span className="attr-name">{ATTR_CN[k]}</span>
                <div className="attr-track">
                  <div className="attr-fill" style={{ width: `${v}%` }} />
                </div>
                <span className="attr-val">{v}</span>
              </div>
            ))}
            <div className="attr-row">
              <span className="attr-name">综合</span>
              <div className="attr-track">
                <div className="attr-fill ovr-fill" style={{ width: `${player.ovr}%` }} />
              </div>
              <span className={`attr-val ${ovrClass(player.ovr)}`}>{player.ovr} {ovrLabel(player.ovr)}</span>
            </div>
            <div className="sec-title" style={{ marginTop: 12 }}>身体·综合素质</div>
            <div className="body-fill">
              {(['strength', 'speed', 'stamina', 'vertical', 'agility', 'durability', 'hustle'] as const).map((k) => (
                <div className="attr-row" key={k}>
                  <span className="attr-name">{BODY_CN[k]}</span>
                  <div className="attr-track">
                    <div className="attr-fill" style={{ width: `${player.body[k]}%` }} />
                  </div>
                  <span className="attr-val">{player.body[k]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-col">
            <div className="sec-title">赛季数据（{player.gp}场 · 场均）</div>
            <div className="stat-grid">
              {[
                ['得分', fmt1(pg.pts)], ['篮板', fmt1(pg.reb)], ['助攻', fmt1(pg.ast)],
                ['抢断', fmt1(pg.stl)], ['盖帽', fmt1(pg.blk)], ['失误', fmt1(pg.tov)],
                ['出场', fmt1(pg.min)], ['投篮%', fmt1(pg.fg)], ['三分%', fmt1(pg.tp)],
              ].map(([label, v]) => (
                <div className="stat-cell" key={String(label)}>
                  <div className="stat-v">{v}</div>
                  <div className="stat-l">{label}</div>
                </div>
              ))}
            </div>
            <div className="mini-lines">
              <div>罚球 {fmt1(pg.ft)}% · 进攻板 {fmt1(player.stats.or / Math.max(1, player.gp))} · 防守板 {fmt1(player.stats.dr / Math.max(1, player.gp))}</div>
            </div>
            <div className="sec-title" style={{ marginTop: 12 }}>18 项属性（总评 = 均值 + 长处补偿）</div>
            <div className="skill-groups">
              {SKILL_GROUPS_UI.map((g) => (
                <div className="skill-group" key={g.title}>
                  <div className="skill-group-title">{g.title}</div>
                  {g.keys.map((k) => (
                    <div className="attr-row" key={k}>
                      <span className="attr-name">{SKILL_CN[k]}</span>
                      <div className="attr-track">
                        <div className="attr-fill" style={{ width: `${player.skills[k]}%` }} />
                      </div>
                      <span className="attr-val">{player.skills[k]}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-col">
            <div className="sec-title">合同</div>
            <div className="contract-box">
              <div className="money-big">{money(player.salary)}</div>
              <div className="mini-lines">
                <div>年薪（美元）</div>
                <div>剩余 {player.contractYears} 年</div>
              </div>
            </div>
            <div className="sec-title" style={{ marginTop: 14 }}>定位</div>
            <div className="mini-lines">
              <div>{ovrLabel(player.ovr)} · {POS_CN[player.pos]} 深度第 {depthLabel()} 位 · 可打 {POS_CN[player.pos]}/{POS_CN[player.secPos]}</div>
              <div>潜力 {player.potential} 星（休赛期加点：潜力 × 成长阶段 × 出场时间系数）</div>
              {player.points > 0 && <div className="warn-text">🌱 本休赛期待分配 {player.points} 点（去「休赛期」页加点）</div>}
              {player.injury && <div className="warn-text">🏥 {player.injury.type}，预计伤停 {player.injury.games} 场</div>}
            </div>
            <div className="skill-ovr-line dim">18 项均值 {avgOf(player)} · 系统总评 {ovrLabel(player.ovr)}</div>
          </div>
        </div>
      </div>
    </div>
  );

  function depthLabel(): number {
    const same = team.players.filter((p) => p.pos === player.pos).sort((a, b) => b.ovr - a.ovr);
    return same.indexOf(player) + 1;
  }
}

function avgOf(p: Player): string {
  const keys = Object.values(p.skills);
  return fmt1(keys.reduce((a, b) => a + b, 0) / keys.length);
}

const BODY_CN: Record<string, string> = {
  strength: '力量', speed: '速度', stamina: '体能', vertical: '弹跳', agility: '敏捷', durability: '耐久', hustle: '拼劲',
};

const SKILL_GROUPS_UI: { title: string; keys: (keyof Player['skills'])[] }[] = [
  { title: '得分能力', keys: ['layup', 'post', 'three', 'mid', 'ft'] },
  { title: '组织能力', keys: ['handle', 'pass', 'vision'] },
  { title: '防守能力', keys: ['perimeter', 'interior', 'steal', 'block', 'iq'] },
  { title: '篮板与身体', keys: ['or', 'dr', 'speed', 'strength', 'vertical'] },
];

const SKILL_CN: Record<string, string> = {
  layup: '篮下终结', post: '低位进攻', three: '三分投射', mid: '中距离', ft: '罚球',
  handle: '控球', pass: '传球', vision: '球场视野',
  perimeter: '外线防守', interior: '内线防守', steal: '抢断', block: '封盖', iq: '篮球智商',
  or: '进攻篮板', dr: '防守篮板', speed: '速度', strength: '力量', vertical: '弹跳',
};
