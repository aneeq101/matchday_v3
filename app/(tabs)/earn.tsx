import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ImageBackground,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';
import { TOURNAMENTS, type Tournament, type EventType } from '../../data/mockData';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchTournaments,
  fetchRegisteredIds,
  registerForTournament,
  unregisterFromTournament,
  createTournament as dbCreateTournament,
} from '../../lib/tournaments';
import { getFormatsForSport } from '../../lib/sportRules';


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

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: 'All', label: 'All' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'league', label: 'League' },
  { key: 'match', label: 'Match' },
];

const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];
const EVENT_TYPES: EventType[] = ['tournament', 'league', 'match'];

export default function EarnScreen() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [registerEvent, setRegisterEvent] = useState<Tournament | null>(null);
  const [leaveEvent, setLeaveEvent] = useState<Tournament | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create event form
  const [newType, setNewType] = useState<EventType>('tournament');
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState('Football');
  const [newFormat, setNewFormat] = useState('3v3');
  const [newMaxParticipants, setNewMaxParticipants] = useState(6);
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newFee, setNewFee] = useState('');
  const [newPrize, setNewPrize] = useState('');

  const [events, setEvents] = useState<Tournament[]>(TOURNAMENTS);

  const loadData = useCallback(async () => {
    const [dbEvents, regIds] = await Promise.all([
      fetchTournaments(),
      user ? fetchRegisteredIds(user.id) : Promise.resolve(new Set<string>()),
    ]);
    setEvents(dbEvents);
    setRegisteredIds(regIds);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const formats = getFormatsForSport(newSport);
    if (formats.length > 0) {
      setNewFormat(formats[0].format);
      setNewMaxParticipants(formats[0].maxPlayers);
    }
  }, [newSport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = activeFilter === 'All' ? events : events.filter((e) => e.type === activeFilter);

  const handleRegister = async () => {
    if (!registerEvent) return;
    setRegisterSuccess(true);
    if (user) {
      await registerForTournament(registerEvent.id, user.id);
      setRegisteredIds((prev) => new Set(prev).add(registerEvent.id));
      // Increment local count
      setEvents((prev) =>
        prev.map((e) =>
          e.id === registerEvent.id ? { ...e, participants: e.participants + 1 } : e
        )
      );
    } else {
      setRegisteredIds((prev) => new Set(prev).add(registerEvent.id));
    }
    setTimeout(() => {
      setRegisterSuccess(false);
      setRegisterEvent(null);
    }, 1600);
  };

  const handleLeave = async () => {
    if (!leaveEvent || !user) return;
    setLeaving(true);
    const ok = await unregisterFromTournament(leaveEvent.id, user.id);
    if (ok) {
      setRegisteredIds((prev) => {
        const next = new Set(prev);
        next.delete(leaveEvent.id);
        return next;
      });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === leaveEvent.id
            ? { ...e, participants: Math.max(0, e.participants - 1) }
            : e
        )
      );
    }
    setLeaving(false);
    setLeaveEvent(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    const saved = await dbCreateTournament(
      {
        name: newName || 'New Event',
        type: newType,
        sport: newSport,
        date: newDate || 'TBD',
        location: newLocation || '',
        entryFee: parseInt(newFee) || 0,
        prizePool: parseInt(newPrize) || 0,
        maxParticipants: newMaxParticipants,
      },
      user?.id ?? null
    );

    const newEvent: Tournament = saved ?? {
      id: String(Date.now()),
      name: newName || 'New Event',
      type: newType,
      sport: newSport,
      sportEmoji: ({ Football: '⚽', Cricket: '🏏', Tennis: '🎾', Basketball: '🏀', Badminton: '🏸', Baseball: '⚾' } as Record<string, string>)[newSport] || '🏆',
      date: newDate || 'TBD',
      location: newLocation || '',
      participants: 0,
      maxParticipants: newMaxParticipants,
      entryFee: parseInt(newFee) || 0,
      prizePool: parseInt(newPrize) || 0,
    };

    setEvents((prev) => [newEvent, ...prev]);
    setSaving(false);
    setShowCreateModal(false);
    setNewName('');
    setNewSport('Football');
    setNewFormat('3v3');
    setNewMaxParticipants(6);
    setNewDate('');
    setNewLocation('');
    setNewFee('');
    setNewPrize('');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Play to Earn</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                  <Ionicons name="add-circle-outline" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
      >
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No events in this category yet</Text>
          </View>
        )}
        {filtered.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            registered={registeredIds.has(event.id)}
            onRegister={() => setRegisterEvent(event)}
            onLeave={() => setLeaveEvent(event)}
          />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Register Modal */}
      <Modal visible={!!registerEvent} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Register for Event</Text>
              <TouchableOpacity onPress={() => setRegisterEvent(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {registerEvent && (
              <ScrollView contentContainerStyle={styles.sheetContent}>
                <View style={styles.eventSummary}>
                  <Text style={styles.eventSummaryEmoji}>{registerEvent.sportEmoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventSummaryName}>{registerEvent.name}</Text>
                    <Text style={styles.eventSummaryMeta}>{registerEvent.date} · {registerEvent.location}</Text>
                  </View>
                </View>

                <View style={styles.feeBox}>
                  <Text style={styles.feeTitle}>Fee Breakdown</Text>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLbl}>Entry Fee</Text>
                    <Text style={styles.feeVal}>PKR {registerEvent.entryFee.toLocaleString()}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLbl}>Platform Fee</Text>
                    <Text style={styles.feeVal}>PKR 0</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLbl}>Total</Text>
                    <Text style={styles.feeTotalVal}>PKR {registerEvent.entryFee.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.paymentNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
                  <Text style={styles.paymentNoteText}>
                    Payment is collected at venue on day of event. No online payment required.
                  </Text>
                </View>

                {registerSuccess ? (
                  <View style={styles.successRow}>
                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                    <Text style={styles.successText}>Successfully Registered!</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleRegister}>
                    <Ionicons name="trophy-outline" size={18} color="#fff" />
                    <Text style={styles.confirmBtnText}>Confirm Registration</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Leave Event Modal */}
      <Modal visible={!!leaveEvent} animationType="fade" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Leave Event</Text>
              <TouchableOpacity onPress={() => setLeaveEvent(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {leaveEvent && (
              <View style={styles.sheetContent}>
                <Text style={styles.leaveText}>
                  Are you sure you want to leave{' '}
                  <Text style={{ fontWeight: '700' }}>{leaveEvent.name}</Text>?
                </Text>
                <View style={styles.leaveActions}>
                  <TouchableOpacity
                    style={styles.leaveCancelBtn}
                    onPress={() => setLeaveEvent(null)}
                  >
                    <Text style={styles.leaveCancelText}>Keep Spot</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.leaveConfirmBtn}
                    onPress={handleLeave}
                    disabled={leaving}
                  >
                    {leaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.leaveConfirmText}>Leave</Text>
                    }
                  </TouchableOpacity>
                </View>
                <View style={{ height: 20 }} />
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Create Event Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Create Event</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formContent}>
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

              <Text style={styles.fieldLabel}>Event Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Lahore Summer Cup"
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
              <Text style={styles.formatHint}>Max {newMaxParticipants} players total</Text>

              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Jun 30, 2025"
                placeholderTextColor="#9ca3af"
                value={newDate}
                onChangeText={setNewDate}
              />

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Model Town Sports Complex"
                placeholderTextColor="#9ca3af"
                value={newLocation}
                onChangeText={setNewLocation}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Entry Fee (PKR)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={newFee}
                    onChangeText={setNewFee}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prize Pool (PKR)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={newPrize}
                    onChangeText={setNewPrize}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="add-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Create Event</Text></>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function EventCard({
  event,
  registered,
  onRegister,
  onLeave,
}: {
  event: Tournament;
  registered: boolean;
  onRegister: () => void;
  onLeave: () => void;
}) {
  const progress = event.maxParticipants > 0 ? event.participants / event.maxParticipants : 0;
  const typeColor = TYPE_COLORS[event.type];

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventTop}>
        <Text style={styles.eventEmoji}>{event.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[event.type]}</Text>
            </View>
          </View>
          <View style={styles.eventMeta}>
            <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
            <Text style={styles.eventMetaText}>{event.date}</Text>
          </View>
          <View style={styles.eventMeta}>
            <Ionicons name="location-outline" size={12} color="#9ca3af" />
            <Text style={styles.eventMetaText}>{event.location}</Text>
          </View>
        </View>
      </View>

      {/* Participants bar */}
      <View style={styles.participantsRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: typeColor }]} />
        </View>
        <Text style={styles.participantsText}>
          {event.participants}/{event.maxParticipants} players
        </Text>
      </View>

      <View style={styles.eventFooter}>
        <View>
          <Text style={styles.feeLabel}>Entry: <Text style={styles.feeAmount}>PKR {event.entryFee.toLocaleString()}</Text></Text>
          {event.prizePool > 0 && (
            <Text style={styles.prizeLabel}>Prize: <Text style={styles.prizeAmount}>PKR {event.prizePool.toLocaleString()}</Text></Text>
          )}
        </View>
        {registered ? (
          <View style={styles.registeredRow}>
            <View style={styles.registeredBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
              <Text style={styles.registeredText}>Registered</Text>
            </View>
            <TouchableOpacity style={styles.leaveSmallBtn} onPress={onLeave}>
              <Text style={styles.leaveSmallText}>Leave</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: typeColor }]}
            onPress={onRegister}
          >
            <Text style={styles.registerBtnText}>Register Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  safeHeader: { overflow: 'hidden' },
  headerBg: { width: '100%' },
  headerOverlay: { backgroundColor: 'rgba(0,0,0,0.40)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 6,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: { backgroundColor: '#16a34a' },
  filterTabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#9ca3af', fontSize: 14, marginTop: 12 },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  eventEmoji: { fontSize: 36, paddingTop: 2 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eventName: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  eventMetaText: { color: '#6b7280', fontSize: 12 },
  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  participantsText: { color: '#6b7280', fontSize: 12 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeLabel: { color: '#6b7280', fontSize: 13 },
  feeAmount: { color: '#374151', fontWeight: '700' },
  prizeLabel: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  prizeAmount: { color: '#16a34a', fontWeight: '700' },
  registerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  registeredRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  registeredText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  leaveSmallBtn: {
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  leaveSmallText: { color: '#ef4444', fontWeight: '600', fontSize: 12 },
  leaveText: { color: '#374151', fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  leaveActions: { flexDirection: 'row', gap: 12 },
  leaveCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  leaveCancelText: { color: '#6b7280', fontWeight: '700', fontSize: 15 },
  leaveConfirmBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  leaveConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
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
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sheetContent: { padding: 20 },
  eventSummary: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  eventSummaryEmoji: { fontSize: 32 },
  eventSummaryName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  eventSummaryMeta: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  feeBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  feeTitle: { fontWeight: '700', color: '#111827', marginBottom: 10 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feeLbl: { color: '#6b7280', fontSize: 13 },
  feeVal: { color: '#374151', fontWeight: '600', fontSize: 13 },
  feeTotalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 2 },
  feeTotalLbl: { fontWeight: '700', color: '#111827' },
  feeTotalVal: { fontWeight: '700', color: '#16a34a', fontSize: 15 },
  paymentNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  paymentNoteText: { color: '#3b82f6', fontSize: 12, flex: 1, lineHeight: 18 },
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
  successRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  successText: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  formContent: { padding: 16 },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
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
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
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
  formatHint: { color: '#6b7280', fontSize: 12, marginTop: -6, marginBottom: 14 },
  twoCol: { flexDirection: 'row', gap: 10 },
});
