// v2.2.1 更新弹窗：每次启动强制显示本次更新内容
const VERSION = '2.2.1';

const ITEMS: string[] = [
  '🏀 球权分配调整：SF/PF/C 三个位置获得更多球权（持球与接球出手倾向均提升），比赛不再是后卫一手包办；能力球员 OVR 越高拿球/出手越多，角色球员相应降低（自定义球权与 PlayCall 仍绝对优先）',
  '⏫ 季后赛晋级展示修复：八强进四强时，最后一个晋级的球队会**立刻**自动进入下一轮对位（无需再点一次模拟）；同时修复了提前把下下轮也建出来的问题',
];

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal changelog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="changelog-title">🎉 更新到 v{VERSION}！</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <ul className="changelog-list">
          {ITEMS.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <div className="btn-row" style={{ marginTop: 4 }}>
          <button className="btn primary" onClick={onClose}>知道了，开始游戏！</button>
        </div>
      </div>
    </div>
  );
}
