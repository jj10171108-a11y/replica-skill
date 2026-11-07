const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

export const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

export const addMonths = (key: string, n: number) => {
  const d = fromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
};

export const diffDays = (a: string, b: string) =>
  Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000);

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const formatDue = (key: string | null, time?: string | null) => {
  if (!key) return '';
  const today = todayKey();
  const diff = diffDays(key, today);
  let label: string;
  if (diff === 0) label = '오늘';
  else if (diff === 1) label = '내일';
  else if (diff === -1) label = '어제';
  else {
    const d = fromKey(key);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    label = `${sameYear ? '' : d.getFullYear() + '. '}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  }
  return time ? `${label} ${formatTime(time)}` : label;
};

export const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${pad(m)}`;
};

export const formatLong = (key: string) => {
  const d = fromKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
};

/** Returns 6x7 grid of date keys for the month containing `key`. */
export const monthGrid = (year: number, month: number, weekStart: 0 | 1) => {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(toKey(d));
  }
  return cells;
};

export const nextOccurrence = (key: string, repeat: string) => {
  switch (repeat) {
    case 'daily':
      return addDays(key, 1);
    case 'weekdays': {
      let k = addDays(key, 1);
      while ([0, 6].includes(fromKey(k).getDay())) k = addDays(k, 1);
      return k;
    }
    case 'weekly':
      return addDays(key, 7);
    case 'monthly':
      return addMonths(key, 1);
    default:
      return null;
  }
};

export const startOfWeek = (key: string, weekStart: 0 | 1) => {
  const d = fromKey(key);
  const off = (d.getDay() - weekStart + 7) % 7;
  return addDays(key, -off);
};
