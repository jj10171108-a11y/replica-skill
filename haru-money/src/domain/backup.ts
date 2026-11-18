/**
 * 백업 파일: 일반 JSON 또는 비밀번호로 잠근 JSON (scrypt 로 키를 만들고 AES-256-GCM 으로 암호화).
 * 순수 자바스크립트 구현(@noble)이라 Expo Go 에서도 동작한다.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { normalize } from './normalize';
import type { AppData, Transaction, Category, Account } from './types';

const ENC_FORMAT = 'haru-money-encrypted';
const PLAIN_FORMAT = 'haru-money-backup';
const SCRYPT = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 };

const enc = new TextEncoder();
const dec = new TextDecoder();

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
  }
  return out;
}
export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : 0));
    const v = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    out.push((v >> 16) & 255);
    if (i + 2 < clean.length) out.push((v >> 8) & 255);
    if (i + 3 < clean.length) out.push(v & 255);
  }
  return new Uint8Array(out);
}

export function makeBackup(data: AppData, password: string | null, randomBytes: (n: number) => Uint8Array): string {
  const payload = JSON.stringify({ format: PLAIN_FORMAT, exportedAt: new Date().toISOString(), data });
  if (!password) return payload;
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = scrypt(enc.encode(password), salt, SCRYPT);
  const ct = gcm(key, nonce).encrypt(enc.encode(payload));
  return JSON.stringify({ format: ENC_FORMAT, v: 1, kdf: { name: 'scrypt', ...SCRYPT, salt: toB64(salt) }, cipher: 'aes-256-gcm', nonce: toB64(nonce), data: toB64(ct) });
}

export const isEncrypted = (text: string) => {
  try { return JSON.parse(text)?.format === ENC_FORMAT; } catch { return false; }
};

/** 백업 파일 → 데이터. 잘못된 비밀번호/형식이면 예외 */
export function readBackup(text: string, password: string | null): AppData {
  let obj: any;
  try { obj = JSON.parse(text); } catch { throw new Error('백업 파일 형식이 아니에요'); }
  if (obj?.format === ENC_FORMAT) {
    if (!password) throw new Error('비밀번호가 필요한 백업이에요');
    const k = obj.kdf;
    const key = scrypt(enc.encode(password), fromB64(k.salt), { N: k.N, r: k.r, p: k.p, dkLen: k.dkLen });
    let plain: Uint8Array;
    try { plain = gcm(key, fromB64(obj.nonce)).decrypt(fromB64(obj.data)); } catch { throw new Error('비밀번호가 맞지 않아요'); }
    obj = JSON.parse(dec.decode(plain));
  }
  const data = obj?.format === PLAIN_FORMAT ? obj.data : obj;
  return normalize(data);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 엑셀에서 바로 열리는 CSV (UTF-8 BOM) */
export function toCsv(txs: Transaction[], accounts: Account[], categories: Category[]): string {
  const acc = (id?: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  const cat = (id?: string | null) => categories.find((c) => c.id === id)?.name ?? '';
  const type = { expense: '지출', income: '수입', transfer: '이체' } as const;
  const head = ['날짜', '구분', '금액', '카테고리', '계좌', '받는 계좌', '메모', '할부'];
  const rows = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t) => [
    t.date, type[t.type], t.type === 'expense' ? -t.amount : t.amount, cat(t.categoryId), acc(t.accountId), acc(t.toAccountId), t.note,
    t.installment ? `${t.installment.index}/${t.installment.count}` : '',
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}
