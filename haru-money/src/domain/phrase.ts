import { addDays, fromKey, toKey, todayKey } from './date';
import { parseAmount } from './money';
import type { Account, Category, TxType } from './types';

export interface ParsedEntry {
  type: TxType;
  amount: number | null;
  date: string;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  installments: number;
  note: string;
}

const INCOME_WORDS = ['월급', '급여', '입금', '받음', '받았', '받은', '수입', '환급', '이자수익', '배당', '용돈받', '용돈 받', '캐시백', '판매', '팔았'];
const TRANSFER_WORDS = ['이체', '송금', '옮김', '저축', '적금'];
const FILLER = /^(에서|으로|로|에|을|를|이|가|은|는|결제|결제함|샀음|샀어|샀다|구매|씀|썼음|썼어|사용|지출|원|하고|했음|함|함\.|좀)$/;
const PARTICLES = /(에서|으로|로|에|을|를|은|는|이랑|랑|하고)$/;

const ACCOUNT_ALIASES: Record<Account['kind'], string[]> = {
  card: ['신용카드', '카드', '신카', 'credit'],
  bank: ['체크카드', '체크', '통장', '계좌', '은행', 'debit'],
  cash: ['현금', 'cash'],
  invest: ['투자', '증권', '주식'],
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 카테고리 추측: 키워드/이름이 문장에 들어 있으면 점수. 긴 키워드 우선 */
export function guessCategory(text: string, categories: Category[], type: TxType | null = null): Category | null {
  const t = norm(text);
  let best: { c: Category; score: number } | null = null;
  for (const c of categories) {
    if (type && type !== 'transfer' && c.type !== type) continue;
    for (const k of [c.name, ...c.keywords]) {
      const kk = norm(k);
      if (kk.length < 1) continue;
      // 한 글자 키워드(예: '밥','약','옷')는 단어 단위로만
      const hit = kk.length === 1 ? new RegExp(`(^|\\s)${k}(\\s|$)`, 'i').test(text) : t.includes(kk);
      if (hit) {
        const score = kk.length + (kk === norm(c.name) ? 0.5 : 0);
        if (!best || score > best.score) best = { c, score };
      }
    }
  }
  return best?.c ?? null;
}

function matchAccount(words: string[], accounts: Account[], used: Set<number>): { id: string; idx: number[] } | null {
  const active = accounts.filter((a) => !a.archived);
  // 1) 계좌 이름 그대로 (붙여쓴 이름도)
  const joined = norm(words.join(' '));
  let named: Account | null = null;
  for (const a of active) {
    const n = norm(a.name);
    if (n.length >= 2 && joined.includes(n) && (!named || n.length > norm(named.name).length)) named = a;
  }
  if (named) {
    const nn = norm(named.name);
    const idx: number[] = [];
    words.forEach((w, i) => { const ww = norm(w.replace(PARTICLES, '')); if (ww && nn.includes(ww) && ww.length >= 2) idx.push(i); });
    return { id: named.id, idx };
  }
  // 2) 종류 별칭 (신용카드 → 첫 카드)
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const w = norm(words[i].replace(PARTICLES, ''));
    for (const kind of ['bank', 'card', 'cash', 'invest'] as const) {
      if (ACCOUNT_ALIASES[kind].some((al) => w === norm(al))) {
        const acc = active.find((a) => a.kind === kind);
        if (acc) return { id: acc.id, idx: [i] };
      }
    }
  }
  return null;
}

function parseDateWord(words: string[], today: string): { date: string; idx: number[] } | null {
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/(에|날)$/, '');
    if (w === '오늘') return { date: today, idx: [i] };
    if (w === '어제') return { date: addDays(today, -1), idx: [i] };
    if (w === '그제' || w === '그저께') return { date: addDays(today, -2), idx: [i] };
    if (w === '내일') return { date: addDays(today, 1), idx: [i] };
    let m = w.match(/^(\d+)일전$/);
    if (m) return { date: addDays(today, -Number(m[1])), idx: [i] };
    if (/^\d+일$/.test(w) && words[i + 1] === '전') return { date: addDays(today, -parseInt(w, 10)), idx: [i, i + 1] };
    m = w.match(/^(\d{1,2})[/.](\d{1,2})$/);
    if (m) return { date: dateFrom(today, Number(m[1]), Number(m[2])), idx: [i] };
    m = w.match(/^(\d{1,2})월$/);
    if (m && /^\d{1,2}일$/.test(words[i + 1] ?? '')) return { date: dateFrom(today, Number(m[1]), parseInt(words[i + 1], 10)), idx: [i, i + 1] };
    m = w.match(/^(\d{1,2})월(\d{1,2})일$/);
    if (m) return { date: dateFrom(today, Number(m[1]), Number(m[2])), idx: [i] };
    m = w.match(/^(\d{1,2})일$/);
    if (m && Number(m[1]) <= 31) {
      const t = fromKey(today);
      return { date: dateFrom(today, t.getMonth() + 1, Number(m[1])), idx: [i] };
    }
  }
  return null;
}

