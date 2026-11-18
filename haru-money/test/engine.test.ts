import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billMonthFor, cardStatus, expandPurchase, splitInstallments, totals, balanceOf } from '../src/domain/ledger';
import { forecastMonth, detectRecurring, projection, findAlerts, healthScore, xirr, investReturn, moneyFlow } from '../src/domain/engine';
import { debtSummary, impliedMonthlyRate, payoffPlan } from '../src/domain/debts';
import { sampleData } from '../src/domain/sample';
import { freshData } from '../src/domain/defaults';
import { parseCsv, parseOfx, buildCandidates, parseDate } from '../src/domain/importer';

let n = 0; const uid = () => 'u' + n++;
const T = '2026-11-18';

test('bill month', () => {
  assert.equal(billMonthFor('2026-11-20', 31, 14), '2026-12');   // 말일 마감, 다음 달 14일 결제
  assert.equal(billMonthFor('2026-11-30', 31, 14), '2026-12');
  assert.equal(billMonthFor('2026-11-10', 15, 25), '2026-11');   // 15일 마감, 같은 달 25일 결제
  assert.equal(billMonthFor('2026-11-16', 15, 25), '2026-12');
  assert.equal(billMonthFor('2026-11-16', 15, 5), '2027-01');    // 15일 마감 → 다음 달 5일
});

test('installments split and bills', () => {
  assert.deepEqual(splitInstallments(100000, 3), [33334, 33333, 33333]);
  const d = freshData(uid); const card = d.accounts[2];
  const txs = expandPurchase({ id: 'x', type: 'expense', amount: 480000, date: '2026-11-18', accountId: card.id, categoryId: 'shopping', note: 'TV', createdAt: 1 }, card, 10, uid);
  assert.equal(txs.length, 10);
  assert.equal(txs[0].billMonth, '2026-12');
  assert.equal(txs[9].billMonth, '2027-09');
  assert.equal(txs[3].date, '2027-02-18');
  assert.equal(txs.reduce((s, t) => s + t.amount, 0), 480000);
  const st = cardStatus(card, txs, T);
  assert.equal(st.outstanding, 480000);
  assert.equal(st.available, 3000000 - 480000);
  assert.equal(st.bills.length, 10);
  assert.equal(st.bills[0].amount, 48000);
  assert.equal(st.bills[0].status, 'open');
});

test('sample data sanity', () => {
  const d = sampleData(uid, T);
  const t = totals(d, T);
  assert.ok(t.liquid > 0, 'liquid ' + t.liquid);
  const card = d.accounts.find((a) => a.kind === 'card')!;
  const st = cardStatus(card, d.transactions, T);
  assert.ok(!st.bills.some((b) => b.status === 'late'), 'no late bills');
  assert.ok(balanceOf(card, d.transactions, T) < 0);
});

test('forecast', () => {
  const d = sampleData(uid, T);
  const f = forecastMonth(d, T);
  assert.equal(f.sims, 2000);
  assert.equal(f.daysLeft, 12);
  assert.ok(f.balance.p10 <= f.balance.p50 && f.balance.p50 <= f.balance.p90);
  assert.ok(f.spend.p50 > f.spend.soFar);
  assert.ok(f.knownIncome >= 3_200_000, 'salary on 25th still to come: ' + f.knownIncome);
  assert.ok(f.probNegative >= 0 && f.probNegative <= 1);
  // 같은 seed → 같은 결과
  assert.deepEqual(forecastMonth(d, T).balance, f.balance);
});

test('recurring detection', () => {
  const d = sampleData(uid, T);
  const rec = detectRecurring(d, T);
  const names = rec.map((r) => `${r.name}:${r.kind}`);
  assert.ok(names.includes('월급:salary'), names.join(','));
  assert.ok(names.includes('넷플릭스:subscription'), names.join(','));
  assert.ok(names.includes('월세:rent'), names.join(','));
  assert.ok(!rec.some((r) => r.name === '커피'), 'coffee is not recurring');
  assert.ok(!rec.some((r) => r.name === '점심'), 'lunch is not recurring');
});

