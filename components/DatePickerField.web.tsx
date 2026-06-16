import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
}

function toInputValue(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function DatePickerField({ value, onChange, placeholder = 'Select date' }: Props) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name="calendar-outline" size={18} color={value ? '#111827' : '#9ca3af'} />
      <Text style={[styles.label, !value && styles.placeholder]}>
        {value ? formatDate(value) : placeholder}
      </Text>
      {/* Transparent native date input laid over the styled row */}
      <input
        type="date"
        value={toInputValue(value)}
        min={toInputValue(new Date())}
        onChange={(e) => {
          if (e.target.value) onChange(new Date(e.target.value + 'T12:00:00'));
        }}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  label:   { flex: 1, fontSize: 14, color: '#111827' },
  placeholder: { color: '#9ca3af' },
});
