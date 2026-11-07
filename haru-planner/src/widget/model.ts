import { fromKey, monthGrid, todayKey, WEEKDAYS } from '../date';
import { AppData } from '../types';
import { getHoliday } from '../holidays';

export const WIDGET_NAME = 'HaruCalendar';
export const WIDGET_OFFSET_KEY = 'haru_widget_month_offset';

export interface WidgetCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  dow: number;
  /** 남은(미완료) 할 일 수 */
  open: number;
  /** 완료한 할 일 수 */
  done: number;
  hasNote: boolean;
  holiday: boolean;
}

export interface WidgetModel {
  year: number;
  month: number;
  offset: number;
  weekdays: string[];
  rows: WidgetCell[][];
  today: { key: string; label: string; holiday: string | null; tasks: { title: string; time: string | null; done: boolean }[]; open: number };
}

export function buildWidgetModel(data: AppData | null, offset: number): WidgetModel {
  const today = todayKey();
  const base = fromKey(today);
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const weekStart = data?.settings.weekStart ?? 0;
  const cells = monthGrid(year, month, weekStart);
  const rowCount = fromKey(cells[35]).getMonth() !== month ? 5 : 6;

  const open: Record<string, number> = {};
  const done: Record<string, number> = {};
  const notes = new Set<string>();
  for (const t of data?.tasks ?? []) {
    if (!t.due) continue;
    if (t.done) done[t.due] = (done[t.due] ?? 0) + 1;
    else open[t.due] = (open[t.due] ?? 0) + 1;
  }
  for (const n of data?.notes ?? []) if (n.date) notes.add(n.date);

  const rows: WidgetCell[][] = [];
  for (let r = 0; r < rowCount; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7).map((k) => {
      const d = fromKey(k);
      return { key: k, day: d.getDate(), inMonth: d.getMonth() === month, isToday: k === today, dow: d.getDay(), open: open[k] ?? 0, done: done[k] ?? 0, hasNote: notes.has(k), holiday: !!getHoliday(k) };
    }));
  }

  const todayTasks = (data?.tasks ?? [])
    .filter((t) => t.due === today)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99') || b.priority - a.priority)
    .map((t) => ({ title: t.title, time: t.time, done: t.done }));

  return {
    year,
    month,
    offset,
    weekdays: weekStart === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS,
    rows,
    today: {
      key: today,
      label: `${base.getMonth() + 1}월 ${base.getDate()}일 (${WEEKDAYS[base.getDay()]})`,
      holiday: getHoliday(today),
      tasks: todayTasks,
      open: todayTasks.filter((t) => !t.done).length,
    },
  };
}
