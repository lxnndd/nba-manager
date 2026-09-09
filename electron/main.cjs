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

// ---------- 单实例锁：避免开两个窗口写同一个存档 ----------
if (!app.requestSingleInstanceLock()) {
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

// ---------- 存档导出 / 导入（分享给弟弟用） ----------
ipcMain.handle('file:export', async (e, suggested, data) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出存档',
    defaultPath: path.join(app.getPath('documents'), (safeName(suggested) || 'NBA存档') + '.json'),
    filters: [{ name: 'NBA经理存档', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, file: filePath };
});

ipcMain.handle('file:import', async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入存档',
    properties: ['openFile'],
    filters: [{ name: 'NBA经理存档', extensions: ['json'] }]
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
    return { ok: true, data, file: filePaths[0] };
  } catch (err) {
    return { ok: false, error: '文件不是有效的存档: ' + err.message };
  }
});

// ---------- 启动 ----------
app.whenReady().then(() => {
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