test('projection, alerts, health', () => {
  const d = sampleData(uid, T);
  const p = projection(d, T);
  assert.equal(p.points.length, 13);
  const alerts = findAlerts(d, T);
  assert.ok(alerts.some((a) => a.kind === 'duplicate' && a.tx.note === '커피'), 'duplicate coffee');
  assert.ok(alerts.some((a) => a.kind === 'unusual' && a.tx.note === '가족 모임 식사'), 'unusual dinner: ' + alerts.map((a) => a.kind + a.tx.note).join(','));
  const h = healthScore(d, T);
  assert.ok(h.score > 0 && h.score <= 100);
  assert.equal(h.parts.length, 4);
  const flow = moneyFlow(d, '2026-10');
  assert.ok(flow.sources.length > 0 && flow.sinks.length > 0);
});

test('debts', () => {
  const r = impliedMonthlyRate(5_000_000, 230_000, 24);
  assert.ok(Math.abs(r * 12 - 0.0965) < 0.01, 'annual ~9.6% got ' + r * 12);
  assert.equal(impliedMonthlyRate(1_200_000, 100_000, 12), 0);
  const d = sampleData(uid, T);
  const s = debtSummary(d.debts[0], T);
  assert.equal(s.paidCount, 4);
  assert.equal(s.lateCount, 1); // 5회차(10/20)가 연체
  assert.equal(s.remainingCount, 20);
  const plan = payoffPlan(d.debts, 100_000, T);
  assert.ok(plan.monthsSaved > 0 && plan.interestSaved > 0);
});

test('xirr', () => {
  const r = xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }]);
  assert.ok(r !== null && Math.abs(r - 0.1) < 0.002, String(r));
  const d = sampleData(uid, T);
  const inv = investReturn(d, d.accounts[3].id, T)!;
  assert.ok(inv.annual !== null && inv.annual > 0, String(inv.annual));
});

test('csv import korean bank', () => {
  const csv = '국민은행 거래내역\n거래일시,적요,출금액,입금액,잔액\n2026.11.01 09:12,월세,"600,000",0,"1,200,000"\n2026.11.02,스타벅스,"4,500",,1195500\n2026.11.03,급여,,"3,200,000",4395500\n2026.11.14,신용카드 대금,"820,000",,3575500\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { date: '2026-11-01', amount: -600000, description: '월세' });
  assert.equal(rows[2].amount, 3200000);
  const d = freshData(uid);
  d.transactions.push({ id: 'e', type: 'expense', amount: 4500, date: '2026-11-02', accountId: d.accounts[0].id, categoryId: 'cafe', note: '커피', createdAt: 1 });
  const c = buildCandidates(rows, d.accounts[0].id, d.transactions, d.accounts, d.categories);
  assert.equal(c[0].categoryId, 'housing');
  assert.equal(c[1].duplicate, true);
  assert.equal(c[1].checked, false);
  assert.equal(c[2].type, 'income');
  assert.equal(c[2].categoryId, 'salary');
  assert.equal(c[3].type, 'transfer');
  assert.equal(c[3].cardPaymentToId, d.accounts[2].id);
});

test('csv single amount column + ofx', () => {
  const rows = parseCsv('Date;Description;Amount\n11/05/2026;Coffee shop;-4,50\n2026-11-06;Refund;12.00\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-11-05');
  const ofx = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000<TRNAMT>-12000<NAME>GS25<MEMO>편의점</STMTTRN><STMTTRN><DTPOSTED>20261106<TRNAMT>50000.00<NAME>환급</STMTTRN></BANKTRANLIST></OFX>';
  const o = parseOfx(ofx);
  assert.equal(o.length, 2);
  assert.deepEqual(o[0], { date: '2026-11-05', amount: -12000, description: 'GS25 편의점' });
  assert.equal(parseDate('20261105'), '2026-11-05');
});
