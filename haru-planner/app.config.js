// app.json 의 설정을 그대로 쓰고, 위젯·딥링크·자동 업데이트 설정만 덧붙인다.
// 자동 업데이트 주소는 `eas init` 이 app.json 에 넣어 둔 projectId 로 만든다.
module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;
  return {
  ...config,
  scheme: 'haruplanner',
  // 앱 버전(app.json 의 version)이 같은 APK 끼리만 업데이트를 받는다.
  // 위젯 등 네이티브 기능을 바꿔 APK 를 새로 만들 때는 version 을 올린다.
  runtimeVersion: { policy: 'appVersion' },
  ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } } : {}),
  plugins: [
    ...(config.plugins ?? []),
    'expo-updates',
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'HaruCalendar',
            label: '하루 플래너 캘린더',
            description: '이번 달 일정과 오늘 할 일을 한눈에',
            minWidth: '250dp',
            minHeight: '250dp',
            targetCellWidth: 4,
            targetCellHeight: 4,
            resizeMode: 'horizontal|vertical',
            previewImage: './assets/widget-preview.png',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
};
};
