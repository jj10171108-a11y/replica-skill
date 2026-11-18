import type { Settings } from './types';

const SYMBOL: Record<Settings['currency'], { prefix: string; suffix: string; decimals: number }> = {
  KRW: { prefix: '', suffix: '원', decimals: 0 },
  USD: { prefix: '$', suffix: '', decimals: 2 },
  EUR: { prefix: '€', suffix: '', decimals: 2 },
  JPY: { prefix: '¥', suffix: '', decimals: 0 },
};

let currency: Settings['currency'] = 'KRW';
export const setCurrency = (c: Settings['currency']) => { currency = c; };
export const getCurrency = () => currency;

const group = (n: number, decimals: number) => {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${g}.${frac}` : g;
};

/** 12345 → "12,345원" , signed 이면 +/− 표시 */
export function fmt(n: number, opts: { signed?: boolean; compact?: boolean } = {}) {
  const s = SYMBOL[currency];
  const neg = n < 0;
  let body: string;
  if (opts.compact && currency === 'KRW' && Math.abs(n) >= 10000) {
    const man = Math.abs(n) / 10000;
    body = man >= 10000 ? `${(man / 10000).toFixed(1).replace(/\.0$/, '')}억` : `${man >= 100 ? Math.round(man).toLocaleString('en-US') : man.toFixed(1).replace(/\.0$/, '')}만`;
    return `${neg ? '−' : opts.signed && n > 0 ? '+' : ''}${body}${s.suffix}`;
  }
  body = group(n, s.decimals);
  return `${neg ? '−' : opts.signed && n > 0 ? '+' : ''}${s.prefix}${body}${s.suffix}`;
}

const DIGIT: Record<string, number> = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const SMALL: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const BIG: Record<string, number> = { 만: 1e4, 억: 1e8, 조: 1e12 };

/**
 * 금액 문자열 해석: "12000", "12,000원", "1.2만", "3만5천", "삼만 오천원", "$12.50", "12.5k"
 * 해석 못 하면 null
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[\s,₩$€¥]/g, '').replace(/원$/, '').replace(/won$/i, '');
  if (!s) return null;
  if (/^\d+(\.\d+)?k$/i.test(s)) return Math.round(parseFloat(s) * 1000);
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (!/^[\d.영공일이삼사오육칠팔구십백천만억조]+$/.test(s)) return null;
  let total = 0;
  let section = 0; // 만 단위 이하 누적
  let num = ''; // 숫자 버퍼
  let digit = -1; // 한글 숫자 버퍼
  const flushNum = () => {
    if (num) { const v = parseFloat(num); num = ''; return v; }
    if (digit >= 0) { const v = digit; digit = -1; return v; }
    return null;
  };
  for (const ch of s) {
    if (/[\d.]/.test(ch)) { num += ch; continue; }
    if (ch in DIGIT) { digit = DIGIT[ch]; continue; }
    if (ch in SMALL) { const v = flushNum(); section += (v ?? 1) * SMALL[ch]; continue; }
    if (ch in BIG) {
      const v = flushNum();
      const chunk = section + (v ?? 0);
      total += (chunk || 1) * BIG[ch];
      section = 0;
      continue;
    }
    return null;
  }
  const rest = flushNum();
  total += section + (rest ?? 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : null;
}
