import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { makeBackup, readBackup, isEncrypted, toB64, fromB64, toCsv } from '../src/domain/backup';
import { sampleData } from '../src/domain/sample';

let n = 0; const uid = () => 'b' + n++;
const rb = (k: number) => new Uint8Array(randomBytes(k));

test('base64 roundtrip', () => {
  for (const len of [0, 1, 2, 3, 4, 31, 100]) {
    const b = rb(len);
    assert.deepEqual(fromB64(toB64(b)), b);
  }
  assert.equal(toB64(new TextEncoder().encode('hello')), Buffer.from('hello').toString('base64'));
});

test('plain backup roundtrip', () => {
  const d = sampleData(uid, '2026-11-18');
  const text = makeBackup(d, null, rb);
  assert.equal(isEncrypted(text), false);
  const back = readBackup(text, null);
  assert.equal(back.transactions.length, d.transactions.length);
  assert.equal(back.debts[0].paid.length, 4);
});

test('encrypted backup', () => {
  const d = sampleData(uid, '2026-11-18');
  const t0 = Date.now();
  const text = makeBackup(d, '비밀번호123', rb);
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(isEncrypted(text), true);
  assert.ok(!text.includes('월급'), 'no plaintext leaks');
  assert.equal(readBackup(text, '비밀번호123').transactions.length, d.transactions.length);
  assert.throws(() => readBackup(text, 'wrong'), /비밀번호가 맞지 않아요/);
  assert.throws(() => readBackup(text, null), /비밀번호가 필요한/);
  assert.throws(() => readBackup('{"x":1}', null), /데이터가 아니에요/);
});

test('csv export', () => {
  const d = sampleData(uid, '2026-11-18');
  const csv = toCsv(d.transactions, d.accounts, d.categories);
  assert.ok(csv.startsWith('﻿날짜,구분,금액'));
  assert.ok(csv.includes('월급'));
  assert.equal(csv.split('\n').length, d.transactions.length + 1);
});
