import { addMonthsYM, dayInMonth, fromKey, monthOf, todayKey } from './date';
import type { Debt } from './types';

export interface DebtDue { n: number; date: string; paid: boolean; late: boolean }

export function schedule(d: Debt, today = todayKey()): DebtDue[] {
  const day = fromKey(d.firstDue).getDate();
  const base = monthOf(d.firstDue);
  const paid = new Set(d.paid);
  return Array.from({ length: d.count }, (_, i) => {
    const date = dayInMonth(addMonthsYM(base, i), day);
    const isPaid = paid.has(i + 1);
    return { n: i + 1, date, paid: isPaid, late: !isPaid && date < today };
  });
}

/** 원금과 매달 상환액, 회차로 숨은 월 이자율 계산 (이자 없으면 0) */
export function impliedMonthlyRate(principal: number, installment: number, count: number): number {
  if (principal <= 0 || installment * count <= principal * 1.0001) return 0;
  const pv = (r: number) => installment * (1 - Math.pow(1 + r, -count)) / r;
  let lo = 1e-9, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > principal) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function debtSummary(d: Debt, today = todayKey()) {
  const sch = schedule(d, today);
  const remaining = sch.filter((x) => !x.paid);
  const late = sch.filter((x) => x.late);
  const r = impliedMonthlyRate(d.principal, d.installment, d.count);
  const totalCost = d.installment * d.count;
  const lastUnpaid = remaining[remaining.length - 1];
  // 남은 원금 = 남은 회차들의 현재가치
  const remainingPrincipal = r > 0 ? d.installment * (1 - Math.pow(1 + r, -remaining.length)) / r : d.installment * remaining.length;
  return {
    schedule: sch,
    paidCount: d.count - remaining.length,
    remainingCount: remaining.length,
    remainingAmount: remaining.length * d.installment,
    remainingPrincipal,
    lateCount: late.length,
    lateAmount: late.length * d.installment,
    next: remaining.find((x) => x.date >= today) ?? remaining[0] ?? null,
    freeDate: lastUnpaid?.date ?? null,
    monthlyRate: r,
    annualRate: r > 0 ? Math.pow(1 + r, 12) - 1 : 0,
    totalInterest: Math.max(0, totalCost - d.principal),
    progress: d.count ? (d.count - remaining.length) / d.count : 1,
  };
}

/**
 * 상환 계획: 이자율 높은 빚부터 (애벌랜치). 매달 extra 를 더 내면 몇 달·이자를 아끼는지.
 */
export function payoffPlan(debts: Debt[], extra: number, today = todayKey()) {
  const items = debts
    .map((d) => ({ d, s: debtSummary(d, today) }))
    .filter((x) => x.s.remainingCount > 0)
    .map((x) => ({ id: x.d.id, name: x.d.name, rate: x.s.monthlyRate, balance: x.s.remainingPrincipal, pay: x.d.installment, months: x.s.remainingCount }))
    .sort((a, b) => b.rate - a.rate);
  const order = items.map((i) => ({ id: i.id, name: i.name, annualRate: i.rate > 0 ? Math.pow(1 + i.rate, 12) - 1 : 0 }));

  const simulate = (extraPay: number) => {
    const bal = items.map((i) => i.balance);
    let month = 0, interest = 0;
    while (bal.some((b) => b > 1) && month < 600) {
      month++;
      let pool = extraPay;
      items.forEach((it, k) => {
        if (bal[k] <= 1) { pool += it.pay; return; }
        const int = bal[k] * it.rate;
        interest += int;
        bal[k] = bal[k] + int - it.pay;
        if (bal[k] < 0) { pool += -bal[k]; bal[k] = 0; }
      });
      for (let k = 0; k < items.length && pool > 0; k++) {
        if (bal[k] <= 1) continue;
        const used = Math.min(pool, bal[k]);
        bal[k] -= used; pool -= used;
      }
    }
    return { months: month, interest };
  };
  const base = simulate(0);
  const fast = simulate(extra);
  return { order, base, fast, monthsSaved: base.months - fast.months, interestSaved: Math.max(0, base.interest - fast.interest) };
}
