import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, Goal, Note, Project, Settings, Task } from './types';
import { nextOccurrence, todayKey, addDays } from './date';
import { cancelReminder, scheduleReminder } from './notify';
import { refreshWidgets } from './widget/bridge';

export const STORAGE_KEY = 'haru_planner_v1';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const defaultSettings: Settings = {
  theme: 'system',
  weekStart: 0,
  notifications: true,
  pinEnabled: false,
  defaultReminderMin: 0,
};

const seed = (): AppData => {
  const now = Date.now();
  const personal: Project = { id: uid(), name: '개인', emoji: '🏠', color: '#1F7A55', createdAt: now };
  const work: Project = { id: uid(), name: '업무', emoji: '💼', color: '#2A5FA8', createdAt: now + 1 };
  const goal: Goal = { id: uid(), title: '꾸준히 운동하기', emoji: '🏃', deadline: null, createdAt: now };
  const base = { note: '', goalId: null, time: null, repeat: 'none' as const, remind: false, subtasks: [], done: false, doneAt: null };
  return {
    version: 1,
    projects: [personal, work],
    goals: [goal],
    tasks: [
      { ...base, id: uid(), title: '하루 플래너에 오신 걸 환영해요 👋', note: '할 일을 눌러 수정하고, 동그라미를 눌러 완료하세요.\n길게 누르면 빠른 메뉴가 열려요.', projectId: personal.id, due: todayKey(), priority: 2, createdAt: now },
      { ...base, id: uid(), title: '30분 걷기', projectId: personal.id, goalId: goal.id, due: todayKey(), priority: 1, repeat: 'daily', createdAt: now + 1 },
      { ...base, id: uid(), title: '주간 회의 준비', projectId: work.id, due: addDays(todayKey(), 1), time: '10:00', priority: 3, createdAt: now + 2,
        subtasks: [{ id: uid(), title: '지난주 회의록 확인', done: false }, { id: uid(), title: '안건 정리', done: false }] },
    ],
    notes: [
      { id: uid(), title: '메모 사용법', body: '메모에 날짜를 연결하면 캘린더에서도 볼 수 있어요.\n중요한 메모는 고정해 두세요.', date: todayKey(), color: '#FFF2C7', pinned: true, updatedAt: now },
    ],
    settings: defaultSettings,
  };
};

/** Validates and normalizes loaded / imported data. Throws on invalid shape. */
export function normalize(raw: any): AppData {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tasks)) throw new Error('올바른 백업 데이터가 아니에요');
  const str = (v: any, d = '') => (typeof v === 'string' ? v : d);
  const dateOrNull = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    version: 1,
    tasks: raw.tasks.filter((t: any) => t && t.id && t.title).map((t: any): Task => ({
      id: str(t.id),
      title: str(t.title).slice(0, 300),
      note: str(t.note).slice(0, 5000),
      projectId: t.projectId ?? null,
      goalId: t.goalId ?? null,
      due: dateOrNull(t.due),
      time: typeof t.time === 'string' && /^\d{2}:\d{2}$/.test(t.time) ? t.time : null,
      priority: [0, 1, 2, 3].includes(t.priority) ? t.priority : 0,
      repeat: ['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(t.repeat) ? t.repeat : 'none',
      remind: !!t.remind,
      notifId: t.notifId ?? null,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s: any) => ({ id: str(s.id, uid()), title: str(s.title), done: !!s.done })) : [],
      done: !!t.done,
      doneAt: typeof t.doneAt === 'number' ? t.doneAt : null,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
    })),
    projects: (Array.isArray(raw.projects) ? raw.projects : []).map((p: any): Project => ({
      id: str(p.id, uid()), name: str(p.name, '프로젝트'), emoji: str(p.emoji, '📁'), color: str(p.color, '#5B45B8'), createdAt: p.createdAt ?? Date.now(),
    })),
    goals: (Array.isArray(raw.goals) ? raw.goals : []).map((g: any): Goal => ({
      id: str(g.id, uid()), title: str(g.title, '목표'), emoji: str(g.emoji, '⭐'), deadline: dateOrNull(g.deadline), createdAt: g.createdAt ?? Date.now(),
    })),
    notes: (Array.isArray(raw.notes) ? raw.notes : []).map((n: any): Note => ({
      id: str(n.id, uid()), title: str(n.title), body: str(n.body), date: dateOrNull(n.date), color: str(n.color, '#FFF2C7'), pinned: !!n.pinned, updatedAt: n.updatedAt ?? Date.now(),
    })),
    settings: { ...defaultSettings, ...(raw.settings || {}) },
  };
}

