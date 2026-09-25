// Electron preload 暴露到 window.gm 的 API 类型声明

export interface SaveMeta {
  name: string;
  mtime: number;
  size: number;
}

export interface GmApi {
  saveWrite: (name: string, data: unknown) => Promise<{ ok: boolean; file?: string; error?: string }>;
  saveList: () => Promise<SaveMeta[]>;
  saveRead: (name: string) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  saveRemove: (name: string) => Promise<{ ok: boolean }>;
  // v2.7.0：已移除 exportFile / importFile（用户要求不需要存档导入导出）
}

declare global {
  interface Window {
    gm?: GmApi;
  }
}

export {};
