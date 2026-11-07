import { createContext, useContext } from 'react';

export const light = {
  dark: false,
  bg: '#F4F5F9',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#181A23',
  sub: '#676B7E',
  faint: '#A3A7B7',
  border: '#E3E5EE',
  primary: '#4F5BD5',
  primarySoft: '#E9EBFC',
  onPrimary: '#FFFFFF',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  success: '#2F9E6A',
  successSoft: '#E4F5EC',
  warn: '#E8930C',
  overlay: 'rgba(10,12,20,0.45)',
};

export type Theme = typeof light;

export const dark: Theme = {
  dark: true,
  bg: '#0E0F14',
  card: '#181A22',
  elevated: '#1F2230',
  text: '#F0F1F6',
  sub: '#9DA1B4',
  faint: '#5E6275',
  border: '#2A2D3A',
  primary: '#8A93F7',
  primarySoft: '#252846',
  onPrimary: '#0E0F14',
  danger: '#FF6B70',
  dangerSoft: '#3A1E22',
  success: '#4CC38A',
  successSoft: '#18301F',
  warn: '#F5A524',
  overlay: 'rgba(0,0,0,0.6)',
};

export const PALETTE = ['#4F5BD5', '#E5484D', '#E8930C', '#2F9E6A', '#0EA5B7', '#C2410C', '#9D4EDD', '#DB2777', '#64748B'];

export const NOTE_COLORS = ['#FFF4C2', '#FFE0E0', '#DDF4E4', '#DCEBFF', '#EFE2FF', '#F1F1F1'];
export const NOTE_COLORS_DARK: Record<string, string> = {
  '#FFF4C2': '#3A3420',
  '#FFE0E0': '#3B2425',
  '#DDF4E4': '#1E3326',
  '#DCEBFF': '#1E2A3D',
  '#EFE2FF': '#2D2340',
  '#F1F1F1': '#26272D',
};

export const PRIORITY_LABEL = ['없음', '낮음', '보통', '높음'];
export const priorityColor = (t: Theme, p: number) =>
  p === 3 ? t.danger : p === 2 ? t.warn : p === 1 ? t.primary : t.faint;

export const ThemeContext = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeContext);
