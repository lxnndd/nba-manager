// v1.0.1 更新弹窗（公测版）：只写本次更新内容 —— 不再累积历史版本公告
const VERSION = '1.0.1';

const ITEMS: string[] = [
  '🏀 **球队定位改看战绩**：打满 **20 场**后，定位（争冠 / 补强 / 重建）改由战绩修正——**胜率不足 20% 直接判为重建**；打满 **40 场**后，若落后本分区第 8 名 **≥10 个胜场**，同样直接进入重建（基本无缘季后赛）。20 场之前仍按阵容实力判定。',
  '🗑️ **移除「轮换与战术」面板**：它的功能已被其他板块接手——分钟与球权在**位置卡片**里直接改（每张卡上有 −/+ 与输入框），战术发起位置**点位置列标题**即可切换；只保留了「恢复自动轮换」按钮与分钟超 48 的提示。',
  '🔍 **交易搜索器**：整个框居中；搜索结果**直接全部列出来**（以前只显示 10 条、要点「显示全部 N 条」才展开），同时去掉了多余的说明文字。',
  '📊 **球员数据榜真正居中**：此前表格被限制在 760px 宽、在容器里是左对齐的，现在表格与人数行都居中。',
  '🧹 顺带精简了几处提示文案。',
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
