// v2.3.0 新秀榜（选秀预测名单）：开档即可查看下一届 80 名新秀的完整球探资料
// （身高 / 体重 / 臂展 / 年龄 / 位置 / 国籍 / 潜力），供提前规划选秀与交易。
import { useMemo, useState } from 'react';
import type { Player } from '../engine/types';
import { heightLabel, weightLabel, wingspanLabel, lbsLabel, feetLabel } from '../engine/gen';
import { POS_CN, ovrClass } from './format';
import { PlayerFace } from './PlayerFace';
import { PlayerModal } from './PlayerModal';
import type { GameApi } from './useGame';

export function DraftView({ api }: { api: GameApi }) {
  const l = api.league!;
  const [view, setView] = useState<Player | null>(null);
  const [sortBy, setSortBy] = useState<'ovr' | 'age' | 'height'>('ovr');

  const list = useMemo(() => {
    const arr = [...(l.nextDraftClass ?? [])];
    if (sortBy === 'ovr') arr.sort((a, b) => b.ovr - a.ovr || a.id - b.id);
    else if (sortBy === 'age') arr.sort((a, b) => a.age - b.age || b.ovr - a.ovr);
    else arr.sort((a, b) => b.height - a.height || b.ovr - a.ovr);
    return arr;
  }, [l.nextDraftClass, sortBy]);

  // 下一届选秀年份 = 本赛季结束后那个夏天
  const draftYear = l.year + 1;
  // 我的签（用于提示能选到哪个区间）
  const myPicks = (l.draftPool ?? [])
    .map((pk, i) => ({ pk, i }))
    .filter((x) => x.pk.o === l.userTeamId && x.pk.year === draftYear);

  const best = list[0];
  const count80 = list.filter((p) => p.ovr >= 80).length;

  return (
    <div className="view">
      <div className="status-strip">
        <div className="chip strong">🎓 {draftYear} 年选秀预测榜</div>
        <div className="chip">共 {list.length} 名新秀 · OVR≥80 的 {count80} 人</div>
        <div className="chip" title="选秀在赛季结束后的休赛期进行；你可以提前考察、甚至交易来更多签位">
          选秀时间：{l.offseason ? '休赛期进行中' : `${l.year} 赛季结束后`}
        </div>
        <div className="chip">
          我的签：{myPicks.length ? myPicks.map((x) => `${x.pk.year} ${x.pk.round === 1 ? '首轮' : '次轮'}`).join(' · ') : '无（已被交易）'}
        </div>
      </div>

      <div className="action-card">
        <div className="action-title">
          📋 球探报告 · 状元热门：{best ? `${best.name}（${POS_CN[best.pos]} · OVR ${best.ovr} · 潜力 ${best.potential} 星 · ${best.age}岁 ${heightLabel(best.height)}）` : '暂无'}
        </div>
        <div className="mini-lines" style={{ marginBottom: 8 }}>
          🌱 这些新秀会在休赛期选秀大会上按签位被挑走（首轮 30 签先选、次轮 30 签后选）；
          名单每个赛季更新一次，随时可以来这里做功课。
        </div>
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <span className="dim">排序：</span>
          <button className={`chip-btn ${sortBy === 'ovr' ? 'on' : ''}`} onClick={() => setSortBy('ovr')}>按实力</button>
          <button className={`chip-btn ${sortBy === 'age' ? 'on' : ''}`} onClick={() => setSortBy('age')}>按年龄</button>
          <button className={`chip-btn ${sortBy === 'height' ? 'on' : ''}`} onClick={() => setSortBy('height')}>按身高</button>
        </div>

        <div className="draft-board">
          <div className="db-head">
            <span>预测</span><span>球员</span><span>位置</span><span>年龄</span>
            <span>身高</span><span>体重</span><span>臂展</span><span>OVR</span><span>潜力</span><span>国籍</span>
          </div>
          {list.map((p, i) => (
            <div className="db-row" key={p.id} onClick={() => setView(p)} title="点击查看完整球探资料（18 项技能 / 体测 / 生涯）">
              <span className="db-rank">{i + 1}</span>
              <span className="db-name">
                <PlayerFace p={p} size="xs" />
                {p.name}
              </span>
              <span className="db-pos">{POS_CN[p.pos]}</span>
              <span>{p.age}岁</span>
              <span title={feetLabel(p.height)}>{heightLabel(p.height)}</span>
              <span title={p.weight ? lbsLabel(p.weight) : ''}>{p.weight ? weightLabel(p.weight) : '-'}</span>
              <span title={p.wingspan ? feetLabel(p.wingspan) : ''}>{p.wingspan ? wingspanLabel(p.wingspan) : '-'}</span>
              <span className={`ovr-badge sm ${ovrClass(p.ovr)}`}>{p.ovr}</span>
              <span className="db-pot">{'★'.repeat(Math.max(1, Math.min(10, p.potential)))}</span>
              <span className="db-nation">{p.nation !== '美国' ? p.nation : ''}</span>
            </div>
          ))}
          {list.length === 0 && <div className="hint">暂无新秀名单（下一个休赛期会生成）。</div>}
        </div>
      </div>

      {view && <PlayerModal player={view} team={l.teams[l.userTeamId]} onClose={() => setView(null)} />}
    </div>
  );
}
