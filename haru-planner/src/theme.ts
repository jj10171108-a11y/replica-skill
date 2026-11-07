import { createContext, useContext } from 'react';

export const light = {
  dark: false,
  bg: '#F5F6F8',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  fill: '#EFF0F3',
  text: '#15161B',
  sub: '#6C6F7D',
  faint: '#A8ABB7',
  border: '#E9EAEF',
  separator: '#EEEFF2',
  primary: '#4263EB',
  primarySoft: '#EDF1FE',
  onPrimary: '#FFFFFF',
  danger: '#E03131',
  dangerSoft: '#FDEDED',
  holiday: '#E03131',
  saturday: '#4263EB',
  success: '#2B9A66',
  successSoft: '#E6F6EE',
  warn: '#E8890C',
  overlay: 'rgba(15,17,25,0.38)',
  shadow: 'rgba(16,24,40,0.06)',
};

export type Theme = typeof light;

export const dark: Theme = {
  dark: true,
  bg: '#0B0C0F',
  card: '#15161B',
  elevated: '#2C2E38',
  fill: '#1F2028',
  text: '#ECEDF1',
  sub: '#999CAA',
  faint: '#5B5E6B',
  border: '#24252D',
  separator: '#22232A',
  primary: '#7C93FF',
  primarySoft: '#1E2440',
  onPrimary: '#0B0C0F',
  danger: '#FF6B6B',
  dangerSoft: '#3A1D20',
  holiday: '#FF6B6B',
  saturday: '#7C93FF',
  success: '#4CC38A',
  successSoft: '#17301F',
  warn: '#F5A524',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0)',
};

export const PALETTE = ['#4263EB', '#E03131', '#E8890C', '#2B9A66', '#1098AD', '#7048E8', '#D6336C', '#495057', '#F59F00'];

export const NOTE_COLORS = ['#FFF6D6', '#FFE8E8', '#E3F6EA', '#E3EEFF', '#F0E8FF', '#F1F2F4'];
export const NOTE_COLORS_DARK: Record<string, string> = {
  '#FFF6D6': '#302A17',
  '#FFE8E8': '#33201F',
  '#E3F6EA': '#182B20',
  '#E3EEFF': '#192439',
  '#F0E8FF': '#261F38',
  '#F1F2F4': '#202127',
};
// 예전 버전 메모 색상 호환
const LEGACY: Record<string, string> = {
  '#FFF4C2': '#FFF6D6', '#FFE0E0': '#FFE8E8', '#DDF4E4': '#E3F6EA', '#DCEBFF': '#E3EEFF', '#EFE2FF': '#F0E8FF', '#F1F1F1': '#F1F2F4',
};
export const noteBg = (t: Theme, color: string) => {
  const c = LEGACY[color] ?? color;
  return t.dark ? NOTE_COLORS_DARK[c] ?? t.card : c;
};

export const PRIORITY_LABEL = ['없음', '낮음', '보통', '높음'];
export const priorityColor = (t: Theme, p: number) =>
  p === 3 ? t.danger : p === 2 ? t.warn : p === 1 ? t.primary : t.faint;

export const cardShadow = (t: Theme) =>
  t.dark
    ? { borderWidth: 1, borderColor: t.border }
    : { shadowColor: '#101828', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 1 };

export const ThemeContext = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeContext);
