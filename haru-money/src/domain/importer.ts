/**
 * 은행·카드 내역 파일 읽기: CSV(쉼표·세미콜론·탭), OFX/QFX.
 * 읽은 줄은 바로 저장하지 않고, 확인 화면에서 고른 것만 들어간다.
 */
import { diffDays } from './date';
import { parseAmount } from './money';
import { guessCategory } from './phrase';
import type { Account, Category, Transaction } from './types';

export interface StatementRow { date: string; amount: number; description: string }

export interface ImportCandidate {
  key: string;
  row: StatementRow;
  type: 'expense' | 'income' | 'transfer';
  categoryId: string | null;
  checked: boolean;
  duplicate: boolean;
  cardPaymentToId: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/["']/g, '');
  let m = s.match(/^(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) return valid(+m[3], +m[1], +m[2]); // MM/DD/YYYY
  m = s.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return valid(2000 + +m[1], +m[2], +m[3]); // YY.MM.DD
  return null;
}
const valid = (y: number, mo: number, d: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100 ? `${y}-${pad(mo)}-${pad(d)}` : null);

function money(raw: string): number | null {
  let s = raw.trim().replace(/["']/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-') || s.startsWith('−')) { neg = true; s = s.slice(1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  // 1.234,56 (유럽식) → 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  const v = parseAmount(s);
  return v === null ? null : neg ? -v : v;
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

const H = {
  date: /^(거래)?(일자|날짜|일시)$|거래일|승인일|이용일|^date|posted/i,
  desc: /내용|적요|가맹점|이용처|거래처|메모|기재|description|memo|payee|name|merchant/i,
  amount: /^(거래)?금액$|이용금액|승인금액|^amount|^value/i,
  out: /출금|지출|찾으신|withdraw|debit|paid out/i,
  in: /입금|수입|맡기신|deposit|credit|paid in/i,
};

export function parseCsv(text: string): StatementRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = [',', ';', '\t'].map((d) => ({ d, n: lines.slice(0, 5).reduce((s, l) => s + splitCsvLine(l, d).length, 0) })).sort((a, b) => b.n - a.n)[0].d;
  // 머리글 줄 찾기 (앞의 은행 안내 문구는 건너뜀)
  let hi = -1, cols = { date: -1, desc: -1, amount: -1, out: -1, in: -1 };
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCsvLine(lines[i], delim);
    const c = { date: -1, desc: -1, amount: -1, out: -1, in: -1 };
    cells.forEach((cell, j) => {
      const v = cell.replace(/["\s]/g, '');
      if (c.date < 0 && H.date.test(v)) c.date = j;
      else if (c.out < 0 && H.out.test(v)) c.out = j;
      else if (c.in < 0 && H.in.test(v)) c.in = j;
      else if (c.amount < 0 && H.amount.test(v)) c.amount = j;
      else if (c.desc < 0 && H.desc.test(v)) c.desc = j;
    });
    if (c.date >= 0 && (c.amount >= 0 || c.out >= 0 || c.in >= 0)) { hi = i; cols = c; break; }
  }
  const rows: StatementRow[] = [];
  const body = hi >= 0 ? lines.slice(hi + 1) : lines;
  for (const line of body) {
    const cells = splitCsvLine(line, delim);
    let date: string | null, amount: number | null = null, description: string;
    if (hi >= 0) {
      date = parseDate(cells[cols.date] ?? '');
      if (cols.amount >= 0) amount = money(cells[cols.amount] ?? '');
      else {
        const o = money(cells[cols.out] ?? '') ?? 0;
        const n = money(cells[cols.in] ?? '') ?? 0;
        amount = n - Math.abs(o);
        if (!o && !n) amount = null;
      }
      description = cols.desc >= 0 ? cells[cols.desc] ?? '' : cells.filter((_, j) => ![cols.date, cols.amount, cols.out, cols.in].includes(j)).find((x) => x && money(x) === null) ?? '';
    } else {
      // 머리글 없음: 날짜처럼 보이는 칸, 금액처럼 보이는 마지막 칸, 나머지 글자
      const di = cells.findIndex((x) => parseDate(x));
      date = di >= 0 ? parseDate(cells[di]) : null;
      const ai = [...cells.keys()].reverse().find((j) => j !== di && money(cells[j]) !== null);
      amount = ai !== undefined ? money(cells[ai]) : null;
      description = cells.find((x, j) => j !== di && j !== ai && x && money(x) === null) ?? '';
    }
    if (date && amount) rows.push({ date, amount, description: description.trim() });
  }
  return rows;
}

export function parseOfx(text: string): StatementRow[] {
  const rows: StatementRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  for (const b of blocks) {
    const date = parseDate(tag(b, 'DTPOSTED').slice(0, 8));
    const amount = parseFloat(tag(b, 'TRNAMT').replace(',', '.'));
    const description = [tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean).join(' ').trim();
    if (date && Number.isFinite(amount) && amount !== 0) rows.push({ date, amount, description });
  }
  return rows;
}

export function parseStatement(text: string, fileName = ''): StatementRow[] {
  if (/\.(ofx|qfx)$/i.test(fileName) || /<OFX>|<STMTTRN>/i.test(text)) return parseOfx(text);
  return parseCsv(text);
}

const CARD_PAYMENT = /카드\s*(대금|결제|값)|신용카드|card\s*payment|결제대금/i;

/** 확인 화면용 후보 만들기: 카테고리 제안, 이미 있는 거래는 체크 해제, 카드 대금 인식 */
export function buildCandidates(rows: StatementRow[], accountId: string, existing: Transaction[], accounts: Account[], categories: Category[]): ImportCandidate[] {
  const account = accounts.find((a) => a.id === accountId);
  const cardIds = accounts.filter((a) => a.kind === 'card' && !a.archived);
  return rows.map((row, i) => {
    const isIn = row.amount > 0;
    // 카드 명세서는 보통 사용액이 양수 → 카드 계좌로 가져오면 부호 반대로 해석
    const expenseOnCard = account?.kind === 'card' && row.amount > 0 && !/환불|취소|refund/i.test(row.description);
    let type: ImportCandidate['type'] = expenseOnCard ? 'expense' : isIn ? 'income' : 'expense';
    let cardPaymentToId: string | null = null;
    if (account?.kind !== 'card' && !isIn && CARD_PAYMENT.test(row.description) && cardIds.length) {
      type = 'transfer';
      cardPaymentToId = (cardIds.find((c) => row.description.includes(c.name)) ?? cardIds[0]).id;
    }
    const amt = Math.abs(row.amount);
    const duplicate = existing.some((t) => t.accountId === accountId && Math.abs(diffDays(t.date, row.date)) <= 1 && Math.abs(t.amount - amt) < 0.5);
    const cat = type === 'transfer' ? null : guessCategory(row.description, categories, type);
    return {
      key: `${i}`,
      row: { ...row, amount: amt },
      type,
      categoryId: cat?.id ?? (type === 'expense' ? 'etc' : type === 'income' ? 'income_etc' : null),
      checked: !duplicate,
      duplicate,
      cardPaymentToId,
    };
  });
}
