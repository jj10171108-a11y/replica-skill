// app.json 의 설정을 그대로 쓰고, 위젯·딥링크 설정만 덧붙인다.
module.exports = ({ config }) => ({
  ...config,
  scheme: 'haruplanner',
  plugins: [
    ...(config.plugins ?? []),
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
});
