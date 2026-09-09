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
  exportFile: (suggested: string, data: unknown) => Promise<{ ok: boolean; canceled?: boolean; file?: string; error?: string }>;
  importFile: () => Promise<{ ok: boolean; canceled?: boolean; data?: unknown; file?: string; error?: string }>;
}

declare global {
  interface Window {
    gm?: GmApi;
  }
}

export {};
