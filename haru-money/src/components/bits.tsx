import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt } from '../domain/money';
import { formatDate } from '../domain/date';
import { tint, useTheme } from '../theme';
import type { Account, Category, Transaction } from '../domain/types';
import { IconName } from './ui';

export const ACCOUNT_ICON: Record<Account['kind'], IconName> = {
  bank: 'business-outline', cash: 'cash-outline', card: 'card-outline', invest: 'trending-up-outline',
};
export const ACCOUNT_KIND_LABEL: Record<Account['kind'], string> = { bank: '통장', cash: '현금', card: '신용카드', invest: '투자' };

export function IconBubble({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  const t = useTheme();
  const p = tint(t, color);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.48} color={p.ink} />
    </View>
  );
}

export function Amount({ value, type, size = 16, weight = '700', signed = true }: { value: number; type?: Transaction['type'] | 'net'; size?: number; weight?: '600' | '700' | '800'; signed?: boolean }) {
  const t = useTheme();
  const color = type === 'income' ? t.success : type === 'transfer' ? t.sub : type === 'net' ? (value < 0 ? t.danger : t.text) : t.text;
  const v = type === 'expense' ? -value : value;
  return <Text style={{ color, fontSize: size, fontWeight: weight, letterSpacing: -0.3 }}>{fmt(v, { signed: signed && type === 'income' })}</Text>;
}

function TxRowImpl({ tx, account, toAccount, category, onPress, showDate }: {
  tx: Transaction; account?: Account; toAccount?: Account; category?: Category; onPress?: (t: Transaction) => void; showDate?: boolean;
}) {
  const t = useTheme();
  const icon: IconName = tx.type === 'transfer' ? (tx.cardPayment ? 'card-outline' : 'swap-horizontal') : ((category?.icon as IconName) ?? 'pricetag-outline');
  const color = tx.type === 'transfer' ? '#5A5560' : category?.color ?? '#5A5560';
  const title = tx.note || (tx.type === 'transfer' ? (tx.cardPayment ? '카드 대금 납부' : '이체') : category?.name ?? '기타');
  const sub = tx.type === 'transfer' ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}` : [category && tx.note ? category.name : null, account?.name].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress ? () => onPress(tx) : undefined} style={({ pressed }) => [st.row, pressed && { backgroundColor: t.fill }]}>
      <IconBubble icon={icon} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={{ color: t.sub, fontSize: 12.5 }} numberOfLines={1}>{showDate ? `${formatDate(tx.date)} · ` : ''}{sub}</Text>
          {tx.installment ? (
            <View style={[st.badge, { backgroundColor: t.primarySoft }]}>
              <Text style={{ color: t.primaryInk, fontSize: 11, fontWeight: '700' }}>할부 {tx.installment.index}/{tx.installment.count}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Amount value={tx.amount} type={tx.type} size={15.5} />
    </Pressable>
  );
}
export const TxRow = memo(TxRowImpl);

export function StatTile({ label, value, color, icon, onPress, small }: { label: string; value: string; color: string; icon: IconName; onPress?: () => void; small?: boolean }) {
  const t = useTheme();
  const p = tint(t, color);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.tile, { backgroundColor: p.bg, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[st.tileIcon, { backgroundColor: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)' }]}>
        <Ionicons name={icon} size={16} color={p.ink} />
      </View>
      <Text style={{ color: t.text, fontSize: small ? 16 : 19, fontWeight: '800', marginTop: 10, letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ color: p.ink, fontSize: 12, fontWeight: '700', marginTop: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ value, color, track, height = 8 }: { value: number; color: string; track?: string; height?: number }) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? t.fill, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  tile: { flex: 1, borderRadius: 22, padding: 13 },
  tileIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
