import { registerRootComponent } from 'expo';

import App from './App';
import { widgetSupported } from './src/widget/bridge';

// 홈 화면 캘린더 위젯 (APK 빌드에서만 동작, Expo Go 에서는 건너뜀)
if (widgetSupported) {
  require('./src/widget/handler').registerCalendarWidget();
}

registerRootComponent(App);
