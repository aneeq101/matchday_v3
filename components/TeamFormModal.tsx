import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView,
  Switch, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { teamFormatsFor, teamFormat, squadNote } from '../lib/sportRules';

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
  format: string;
}

const EMPTY: TeamFormValues = {
  name: '', sport: 'Football', area: '', description: '', isOpen: true, maxMembers: 18, format: '11-a-side',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  visible, title, submitLabel, initial, lockSport, minMembers = 1, onClose, onSubmit,
}: Props) {
  const [values, setValues] = useState<TeamFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      const v = initial ?? EMPTY;
      // Older teams may have no format saved — use the one that fits them
      const f = teamFormat(v.sport, v.format);
      setValues(f ? { ...v, format: f.format } : v);
      setError('');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof TeamFormValues>(key: K, v: TeamFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const fmt = teamFormat(values.sport, values.format);
  const formats = teamFormatsFor(values.sport);
  const lo = fmt ? Math.max(fmt.min, minMembers) : Math.max(2, minMembers);
  const hi = fmt ? fmt.max : 50;

  const chooseSport = (sport: string) => {
    const f = teamFormat(sport);
    setValues((prev) => ({
      ...prev, sport,
      format: f?.format ?? '',
      maxMembers: f ? clamp(f.def, Math.max(f.min, minMembers), f.max) : prev.maxMembers,
    }));
  };

  const chooseFormat = (format: string) => {
    const f = teamFormat(values.sport, format);
    if (!f) return;
    setValues((prev) => ({ ...prev, format, maxMembers: clamp(f.def, Math.max(f.min, minMembers), f.max) }));
  };

  const submit = async () => {
    if (!values.name.trim()) { setError('Please enter a team name.'); return; }
    if (fmt && (values.maxMembers < fmt.min || values.maxMembers > fmt.max)) {
      setError(`${values.sport} ${fmt.label} teams have ${fmt.min}–${fmt.max} players.`);
      return;
    }
    if (values.maxMembers < minMembers) {
      setError(`The team already has ${minMembers} members.`);
      return;
    }
    setError('');
    setSaving(true);
    const err = await onSubmit(values);
    setSaving(false);
    if (err) setError(err);
  };

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
                          onPress={() => chooseSport(s)}
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

                {formats.length > 1 && (
                  <>
                    <Text style={styles.label}>Format</Text>
                    <View style={styles.formatRow}>
                      {formats.map((f) => {
                        const tooSmall = minMembers > f.max;
                        const on = values.format === f.format;
                        return (
                          <TouchableOpacity
                            key={f.format}
                            style={[styles.chip, on && styles.chipActive, tooSmall && styles.chipDisabled]}
                            onPress={() => chooseFormat(f.format)}
                            disabled={tooSmall}
                          >
                            <Text style={[styles.chipText, on && { color: '#fff' }]}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={styles.label}>Squad Size</Text>
                {fmt && fmt.min === fmt.max ? (
                  <View style={styles.fixedSize}>
                    <Ionicons name="people" size={18} color="#16a34a" />
                    <Text style={styles.fixedSizeText}>{fmt.max} players · {fmt.label}</Text>
                  </View>
                ) : (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, values.maxMembers <= lo && styles.stepBtnOff]}
                      onPress={() => set('maxMembers', clamp(values.maxMembers - 1, lo, hi))}
                      disabled={values.maxMembers <= lo}
                      accessibilityLabel="Fewer players"
                    >
                      <Ionicons name="remove" size={20} color="#16a34a" />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{values.maxMembers}</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, values.maxMembers >= hi && styles.stepBtnOff]}
                      onPress={() => set('maxMembers', clamp(values.maxMembers + 1, lo, hi))}
                      disabled={values.maxMembers >= hi}
                      accessibilityLabel="More players"
                    >
                      <Ionicons name="add" size={20} color="#16a34a" />
                    </TouchableOpacity>
                  </View>
                )}
                {fmt && <Text style={styles.sizeNote}>{squadNote(fmt, values.maxMembers)}</Text>}

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
  chipDisabled: { opacity: 0.4 },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  fixedSize: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  fixedSizeText: { fontSize: 15, fontWeight: '700', color: '#166534' },
  sizeNote: { fontSize: 12, color: '#6b7280', marginTop: -8, marginBottom: 16 },
  stepBtnOff: { opacity: 0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
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
