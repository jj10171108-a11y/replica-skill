# 하루 플래너 컴포넌트 명세 (파스텔 카드 스타일)

토큰: `tokens.json`(라이트) · `tokens.dark.json`(다크) → 코드 `src/theme.ts`
대비 검사: `python3 ../replica-design/contrast.py replica/design/tokens.json` → 0 failing AA (라이트·다크 모두, report-*.txt)
아이콘: Ionicons (MIT, @expo/vector-icons). 글꼴: 시스템 기본 (Android Noto Sans KR).

## 파스텔 팔레트
lavender · mint · peach · sky · butter · rose · stone — 각각 `bg`(카드 배경) + `ink`(그 위 글자·아이콘).
프로젝트 색은 ink(라이트) 값으로 저장, `tint(theme, color)`가 현재 테마의 {bg, ink} 반환. 예전 색은 가장 가까운 파스텔로 매핑.

## Card
  radius    lg 24, padding 18
  tokens    bg surface, 라이트 그림자 card(보라빛 0.07), 다크는 그림자 없음
  variant   tinted: bg = 파스텔 bg, 그림자 없음 (프로젝트·목표·통계 타일)

## TaskItem (할 일 카드)
  layout    개별 카드, radius 22, 세로 15 / 가로 16, 카드 사이 10
  tint      프로젝트 있으면 그 파스텔 bg, 없으면 surface + 그림자
  check     26px 원, 테두리 = 프로젝트 ink (높음 우선순위는 danger), 완료 = success 채움 + ✓
  states    default, pressed(scale .985), done(투명도 .7, 취소선, surface 배경)
  meta      12px text-muted 아이콘+글 (날짜, 시간, 반복, 세부항목, 알림, 메모, 목표)
  tag       오른쪽 흰 반투명 pill에 프로젝트 이모지+이름 (ink)
  a11y      체크 = role checkbox + checked 상태, 길게 누르면 빠른 메뉴

## Summary tile (오늘 남은 일 / 완료 / 기한 지남)
  3열, radius 24, 파스텔 bg, 흰 원 아이콘 32px, 숫자 26/800, 라벨 12/700 ink
  누르면 해당 필터로 이동. 기한 지남 0이면 stone, 있으면 rose

## Chip
  pill(999), 높이 36, 가로 15
  inactive  surface + border 1px, 글자 text-muted
  active    파스텔 bg(색 지정 시) 또는 accent-soft, 글자 ink 700

## Segmented
  pill 트랙 surface + 그림자, 선택 항목 accent 채움 + on-accent 글자

## Button
  variants  primary(accent / on-accent), ghost(accent-soft / accent-ink), danger(rose bg / danger)
  size      높이 54, radius 18, 글자 16/700, 아이콘 선택
  states    pressed .85, disabled .4

## Field / SearchField
  Field: fill 배경, radius 16 · SearchField: surface pill 높이 46, 돋보기 아이콘, 지우기 버튼

## Fab
  60px 원, accent, 아이콘 add 28, accent 색 그림자

## Tab bar
  떠 있는 pill 바: 좌우 14 여백, radius 28, surface + 그림자(다크는 border)
  선택 탭: accent-soft pill(52x30) + 채운 아이콘 + ink 라벨, 나머지 faint 외곽선 아이콘

## Sheet
  상단 radius 30, 회색 손잡이, 닫기 = 원형 X 버튼, 키보드 높이만큼 패딩, 뒤로가기로 닫힘

## ListRow (설정)
  34px 원형 파스텔 아이콘, 제목 16, 설명 13 muted, 구분선 separator, 오른쪽 chevron/스위치

## MonthGrid
  선택일 accent 원, 오늘 accent-soft 원, 일요일·공휴일 danger, 토요일 saturday, 공휴일 이름 9px
