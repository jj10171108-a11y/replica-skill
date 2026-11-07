import { createContext, useContext } from 'react';

// 값은 replica/design/tokens.json · tokens.dark.json 과 동기화 (WCAG AA 대비 검사 통과)
export const light = {
  dark: false,
  bg: '#FAF7F2',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  fill: '#F2EEE8',
  text: '#221E2E',
  sub: '#6A6475',
  faint: '#8E889A',
  border: '#ECE7DF',
  separator: '#F0ECE6',
  primary: '#6E56CF',
  primarySoft: '#EEEAFD',
  primaryInk: '#5B45B8',
  onPrimary: '#FFFFFF',
  danger: '#C92A2A',
  dangerSoft: '#FFE1EA',
  holiday: '#C92A2A',
  saturday: '#3A63C4',
  success: '#1F7A55',
  successSoft: '#DDF4E8',
  warn: '#9A5A08',
  overlay: 'rgba(34,30,46,0.32)',
  shadow: '#3C2878',
};

export type Theme = typeof light;

export const dark: Theme = {
  dark: true,
  bg: '#121117',
  card: '#1B1A22',
  elevated: '#2E2B3A',
  fill: '#25232E',
  text: '#EEECF4',
  sub: '#A29DB0',
  faint: '#7A7588',
  border: '#2D2B37',
  separator: '#28262F',
  primary: '#A594F9',
  primarySoft: '#2A2446',
  primaryInk: '#C4B8FF',
  onPrimary: '#17141F',
  danger: '#FF7A85',
  dangerSoft: '#3A1F2A',
  holiday: '#FF7A85',
  saturday: '#8DB4FF',
  success: '#5FD39A',
  successSoft: '#183126',
  warn: '#F2B44C',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

/** 파스텔 팔레트: 배경(bg) + 그 위에 쓰는 진한 글자색(ink). 프로젝트 색으로 ink(라이트) 값을 저장한다. */
export const PASTELS = [
  { key: 'lavender', light: { bg: '#EEEAFD', ink: '#5B45B8' }, dark: { bg: '#2A2446', ink: '#C4B8FF' } },
  { key: 'mint', light: { bg: '#DDF4E8', ink: '#1F7A55' }, dark: { bg: '#183126', ink: '#7FDDAE' } },
  { key: 'peach', light: { bg: '#FFE7DC', ink: '#A84B24' }, dark: { bg: '#3A2420', ink: '#FFB59A' } },
  { key: 'sky', light: { bg: '#DDEDFF', ink: '#2A5FA8' }, dark: { bg: '#1A2A40', ink: '#9CC3FF' } },
  { key: 'butter', light: { bg: '#FFF2C7', ink: '#7D5F00' }, dark: { bg: '#332B14', ink: '#F2D27A' } },
  { key: 'rose', light: { bg: '#FFE1EA', ink: '#A8335E' }, dark: { bg: '#3A1F2A', ink: '#FF9FBF' } },
  { key: 'stone', light: { bg: '#EEECE8', ink: '#5A5560' }, dark: { bg: '#26252B', ink: '#C9C5D2' } },
] as const;

export const PALETTE: string[] = PASTELS.map((p) => p.light.ink);

// 이전 버전에서 저장된 프로젝트 색 → 가장 가까운 파스텔
const LEGACY_PASTEL: Record<string, string> = {
  '#4263EB': 'sky', '#4F5BD5': 'lavender', '#1098AD': 'sky', '#0EA5B7': 'sky',
  '#2F9E6A': 'mint', '#2B9A66': 'mint', '#E03131': 'rose', '#E5484D': 'rose', '#D6336C': 'rose', '#DB2777': 'rose',
  '#E8890C': 'peach', '#E8930C': 'peach', '#C2410C': 'peach', '#F59F00': 'butter',
  '#7048E8': 'lavender', '#9D4EDD': 'lavender', '#495057': 'stone', '#64748B': 'stone',
};

/** 아무 색이든 → 현재 테마의 파스텔 { bg, ink } */
export function tint(t: Theme, color: string | null | undefined) {
  const c = (color ?? '').toUpperCase();
  const p = PASTELS.find((x) => x.light.ink === c || x.dark.ink === c) ?? PASTELS.find((x) => x.key === LEGACY_PASTEL[c]);
  if (p) return t.dark ? p.dark : p.light;
  if (!color) return { bg: t.card, ink: t.text };
  return { bg: color + (t.dark ? '2E' : '1F'), ink: color };
}

export const NOTE_COLORS = PASTELS.slice(0, 6).map((p) => p.light.bg);
const NOTE_LEGACY: Record<string, string> = {
  '#FFF4C2': '#FFF2C7', '#FFF6D6': '#FFF2C7', '#FFE0E0': '#FFE1EA', '#FFE8E8': '#FFE1EA', '#DDF4E4': '#DDF4E8', '#E3F6EA': '#DDF4E8',
  '#DCEBFF': '#DDEDFF', '#E3EEFF': '#DDEDFF', '#EFE2FF': '#EEEAFD', '#F0E8FF': '#EEEAFD', '#F1F1F1': '#EEECE8', '#F1F2F4': '#EEECE8',
};
export const normalizeNoteColor = (color: string) => NOTE_LEGACY[color.toUpperCase()] ?? color.toUpperCase();
export const noteBg = (t: Theme, color: string) => {
  const c = normalizeNoteColor(color);
  const p = PASTELS.find((x) => x.light.bg === c);
  return p ? (t.dark ? p.dark.bg : p.light.bg) : t.dark ? t.card : c;
};

export const PRIORITY_LABEL = ['없음', '낮음', '보통', '높음'];
export const priorityColor = (t: Theme, p: number) =>
  p === 3 ? t.danger : p === 2 ? t.warn : p === 1 ? t.primary : t.faint;

export const cardShadow = (t: Theme) =>
  t.dark
    ? {}
    : { shadowColor: t.shadow, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

export const ThemeContext = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeContext);
