import { addDays, addMonthsYM, dayInMonth, fromKey, monthOf, todayKey } from './date';
import { freshData, INK } from './defaults';
import { rng } from './engine';
import { cardBills, expandPurchase } from './ledger';
import type { AppData, Transaction } from './types';

/** 최근 4개월치 그럴듯한 예시 데이터 (설정 → 예시 데이터) */
export function sampleData(uid: () => string, today = todayKey()): AppData {
  const d = freshData(uid);
  const [bank, cash, card] = d.accounts;
  const invest = { id: uid(), name: '증권 계좌', kind: 'invest' as const, initial: 0, color: INK.butter, createdAt: Date.now() + 3,
    invest: { currentValue: 0, valuedAt: today } };
  d.accounts.push(invest);
  bank.initial = 1_800_000;
  cash.initial = 80_000;
  const r = rng(7);
  const txs: Transaction[] = [];
  let ts = Date.now() - 1e9;
  const add = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date' | 'accountId'>, inst = 1) => {
    const base: Transaction = { id: uid(), categoryId: null, note: '', toAccountId: null, createdAt: ts++, ...p };
    const acc = d.accounts.find((a) => a.id === p.accountId);
    txs.push(...expandPurchase(base, acc, inst, uid));
  };
  const start = addDays(today, -125);
  const months = [0, 1, 2, 3, 4].map((i) => addMonthsYM(monthOf(today), -4 + i));
  for (const ym of months) {
    const on = (day: number) => dayInMonth(ym, day);
    const ok = (k: string) => k >= start && k <= today;
    if (ok(on(25))) add({ type: 'income', amount: 3_200_000, date: on(25), accountId: bank.id, categoryId: 'salary', note: '월급' });
    if (ok(on(1))) add({ type: 'expense', amount: 600_000, date: on(1), accountId: bank.id, categoryId: 'housing', note: '월세' });
    if (ok(on(10))) add({ type: 'expense', amount: 118_000 + Math.round(r() * 15) * 1000, date: on(10), accountId: bank.id, categoryId: 'housing', note: '관리비' });
    if (ok(on(15))) add({ type: 'expense', amount: 55_000, date: on(15), accountId: card.id, categoryId: 'phone', note: '통신비' });
    if (ok(on(5))) add({ type: 'expense', amount: 17_000, date: on(5), accountId: card.id, categoryId: 'subs', note: '넷플릭스' });
    if (ok(on(20))) add({ type: 'expense', amount: 14_900, date: on(20), accountId: card.id, categoryId: 'subs', note: '유튜브 프리미엄' });
    if (ok(on(26))) add({ type: 'transfer', amount: 300_000, date: on(26), accountId: bank.id, toAccountId: invest.id, categoryId: null, note: '적립식 투자' });
  }
  for (let k = addDays(today, -1); k >= start; k = addDays(k, -1)) {
    const dow = fromKey(k).getDay();
    if (dow >= 1 && dow <= 5 && r() < 0.85) add({ type: 'expense', amount: 8000 + Math.round(r() * 8) * 1000, date: k, accountId: card.id, categoryId: 'food', note: '점심' });
    if (r() < 0.45) add({ type: 'expense', amount: [4500, 5000, 5500, 6300][Math.floor(r() * 4)], date: k, accountId: card.id, categoryId: 'cafe', note: '커피' });
    if (dow === 6 && r() < 0.9) add({ type: 'expense', amount: 35_000 + Math.round(r() * 50) * 1000, date: k, accountId: card.id, categoryId: 'grocery', note: '마트 장보기' });
    if (r() < 0.12) add({ type: 'expense', amount: 9000 + Math.round(r() * 12) * 1000, date: k, accountId: card.id, categoryId: 'transport', note: '택시' });
    if (r() < 0.2) add({ type: 'expense', amount: 1500 * (1 + Math.floor(r() * 3)), date: k, accountId: cash.id, categoryId: 'transport', note: '버스' });
    if ((dow === 5 || dow === 6) && r() < 0.35) add({ type: 'expense', amount: 25_000 + Math.round(r() * 40) * 1000, date: k, accountId: card.id, categoryId: 'food', note: '저녁 외식' });
    if (r() < 0.05) add({ type: 'expense', amount: 15_000 + Math.round(r() * 20) * 1000, date: k, accountId: card.id, categoryId: 'fun', note: '영화' });
  }
  // 할부 구매, 평소와 다른 지출, 중복 결제
  add({ type: 'expense', amount: 480_000, date: addDays(today, -70), accountId: card.id, categoryId: 'shopping', note: 'TV' }, 10);
  add({ type: 'expense', amount: 320_000, date: addDays(today, -4), accountId: card.id, categoryId: 'food', note: '가족 모임 식사' });
  add({ type: 'expense', amount: 5500, date: addDays(today, -2), accountId: card.id, categoryId: 'cafe', note: '커피' });
  add({ type: 'expense', amount: 5500, date: addDays(today, -2), accountId: card.id, categoryId: 'cafe', note: '커피' });
  add({ type: 'income', amount: 150_000, date: addDays(today, -40), accountId: bank.id, categoryId: 'side', note: '중고 판매' });

  // 지난 카드 청구서는 결제일에 통장에서 납부
  d.transactions = txs;
  for (const b of cardBills(card, txs, today)) {
    if (b.dueDate < today && b.dueDate >= start) {
      txs.push({ id: uid(), type: 'transfer', amount: b.amount, date: b.dueDate, accountId: bank.id, toAccountId: card.id, categoryId: null, note: '카드 대금', cardPayment: true, createdAt: ts++ });
    }
  }
  const contributed = txs.filter((t) => t.toAccountId === invest.id).reduce((s, t) => s + t.amount, 0);
  invest.invest = { currentValue: Math.round(contributed * 1.035), valuedAt: today };

  d.transactions = txs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  d.budgets = [{ categoryId: 'food', amount: 450_000 }, { categoryId: 'cafe', amount: 80_000 }, { categoryId: 'shopping', amount: 150_000 }, { categoryId: 'transport', amount: 100_000 }];
  d.goals = [
    { id: uid(), name: '제주도 여행', target: 1_500_000, saved: 450_000, deadline: dayInMonth(addMonthsYM(monthOf(today), 5), 1), color: INK.sky, createdAt: Date.now() },
    { id: uid(), name: '비상금', target: 5_000_000, saved: 1_200_000, deadline: null, color: INK.mint, createdAt: Date.now() },
  ];
  d.recurring = [{ id: uid(), name: '월세', type: 'expense', amount: 600_000, categoryId: 'housing', accountId: bank.id, day: 1, remind: false, active: true }];
  const first = dayInMonth(addMonthsYM(monthOf(today), -5), 20);
  d.debts = [{ id: uid(), name: '학자금 대출', kind: 'loan', principal: 5_000_000, installment: 230_000, count: 24, firstDue: first, paid: [1, 2, 3, 4], remind: false, createdAt: Date.now() }];
  d.settings.onboarded = true;
  return d;
}
