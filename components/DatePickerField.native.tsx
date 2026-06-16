import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function DatePickerField({
  value, onChange, placeholder = 'Select date',
}: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  const handleOpen = () => {
    setTempDate(value ?? new Date());
    setShow(true);
  };

  const handleConfirm = () => {
    setShow(false);
    onChange(tempDate);
  };

  const handleAndroidChange = (_: DateTimePickerEvent, d?: Date) => {
    setShow(false);
    if (d) onChange(d);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={handleOpen}>
        <Ionicons name="calendar-outline" size={18} color={value ? '#111827' : '#9ca3af'} />
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelBtn}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Select Date</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.doneBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                accentColor="#16a34a"
                onChange={(_, d) => { if (d) setTempDate(d); }}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleAndroidChange}
          />
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
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
  triggerText: { flex: 1, fontSize: 14, color: '#111827' },
  placeholder: { color: '#9ca3af' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontWeight: '700', fontSize: 16, color: '#111827' },
  doneBtn:   { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  cancelBtn: { color: '#6b7280', fontSize: 15 },
});
