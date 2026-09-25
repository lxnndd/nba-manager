const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gm', {
  // 内部存档槽（自动存 / 读）
  saveWrite: (name, data) => ipcRenderer.invoke('save:write', name, data),
  saveList: () => ipcRenderer.invoke('save:list'),
  saveRead: (name) => ipcRenderer.invoke('save:read', name),
  saveRemove: (name) => ipcRenderer.invoke('save:remove', name)
  // v2.7.0：已移除存档导出/导入（用户要求不需要该功能）
});
