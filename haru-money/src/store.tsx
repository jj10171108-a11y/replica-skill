import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { freshData } from './domain/defaults';
import { normalize } from './domain/normalize';
import { expandPurchase } from './domain/ledger';
import { sampleData } from './domain/sample';
import { setCurrency } from './domain/money';
import { schedule } from './domain/debts';
import { fromKey, todayKey } from './domain/date';
import type { Account, AppData, Budget, Category, Debt, Goal, Recurring, Settings, Transaction } from './domain/types';

const KEY = 'haru_money_v1';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

// ───────── 알림 (고정 지출·빚 상환일) ─────────
const CHANNEL = 'money-reminders';
let notifReady = false;
async function ensureNotif() {
  if (Platform.OS === 'web') return false;
  try {
    if (!notifReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, { name: '납부 알림', importance: Notifications.AndroidImportance.HIGH });
      }
      notifReady = true;
    }
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
async function cancel(ids?: (string | null | undefined)[]) {
  if (Platform.OS === 'web') return;
  for (const id of ids ?? []) if (id) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch {} }
}
async function scheduleRecurring(r: Recurring): Promise<string | null> {
  if (!r.remind || !r.active || !(await ensureNotif())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: `${r.name} ${r.type === 'income' ? '들어오는 날' : '납부일'}이에요`, body: `${r.amount.toLocaleString('ko-KR')}원 · 기록을 확인하세요` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: Math.min(r.day, 28), hour: 9, minute: 0, channelId: CHANNEL },
    });
  } catch { return null; }
}
async function scheduleDebt(d: Debt): Promise<string[]> {
  if (!d.remind || !(await ensureNotif())) return [];
  const ids: string[] = [];
  const today = todayKey();
  for (const s of schedule(d, today).filter((x) => !x.paid && x.date >= today).slice(0, 6)) {
    const at = fromKey(s.date); at.setHours(9, 0, 0, 0);
    if (at.getTime() < Date.now()) continue;
    try {
      ids.push(await Notifications.scheduleNotificationAsync({
        content: { title: `${d.name} ${s.n}회차 납부일`, body: `${d.installment.toLocaleString('ko-KR')}원을 오늘 내야 해요` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      }));
    } catch {}
  }
  return ids;
}

// ───────── 스토어 ─────────
export interface NewEntry {
  type: Transaction['type'];
  amount: number;
  date: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId: string | null;
  note: string;
  installments?: number;
  cardPayment?: boolean;
  recurringId?: string | null;
}

interface Store {
  data: AppData;
  loaded: boolean;
  addEntry: (e: NewEntry) => void;
  addMany: (txs: Transaction[]) => void;
  updateTx: (t: Transaction) => void;
  deleteTx: (id: string, wholeInstallment?: boolean) => void;
  saveAccount: (a: Account) => void;
  deleteAccount: (id: string) => void;
  saveCategory: (c: Category) => void;
  setBudget: (b: Budget | { categoryId: string; amount: 0 }) => void;
  saveGoal: (g: Goal) => void;
  deleteGoal: (id: string) => void;
  saveRecurring: (r: Recurring) => Promise<void>;
  deleteRecurring: (id: string) => void;
  saveDebt: (d: Debt) => Promise<void>;
  deleteDebt: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  replaceAll: (d: AppData) => void;
  loadSample: () => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => freshData(uid));
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(data);
  ref.current = data;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setData(normalize(JSON.parse(raw))); })
      .catch((e) => console.warn('불러오기 실패', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    setCurrency(data.settings.currency);
    if (!loaded) return;
    const h = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(data)).catch((e) => console.warn('저장 실패', e)); }, 250);
    return () => clearTimeout(h);
  }, [data, loaded]);

  const patch = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const upsert = <T extends { id: string }>(list: T[], x: T) => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x]);

  const store = useMemo<Store>(() => ({
    data,
    loaded,
    addEntry: (e) => patch((d) => {
      const acc = d.accounts.find((a) => a.id === e.accountId);
      const base: Transaction = {
        id: uid(), type: e.type, amount: Math.round(e.amount * 100) / 100, date: e.date, accountId: e.accountId,
        toAccountId: e.type === 'transfer' ? e.toAccountId ?? null : null, categoryId: e.type === 'transfer' ? null : e.categoryId,
        note: e.note.trim(), cardPayment: e.cardPayment ?? (e.type === 'transfer' && d.accounts.find((a) => a.id === e.toAccountId)?.kind === 'card'),
        recurringId: e.recurringId ?? null, createdAt: Date.now(),
      };
      return { ...d, transactions: [...expandPurchase(base, acc, e.installments ?? 1, uid), ...d.transactions] };
    }),
    addMany: (txs) => patch((d) => ({ ...d, transactions: [...txs, ...d.transactions] })),
    updateTx: (t) => patch((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === t.id ? t : x)) })),
    deleteTx: (id, whole) => patch((d) => {
      const t = d.transactions.find((x) => x.id === id);
      const gid = whole ? t?.installment?.groupId : null;
      return { ...d, transactions: d.transactions.filter((x) => x.id !== id && !(gid && x.installment?.groupId === gid)) };
    }),
    saveAccount: (a) => patch((d) => ({ ...d, accounts: upsert(d.accounts, a) })),
    deleteAccount: (id) => patch((d) => {
      const used = d.transactions.some((t) => t.accountId === id || t.toAccountId === id);
      // 기록이 있으면 보관(숨김) 처리, 없으면 삭제
      return used
        ? { ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)) }
        : { ...d, accounts: d.accounts.filter((a) => a.id !== id) };
    }),
    saveCategory: (c) => patch((d) => ({ ...d, categories: upsert(d.categories, c) })),
    setBudget: (b) => patch((d) => ({
      ...d,
      budgets: b.amount > 0 ? [...d.budgets.filter((x) => x.categoryId !== b.categoryId), b as Budget] : d.budgets.filter((x) => x.categoryId !== b.categoryId),
    })),
    saveGoal: (g) => patch((d) => ({ ...d, goals: upsert(d.goals, g) })),
    deleteGoal: (id) => patch((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })),
    saveRecurring: async (r) => {
      const old = ref.current.recurring.find((x) => x.id === r.id);
      await cancel([old?.notifId]);
      const notifId = await scheduleRecurring(r);
      patch((d) => ({ ...d, recurring: upsert(d.recurring, { ...r, notifId }) }));
    },
    deleteRecurring: (id) => {
      cancel([ref.current.recurring.find((x) => x.id === id)?.notifId]);
      patch((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== id) }));
    },
    saveDebt: async (debt) => {
      const old = ref.current.debts.find((x) => x.id === debt.id);
      await cancel(old?.notifIds);
      const notifIds = await scheduleDebt(debt);
      patch((d) => ({ ...d, debts: upsert(d.debts, { ...debt, notifIds }) }));
    },
    deleteDebt: (id) => {
      cancel(ref.current.debts.find((x) => x.id === id)?.notifIds);
      patch((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== id) }));
    },
    updateSettings: (s) => patch((d) => ({ ...d, settings: { ...d.settings, ...s } })),
    replaceAll: (next) => setData({ ...next, settings: { ...next.settings, lock: ref.current.settings.lock, onboarded: true } }),
    loadSample: () => setData({ ...sampleData(uid), settings: { ...ref.current.settings, onboarded: true } }),
    resetAll: () => { const f = freshData(uid); setData({ ...f, settings: { ...f.settings, onboarded: true, lock: ref.current.settings.lock, theme: ref.current.settings.theme } }); },
  }), [data, loaded, patch]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};

export const useLookup = () => {
  const { data } = useStore();
  return useMemo(() => ({
    account: Object.fromEntries(data.accounts.map((a) => [a.id, a])) as Record<string, Account>,
    category: Object.fromEntries(data.categories.map((c) => [c.id, c])) as Record<string, Category>,
  }), [data.accounts, data.categories]);
};
