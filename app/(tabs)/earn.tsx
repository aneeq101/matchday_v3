import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ImageBackground,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const FIELD_IMAGE = 'https://image.pollinations.ai/prompt/close%20up%20ground%20level%20shot%20real%20football%20pitch%20grass%20sharp%20green%20grass%20blades%20foreground%20white%20painted%20center%20circle%20line%20shallow%20depth%20of%20field%20bokeh%20golden%20hour%20lighting%20photorealistic%20ultra%20detailed%20grass%20texture%20dew%20drops%20cinematic%20dark%20moody%20tone%20portrait%20no%20people?width=1080&height=1920&seed=42&nologo=true&model=flux';
import { TOURNAMENTS, type Tournament, type EventType } from '../../data/mockData';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchTournaments,
  fetchRegisteredIds,
  registerForTournament,
  unregisterFromTournament,
  eventCategory, eventIsPast,
} from '../../lib/tournaments';
import { entrantNouns } from '../../lib/sportRules';
import CreateEventModal from '../../components/CreateEventModal';


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
  { key: 'tournament', label: 'Tournaments' },
  { key: 'league', label: 'Leagues' },
  { key: 'match', label: 'Matches' },
];




export default function EarnScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [registerEvent, setRegisterEvent] = useState<Tournament | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [leaveEvent, setLeaveEvent] = useState<Tournament | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Play to Earn is prize money only — friendly events live in My Turf → Near me
  const filtered = events
    .filter((e) => eventCategory(e) === 'prize')
    .filter((e) => activeFilter === 'All' || e.type === activeFilter);
  // Finished / gone-by events sit in a collapsed "Past events" list under the open ones
  const upcoming = filtered.filter((e) => !eventIsPast(e));
  const past     = filtered.filter(eventIsPast);
  const filtersOn = activeFilter !== 'All';

  const handleRegister = async () => {
    if (!registerEvent || registering) return;
    setRegisterError('');

    if (!user) {
      setRegisteredIds((prev) => new Set(prev).add(registerEvent.id));
      setRegisterSuccess(true);
      setTimeout(() => {
        setRegisterSuccess(false);
        setRegisterEvent(null);
      }, 1600);
      return;
    }

    if (registerEvent.maxParticipants > 0 && registerEvent.participants >= registerEvent.maxParticipants) {
      setRegisterError('This event is full.');
      return;
    }

    setRegistering(true);
    const { ok, error } = await registerForTournament(registerEvent.id, user.id);
    setRegistering(false);

    if (!ok) {
      setRegisterError(error ?? 'Failed to register. Please try again.');
      return;
    }

    setRegisteredIds((prev) => new Set(prev).add(registerEvent.id));
    setEvents((prev) =>
      prev.map((e) =>
        e.id === registerEvent.id ? { ...e, participants: e.participants + 1 } : e
      )
    );
    setRegisterSuccess(true);
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
    } else {
      Alert.alert('Couldn\'t leave', 'Sign-ups for this event may already be closed. Pull down to refresh.');
    }
    setLeaving(false);
    setLeaveEvent(null);
  };


  return (
    <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.root} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <View style={styles.headerBg}>
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Play to Earn</Text>
                <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)} accessibilityRole="button">
                  <Ionicons name="add" size={18} color="#16a34a" />
                  <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </View>

      {/* Filter by event type */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTER_TABS.map((tab) => {
            const on = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, on && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.key)}
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.filterTabText, on && styles.filterTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
      >
        {upcoming.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="trophy-outline" size={40} color="#9ca3af" />
            <Text style={styles.emptyTitle}>{filtersOn ? 'No events match these filters' : 'No upcoming events'}</Text>
            <Text style={styles.emptyText}>
              {filtersOn ? 'Try another filter, or create the event you’re looking for.' : 'Start one — players nearby get an alert. Looking for a free game? See My Turf → Near me.'}
            </Text>
            <View style={styles.emptyActions}>
              {filtersOn && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveFilter('All')}>
                  <Text style={styles.emptyBtnText}>Clear filters</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.emptyBtnText}>Create event</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {upcoming.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            registered={registeredIds.has(event.id)}
            onOpen={() => router.push({ pathname: '/tournament', params: { id: event.id } })}
            onRegister={() => {
              if (event.entrantType === 'team') {
                router.push({ pathname: '/tournament', params: { id: event.id, join: '1' } });
              } else {
                setRegisterError('');
                setRegisterEvent(event);
              }
            }}
            onLeave={() => setLeaveEvent(event)}
          />
        ))}

        {/* Past events — only shown when tapped */}
        {past.length > 0 && (
          <TouchableOpacity
            style={styles.pastToggle}
            onPress={() => setShowPast((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPast }}
          >
            <Ionicons name="time-outline" size={18} color="#374151" />
            <Text style={styles.pastToggleText}>Past events ({past.length})</Text>
            <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={18} color="#374151" />
          </TouchableOpacity>
        )}
        {showPast && past.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            registered={registeredIds.has(event.id)}
            onOpen={() => router.push({ pathname: '/tournament', params: { id: event.id } })}
            onRegister={() => {
              if (event.entrantType === 'team') {
                router.push({ pathname: '/tournament', params: { id: event.id, join: '1' } });
              } else {
                setRegisterError('');
                setRegisterEvent(event);
              }
            }}
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
                    <Text style={styles.feeVal}>CAD {registerEvent.entryFee.toLocaleString()}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLbl}>Platform Fee</Text>
                    <Text style={styles.feeVal}>CAD 0</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLbl}>Total</Text>
                    <Text style={styles.feeTotalVal}>CAD {registerEvent.entryFee.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.paymentNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
                  <Text style={styles.paymentNoteText}>
                    Payment is collected at venue on day of event. No online payment required.
                  </Text>
                </View>

                {registerError !== '' && (
                  <Text style={styles.registerErrorText}>{registerError}</Text>
                )}

                {registerSuccess ? (
                  <View style={styles.successRow}>
                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                    <Text style={styles.successText}>Successfully Registered!</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.confirmBtn, registering && styles.confirmBtnDisabled]}
                    onPress={handleRegister}
                    disabled={registering}
                  >
                    {registering ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="trophy-outline" size={18} color="#fff" />
                        <Text style={styles.confirmBtnText}>Confirm Registration</Text>
                      </>
                    )}
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

      <CreateEventModal
        visible={showCreateModal}
        category="prize"
        onClose={() => setShowCreateModal(false)}
        onCreated={(saved) => setEvents((prev) => [saved, ...prev])}
      />
    </ImageBackground>
  );
}

