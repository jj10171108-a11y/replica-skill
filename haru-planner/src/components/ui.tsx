import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Portal } from './portal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

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
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: t.sub, fontSize: 16 }}>닫기</Text>
              </Pressable>
              <Text style={[s.sheetTitle, { color: t.text }]} numberOfLines={1}>{title}</Text>
              <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
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

export function Chip({ label, active, onPress, color, style }: {
  label: string; active?: boolean; onPress?: () => void; color?: string; style?: ViewStyle;
}) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      style={[
        s.chip,
        { borderColor: active ? c : t.border, backgroundColor: active ? c + (t.dark ? '33' : '1A') : 'transparent' },
        style,
      ]}
    >
      <Text style={{ color: active ? c : t.sub, fontWeight: active ? '700' : '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
      {children}
    </ScrollView>
  );
}

export function Button({ label, onPress, kind = 'primary', style, disabled }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; style?: ViewStyle; disabled?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.dangerSoft : t.primarySoft;
  const fg = kind === 'primary' ? t.onPrimary : kind === 'danger' ? t.danger : t.primary;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}
    >
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
      style={[s.field, { color: t.text, backgroundColor: t.bg, borderColor: t.border }, props.style]}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.label, { color: t.sub }]}>{children}</Text>;
}

export function Fab({ onPress, label = '+' }: { onPress: () => void; label?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel="추가"
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.fab, { backgroundColor: t.primary, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <Text style={{ color: t.onPrimary, fontSize: 30, lineHeight: 32, fontWeight: '400' }}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={{ color: t.sub, fontSize: 14, marginBottom: 2 }}>{subtitle}</Text> : null}
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Progress({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height, borderRadius: height, backgroundColor: color ?? t.primary }} />
    </View>
  );
}

export function Empty({ emoji, title, desc }: { emoji: string; title: string; desc?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 12 }}>{title}</Text>
      {desc ? <Text style={{ color: t.sub, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{desc}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress, onLongPress }: {
  children: React.ReactNode; style?: ViewStyle; onPress?: () => void; onLongPress?: () => void;
}) {
  const t = useTheme();
  const base = [s.card, { backgroundColor: t.card, borderColor: t.border }, style];
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
    <View style={[s.seg, { backgroundColor: t.dark ? t.card : '#E8EAF1' }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { tap(); onChange(o.value); }}
            style={[s.segItem, on && { backgroundColor: t.dark ? t.elevated : '#FFFFFF' }]}
          >
            <Text style={{ color: on ? t.text : t.sub, fontWeight: on ? '700' : '500', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8, letterSpacing: 0.2 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
});
