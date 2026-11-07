import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import { formatTime } from '../date';
import { WidgetModel } from './model';

const LIGHT = {
  bg: '#FFFDF9' as HexColor, text: '#221E2E' as HexColor, sub: '#6A6475' as HexColor, faint: '#B4AEBC' as HexColor,
  primary: '#6E56CF' as HexColor, onPrimary: '#FFFFFF' as HexColor, soft: '#EEEAFD' as HexColor,
  danger: '#C92A2A' as HexColor, blue: '#3A63C4' as HexColor, warn: '#A84B24' as HexColor, line: '#F0ECE6' as HexColor,
};
const DARK: typeof LIGHT = {
  bg: '#1B1A22' as HexColor, text: '#EEECF4' as HexColor, sub: '#A29DB0' as HexColor, faint: '#5E5A6B' as HexColor,
  primary: '#A594F9' as HexColor, onPrimary: '#17141F' as HexColor, soft: '#2A2446' as HexColor,
  danger: '#FF7A85' as HexColor, blue: '#8DB4FF' as HexColor, warn: '#FFB59A' as HexColor, line: '#2D2B37' as HexColor,
};

const uri = (path: string) => ({ clickAction: 'OPEN_URI', clickActionData: { uri: `haruplanner://${path}` } });

function NavButton({ label, action, c }: { label: string; action: string; c: typeof LIGHT }) {
  return (
    <FlexWidget
      clickAction={action}
      style={{ height: 30, width: label.length > 1 ? 44 : 30, borderRadius: 15, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}
    >
      <TextWidget text={label} style={{ fontSize: label.length > 1 ? 12 : 16, color: c.primary, fontWeight: '700' }} />
    </FlexWidget>
  );
}

export function CalendarWidget({ model, dark, width, height }: { model: WidgetModel; dark: boolean; width: number; height: number }) {
  const c = dark ? DARK : LIGHT;
  const showToday = height >= 300;
  const listCount = height >= 400 ? 4 : height >= 340 ? 3 : 2;
  const small = width < 260;
  const dayFont = small ? 12 : 14;

  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 28, padding: 14, flexDirection: 'column' }}>
      {/* 헤더 */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <FlexWidget {...uri('calendar')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={`${model.month + 1}월`} style={{ fontSize: 18, fontWeight: '800', color: c.text }} />
          <TextWidget text={`  ${model.year}`} style={{ fontSize: 13, color: c.sub }} />
        </FlexWidget>
        {model.offset !== 0 ? <NavButton label="오늘" action="TODAY" c={c} /> : null}
        <NavButton label="‹" action="PREV" c={c} />
        <NavButton label="›" action="NEXT" c={c} />
        <FlexWidget {...uri('new')} style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>
          <TextWidget text="+" style={{ fontSize: 18, color: c.onPrimary, fontWeight: '700' }} />
        </FlexWidget>
      </FlexWidget>

      {/* 요일 */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 2 }}>
        {model.weekdays.map((d) => (
          <FlexWidget key={d} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget text={d} style={{ fontSize: 11, fontWeight: '700', color: d === '일' ? c.danger : d === '토' ? c.blue : c.sub }} />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* 날짜 그리드 */}
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'column' }}>
        {model.rows.map((row, ri) => (
          <FlexWidget key={ri} style={{ width: 'match_parent', flex: 1, flexDirection: 'row' }}>
            {row.map((cell) => {
              const color: HexColor = cell.isToday ? c.onPrimary : !cell.inMonth ? c.faint : (cell.dow === 0 || cell.holiday) ? c.danger : cell.dow === 6 ? c.blue : c.text;
              const dot: HexColor | null = cell.open > 0 ? (cell.inMonth ? c.primary : c.faint) : cell.hasNote ? c.warn : cell.done > 0 ? c.faint : null;
              return (
                <FlexWidget key={cell.key} {...uri(`calendar?date=${cell.key}`)} style={{ flex: 1, height: 'match_parent', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <FlexWidget style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: cell.isToday ? c.primary : (c.bg) }}>
                    <TextWidget text={String(cell.day)} style={{ fontSize: dayFont, fontWeight: cell.isToday ? '800' : '500', color }} />
                  </FlexWidget>
                  <FlexWidget style={{ width: 5, height: 5, borderRadius: 3, marginTop: 1, backgroundColor: dot ?? c.bg }} />
                </FlexWidget>
              );
            })}
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* 오늘 할 일 */}
      {showToday ? (
        <FlexWidget {...uri('tasks')} style={{ width: 'match_parent', flexDirection: 'column', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line }}>
          <TextWidget
            text={`오늘 ${model.today.label}${model.today.holiday ? ' ' + model.today.holiday : ''} · 남은 일 ${model.today.open}개`}
            style={{ fontSize: 12, fontWeight: '700', color: c.sub, marginBottom: 4 }}
          />
          {model.today.tasks.length === 0 ? (
            <TextWidget text="오늘 일정이 없어요 🎉" style={{ fontSize: 13, color: c.faint }} />
          ) : (
            model.today.tasks.slice(0, listCount).map((t, i) => (
              <FlexWidget key={i} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <TextWidget text={t.done ? '✓' : '○'} style={{ fontSize: 13, color: t.done ? c.faint : c.primary, fontWeight: '700' }} />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget text={`  ${t.title}`} maxLines={1} truncate="END" style={{ fontSize: 13, color: t.done ? c.faint : c.text }} />
                </FlexWidget>
                {t.time ? <TextWidget text={formatTime(t.time)} style={{ fontSize: 11, color: c.sub }} /> : null}
              </FlexWidget>
            ))
          )}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
