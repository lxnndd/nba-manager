// ⚠️ 必须最先执行：Windows 某系统组件会把字面量 %SystemDrive%\ProgramData\Microsoft\Windows\Caches
// 缓存目录创建在"进程工作目录"下（从桌面双击 exe → 桌面残留 %SystemDrive% 文件夹）。
// ① 先记住原始工作目录；② 在加载 electron 前立刻把工作目录切到 exe 所在目录规避；
// ③ 系统组件创建该目录的时机早于本脚本（且 portable 壳自身也会在壳进程 cwd 造一份），
//    故启动后每 3 秒循环删除残留，退出时再兜底一次。
const _origCwd = (() => { try { return process.cwd(); } catch { return null; } })();
try { process.chdir(require('path').dirname(process.execPath)); } catch { /* 切不动就算了 */ }
const _cleanupSystemDriveDirs = () => {
  const { rmSync } = require('fs');
  const { join, dirname } = require('path');
  const home = process.env.USERPROFILE || '';
  const targets = new Set([
    _origCwd, dirname(process.execPath),
    process.env.PORTABLE_EXECUTABLE_DIR || null,
    home ? join(home, 'Desktop') : null,
    home,
  ]);
  for (const t of targets) {
    if (!t) continue;
    try { rmSync(join(t, '%SystemDrive%'), { recursive: true, force: true }); } catch { /* 删不掉就算了 */ }
  }
};
setInterval(_cleanupSystemDriveDirs, 3000);
process.on('exit', _cleanupSystemDriveDirs);

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------- v1.0.1：Chromium 沙箱兼容兜底（修"双击打不开 / 黑屏窗口"）----------
// 实测（同一台机器、同一个 user-data-dir 做 A/B 对照）：
//   · 保留沙箱 → Electron 启动阶段即崩溃（退出码 0x80000003），表现为"双击没反应"或一个黑屏窗口；
//   · 关掉沙箱 → 1~2 秒内正常出窗口。
//   原因通常是安全策略 / 驱动 hook / 受限父进程让 Chromium 沙箱初始化失败（换台机器就正常，
//   这也是"弟弟能玩、本机不行"的典型成因）。
// 取舍：本项目是**纯离线单机游戏**（不加载远程内容、不执行外部脚本），关掉渲染器沙箱的收益
//   远大于风险。若想恢复，注释掉下面两行即可。
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// ---------- 单实例锁：避免开两个窗口写同一个存档 ----------
// ⚠️ 这里**绝对不能** process.exit()：在受限环境（沙箱 / 权限策略 / 驱动）下
//   requestSingleInstanceLock() 可能直接返回 false，一旦 exit 就永远起不来（无窗口、无报错）。
//   正确做法：只 quit()，并在下面的 whenReady 里用 gotLock 挡住建窗（避免"黑屏窗口"）。
// NBA_SKIP_SINGLE_INSTANCE=1：跳过单实例锁（仅用于受限环境排查/调试，普通玩家不需要设置）
const gotLock = process.env.NBA_SKIP_SINGLE_INSTANCE === '1' ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ---------- 窗口 ----------
// v1.1.1：应用图标（打包 extraResources 复制到 resources/icon.png）→ 窗口/任务栏图标与 exe 文件图标一致
function appIcon() {
  try {
    const cand = path.join(path.dirname(process.execPath), 'resources', 'icon.png');
    return fs.existsSync(cand) ? cand : undefined;
  } catch { return undefined; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'NBA 经理',
    icon: appIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.setMenuBarVisibility(false);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  return win;
}

// ---------- 存档目录：%APPDATA%/NBA经理/saves ----------
function savesDir() {
  const dir = path.join(app.getPath('userData'), 'saves');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeName(name) {
  const n = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return n || 'slot';
}

ipcMain.handle('save:write', (e, name, data) => {
  const file = path.join(savesDir(), safeName(name) + '.json');
  fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
  return { ok: true, file };
});

ipcMain.handle('save:list', () => {
  const dir = savesDir();
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) {
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        out.push({ name: f.replace(/\.json$/, ''), mtime: st.mtimeMs, size: st.size });
      } catch { /* ignore */ }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
});

ipcMain.handle('save:read', (e, name) => {
  const file = path.join(savesDir(), safeName(name) + '.json');
  if (!fs.existsSync(file)) return { ok: false, error: '存档不存在' };
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf-8')) };
  } catch (err) {
    return { ok: false, error: '存档损坏: ' + err.message };
  }
});

ipcMain.handle('save:remove', (e, name) => {
  const file = path.join(savesDir(), safeName(name) + '.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { ok: true };
});

// ---------- 启动 ----------
app.whenReady().then(() => {
  if (!gotLock) return; // 第二个实例不建窗口（否则用户会看到一个"黑屏窗口"）
  createWindow();
  // 自测模式：验证主进程链路后自动退出（构建验证用）
  if (process.env.DSH_AUTOQUIT_MS) {
    setTimeout(() => app.quit(), Number(process.env.DSH_AUTOQUIT_MS));
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
