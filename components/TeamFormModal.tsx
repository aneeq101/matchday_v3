import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView,
  Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export const TEAM_SPORTS = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton', 'Baseball', 'Hockey'];

export const TEAM_SPORT_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Basketball: '🏀', Tennis: '🎾',
  Badminton: '🏸', Baseball: '⚾', Hockey: '🏑',
};

export interface TeamFormValues {
  name: string;
  sport: string;
  area: string;
  description: string;
  isOpen: boolean;
  maxMembers: number;
}

const EMPTY: TeamFormValues = {
  name: '', sport: 'Football', area: '', description: '', isOpen: true, maxMembers: 12,
};

interface Props {
  visible: boolean;
  title: string;
  submitLabel: string;
  initial?: TeamFormValues;
  /** Sport can't be changed after creation */
  lockSport?: boolean;
  /** Current member count — max members can't go below it */
  minMembers?: number;
  onClose: () => void;
  onSubmit: (values: TeamFormValues) => Promise<string | null>; // returns error message or null
}

export default function TeamFormModal({
  visible, title, submitLabel, initial, lockSport, minMembers = 2, onClose, onSubmit,
}: Props) {
  const [values, setValues] = useState<TeamFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setValues(initial ?? EMPTY);
      setError('');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof TeamFormValues>(key: K, v: TeamFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const submit = async () => {
    if (!values.name.trim()) { setError('Please enter a team name.'); return; }
    setError('');
    setSaving(true);
    const err = await onSubmit(values);
    setSaving(false);
    if (err) setError(err);
  };

  const minMax = Math.max(2, minMembers);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Team Name *</Text>
                <TextInput
                  style={styles.input}
                  value={values.name}
                  onChangeText={(v) => set('name', v)}
                  placeholder="e.g. Sunday Strikers"
                  placeholderTextColor="#9ca3af"
                  maxLength={40}
                />

                <Text style={styles.label}>Sport</Text>
                {lockSport ? (
                  <Text style={styles.lockedSport}>{TEAM_SPORT_EMOJI[values.sport] ?? '🏆'} {values.sport}</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {TEAM_SPORTS.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.chip, values.sport === s && styles.chipActive]}
                          onPress={() => set('sport', s)}
                        >
                          <Text style={{ fontSize: 15 }}>{TEAM_SPORT_EMOJI[s]}</Text>
                          <Text style={[styles.chipText, values.sport === s && { color: '#fff' }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}

                <Text style={styles.label}>City / Area</Text>
                <TextInput
                  style={styles.input}
                  value={values.area}
                  onChangeText={(v) => set('area', v)}
                  placeholder="e.g. Toronto"
                  placeholderTextColor="#9ca3af"
                  maxLength={60}
                />

                <Text style={styles.label}>About the team</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={values.description}
                  onChangeText={(v) => set('description', v)}
                  placeholder="When you play, skill level, anything players should know"
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={200}
                />

                <Text style={styles.label}>Max Members</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => set('maxMembers', Math.max(minMax, values.maxMembers - 1))}
                  >
                    <Ionicons name="remove" size={20} color="#16a34a" />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{values.maxMembers}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => set('maxMembers', Math.min(50, values.maxMembers + 1))}
                  >
                    <Ionicons name="add" size={20} color="#16a34a" />
                  </TouchableOpacity>
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Open to everyone</Text>
                    <Text style={styles.switchSub}>
                      {values.isOpen ? 'Anyone can find and join this team' : 'Only players you add can join'}
                    </Text>
                  </View>
                  <Switch
                    value={values.isOpen}
                    onValueChange={(v) => set('isOpen', v)}
                    trackColor={{ false: '#d1d5db', true: '#86efac' }}
                    thumbColor={values.isOpen ? '#16a34a' : '#9ca3af'}
                  />
                </View>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitText}>{submitLabel}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: '88%', overflow: 'hidden',
  },
  handle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 16,
  },
  lockedSport: { fontSize: 15, color: '#374151', marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { color: '#374151', fontWeight: '500', fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0fdf4',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbf7d0',
  },
  stepValue: { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 30, textAlign: 'center' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  switchTitle: { fontWeight: '600', color: '#111827', fontSize: 14 },
  switchSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  submitBtn: { backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
