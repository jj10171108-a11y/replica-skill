import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, fmt } from '../src/domain/money';
import { parsePhrase } from '../src/domain/phrase';
import { freshData } from '../src/domain/defaults';

let n = 0;
const data = freshData(() => 'id' + n++);
const [bank, cash, card] = data.accounts;
const cats = data.categories;
const T = '2026-11-18';
const p = (s: string) => parsePhrase(s, data.accounts, cats, T);

test('parseAmount', () => {
  assert.equal(parseAmount('12000'), 12000);
  assert.equal(parseAmount('12,000원'), 12000);
  assert.equal(parseAmount('1.2만'), 12000);
  assert.equal(parseAmount('3만5천'), 35000);
  assert.equal(parseAmount('삼만오천원'), 35000);
  assert.equal(parseAmount('320만'), 3200000);
  assert.equal(parseAmount('1억2000만'), 120000000);
  assert.equal(parseAmount('12.5k'), 12500);
  assert.equal(parseAmount('천원'), 1000);
  assert.equal(parseAmount('점심'), null);
});

test('fmt', () => {
  assert.equal(fmt(1234567), '1,234,567원');
  assert.equal(fmt(-5000), '−5,000원');
  assert.equal(fmt(35000, { compact: true }), '3.5만원');
});

test('simple expense', () => {
  const r = p('점심 12000 체크카드');
  assert.equal(r.type, 'expense');
  assert.equal(r.amount, 12000);
  assert.equal(r.categoryId, 'food');
  assert.equal(r.accountId, bank.id);
  assert.equal(r.date, T);
  assert.equal(r.note, '점심');
});

test('yesterday taxi with cash', () => {
  const r = p('어제 택시 15000원 현금으로');
  assert.equal(r.date, '2026-11-17');
  assert.equal(r.categoryId, 'transport');
  assert.equal(r.accountId, cash.id);
  assert.equal(r.amount, 15000);
});

test('installment on credit card', () => {
  const r = p('TV 48만 10개월 할부 신용카드');
  assert.equal(r.amount, 480000);
  assert.equal(r.installments, 10);
  assert.equal(r.accountId, card.id);
  assert.equal(r.categoryId, 'shopping');
  assert.equal(r.note, 'TV');
});

test('installment defaults to card', () => {
  const r = p('노트북 150만 할부 12개월');
  assert.equal(r.installments, 12);
  assert.equal(r.accountId, card.id);
});

test('income', () => {
  const r = p('월급 320만 입금');
  assert.equal(r.type, 'income');
  assert.equal(r.amount, 3200000);
  assert.equal(r.categoryId, 'salary');
});

test('income by category only', () => {
  const r = p('용돈 5만');
  assert.equal(r.type, 'income');
  assert.equal(r.categoryId, 'side');
});

test('split amount words', () => {
  assert.equal(p('커피 4천 5백원').amount, 4500);
  assert.equal(p('장보기 3만 5천').amount, 35000);
});

test('dates', () => {
  assert.equal(p('11월 3일 영화 15000').date, '2026-11-03');
  assert.equal(p('11/3 영화 15000').date, '2026-11-03');
  assert.equal(p('3일전 약국 8000').date, '2026-11-15');
  assert.equal(p('5일 병원 20000').date, '2026-11-05');
  assert.equal(p('12월 30일 여행 30만').date, '2025-12-30');
});

test('transfer', () => {
  const r = p('주거래 통장에서 현금으로 5만 이체');
  assert.equal(r.type, 'transfer');
  assert.equal(r.amount, 50000);
});

test('no amount', () => {
  const r = p('점심');
  assert.equal(r.amount, null);
  assert.equal(r.categoryId, 'food');
});