function EventCard({
  event,
  registered,
  onOpen,
  onRegister,
  onLeave,
}: {
  event: Tournament;
  registered: boolean;
  onOpen: () => void;
  onRegister: () => void;
  onLeave: () => void;
}) {
  const progress = event.maxParticipants > 0 ? event.participants / event.maxParticipants : 0;
  const isFull = event.maxParticipants > 0 && event.participants >= event.maxParticipants;
  const typeColor = TYPE_COLORS[event.type];
  const status = event.status ?? 'active';
  const who = entrantNouns(event.entrantType, event.format).nouns;
  const hasDraw = event.type === 'tournament' || event.type === 'league';

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.eventTop}>
        <Text style={styles.eventEmoji}>{event.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[event.type]}</Text>
            </View>
            {!!event.format && (
              <View style={[styles.typeBadge, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[styles.typeBadgeText, { color: '#4b5563' }]}>{event.format}</Text>
              </View>
            )}
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
          {event.participants}/{event.maxParticipants} {who}
        </Text>
      </View>
      {hasDraw && status === 'active' && (event.minParticipants ?? 0) > 0 && (
        <Text style={styles.minText}>
          {event.participants >= (event.minParticipants ?? 2)
            ? `✓ Enough ${who} to start`
            : `Needs ${event.minParticipants} ${who} to start`}
        </Text>
      )}

      <View style={styles.eventFooter}>
        <View>
          {event.prizePool > 0 && (
            <Text style={styles.prizeAmount}>🏆 CAD {event.prizePool.toLocaleString()} prize</Text>
          )}
          <Text style={styles.feeLabel}>
            {event.entryFee > 0 ? `Entry CAD ${event.entryFee.toLocaleString()}` : 'Free entry'}
          </Text>
        </View>
        {status === 'completed' ? (
          <View style={[styles.statusBadge, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statusBadgeText, { color: '#b45309' }]} numberOfLines={1}>
              🏆 {event.championName ?? 'Finished'}
            </Text>
          </View>
        ) : status === 'in_progress' ? (
          <View style={[styles.statusBadge, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.statusBadgeText, { color: '#1d4ed8' }]}>
              {event.type === 'league' ? 'Live · See table' : 'Live · See bracket'}
            </Text>
          </View>
        ) : registered ? (
          <View style={styles.registeredRow}>
            <View style={styles.registeredBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
              <Text style={styles.registeredText}>Registered</Text>
            </View>
            <TouchableOpacity style={styles.leaveSmallBtn} onPress={onLeave}>
              <Text style={styles.leaveSmallText}>Leave</Text>
            </TouchableOpacity>
          </View>
        ) : isFull ? (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeText}>Event Full</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: typeColor }]}
            onPress={onRegister}
          >
            <Text style={styles.registerBtnText}>{event.entrantType === 'team' ? 'Enter Team' : 'Register Now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,2,0.38)' },
  safeHeader: { overflow: 'hidden' },
  headerBg: { width: '100%' },
  headerOverlay: { backgroundColor: 'rgba(0,0,0,0.18)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
  },
  createBtnText: { color: '#16a34a', fontWeight: '800', fontSize: 14 },
  filterBar: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: { backgroundColor: '#16a34a' },
  pastToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  pastToggleText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  emptyCard: {
    alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 16,
    paddingVertical: 28, paddingHorizontal: 18,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  emptyBtn: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  emptyBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  filterTabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  eventEmoji: { fontSize: 36, paddingTop: 2 },
  eventName: { fontWeight: '800', color: '#111827', fontSize: 15, lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 },
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
  prizeAmount: { color: '#16a34a', fontWeight: '800', fontSize: 14, marginBottom: 2 },
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
  fullBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  fullBadgeText: { color: '#6b7280', fontWeight: '700', fontSize: 13 },
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
    backgroundColor: 'rgba(255,255,255,0.98)',
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
  confirmBtnDisabled: { opacity: 0.6 },
  registerErrorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  successRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  successText: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  minText: { color: '#6b7280', fontSize: 12, marginTop: -6, marginBottom: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, maxWidth: 180 },
  statusBadgeText: { fontWeight: '700', fontSize: 12 },
});
