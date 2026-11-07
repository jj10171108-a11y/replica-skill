import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import type { AppData } from '../types';

/** 위젯 네이티브 모듈은 APK(개발/정식 빌드)에만 있고 Expo Go 에는 없다 */
export const widgetSupported =
  Platform.OS === 'android' && !!(TurboModuleRegistry.get('AndroidWidget') ?? NativeModules.AndroidWidget);

export function refreshWidgets(data: AppData) {
  if (!widgetSupported) return;
  try {
    require('./handler').updateCalendarWidgets(data).catch(() => {});
  } catch {}
}
