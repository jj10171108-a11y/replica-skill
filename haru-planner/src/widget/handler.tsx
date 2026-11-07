import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetInfo, WidgetRepresentation, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { normalize, STORAGE_KEY } from '../store';
import { AppData } from '../types';
import { CalendarWidget } from './CalendarWidget';
import { buildWidgetModel, WIDGET_NAME, WIDGET_OFFSET_KEY } from './model';

const offsetKey = (id: number) => `${WIDGET_OFFSET_KEY}_${id}`;

async function loadData(): Promise<AppData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function getOffset(id: number) {
  const v = Number(await AsyncStorage.getItem(offsetKey(id)));
  return Number.isFinite(v) ? v : 0;
}

function render(info: WidgetInfo, data: AppData | null, offset: number): WidgetRepresentation {
  const model = buildWidgetModel(data, offset);
  const make = (dark: boolean) => <CalendarWidget model={model} dark={dark} width={info.width} height={info.height} />;
  const theme = data?.settings.theme ?? 'system';
  if (theme === 'light') return { light: make(false), dark: make(false) };
  if (theme === 'dark') return { light: make(true), dark: make(true) };
  return { light: make(false), dark: make(true) };
}

async function handler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetInfo.widgetName !== WIDGET_NAME) return;
  const id = widgetInfo.widgetId;
  if (widgetAction === 'WIDGET_DELETED') {
    await AsyncStorage.removeItem(offsetKey(id));
    return;
  }
  let offset = await getOffset(id);
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') offset = 0; // 주기 갱신 시 이번 달로 복귀
  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction === 'PREV') offset -= 1;
    else if (clickAction === 'NEXT') offset += 1;
    else if (clickAction === 'TODAY') offset = 0;
    else return;
  }
  await AsyncStorage.setItem(offsetKey(id), String(offset));
  renderWidget(render(widgetInfo, await loadData(), offset));
}

export function registerCalendarWidget() {
  registerWidgetTaskHandler(handler);
}

/** 앱에서 데이터가 바뀌면 홈 화면 위젯을 다시 그린다 */
export async function updateCalendarWidgets(data: AppData) {
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: async (info) => render(info, data, await getOffset(info.widgetId)),
  });
}
