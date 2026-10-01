import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { badgeInfo } from '../lib/ratingRules';

interface Props {
  tier: string | null | undefined;
  sport?: string;          // shown after the badge name, e.g. "Gold · Tennis"
  size?: 'sm' | 'md' | 'lg';
}

/** Bronze / Silver / Gold / Platinum / Diamond pill. Renders nothing without a badge. */
export default function BadgeChip({ tier, sport, size = 'sm' }: Props) {
  const b = badgeInfo(tier);
  if (!b) return null;
  const icon = b.icon === 'diamond' ? 'diamond' : 'medal';
  const s = SIZES[size];
  return (
    <View
      style={[styles.chip, { backgroundColor: b.bg, paddingHorizontal: s.padH, paddingVertical: s.padV }]}
      accessibilityLabel={`${b.name} badge${sport ? ` in ${sport}` : ''}`}
    >
      <Ionicons name={icon} size={s.icon} color={b.color} />
      <Text style={[styles.text, { color: b.color, fontSize: s.font }]}>
        {b.name}{sport ? ` · ${sport}` : ''}
      </Text>
    </View>
  );
}

const SIZES = {
  sm: { icon: 12, font: 11, padH: 8,  padV: 3 },
  md: { icon: 15, font: 13, padH: 10, padV: 5 },
  lg: { icon: 20, font: 16, padH: 14, padV: 7 },
};

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, alignSelf: 'flex-start' },
  text: { fontWeight: '800' },
});
