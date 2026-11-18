import { DEFAULT_CATEGORIES, defaultSettings } from './defaults';
import type { AppData, Category } from './types';

const isDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: any, d = '') => (typeof v === 'string' ? v : d);
const arr = (v: any) => (Array.isArray(v) ? v : []);

/** 불러온 데이터(저장소·백업)를 검사하고 빠진 값은 채운다. 형식이 아니면 예외 */
export function normalize(raw: any): AppData {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.accounts) || !Array.isArray(raw.transactions)) {
    throw new Error('하루 가계부 데이터가 아니에요');
  }
  const accounts = arr(raw.accounts).filter((a: any) => a && a.id).map((a: any) => ({
    id: str(a.id), name: str(a.name, '계좌').slice(0, 40), kind: ['bank', 'cash', 'card', 'invest'].includes(a.kind) ? a.kind : 'bank',
    initial: num(a.initial), color: str(a.color, '#2A5FA8'), createdAt: num(a.createdAt, Date.now()), archived: !!a.archived,
    card: a.card ? { closingDay: num(a.card.closingDay, 31), dueDay: num(a.card.dueDay, 14), limit: num(a.card.limit), payFromId: a.card.payFromId ?? null } : undefined,
    invest: a.invest ? { currentValue: num(a.invest.currentValue), valuedAt: isDate(a.invest.valuedAt) ? a.invest.valuedAt : new Date().toISOString().slice(0, 10) } : undefined,
  }));
  const ids = new Set(accounts.map((a: any) => a.id));
  const transactions = arr(raw.transactions)
    .filter((t: any) => t && t.id && isDate(t.date) && ids.has(t.accountId) && num(t.amount) > 0)
    .map((t: any) => ({
      id: str(t.id), type: ['expense', 'income', 'transfer'].includes(t.type) ? t.type : 'expense', amount: num(t.amount), date: t.date,
      accountId: t.accountId, toAccountId: t.toAccountId && ids.has(t.toAccountId) ? t.toAccountId : null, categoryId: t.categoryId ?? null,
      note: str(t.note).slice(0, 200), installment: t.installment && t.installment.groupId ? {
        groupId: str(t.installment.groupId), index: num(t.installment.index, 1), count: num(t.installment.count, 1), total: num(t.installment.total, t.amount),
      } : null,
      billMonth: typeof t.billMonth === 'string' ? t.billMonth : null, cardPayment: !!t.cardPayment, recurringId: t.recurringId ?? null,
      createdAt: num(t.createdAt, Date.now()),
    }))
    .filter((t: any) => t.type !== 'transfer' || t.toAccountId);
  const categories = arr(raw.categories).length
    ? arr(raw.categories).filter((c: any) => c && c.id).map((c: any) => ({
      id: str(c.id), name: str(c.name, '카테고리'), icon: str(c.icon, 'pricetag-outline'), color: str(c.color, '#5A5560'),
      type: (c.type === 'income' ? 'income' : 'expense') as Category['type'], keywords: arr(c.keywords).filter((k: any) => typeof k === 'string'),
    }))
    : DEFAULT_CATEGORIES;
  return {
    version: 1,
    accounts,
    transactions,
    categories,
    budgets: arr(raw.budgets).filter((b: any) => b && b.categoryId && num(b.amount) > 0).map((b: any) => ({ categoryId: b.categoryId, amount: num(b.amount) })),
    goals: arr(raw.goals).filter((g: any) => g && g.id).map((g: any) => ({
      id: str(g.id), name: str(g.name, '목표'), target: num(g.target), saved: num(g.saved), deadline: isDate(g.deadline) ? g.deadline : null, color: str(g.color, '#1F7A55'), createdAt: num(g.createdAt, Date.now()),
    })),
    recurring: arr(raw.recurring).filter((r: any) => r && r.id && ids.has(r.accountId)).map((r: any) => ({
      id: str(r.id), name: str(r.name, '고정 항목'), type: r.type === 'income' ? 'income' : 'expense', amount: num(r.amount), categoryId: r.categoryId ?? null,
      accountId: r.accountId, day: Math.min(31, Math.max(1, num(r.day, 1))), remind: !!r.remind, notifId: r.notifId ?? null, active: r.active !== false,
    })),
    debts: arr(raw.debts).filter((d: any) => d && d.id && isDate(d.firstDue)).map((d: any) => ({
      id: str(d.id), name: str(d.name, '빚'), kind: ['loan', 'financing', 'agreement', 'personal'].includes(d.kind) ? d.kind : 'loan',
      principal: num(d.principal), installment: num(d.installment), count: Math.max(1, num(d.count, 1)), firstDue: d.firstDue,
      paid: arr(d.paid).filter((n: any) => typeof n === 'number'), remind: !!d.remind, notifIds: arr(d.notifIds), createdAt: num(d.createdAt, Date.now()),
    })),
    settings: { ...defaultSettings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) },
  };
}
