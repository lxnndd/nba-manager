// v1.0.2 更新弹窗（公测版）：只写本次更新内容
const VERSION = '1.0.2';

const ITEMS: string[] = [
  '🖥️ **修复「双击打不开、必须用管理员运行才能开」**：程序启动时要拿一个"单实例锁"（防止开两个窗口把存档写坏），但在受限权限 / 安全策略环境下这个锁会**失败**——旧代码遇到失败会**直接退出**，所以你双击时"毫无反应"，而用管理员运行（能拿到锁）就正常。现在**锁拿不到也照常启动**（代价只是允许多开），双击即可运行。',
  '🛡️ **顺手加固存档目录**：如果默认的存档目录（`%APPDATA%\\NBA经理`）写不进去，会自动改用程序所在目录，避免因权限问题起不来；默认目录可写时行为不变（你的旧存档不受影响）。',
  '📎 另附 `以管理员身份启动.cmd`：万一还有权限问题，双击它就会以管理员身份拉起游戏。',
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
