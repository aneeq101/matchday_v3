import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type EventCategory } from '../data/mockData';
import { CATEGORY_INFO } from '../lib/tournaments';

/**
 * Friendly / Prize money choice + the money fields that go with it.
 * Used by Create Event (Play to Earn), Organize Match (My Turf) and venue booking.
 */
export default function CategoryPicker({
  value, onChange, entryFee, prizePool, onEntryFee, onPrizePool, spots, what = 'event', locked = false,
}: {
  value: EventCategory;
  onChange: (c: EventCategory) => void;
  entryFee: string;
  prizePool: string;
  onEntryFee: (v: string) => void;
  onPrizePool: (v: string) => void;
  /** Number of entry fees collected if every spot fills (for the "adds up to" hint) */
  spots?: number;
  /** "event", "match", "game" — used in the helper text */
  what?: string;
  /** Category is decided by where the form was opened (Play to Earn = prize): hide the choice */
  locked?: boolean;
}) {
  const fee = parseInt(entryFee) || 0;
  return (
    <View>
      {!locked && <Text style={styles.label}>Category</Text>}
      {!locked && <View style={styles.row}>
        {(['friendly', 'prize'] as const).map((c) => {
          const info = CATEGORY_INFO[c];
          const on = value === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.card, on && { borderColor: info.color, backgroundColor: info.bg }]}
              onPress={() => onChange(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={{ fontSize: 24 }}>{info.emoji}</Text>
              <Text style={[styles.title, on && { color: info.color }]}>{info.label}</Text>
              <Text style={styles.blurb}>{info.blurb}</Text>
              {on && <Ionicons name="checkmark-circle" size={18} color={info.color} style={styles.tick} />}
            </TouchableOpacity>
          );
        })}
      </View>}

      {value === 'prize' ? (
        <>
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prize Pool (CAD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={prizePool}
                onChangeText={onPrizePool}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Entry Fee (CAD)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={entryFee}
                onChangeText={onEntryFee}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Prize pool is required. Entry fee per player is optional (leave 0 if the prize is sponsored).
            {fee > 0 && spots ? ` If every spot fills, entry fees add up to CAD ${(fee * spots).toLocaleString()}.` : ''}
          </Text>
        </>
      ) : (
        <View style={styles.friendlyNote}>
          <Text style={{ fontSize: 18 }}>🤝</Text>
          <Text style={styles.friendlyText}>Friendly {what} — free to join, no prize money. Just for the game.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  card: {
    flex: 1, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, padding: 12, gap: 4, backgroundColor: '#fff',
  },
  title: { fontSize: 15, fontWeight: '800', color: '#111827' },
  blurb: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  tick: { position: 'absolute', top: 10, right: 10 },
  twoCol: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#f9fafb', marginBottom: 12,
  },
  hint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginTop: -4, marginBottom: 14 },
  friendlyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e0f2fe',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  friendlyText: { flex: 1, fontSize: 13, color: '#075985', fontWeight: '600', lineHeight: 18 },
});
