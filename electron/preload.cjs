const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gm', {
  // 内部存档槽（自动存 / 读）
  saveWrite: (name, data) => ipcRenderer.invoke('save:write', name, data),
  saveList: () => ipcRenderer.invoke('save:list'),
  saveRead: (name) => ipcRenderer.invoke('save:read', name),
  saveRemove: (name) => ipcRenderer.invoke('save:remove', name),
  // 导出/导入 .json 文件（分享存档）
  exportFile: (suggested, data) => ipcRenderer.invoke('file:export', suggested, data),
  importFile: () => ipcRenderer.invoke('file:import')
});
