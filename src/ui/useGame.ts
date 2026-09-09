// 游戏状态管理：league 真身存 ref（就地 mutate），tick 强制刷新 + 防抖自动存档
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LeagueState, SaveFile } from '../engine/types';
import { SAVE_VERSION } from '../engine/types';
import { migrateSave } from '../engine/league';

const SAVE_SLOT = 'auto';
const LS_KEY = 'nba-manager-auto';

export interface GameApi {
  league: LeagueState | null;
  hasSave: boolean;
  saveTime: number | null;
  tick: () => void;
  startNew: (l: LeagueState) => void;
  continueGame: () => Promise<boolean>;
  saveNow: () => Promise<boolean>;
  exportSave: () => Promise<void>;
  importSave: () => Promise<boolean>;
  resetToTitle: () => void;
  dirty: boolean;
}

function pack(l: LeagueState): SaveFile {
  return { kind: 'nba-manager-save', saveVersion: SAVE_VERSION, league: l, updatedAt: Date.now() };
}

export function useGame(): GameApi {
  const leagueRef = useRef<LeagueState | null>(null);
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [saveTime, setSaveTime] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    // ⚠️ v0.3.5 关键修复：必须从"当前 UI 对象(prev)"重建，而不是 leagueRef.current。
    // 引擎(如 simDay)就地 mutate 的是上一个 tick 产出的视图对象；若 tick 从 leagueRef.current
    // 拷贝，顶层标量字段(l.day / offseason / season…)的修改全部丢失——表现就是：
    // "比赛照常模拟(共享的 results/球员数据在涨)，但比赛日数字永远不动"。
    setLeague((prev) => {
      if (!prev) return prev;
      const next = { ...prev } as LeagueState;
      leagueRef.current = next; // 真身跟随最新对象：自动存档与后续拷贝都基于它
      return next;
    });
    setDirty(true);
  }, []);

  const persist = useCallback(async (data: SaveFile) => {
    try {
      if (window.gm) {
        const r = await window.gm.saveWrite(SAVE_SLOT, data);
        if (r.ok) return true;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }, []);

  // 防抖自动保存
  useEffect(() => {
    if (!dirty || !leagueRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const ok = await persist(pack(leagueRef.current!));
      if (ok) {
        setSaveTime(Date.now());
        setDirty(false);
      }
    }, 900);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dirty, persist]);

  const startNew = useCallback((l: LeagueState) => {
    leagueRef.current = l;
    setLeague(l);
    setDirty(true);
  }, []);

  const continueGame = useCallback(async (): Promise<boolean> => {
    try {
      let data: SaveFile | null = null;
      if (window.gm) {
        const r = await window.gm.saveRead(SAVE_SLOT);
        if (r.ok && r.data) data = r.data as SaveFile;
      }
      if (!data) {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) data = JSON.parse(raw) as SaveFile;
      }
      if (!data || !data.league) return false;
      migrateSave(data.league); // v1 → v2 字段补齐（老档兼容）
      leagueRef.current = data.league;
      setLeague(data.league);
      setSaveTime(data.updatedAt ?? Date.now());
      setHasSave(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!leagueRef.current) return false;
    const ok = await persist(pack(leagueRef.current));
    if (ok) {
      setSaveTime(Date.now());
      setDirty(false);
    }
    return ok;
  }, [persist]);

  const exportSave = useCallback(async () => {
    if (!leagueRef.current || !window.gm) return;
    await window.gm.exportFile(
      `NBA经理-${leagueRef.current.year}赛季-${new Date().toISOString().slice(0, 10)}`,
      pack(leagueRef.current)
    );
  }, []);

  const importSave = useCallback(async (): Promise<boolean> => {
    if (!window.gm) {
      // 浏览器模式不支持文件对话框
      return false;
    }
    const r = await window.gm.importFile();
    if (r.ok && r.data) {
      const data = r.data as SaveFile;
      if (data.league) {
        migrateSave(data.league); // 导入老档同样迁移
        leagueRef.current = data.league;
        setLeague(data.league);
        setSaveTime(Date.now());
        setHasSave(true);
        return true;
      }
    }
    return false;
  }, []);

  const resetToTitle = useCallback(() => {
    leagueRef.current = null;
    setLeague(null);
    setHasSave(true); // 保留存档存在性标记
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  // 启动时探测存档
  useEffect(() => {
    (async () => {
      try {
        if (window.gm) {
          const list = await window.gm.saveList();
          if (list.some((m) => m.name === SAVE_SLOT)) {
            setHasSave(true);
            const r = await window.gm.saveRead(SAVE_SLOT);
            if (r.ok && r.data) setSaveTime((r.data as SaveFile).updatedAt ?? null);
            return;
          }
        }
        if (localStorage.getItem(LS_KEY)) setHasSave(true);
      } catch { /* ignore */ }
    })();
  }, []);

  return {
    league, hasSave, saveTime, tick, startNew, continueGame, saveNow, exportSave, importSave, resetToTitle, dirty,
  };
}
