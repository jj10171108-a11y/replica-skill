import React from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export function Sheet({ visible, onClose, title, children, right, full }: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; right?: React.ReactNode; full?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <View
            style={[
              s.sheet,
              { backgroundColor: t.card, paddingBottom: insets.bottom + 12 },
              full ? { height: '92%' } : { maxHeight: '90%' },
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
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
