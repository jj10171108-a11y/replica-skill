const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};
export const todayKey = () => toKey(new Date());
export const monthOf = (k: string) => k.slice(0, 7);
export const thisMonth = () => monthOf(todayKey());

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** YYYY-MM 에 n 개월 더하기 */
export const addMonthsYM = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** 그 달의 day 일 (말일보다 크면 말일) */
export const dayInMonth = (ym: string, day: number) => `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;

export const diffDays = (a: string, b: string) => Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000);

export const monthsBetween = (fromYM: string, toYM: string) => {
  const [y1, m1] = fromYM.split('-').map(Number);
  const [y2, m2] = toYM.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const formatDate = (k: string, today = todayKey()) => {
  const diff = diffDays(k, today);
  if (diff === 0) return '오늘';
  if (diff === -1) return '어제';
  if (diff === 1) return '내일';
  const d = fromKey(k);
  const sameYear = k.slice(0, 4) === today.slice(0, 4);
  return `${sameYear ? '' : d.getFullYear() + '년 '}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};

export const formatYM = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${y}년 ${m}월`;
};