interface Store {
  data: AppData;
  loaded: boolean;
  saveTask: (t: Task) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleSubtask: (taskId: string, subId: string) => void;
  saveProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  saveGoal: (g: Goal) => void;
  deleteGoal: (id: string) => void;
  saveNote: (n: Note) => void;
  deleteNote: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  replaceAll: (d: AppData) => Promise<void>;
  resetAll: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => ({ ...seed(), tasks: [], notes: [], projects: [], goals: [] }));
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setData(raw ? normalize(JSON.parse(raw)) : seed());
      } catch (e) {
        console.warn('데이터 로드 실패, 새로 시작합니다', e);
        setData(seed());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // 변경 시 디바운스 저장
  useEffect(() => {
    if (!loaded) return;
    const h = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        .then(() => refreshWidgets(data))
        .catch((e) => console.warn('저장 실패', e));
    }, 300);
    return () => clearTimeout(h);
  }, [data, loaded]);

  const patch = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const withReminder = useCallback(async (t: Task): Promise<Task> => {
    const s = dataRef.current.settings;
    await cancelReminder(t.notifId);
    const notifId = s.notifications ? await scheduleReminder(t, s.defaultReminderMin) : null;
    return { ...t, notifId };
  }, []);

  const saveTask = useCallback(async (task: Task) => {
    const t = await withReminder(task);
    patch((d) => {
      const exists = d.tasks.some((x) => x.id === t.id);
      return { ...d, tasks: exists ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...d.tasks] };
    });
  }, [patch, withReminder]);

  const toggleTask = useCallback(async (id: string) => {
    const cur = dataRef.current.tasks.find((t) => t.id === id);
    if (!cur) return;
    const done = !cur.done;
    const updated = await withReminder({ ...cur, done, doneAt: done ? Date.now() : null });
    let spawned: Task | null = null;
    // 반복 할 일을 완료하면 다음 회차를 자동 생성
    if (done && cur.repeat !== 'none' && cur.due) {
      const next = nextOccurrence(cur.due, cur.repeat);
      const already = dataRef.current.tasks.some((t) => !t.done && t.title === cur.title && t.due === next && t.repeat === cur.repeat);
      if (next && !already) {
        spawned = await withReminder({
          ...cur, id: uid(), due: next, done: false, doneAt: null, notifId: null, createdAt: Date.now(),
          subtasks: cur.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
        });
      }
    }
    patch((d) => ({ ...d, tasks: [...(spawned ? [spawned] : []), ...d.tasks.map((t) => (t.id === id ? updated : t))] }));
  }, [patch, withReminder]);

  const deleteTask = useCallback(async (id: string) => {
    const cur = dataRef.current.tasks.find((t) => t.id === id);
    await cancelReminder(cur?.notifId);
    patch((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, [patch]);

  const toggleSubtask = useCallback((taskId: string, subId: string) => {
    patch((d) => ({
      ...d,
      tasks: d.tasks.map((t) => t.id !== taskId ? t : { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }),
    }));
  }, [patch]);

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

  const store = useMemo<Store>(() => ({
    data,
    loaded,
    saveTask,
    toggleTask,
    deleteTask,
    toggleSubtask,
    saveProject: (p) => patch((d) => ({ ...d, projects: upsert(d.projects, p) })),
    deleteProject: (id) => patch((d) => ({
      ...d, projects: d.projects.filter((p) => p.id !== id), tasks: d.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
    })),
    saveGoal: (g) => patch((d) => ({ ...d, goals: upsert(d.goals, g) })),
    deleteGoal: (id) => patch((d) => ({
      ...d, goals: d.goals.filter((g) => g.id !== id), tasks: d.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    })),
    saveNote: (n) => patch((d) => ({ ...d, notes: upsert(d.notes, n) })),
    deleteNote: (id) => patch((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),
    updateSettings: (s) => patch((d) => ({ ...d, settings: { ...d.settings, ...s } })),
    replaceAll: async (next) => {
      await Promise.all(dataRef.current.tasks.map((t) => cancelReminder(t.notifId)));
      const tasks = await Promise.all(next.tasks.map((t) => withReminder({ ...t, notifId: null })));
      setData({ ...next, tasks, settings: { ...next.settings, pinEnabled: dataRef.current.settings.pinEnabled } });
    },
    resetAll: async () => {
      await Promise.all(dataRef.current.tasks.map((t) => cancelReminder(t.notifId)));
      setData({ ...seed(), settings: { ...dataRef.current.settings } });
    },
  }), [data, loaded, saveTask, toggleTask, deleteTask, toggleSubtask, patch, withReminder]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};

export const newTask = (partial: Partial<Task> = {}): Task => ({
  id: uid(),
  title: '',
  note: '',
  projectId: null,
  goalId: null,
  due: null,
  time: null,
  priority: 0,
  repeat: 'none',
  remind: false,
  notifId: null,
  subtasks: [],
  done: false,
  doneAt: null,
  createdAt: Date.now(),
  ...partial,
});
