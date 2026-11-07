# 하루 플래너 (Haru Planner)

할 일 · 캘린더 · 프로젝트 · 목표 · 메모를 한 앱에서 관리하는 Expo(React Native) 앱입니다.
"할 일 목록 & 스케줄 플래너" 류 앱의 기능 구성을 참고해 **직접 새로 만든** 앱이며, 원본의 코드·로고·디자인은 사용하지 않았습니다.

## 원본 대비 보완한 점

| 원본(스토어 정보 기준) | 하루 플래너 |
| --- | --- |
| 광고 포함 · 인앱 구매 | 광고 없음, 모든 기능 무료 |
| 영문 위주 UI | 처음부터 한국어 UI (오전/오후, 요일, D-day 표기) |
| 잠금 기능 없음 | **PIN 잠금** (SHA-256 + 솔트 해시를 기기 보안 저장소에 보관, 백그라운드 1분 후 재잠금) |
| 데이터 행방 불명확 | 모든 데이터 기기 내 저장, 외부 전송·추적 SDK 없음 |
| 기기 바꾸면 데이터 유실 위험 | 백업 내보내기(공유) / 붙여넣기로 복원, 입력값 검증 |
| 목표 진행률 수동 | 할 일을 목표에 연결하면 진행률 자동 계산, D-day 표시 |
| — | 반복 할 일(매일·평일·매주·매월) 완료 시 다음 회차 자동 생성 |
| — | 세부 항목(체크리스트), 우선순위, 기한 지남 섹션 |
| — | 미리 알림(정시/5/10/30/60분 전), 시간 없는 할 일은 오전 9시 알림 |
| — | 검색, 프로젝트 필터, 정렬(날짜/중요도/최근), 길게 눌러 빠른 메뉴(완료·내일로 미루기·삭제) |
| — | 다크 모드, 주 시작 요일, 연속 달성일·주간 완료 통계 |

## 화면 구성

- **할 일**: 오늘 진행률, 오늘/예정/전체/완료 탭, 검색·필터·정렬
- **캘린더**: 월간 달력(프로젝트 색 점 표시), 선택한 날짜의 할 일과 메모
- **프로젝트 / 목표**: 프로젝트별 진행률, 목표별 진행률·D-day, 상세에서 바로 할 일 추가
- **메모**: 색상 메모, 고정, 날짜 연결(캘린더에 표시), 검색
- **설정**: 테마, 알림, PIN 잠금, 백업/복원, 초기화, 통계

## 휴대폰(Termux 등 모바일 터미널 + Expo Go)에서 실행

```bash
# 1) 준비 (Termux 기준, 처음 한 번)
pkg update && pkg install -y git nodejs-lts

# 2) 코드 받기
git clone https://github.com/jj10171108-a11y/replica-skill.git
cd replica-skill
git checkout ccr-47e99c8d-d8mibl
cd haru-planner

# 3) 설치 & 실행
npm install
npx expo start
```

터미널에 `exp://127.0.0.1:8081` 같은 주소가 나오면 **Expo Go** 앱을 열고
"Enter URL manually"에 그 주소를 입력하세요 (같은 휴대폰이라 QR 스캔은 필요 없어요).
PC에서 실행했다면 같은 Wi-Fi에서 Expo Go로 QR을 스캔하면 됩니다.
연결이 안 되면 `npx expo start --tunnel`을 써 보세요.

> Expo Go 앱은 최신 SDK(이 프로젝트는 **SDK 58**)를 지원하는 버전으로 업데이트해 두세요.

### 참고

- Expo Go에서도 로컬 알림은 동작하지만, 정식 앱처럼 쓰려면 `npx eas-cli build -p android --profile preview`로 APK를 만들어 설치하는 걸 권장합니다.
- 웹 미리보기: `npx expo start --web` (알림·보안 저장소는 웹에서 제한됨)

## 구조

```
App.tsx                  탭 네비게이션, 테마, 잠금 게이트
src/store.tsx            상태 관리 + AsyncStorage 저장 + 백업 검증(normalize)
src/notify.ts            expo-notifications 알림 예약/취소
src/security.ts          PIN 해시 (expo-crypto + expo-secure-store)
src/date.ts              날짜 유틸 (한국어 포맷, 달력 그리드, 반복 계산)
src/components/          공용 UI, 달력, 날짜/시간 선택기, 할 일 편집기
src/screens/             할 일 · 캘린더 · 프로젝트 · 메모 · 설정 · 잠금
```
