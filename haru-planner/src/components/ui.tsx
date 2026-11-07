import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Portal } from './portal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { cardShadow, useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.sub} />;
}

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setH(e.endCoordinates.height));
    const b = Keyboard.addListener(hideEvt, () => setH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  return h;
}

function SheetBody({ onClose, title, children, right, full }: {
  onClose: () => void; title?: string; children: React.ReactNode; right?: React.ReactNode; full?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const slide = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // 마운트 순서대로 등록 → 가장 위(나중에 열린) 시트가 뒤로가기를 먼저 받음
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closeRef.current(); return true; });
    return () => sub.remove();
  }, []);
  // 안드로이드: 키보드 높이에는 내비게이션 바가 빠져 있으므로 더해 준다
  const bottom = kb > 0 ? kb + (Platform.OS === 'android' ? insets.bottom : 0) + 8 : insets.bottom + 12;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay, opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }} accessibilityLabel="닫기" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 8 }} pointerEvents="box-none">
        <Animated.View
          style={[
            s.sheet,
            { backgroundColor: t.card, paddingBottom: bottom },
            full ? { height: '94%' } : { maxHeight: '94%' },
            { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }) }] },
          ]}
        >
          <View style={[s.grabber, { backgroundColor: t.border }]} />
          {(title || right) && (
            <View style={s.sheetHeader}>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기" style={[s.iconBtn, { backgroundColor: t.fill }]}>
                <Ionicons name="close" size={18} color={t.sub} />
              </Pressable>
              <Text style={[s.sheetTitle, { color: t.text }]} numberOfLines={1}>{title}</Text>
              <View style={{ minWidth: 34, alignItems: 'flex-end' }}>{right}</View>
            </View>
          )}
          <View style={full ? { flex: 1 } : { flexShrink: 1 }}>{children}</View>
        </Animated.View>
      </View>
    </View>
  );
}

export function Sheet(props: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; right?: React.ReactNode; full?: boolean;
}) {
  const { visible, ...rest } = props;
  return (
    <Portal visible={visible}>
      <SheetBody {...rest} />
    </Portal>
  );
}

export function Chip({ label, active, onPress, color, style, icon }: {
  label: string; active?: boolean; onPress?: () => void; color?: string; style?: ViewStyle; icon?: IconName;
}) {
  const t = useTheme();
  const c = color ?? t.primary;
  const fg = active ? c : t.sub;
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: active ? (color ? c + (t.dark ? '2E' : '17') : t.primarySoft) : t.fill, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={color ?? fg} style={{ marginRight: 5 }} /> : null}
      <Text style={{ color: fg, fontWeight: active ? '700' : '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 16 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Button({ label, onPress, kind = 'primary', style, disabled, icon }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; style?: ViewStyle; disabled?: boolean; icon?: IconName;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.dangerSoft : t.primarySoft;
  const fg = kind === 'primary' ? t.onPrimary : kind === 'danger' ? t.danger : t.primary;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.faint}
      {...props}
      style={[s.field, { color: t.text, backgroundColor: t.fill }, props.style]}
    />
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const t = useTheme();
  return (
    <View style={[s.search, { backgroundColor: t.fill }]}>
      <Ionicons name="search" size={17} color={t.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        returnKeyType="search"
        style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="검색어 지우기">
          <Ionicons name="close-circle" size={17} color={t.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Label({ children, icon }: { children: React.ReactNode; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={s.labelRow}>
      {icon ? <Ionicons name={icon} size={15} color={t.sub} /> : null}
      <Text style={[s.label, { color: t.sub }]}>{children}</Text>
    </View>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel="추가"
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        s.fab,
        { backgroundColor: t.primary, shadowColor: t.primary, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      <Ionicons name={icon} size={28} color={t.onPrimary} />
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={8} accessibilityLabel={label}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: t.fill, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={18} color={color ?? t.text} />
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={{ color: t.sub, fontSize: 13, fontWeight: '600', marginBottom: 2 }}>{subtitle}</Text> : null}
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>{title}</Text>
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ children, color, right }: { children: React.ReactNode; color?: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.sectionRow}>
      <Text style={{ color: color ?? t.sub, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }}>{children}</Text>
      {right}
    </View>
  );
}

export function Progress({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.fill, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height, borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

export function Empty({ icon, title, desc }: { icon: IconName; title: string; desc?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24 }}>
      <View style={[s.emptyIcon, { backgroundColor: t.fill }]}>
        <Ionicons name={icon} size={26} color={t.faint} />
      </View>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', marginTop: 14 }}>{title}</Text>
      {desc ? <Text style={{ color: t.sub, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{desc}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress, onLongPress }: {
  children: React.ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; onLongPress?: () => void;
}) {
  const t = useTheme();
  const base = [s.card, { backgroundColor: t.card }, cardShadow(t), style];
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[s.seg, { backgroundColor: t.fill }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { tap(); onChange(o.value); }}
            style={[s.segItem, on && [{ backgroundColor: t.dark ? t.elevated : '#FFFFFF' }, !t.dark && s.segShadow]]}
          >
            <Text style={{ color: on ? t.text : t.sub, fontWeight: on ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 설정 화면 등에서 쓰는 목록 행 */
export function ListRow({ icon, iconBg, title, desc, right, onPress, last }: {
  icon?: IconName; iconBg?: string; title: string; desc?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.listRow, { backgroundColor: pressed ? t.fill : 'transparent' }]}>
      {icon ? (
        <View style={[s.rowIcon, { backgroundColor: iconBg ?? t.primary }]}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
      ) : null}
      <View style={[s.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 16 }}>{title}</Text>
          {desc ? <Text style={{ color: t.sub, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{desc}</Text> : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.faint} /> : null)}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 14, borderRadius: 10 },
  btn: { flexDirection: 'row', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  field: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: 12, paddingHorizontal: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 18, marginBottom: 8 },
  card: { borderRadius: 18, padding: 16 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  segShadow: { shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingRight: 16, gap: 10 },
});