/** 월/일 → 오늘 이후면 작년 날짜로 (미래 날짜를 말하는 경우는 드묾) */
function dateFrom(today: string, month: number, day: number) {
  const t = fromKey(today);
  let d = new Date(t.getFullYear(), month - 1, day);
  if (toKey(d) > today && month - 1 > t.getMonth()) d = new Date(t.getFullYear() - 1, month - 1, day);
  return toKey(d);
}

/**
 * "점심 12000 체크카드", "어제 택시 15000", "TV 480000 10개월 할부 신용카드", "월급 320만 입금", "통장에서 현금으로 5만 이체"
 */
export function parsePhrase(input: string, accounts: Account[], categories: Category[], today = todayKey()): ParsedEntry {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  const text = input.trim();

  // 할부
  let installments = 1;
  for (let i = 0; i < words.length; i++) {
    let m = words[i].match(/^(\d{1,2})개월(할부)?$/);
    if (m) { installments = Number(m[1]); used.add(i); if (words[i + 1] === '할부') used.add(i + 1); break; }
    m = words[i].match(/^할부(\d{1,2})(개월)?$/);
    if (m) { installments = Number(m[1]); used.add(i); break; }
    if (words[i] === '할부' && /^\d{1,2}(개월)?$/.test(words[i + 1] ?? '')) { installments = parseInt(words[i + 1], 10); used.add(i); used.add(i + 1); break; }
    if (words[i] === '일시불') { used.add(i); break; }
  }
  if (installments < 1 || installments > 60) installments = 1;

  // 날짜
  const dw = parseDateWord(words.map((w, i) => (used.has(i) ? '' : w)), today);
  const date = dw?.date ?? today;
  dw?.idx.forEach((i) => used.add(i));

  // 금액: 숫자가 들어 있거나 한글 금액 단위가 있는 첫 단어 (단어 끝 조사 제거)
  let amount: number | null = null;
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const w = words[i].replace(/(원|원에|원으로|원을)$/, '').replace(PARTICLES, '');
    if (!/\d|[만천억]/.test(w)) continue;
    const v = parseAmount(w);
    if (v !== null) {
      // "3만" "5천" 처럼 이어진 단어 합치기
      let total = v; used.add(i);
      for (let j = i + 1; j < words.length && !used.has(j); j++) {
        const nxt = parseAmount(words[j].replace(/원$/, ''));
        if (nxt !== null && /^[\d.]*[천백십]?(원)?$|^[\d.]+천/.test(words[j]) && nxt < 10000) { total += nxt; used.add(j); } else break;
      }
      amount = total;
      break;
    }
  }

  // 유형
  let type: TxType = 'expense';
  const isTransfer = TRANSFER_WORDS.some((w) => text.includes(w));
  if (isTransfer) type = 'transfer';
  else if (INCOME_WORDS.some((w) => text.includes(w))) type = 'income';

  // 계좌 (이체는 "A에서 B로")
  let accountId: string | null = null;
  let toAccountId: string | null = null;
  if (type === 'transfer') {
    const fromIdx = words.findIndex((w) => /에서$/.test(w));
    const toIdx = words.findIndex((w, i) => i !== fromIdx && /(으로|로)$/.test(w) && !/^\d/.test(w));
    if (fromIdx >= 0) { const a = matchAccount([words[fromIdx].replace(/에서$/, '')], accounts, new Set()); if (a) { accountId = a.id; used.add(fromIdx); } }
    if (toIdx >= 0) { const a = matchAccount([words[toIdx].replace(/(으로|로)$/, '')], accounts, new Set()); if (a) { toAccountId = a.id; used.add(toIdx); } }
  } else {
    const acc = matchAccount(words.map((w, i) => (used.has(i) ? '' : w)), accounts, used);
    if (acc) { accountId = acc.id; acc.idx.forEach((i) => used.add(i)); }
    if (installments > 1 && !accountId) accountId = accounts.find((a) => a.kind === 'card' && !a.archived)?.id ?? null;
  }

  // 메모 = 남은 단어 (조사·군더더기 제거)
  const rest = words
    .filter((_, i) => !used.has(i))
    .map((w) => w.replace(PARTICLES, ''))
    .filter((w) => w && !FILLER.test(w) && !TRANSFER_WORDS.includes(w) && !['입금', '받음', '받았음', '받았어'].includes(w));
  const note = rest.join(' ');

  const cat = type === 'transfer' ? null : guessCategory(note || text, categories, type);
  // 카테고리 키워드로 수입이 확실하면 유형 보정 (예: "월급 300만")
  if (type === 'expense' && !cat) {
    const incomeCat = guessCategory(note || text, categories, 'income');
    if (incomeCat) return { type: 'income', amount, date, accountId, toAccountId, categoryId: incomeCat.id, installments: 1, note };
  }

  return { type, amount, date, accountId, toAccountId, categoryId: cat?.id ?? null, installments: type === 'expense' ? installments : 1, note };
}
