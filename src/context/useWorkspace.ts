import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from '../types';
import defaults from '../../shared/defaults.json';
import { accountRequest } from '../utils/accounts';

const lists = ['classrooms', 'students', 'attendance', 'journals', 'whatsappLogs'] as const;
const settings = ['whatsappSettings', 'reportSchedule'] as const;
type Kind = keyof AppData;
type Row = { kind: Kind; id: string; value: unknown; version: string };
type Change = Omit<Row, 'version'> & { before: unknown };
const empty = (): AppData => ({
  classrooms: [],
  students: [],
  attendance: [],
  journals: [],
  whatsappLogs: [],
  whatsappSettings: defaults.whatsappSettings,
  reportSchedule: defaults.reportSchedule as AppData['reportSchedule'],
});

function changesBetween(a: AppData, b: AppData): Change[] {
  const changes: Change[] = [];
  for (const kind of lists) {
    if (a[kind] === b[kind]) continue;
    const old = new Map<string, unknown>(a[kind].map((r) => [r.id, r]));
    for (const value of b[kind]) {
      const before = old.get(value.id) ?? null;
      if (before !== value) changes.push({ kind, id: value.id, before, value });
      old.delete(value.id);
    }
    for (const [id, before] of old) changes.push({ kind, id, before, value: null });
  }
  for (const kind of settings) {
    if (a[kind] !== b[kind])
      changes.push({ kind, id: 'settings', before: a[kind] ?? null, value: b[kind] });
  }
  return changes;
}

function applyRows(data: AppData, rows: Row[]): AppData {
  const result = { ...data };
  for (const kind of lists) {
    const updates = rows.filter((row) => row.kind === kind);
    if (!updates.length) continue;
    const map = new Map<string, unknown>(data[kind].map((r) => [r.id, r]));
    for (const row of updates) {
      if (row.value === null) map.delete(row.id);
      else map.set(row.id, row.value);
    }
    Object.assign(result, { [kind]: Array.from(map.values()) });
  }
  for (const row of rows) {
    if (row.kind === 'whatsappSettings' || row.kind === 'reportSchedule')
      Object.assign(result, { [row.kind]: row.value });
  }
  if (result.whatsappLogs !== data.whatsappLogs)
    result.whatsappLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return result;
}

export function useWorkspace(accountId?: string) {
  const [data, render] = useState<AppData>(empty);
  const [loaded, setLoaded] = useState<string>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const store = useRef<{
    id: string;
    data: AppData;
    confirmed: AppData;
    cursor: string;
    count: number;
    generation: number;
    queue: Promise<void>;
    sync: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setError('');
    setLoaded(undefined);
    setPending(false);
    render(empty());
    if (!accountId) return;
    const state = {
      id: accountId,
      data: empty(),
      confirmed: empty(),
      cursor: '0',
      count: 0,
      generation: 0,
      queue: Promise.resolve(),
      sync: async () => {},
    };
    store.current = state;
    let fetching = false;
    let refreshAgain = false;
    async function sync() {
      if (state.count || store.current !== state) return;
      if (fetching) {
        refreshAgain = true;
        return;
      }
      fetching = true;
      const generation = state.generation;
      try {
        let cursor = state.cursor,
          snapshot = state.confirmed;
        while (true) {
          const page = await accountRequest<{ rows: Row[]; more: boolean }>('workspace?after=' + cursor);
          if (store.current !== state || generation !== state.generation) return;
          snapshot = applyRows(snapshot, page.rows);
          cursor = page.rows.at(-1)?.version ?? cursor;
          if (!page.more) break;
        }
        state.cursor = cursor;
        state.confirmed = snapshot;
        state.data = snapshot;
        render(snapshot);
        setLoaded(accountId);
      } catch (err) {
        if (store.current === state) setError((err as Error).message);
      } finally {
        fetching = false;
        if (refreshAgain) {
          refreshAgain = false;
          void sync();
        }
      }
    }
    state.sync = sync;
    void sync();
    const poll = window.setInterval(sync, 6000);
    window.addEventListener('focus', sync);
    const warn = (event: BeforeUnloadEvent) => {
      if (state.count) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      store.current = null;
      clearInterval(poll);
      window.removeEventListener('focus', sync);
      window.removeEventListener('beforeunload', warn);
    };
  }, [accountId]);

  const setData = useCallback((update: AppData | ((previous: AppData) => AppData)) => {
    const state = store.current;
    if (!state) return;
    const next = typeof update === 'function' ? update(state.data) : update;
    const changes = changesBetween(state.data, next);
    if (!changes.length) return;
    state.generation++;
    state.count++;
    state.data = next;
    render(next);
    setPending(true);
    setError('');
    state.queue = state.queue.then(async () => {
      if (store.current !== state) return;
      try {
        await accountRequest('workspace', { changes });
      } catch (err) {
        if (store.current === state) setError('Periksa hasil penyimpanan: ' + (err as Error).message);
      } finally {
        state.count--;
        if (store.current === state && !state.count) {
          setPending(false);
          await state.sync();
        }
      }
    });
  }, []);
  return {
    data,
    setData,
    workspaceReady: !!accountId && loaded === accountId,
    workspaceError: error,
    workspacePending: pending,
    flush: () => store.current?.queue,
    retry: () => {
      setError('');
      void store.current?.sync();
    },
  };
}
