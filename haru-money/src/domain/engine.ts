/**
 * 재정 엔진: 월말 예측(몬테카를로), 고정 수입·지출 자동 찾기, 12개월 잔액 전망,
 * 이상 지출·중복 결제, 재정 건강 점수, 투자 연 수익률. 전부 기기 안에서 계산.
 */
import { addDays, addMonthsYM, daysInMonth, diffDays, fromKey, monthOf, todayKey } from './date';
import { cardDueUntil, isLiquid, monthSummary, totals } from './ledger';
import { debtSummary } from './debts';
import type { AppData, Transaction } from './types';

// 재현 가능한 난수
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);

const normKey = (s: string) => s.toLowerCase().replace(/[0-9\s\-_.()/#*]+/g, '').slice(0, 20);

// ───────── 고정 수입·지출 찾기 ─────────

export interface DetectedRecurring {
  key: string;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  day: number;
  categoryId: string | null;
  accountId: string;
  kind: 'salary' | 'rent' | 'subscription' | 'bill' | 'income';
  months: number;
  lastDate: string;
}

export function detectRecurring(data: AppData, today = todayKey()): DetectedRecurring[] {
  const since = addDays(today, -200);
  const groups = new Map<string, Transaction[]>();
  for (const t of data.transactions) {
    if (t.type === 'transfer' || t.installment || t.date < since || t.date > today) continue;
    const label = normKey(t.note) || `cat:${t.categoryId}`;
    const key = `${t.type}|${label}|${label.startsWith('cat:') ? Math.round(t.amount / 1000) : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const out: DetectedRecurring[] = [];
  for (const [key, list] of groups) {
    const months = new Set(list.map((t) => monthOf(t.date)));
    if (months.size < 3) continue;
    // 한 달에 여러 번이면 고정 지출이 아님 (예: 커피)
    if (list.length > months.size * 1.5) continue;
    const amounts = list.map((t) => t.amount);
    const med = median(amounts);
    if (amounts.some((a) => Math.abs(a - med) > med * 0.2)) continue;
    const days = list.map((t) => fromKey(t.date).getDate());
    const dMed = median(days);
    if (days.some((d) => Math.abs(d - dMed) > 5)) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    if (diffDays(today, last.date) > 45) continue; // 끊긴 것
    const type = last.type as 'expense' | 'income';
    const cat = data.categories.find((c) => c.id === last.categoryId);
    let kind: DetectedRecurring['kind'] = type === 'income' ? 'income' : 'bill';
    if (type === 'income' && (cat?.id === 'salary' || med >= 1_000_000)) kind = 'salary';
    else if (/월세|rent/i.test(last.note)) kind = 'rent';
    else if (type === 'expense' && (cat?.id === 'subs' || med <= 30000)) kind = 'subscription';
    out.push({
      key, name: last.note || cat?.name || '고정 항목', type, amount: Math.round(med), day: Math.round(dMed),
      categoryId: last.categoryId, accountId: last.accountId, kind, months: months.size, lastDate: last.date,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** 사용자가 등록한 고정 항목 + 자동으로 찾은 것 (이름이 겹치면 등록한 것 우선) */
export function allRecurring(data: AppData, today = todayKey()) {
  const manual = data.recurring.filter((r) => r.active).map((r) => ({ name: r.name, type: r.type, amount: r.amount, day: r.day, accountId: r.accountId, categoryId: r.categoryId, manualId: r.id as string | null }));
  const names = new Set(manual.map((m) => normKey(m.name)));
  const auto = detectRecurring(data, today)
    .filter((d) => !names.has(normKey(d.name)))
    .map((d) => ({ name: d.name, type: d.type, amount: d.amount, day: d.day, accountId: d.accountId, categoryId: d.categoryId, manualId: null as string | null }));
  return [...manual, ...auto];
}

/** 이번 달에 이미 기록됐는지 (같은 이름·비슷한 금액) */
function recordedThisMonth(data: AppData, r: { name: string; amount: number; type: string; manualId: string | null }, ym: string) {
  return data.transactions.some((t) => monthOf(t.date) === ym && t.type === r.type &&
    ((r.manualId && t.recurringId === r.manualId) || (normKey(t.note) === normKey(r.name) && Math.abs(t.amount - r.amount) <= r.amount * 0.2)));
}

// ───────── 월말 예측 ─────────

export interface Forecast {
  sims: number;
  daysLeft: number;
  /** 월말 통장+현금 잔액 분포 */
  balance: { p10: number; p50: number; p90: number };
  probNegative: number;
  /** 이번 달 총 지출 예상 */
  spend: { soFar: number; p10: number; p50: number; p90: number };
  knownIncome: number;
  knownExpense: number;
  cardDue: number;
  historyDays: number;
}

/** 지난 기간 하루 변동 지출(고정·할부 회차 제외) 표본 */
function dailyVariableSpend(data: AppData, today: string, days = 90) {
  const fixedNames = new Set(allRecurring(data, today).map((r) => normKey(r.name)));
  const byDay = new Map<string, { all: number; liquid: number }>();
  const liquidIds = new Set(data.accounts.filter(isLiquid).map((a) => a.id));
  let first = today;
  for (const t of data.transactions) {
    if (t.type !== 'expense' || t.date >= today || t.date < addDays(today, -days)) continue;
    if (t.recurringId || fixedNames.has(normKey(t.note)) || (t.installment && t.installment.index > 1)) continue;
    const v = byDay.get(t.date) ?? { all: 0, liquid: 0 };
    v.all += t.amount;
    if (liquidIds.has(t.accountId)) v.liquid += t.amount;
    byDay.set(t.date, v);
    if (t.date < first) first = t.date;
  }
  const span = Math.max(1, Math.min(days, diffDays(today, first)));
  const samples: { all: number; liquid: number }[] = [];
  for (let i = 1; i <= span; i++) samples.push(byDay.get(addDays(today, -i)) ?? { all: 0, liquid: 0 });
  return samples;
}

export function forecastMonth(data: AppData, today = todayKey(), sims = 2000, seed = 42): Forecast {
  const ym = monthOf(today);
  const dim = daysInMonth(ym);
  const dayNow = fromKey(today).getDate();
  const daysLeft = dim - dayNow; // 오늘 이후 남은 날
  const t = totals(data, today);
  const soFar = monthSummary(data.transactions.filter((x) => x.date <= today), ym).expense;

  // 남은 고정 항목 (아직 기록 안 된 것)
  let knownIncome = 0, knownExpense = 0, knownExpenseLiquid = 0;
  for (const r of allRecurring(data, today)) {
    if (r.day <= dayNow || recordedThisMonth(data, r, ym)) continue;
    const acc = data.accounts.find((a) => a.id === r.accountId);
    if (r.type === 'income') knownIncome += r.amount;
    else { knownExpense += r.amount; if (!acc || isLiquid(acc)) knownExpenseLiquid += r.amount; }
  }
  // 남은 빚 상환
  for (const d of data.debts) {
    for (const due of debtSummary(d, today).schedule) {
      if (!due.paid && due.date > today && monthOf(due.date) === ym) { knownExpense += d.installment; knownExpenseLiquid += d.installment; }
    }
  }
  const cardDue = cardDueUntil(data, `${ym}-${String(dim).padStart(2, '0')}`, addDays(today, 1));

  const samples = dailyVariableSpend(data, today);
  const r = rng(seed);
  const ends: number[] = [];
  const spends: number[] = [];
  for (let s = 0; s < sims; s++) {
    let all = 0, liquid = 0;
    for (let d = 0; d < daysLeft; d++) {
      const pick = samples.length ? samples[Math.floor(r() * samples.length)] : { all: 0, liquid: 0 };
      all += pick.all; liquid += pick.liquid;
    }
    ends.push(t.liquid + knownIncome - knownExpenseLiquid - cardDue - liquid);
    spends.push(soFar + knownExpense + all);
  }
  ends.sort((a, b) => a - b);
  spends.sort((a, b) => a - b);
  return {
    sims,
    daysLeft,
    balance: { p10: quantile(ends, 0.1), p50: quantile(ends, 0.5), p90: quantile(ends, 0.9) },
    probNegative: ends.filter((x) => x < 0).length / sims,
    spend: { soFar, p10: quantile(spends, 0.1), p50: quantile(spends, 0.5), p90: quantile(spends, 0.9) },
    knownIncome, knownExpense, cardDue,
    historyDays: samples.length,
  };
}

// ───────── 12개월 전망 ─────────

export function projection(data: AppData, today = todayKey(), months = 12) {
  const ym = monthOf(today);
  const rec = allRecurring(data, today);
  const recIncome = rec.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const recExpense = rec.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  // 최근 3개월 변동 지출 평균 (전체 지출 − 고정 지출)
  const past = [1, 2, 3].map((i) => monthSummary(data.transactions, addMonthsYM(ym, -i)));
  const withData = past.filter((m) => m.expense > 0 || m.income > 0);
  const avgExpense = withData.length ? withData.reduce((s, m) => s + m.expense, 0) / withData.length : 0;
  const avgIncome = withData.length ? withData.reduce((s, m) => s + m.income, 0) / withData.length : 0;
  const variable = Math.max(0, avgExpense - recExpense);
  const otherIncome = Math.max(0, avgIncome - recIncome);
  const debtByMonth = (m: string) => data.debts.reduce((s, d) => s + debtSummary(d, today).schedule.filter((x) => !x.paid && monthOf(x.date) === m).length * d.installment, 0);

  let bal = forecastMonth(data, today, 400).balance.p50;
  const out = [{ ym, balance: bal }];
  for (let i = 1; i <= months; i++) {
    const m = addMonthsYM(ym, i);
    bal += recIncome + otherIncome - recExpense - variable - debtByMonth(m);
    out.push({ ym: m, balance: bal });
  }
  return { points: out, monthlyNet: recIncome + otherIncome - recExpense - variable, recIncome, recExpense, variable };
}

// ───────── 이상 지출·중복 결제 ─────────

export interface Alert { kind: 'unusual' | 'duplicate'; tx: Transaction; other?: Transaction; typical?: number }

export function findAlerts(data: AppData, today = todayKey(), lookback = 45): Alert[] {
  const since = addDays(today, -lookback);
  const alerts: Alert[] = [];
  const byCat = new Map<string, Transaction[]>();
  for (const t of data.transactions) {
    if (t.type !== 'expense' || (t.installment && t.installment.index > 1)) continue;
    const k = t.categoryId ?? 'etc';
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(t);
  }
  for (const list of byCat.values()) {
    for (const t of list) {
      if (t.date < since || t.date > today) continue;
      // 같은 이름 기록이 충분하면 그것끼리, 아니면 카테고리 전체와 비교
      const sameName = list.filter((x) => x.id !== t.id && x.date < t.date && normKey(x.note) && normKey(x.note) === normKey(t.note));
      const pool = sameName.length >= 5 ? sameName : list.filter((x) => x.id !== t.id && x.date < t.date);
      const history = pool.map((x) => (x.installment ? x.installment.total : x.amount));
      if (history.length < 5) continue;
      const med = median(history);
      const mad = median(history.map((h) => Math.abs(h - med))) || med * 0.25;
      const amt = t.installment ? t.installment.total : t.amount;
      if (amt >= 20000 && amt > med * 3 && amt > med + 6 * mad) alerts.push({ kind: 'unusual', tx: t, typical: med });
    }
  }
  const recent = data.transactions.filter((t) => t.type === 'expense' && !t.installment && t.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i], b = recent[j];
      if (b.date !== a.date) break;
      if (a.amount === b.amount && a.accountId === b.accountId && normKey(a.note) === normKey(b.note) && a.amount >= 3000) {
        alerts.push({ kind: 'duplicate', tx: b, other: a });
      }
    }
  }
  return alerts.sort((x, y) => y.tx.date.localeCompare(x.tx.date));
}

// ───────── 재정 건강 점수 ─────────

export interface Health {
  score: number;
  parts: { key: string; label: string; score: number; max: number; detail: string }[];
  tips: string[];
}

export function healthScore(data: AppData, today = todayKey()): Health {
  const ym = monthOf(today);
  const months = [1, 2, 3].map((i) => monthSummary(data.transactions, addMonthsYM(ym, -i))).filter((m) => m.income || m.expense);
  const inc = months.reduce((s, m) => s + m.income, 0) / Math.max(1, months.length);
  const exp = months.reduce((s, m) => s + m.expense, 0) / Math.max(1, months.length);
  const tips: string[] = [];
  const parts: Health['parts'] = [];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const rate = inc > 0 ? (inc - exp) / inc : 0;
  const s1 = Math.round(25 * clamp(rate / 0.2));
  parts.push({ key: 'save', label: '저축률', score: s1, max: 25, detail: inc > 0 ? `수입의 ${Math.round(rate * 100)}%를 남겼어요` : '수입 기록이 부족해요' });
  if (rate < 0.1) tips.push('수입의 10~20%를 먼저 떼어 저축 목표로 옮겨 보세요.');

  const liquid = totals(data, today).liquid;
  const cover = exp > 0 ? liquid / exp : 0;
  const s2 = Math.round(25 * clamp(cover / 6));
  parts.push({ key: 'fund', label: '비상금', score: s2, max: 25, detail: exp > 0 ? `생활비 ${cover.toFixed(1)}개월분이 있어요` : '지출 기록이 부족해요' });
  if (cover < 3) tips.push('생활비 3~6개월분의 비상금을 목표로 모아 보세요.');

  const debtMonthly = data.debts.reduce((s, d) => s + (debtSummary(d, today).remainingCount > 0 ? d.installment : 0), 0);
  const instMonthly = data.transactions.filter((t) => t.installment && monthOf(t.date) === ym).reduce((s, t) => s + t.amount, 0);
  const burden = inc > 0 ? (debtMonthly + instMonthly) / inc : debtMonthly + instMonthly > 0 ? 1 : 0;
  const s3 = Math.round(25 * clamp(1 - burden / 0.4));
  parts.push({ key: 'debt', label: '빚 부담', score: s3, max: 25, detail: `수입의 ${Math.round(burden * 100)}%가 빚·할부 상환에 쓰여요` });
  if (burden > 0.3) tips.push('빚과 할부 상환이 수입의 30%를 넘어요. 이자가 높은 빚부터 갚는 계획을 세워 보세요.');

  let s4: number;
  if (data.budgets.length === 0) {
    s4 = 12;
    parts.push({ key: 'budget', label: '예산 지키기', score: s4, max: 25, detail: '아직 예산이 없어요' });
    tips.push('자주 쓰는 카테고리에 월 예산을 정하면 지출을 관리하기 쉬워요.');
  } else {
    const cur = monthSummary(data.transactions, ym);
    const progress = fromKey(today).getDate() / daysInMonth(ym);
    const ok = data.budgets.filter((b) => (cur.byCategory[b.categoryId] ?? 0) <= b.amount * Math.max(progress, 0.25) * 1.1).length;
    s4 = Math.round(25 * (ok / data.budgets.length));
    parts.push({ key: 'budget', label: '예산 지키기', score: s4, max: 25, detail: `예산 ${data.budgets.length}개 중 ${ok}개가 순조로워요` });
    if (ok < data.budgets.length) tips.push('속도가 빠른 예산이 있어요. 계획 탭에서 확인해 보세요.');
  }
  if (!tips.length) tips.push('아주 잘하고 있어요! 남는 돈은 저축 목표나 투자로 보내 보세요.');
  return { score: parts.reduce((s, p) => s + p.score, 0), parts, tips };
}

// ───────── 투자 연 수익률 (XIRR) ─────────

/** flows: 투자자 입장 현금 흐름 (넣은 돈 −, 뺀 돈·현재 평가액 +) */
export function xirr(flows: { date: string; amount: number }[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = fromKey(flows[0].date).getTime();
  const years = flows.map((f) => (fromKey(f.date).getTime() - t0) / (365 * 86400000));
  if (Math.max(...years) < 1 / 365) return null;
  const npv = (r: number) => flows.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, years[i]), 0);
  let lo = -0.99, hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function investReturn(data: AppData, accountId: string, today = todayKey()) {
  const acc = data.accounts.find((a) => a.id === accountId);
  if (!acc) return null;
  const flows: { date: string; amount: number }[] = [];
  if (acc.initial) flows.push({ date: fromKeySafe(acc.createdAt), amount: -acc.initial });
  let contributed = acc.initial;
  for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.type === 'transfer' && t.toAccountId === acc.id) { flows.push({ date: t.date, amount: -t.amount }); contributed += t.amount; }
    else if (t.type === 'transfer' && t.accountId === acc.id) { flows.push({ date: t.date, amount: t.amount }); contributed -= t.amount; }
  }
  const value = acc.invest?.currentValue ?? contributed;
  flows.sort((a, b) => a.date.localeCompare(b.date));
  flows.push({ date: acc.invest?.valuedAt ?? today, amount: value });
  return { contributed, value, gain: value - contributed, simple: contributed > 0 ? (value - contributed) / contributed : null, annual: xirr(flows) };
}
const fromKeySafe = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ───────── 지출 캘린더 · 돈의 흐름 ─────────

export function dailyTotals(txs: Transaction[], ym: string) {
  const out: Record<string, number> = {};
  for (const t of txs) if (t.type === 'expense' && monthOf(t.date) === ym) out[t.date] = (out[t.date] ?? 0) + t.amount;
  return out;
}

export function weekdayPattern(txs: Transaction[], today = todayKey(), days = 90) {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (let i = 0; i < days; i++) counts[fromKey(addDays(today, -i)).getDay()]++;
  for (const t of txs) if (t.type === 'expense' && t.date <= today && t.date > addDays(today, -days)) sums[fromKey(t.date).getDay()] += t.amount;
  return sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
}

export function moneyFlow(data: AppData, ym: string) {
  const s = monthSummary(data.transactions, ym);
  const incomeBy: Record<string, number> = {};
  for (const t of data.transactions) if (t.type === 'income' && monthOf(t.date) === ym) incomeBy[t.categoryId ?? 'income_etc'] = (incomeBy[t.categoryId ?? 'income_etc'] ?? 0) + t.amount;
  const sources = Object.entries(incomeBy).map(([id, v]) => ({ id, value: v }));
  if (s.expense > s.income) sources.push({ id: '__savings_used', value: s.expense - s.income });
  const sinks = Object.entries(s.byCategory).map(([id, v]) => ({ id, value: v })).sort((a, b) => b.value - a.value);
  if (s.income > s.expense) sinks.push({ id: '__saved', value: s.income - s.expense });
  return { sources: sources.sort((a, b) => b.value - a.value), sinks, income: s.income, expense: s.expense };
}
