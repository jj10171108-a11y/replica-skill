import { OFFICIAL_HOLIDAYS, OFFICIAL_LAST_YEAR } from './holidayData';

// 관보 데이터가 아직 없는 연도용: 양력 고정 공휴일만 (설·추석·부처님오신날 등 음력 공휴일과 대체공휴일 제외)
const FIXED: Record<string, string> = {
  '01-01': '1월 1일',
  '03-01': '3·1절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '기독탄신일',
};

/** YYYY-MM-DD → 공휴일 이름 (없으면 null) */
export function getHoliday(key: string): string | null {
  const year = Number(key.slice(0, 4));
  if (year <= OFFICIAL_LAST_YEAR) return OFFICIAL_HOLIDAYS[key] ?? null;
  return FIXED[key.slice(5)] ?? null;
}

/** 달력 칸에 들어갈 짧은 이름 */
export function shortHoliday(name: string) {
  return name
    .replace(/^대체공휴일.*/, '대체휴일')
    .replace('부처님 오신 날', '부처님오신날')
    .replace(' 다음 날', '')
    .replace(' 전날', '')
    .replace('기독탄신일', '성탄절')
    .replace('1월 1일', '신정')
    .replace('전국동시지방선거', '지방선거');
}
