import { addMonthsYM, dayInMonth, fromKey, monthOf, todayKey, addDays } from './date';
import type { Account, AppData, Transaction } from './types';

/** 거래가 해당 계좌 잔액에 주는 영향 (+ 들어옴, − 나감) */
export function effectOn(tx: Transaction, accountId: string): number {
  if (tx.type === 'expense') return tx.accountId === accountId ? -tx.amount : 0;
  if (tx.type === 'income') return tx.accountId === accountId ? tx.amount : 0;
  let v = 0;
  if (tx.accountId === accountId) v -= tx.amount;
  if (tx.toAccountId === accountId) v += tx.amount;
  return v;
}

/** 계좌 잔액. 카드는 음수 = 갚아야 할 돈. upTo 날짜까지 (포함) */
export function balanceOf(acc: Account, txs: Transaction[], upTo?: string): number {
  let b = acc.initial;
  for (const t of txs) {
    if (upTo && t.date > upTo) continue;
    b += effectOn(t, acc.id);
  }
  return b;
}

export const isLiquid = (a: Account) => a.kind === 'bank' || a.kind === 'cash';

export interface Totals { liquid: number; cardDebt: number; invest: number; net: number }

export function totals(data: AppData, upTo = todayKey()): Totals {
  let liquid = 0, cardDebt = 0, invest = 0;
  for (const a of data.accounts) {
    if (a.archived) continue;
    const b = balanceOf(a, data.transactions, upTo);
    if (a.kind === 'card') cardDebt += -b;
    else if (a.kind === 'invest') invest += a.invest?.currentValue ?? b;
    else liquid += b;
  }
  return { liquid, cardDebt, invest, net: liquid + invest - cardDebt };
}

/** 지출·수입 집계에서 빼야 할 거래: 이체, 카드 대금 납부 */
export const countsAsFlow = (t: Transaction) => t.type !== 'transfer';

export interface MonthSummary { ym: string; income: number; expense: number; byCategory: Record<string, number> }

export function monthSummary(txs: Transaction[], ym: string): MonthSummary {
  let income = 0, expense = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txs) {
    if (!countsAsFlow(t) || monthOf(t.date) !== ym) continue;
    if (t.type === 'income') income += t.amount;
    else {
      expense += t.amount;
      const k = t.categoryId ?? 'etc';
      byCategory[k] = (byCategory[k] ?? 0) + t.amount;
    }
  }
  return { ym, income, expense, byCategory };
}

// ───────── 신용카드 ─────────

/**
 * 카드 사용일 → 대금을 내는 달 (YYYY-MM).
 * closingDay(사용 기간 마감일) 이전 사용분은 이번 마감, 이후는 다음 마감.
 * 결제일(dueDay)이 마감일보다 뒤면 같은 달, 아니면 다음 달에 납부.
 */
export function billMonthFor(date: string, closingDay: number, dueDay: number): string {
  const d = fromKey(date);
  const ym = monthOf(date);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const closeThisMonth = d.getDate() <= Math.min(closingDay, lastDay);
  const closingYM = closeThisMonth ? ym : addMonthsYM(ym, 1);
  return dueDay > closingDay ? closingYM : addMonthsYM(closingYM, 1);
}

export const dueDateOf = (billMonth: string, dueDay: number) => dayInMonth(billMonth, dueDay);

/** 할부 금액 나누기: 나머지는 첫 회차에 */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i === 0 ? rest : 0));
}

/**
 * 지출 1건을 실제 저장할 거래들로 펼침.
 * 카드면 청구 달을 붙이고, 할부면 회차마다 다음 달 청구서로.
 */
export function expandPurchase(base: Transaction, account: Account | undefined, installments: number, uid: () => string): Transaction[] {
  const card = account?.kind === 'card' ? account.card : undefined;
  const first = card ? billMonthFor(base.date, card.closingDay, card.dueDay) : null;
  if (installments <= 1 || base.type !== 'expense') return [{ ...base, billMonth: first, installment: null }];
  const groupId = uid();
  const parts = splitInstallments(base.amount, installments);
  return parts.map((amount, i) => {
    const date = i === 0 ? base.date : dayInMonth(addMonthsYM(monthOf(base.date), i), fromKey(base.date).getDate());
    return {
      ...base,
      id: i === 0 ? base.id : uid(),
      amount,
      date,
      billMonth: first ? addMonthsYM(first, i) : null,
      installment: { groupId, index: i + 1, count: installments, total: base.amount },
      createdAt: base.createdAt + i,
    };
  });
}

export interface CardBill {
  billMonth: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: 'paid' | 'open' | 'late' | 'upcoming';
  items: Transaction[];
}

/** 카드 청구서 목록 (오래된 순). 납부는 오래된 청구서부터 채움 */
export function cardBills(acc: Account, txs: Transaction[], today = todayKey()): CardBill[] {
  if (!acc.card) return [];
  const { closingDay, dueDay } = acc.card;
  const map = new Map<string, Transaction[]>();
  let payments = 0;
  for (const t of txs) {
    if (t.type === 'expense' && t.accountId === acc.id) {
      const bm = t.billMonth ?? billMonthFor(t.date, closingDay, dueDay);
      if (!map.has(bm)) map.set(bm, []);
      map.get(bm)!.push(t);
    } else if (t.type === 'transfer' && t.toAccountId === acc.id) {
      payments += t.amount;
    } else if (t.type === 'income' && t.accountId === acc.id) {
      payments += t.amount; // 환불·캐시백
    }
  }
  const months = [...map.keys()].sort();
  const currentBill = billMonthFor(today, closingDay, dueDay);
  let left = payments;
  return months.map((bm) => {
    const items = map.get(bm)!;
    const amount = items.reduce((s, t) => s + t.amount, 0);
    const paid = Math.min(amount, left);
    left -= paid;
    const dueDate = dueDateOf(bm, dueDay);
    let status: CardBill['status'];
    if (paid >= amount) status = 'paid';
    else if (dueDate < today) status = 'late';
    else if (bm <= currentBill) status = 'open';
    else status = 'upcoming';
    return { billMonth: bm, dueDate, amount, paid, status, items };
  });
}

export function cardStatus(acc: Account, txs: Transaction[], today = todayKey()) {
  const bills = cardBills(acc, txs, today);
  const outstanding = bills.reduce((s, b) => s + b.amount - b.paid, 0);
  const next = bills.find((b) => b.status !== 'paid');
  const limit = acc.card?.limit ?? 0;
  return { bills, outstanding, available: Math.max(0, limit - outstanding), limit, next };
}

/** 이번 달 안에 납부해야 하는 카드 대금 합 (오늘 이후, 미납분) */
export function cardDueUntil(data: AppData, until: string, today = todayKey()) {
  let sum = 0;
  for (const a of data.accounts) {
    if (a.kind !== 'card' || a.archived) continue;
    for (const b of cardBills(a, data.transactions, today)) {
      if (b.status !== 'paid' && b.dueDate >= today && b.dueDate <= until) sum += b.amount - b.paid;
    }
  }
  return sum;
}

/** 지난 n 일 (오늘 포함) 날짜 키 */
export const lastDays = (n: number, today = todayKey()) => Array.from({ length: n }, (_, i) => addDays(today, -i));
