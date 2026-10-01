import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput,
  Platform, ActivityIndicator, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type Tournament, type EventType, type EventCategory } from '../data/mockData';
import { useAuth } from '../lib/AuthContext';
import { createTournament as dbCreateTournament, categoryMoney } from '../lib/tournaments';
import { getFormatsForSport, eventRules, MIN_ENTRANTS } from '../lib/sportRules';
import { toISODate } from '../lib/matchday';
import DatePickerField from './DatePickerField';
import CategoryPicker from './CategoryPicker';
import LocationPickerModal from './LocationPickerModal';

const TYPE_COLORS: Record<EventType, string> = {
  tournament: '#8b5cf6',
  league: '#3b82f6',
  match: '#16a34a',
};
const TYPE_LABELS: Record<EventType, string> = {
  tournament: 'Tournament',
  league: 'League',
  match: 'Match',
};
const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];
const EVENT_TYPES: EventType[] = ['tournament', 'league', 'match'];

/**
 * Create a tournament / league / match event. The category is fixed by where it's
 * opened: Play to Earn → 'prize' (prize pool required), My Turf → 'friendly' (free).
 */
export default function CreateEventModal({ visible, category, onClose, onCreated }: {
  visible: boolean;
  category: EventCategory;
  onClose: () => void;
  onCreated?: (event: Tournament) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState<EventType>('tournament');
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState('Football');
  const [newFormat, setNewFormat] = useState('3v3');
  const [newMaxParticipants, setNewMaxParticipants] = useState(6);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newCoord, setNewCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [newFee, setNewFee] = useState('');
  const [newPrize, setNewPrize] = useState('');
  const hasBracket = newType === 'tournament' || newType === 'league';
  // Who signs up + sensible limits follow from sport, format and event type
  const rules = eventRules(newSport, newType === 'league' ? 'league' : 'tournament', newFormat);
  const [newMin, setNewMin] = useState(rules.defMin);
  const [newMax, setNewMax] = useState(rules.defMax);

  useEffect(() => {
    const formats = getFormatsForSport(newSport);
    if (formats.length > 0) {
      setNewFormat(formats[0].format);
      setNewMaxParticipants(formats[0].maxPlayers);
    }
  }, [newSport]);

  // Reset limits to sensible defaults when what's being organised changes
  useEffect(() => {
    setNewMin(rules.defMin);
    setNewMax(rules.defMax);
  }, [rules.defMin, rules.defMax, rules.entrant, rules.noun]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter an event name.');
      return;
    }
    if (newDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      if (selected < today) {
        Alert.alert('Invalid date', 'Event date cannot be in the past.');
        return;
      }
    }
    if (hasBracket) {
      if (newMin < rules.min || newMax > rules.max || newMin > newMax) {
        Alert.alert(
          'Check sign-up limits',
          `You need at least ${rules.min} ${rules.nouns}, and at most ${rules.max}.`,
        );
        return;
      }
    }
    const { entryFee: fee, prizePool: prize, error: moneyError } = categoryMoney(category, newFee, newPrize);
    if (moneyError) {
      Alert.alert('Add a prize pool', moneyError);
      return;
    }
    setSaving(true);
    try {
      const formattedDate = newDate
        ? newDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : 'TBD';
      const saved = await dbCreateTournament(
        {
          name: newName.trim(),
          type: newType,
          sport: newSport,
          date: formattedDate,
          location: newLocation || '',
          latitude: newCoord?.latitude ?? null,
          longitude: newCoord?.longitude ?? null,
          entryFee: fee,
          prizePool: prize,
          category,
          maxParticipants: hasBracket ? newMax : newMaxParticipants,
          // A single match needs its full line-up (e.g. 5v5 → 10 players)
          minParticipants: hasBracket ? newMin : newMaxParticipants,
          entrantType: hasBracket ? rules.entrant : 'player',
          format: newFormat,
          startsOn: newDate ? toISODate(newDate) : null,
        },
        user?.id ?? null
      );

      if (!saved) {
        Alert.alert('Error', 'Failed to save event. Please try again.');
        setSaving(false);
        return;
      }

      onCreated?.(saved);
      onClose();
      // Show the new event straight away — including its empty bracket
      if (hasBracket) router.push({ pathname: '/tournament', params: { id: saved.id } });
      setNewName('');
      setNewType('tournament');
      setNewSport('Football');
      setNewFormat('3v3');
      setNewMaxParticipants(6);
      setNewDate(null);
      setNewLocation('');
      setNewCoord(null);
      setNewFee('');
      setNewPrize('');
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.sheetOverlay}>
        <KeyboardAvoidingView
          style={styles.createSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{category === 'prize' ? 'Create Prize Event' : 'Create Friendly Event'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
            <Text style={styles.fieldLabel}>Event Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    newType === t && { backgroundColor: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] },
                  ]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeChipText, newType === t && { color: '#fff' }]}>
                    {TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <CategoryPicker
              locked
              value={category}
              onChange={() => {}}
              entryFee={newFee}
              prizePool={newPrize}
              onEntryFee={setNewFee}
              onPrizePool={setNewPrize}
              spots={hasBracket ? newMax : newMaxParticipants}
              what={newType === 'match' ? 'match' : newType}
            />

            <Text style={styles.fieldLabel}>Event Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. GTA Summer Cup"
              placeholderTextColor="#9ca3af"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.fieldLabel}>Sport</Text>
            <View style={styles.sportGrid}>
              {SPORTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, newSport === s && styles.sportChipActive]}
                  onPress={() => setNewSport(s)}
                >
                  <Text style={[styles.sportChipText, newSport === s && styles.sportChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Format</Text>
            <View style={styles.sportGrid}>
              {getFormatsForSport(newSport).map((f) => (
                <TouchableOpacity
                  key={f.format}
                  style={[styles.sportChip, newFormat === f.format && styles.sportChipActive]}
                  onPress={() => { setNewFormat(f.format); setNewMaxParticipants(f.maxPlayers); }}
                >
                  <Text style={[styles.sportChipText, newFormat === f.format && styles.sportChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {hasBracket ? (
              <>
                <Text style={styles.formatHint}>Format of each game</Text>

                <View style={styles.whoRow}>
                  <Ionicons name={rules.entrant === 'player' ? 'person' : 'people'} size={16} color="#16a34a" />
                  <Text style={styles.whoText}>{rules.who}</Text>
                </View>

                <View style={styles.twoCol}>
                  <Stepper
                    label={`Minimum ${rules.nouns}`}
                    value={newMin}
                    min={rules.min}
                    max={newMax}
                    onChange={setNewMin}
                  />
                  <Stepper
                    label={`Maximum ${rules.nouns}`}
                    value={newMax}
                    min={Math.max(newMin, MIN_ENTRANTS)}
                    max={rules.max}
                    onChange={setNewMax}
                  />
                </View>
                <View style={styles.bracketHint}>
                  <Ionicons name="git-network-outline" size={16} color="#8b5cf6" />
                  <Text style={styles.bracketHintText}>
                    {newType === 'league'
                      ? `Needs at least ${newMin} ${rules.nouns}. Fixtures are created when you start the league — everyone plays everyone once.`
                      : `Needs at least ${newMin} ${rules.nouns} (a knockout needs semi-finals and a final). The bracket is drawn randomly when you start it; extra places become byes.`}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.formatHint}>
                Needs the full line-up: {newMaxParticipants} players
              </Text>
            )}

            <Text style={styles.fieldLabel}>Date</Text>
            <DatePickerField
              value={newDate}
              onChange={setNewDate}
              placeholder="Select event date"
            />

            <Text style={styles.fieldLabel}>Location</Text>
            <TouchableOpacity
              style={styles.locationTrigger}
              onPress={() => setShowLocationPicker(true)}
            >
              <Ionicons name="location-outline" size={18} color={newLocation ? '#111827' : '#9ca3af'} />
              <Text style={[styles.locationTriggerText, !newLocation && { color: '#9ca3af' }]} numberOfLines={1}>
                {newLocation || 'Pick location from map'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="add-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Create Event</Text></>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <LocationPickerModal
      visible={showLocationPicker}
      sport={newSport}
      onSelect={(loc, coord) => { setNewLocation(loc); setNewCoord(coord ?? null); setShowLocationPicker(false); }}
      onClose={() => setShowLocationPicker(false)}
    />
    </>
  );
}

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  return (
    <View style={{ flex: 1, marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
          <Ionicons name="remove" size={18} color={value <= min ? '#d1d5db' : '#111827'} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
          <Ionicons name="add" size={18} color={value >= max ? '#d1d5db' : '#111827'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bracketHint: {
    flexDirection: 'row', gap: 8, backgroundColor: '#f5f3ff', borderRadius: 10, padding: 12, marginBottom: 14,
  },
  bracketHintText: { flex: 1, color: '#5b21b6', fontSize: 12, lineHeight: 18 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  createSheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
  },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  formContent: { padding: 16 },
  formInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 14,
  },
  formatHint: { color: '#6b7280', fontSize: 12, marginTop: -6, marginBottom: 14 },
  locationTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 13,
    marginBottom: 14,
  },
  locationTriggerText: { flex: 1, fontSize: 14, color: '#111827' },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  sportChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  sportChipText: { color: '#6b7280', fontSize: 13 },
  sportChipTextActive: { color: '#fff' },
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  typeChipText: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  whoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4',
    borderRadius: 10, padding: 10, marginBottom: 14,
  },
  whoText: { flex: 1, color: '#166534', fontSize: 13, fontWeight: '600' },
});
