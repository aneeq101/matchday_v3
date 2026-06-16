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
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { fetchMyMatches, createMatch, cancelMatch, fetchMyTournamentCount } from '../../lib/matches';
import { type Booking, type MatchItem } from '../../data/mockData';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';

const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];
const FORMATS = ['2v2', '5v5', '6v6', '11v11', 'Open/Any'];

function sportEmoji(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return '⚽';
  if (s.includes('cricket'))    return '🏏';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('tennis'))     return '🎾';
  if (s.includes('badminton'))  return '🏸';
  if (s.includes('baseball'))   return '⚾';
  return '🏟️';
}

function dbToBooking(row: Record<string, unknown>): Booking {
  const statusRaw = (row.status as string | null) ?? 'confirmed';
  const status: Booking['status'] =
    statusRaw === 'cancelled' ? 'Cancelled' :
    statusRaw === 'confirmed' ? 'Confirmed' : 'Pending';
  return {
    id:              row.id as string,
    venueName:       (row.venue_name as string) ?? 'Venue',
    sport:           (row.sport as string) ?? 'Sport',
    sportEmoji:      sportEmoji((row.sport as string) ?? ''),
    date:            (row.date as string) ?? '',
    time:            (row.time_slot as string) ?? '',
    price:           (row.total_price as number) ?? 0,
    status,
    duration:        (row.duration_hours as number) ?? undefined,
    players:         (row.players_count as number) ?? undefined,
    address:         (row.venue_address as string) ?? undefined,
    specialRequests: (row.special_requests as string) ?? undefined,
  };
}

export default function MyTurfScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [bookings, setBookings]             = useState<Booking[]>([]);
  const [matches, setMatches]               = useState<MatchItem[]>([]);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedMatch, setSelectedMatch]     = useState<MatchItem | null>(null);
  const [notifVisible, setNotifVisible]       = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Create Match modal
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [matchTitle, setMatchTitle]           = useState('');
  const [matchSport, setMatchSport]           = useState('Football');
  const [matchFormat, setMatchFormat]         = useState('11v11');
  const [matchDate, setMatchDate]             = useState('');
  const [matchLocation, setMatchLocation]     = useState('');
  const [creatingMatch, setCreatingMatch]     = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [bData, mData, tCount] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      fetchMyMatches(user.id),
      fetchMyTournamentCount(user.id),
    ]);

    if (!bData.error && bData.data) {
      setBookings(bData.data.map(dbToBooking));
    }
    setMatches(mData);
    setTournamentCount(tCount);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setCancellingBooking(true);

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', selectedBooking.id);

    if (!error) {
      const updated: Booking = { ...selectedBooking, status: 'Cancelled' };
      setBookings((prev) => prev.map((b) => b.id === selectedBooking.id ? updated : b));
      setSelectedBooking(updated);
    }
    setCancellingBooking(false);
  };

  const handleCreateMatch = async () => {
    if (!user || !matchTitle.trim() || !matchDate.trim() || !matchLocation.trim()) return;
    setCreatingMatch(true);

    const newMatch = await createMatch({
      userId:        user.id,
      title:         matchTitle.trim(),
      sport:         matchSport,
      playersFormat: matchFormat,
      matchDate:     matchDate.trim(),
      location:      matchLocation.trim(),
    });

    if (newMatch) {
      setMatches((prev) => [newMatch, ...prev]);
    }

    setCreatingMatch(false);
    setShowCreateMatch(false);
    setMatchTitle('');
    setMatchDate('');
    setMatchLocation('');
  };

  const upcomingBookings = bookings.filter((b) => b.status !== 'Cancelled');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>My Turf</Text>
                <TouchableOpacity onPress={() => setNotifVisible(true)}>
                  <View>
                    <Ionicons name="notifications-outline" size={24} color="#fff" />
                    <View style={styles.notifDot} />
                  </View>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{bookings.length}</Text>
            <Text style={styles.statLbl}>Bookings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{matches.length}</Text>
            <Text style={styles.statLbl}>Matches</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>{tournamentCount}</Text>
            <Text style={styles.statLbl}>Tournaments</Text>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        {loading && <ActivityIndicator color="#16a34a" style={{ marginVertical: 12 }} />}
        {!loading && upcomingBookings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>No upcoming bookings</Text>
            <Text style={styles.emptySubText}>Book a venue to see it here</Text>
          </View>
        )}
        {upcomingBookings.map((b) => (
          <BookingCard key={b.id} booking={b} onPress={() => setSelectedBooking(b)} />
        ))}

        {/* My Matches */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>My Matches</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateMatch(true)}>
            <Ionicons name="add" size={16} color="#16a34a" />
            <Text style={styles.addBtnText}>Organize</Text>
          </TouchableOpacity>
        </View>
        {!loading && matches.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="football-outline" size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>No matches yet</Text>
            <TouchableOpacity onPress={() => setShowCreateMatch(true)}>
              <Text style={styles.emptyAction}>Organize a match</Text>
            </TouchableOpacity>
          </View>
        )}
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />
        ))}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'calendar-outline' as const,  label: 'New Booking',     color: '#16a34a', onPress: () => router.push('/(tabs)/book') },
            { icon: 'football-outline' as const,   label: 'Organize Match',  color: '#3b82f6', onPress: () => setShowCreateMatch(true) },
            { icon: 'trophy-outline' as const,     label: 'My Tournaments',  color: '#f59e0b', onPress: () => {} },
            { icon: 'people-outline' as const,     label: 'My Teams',        color: '#8b5cf6', onPress: () => {} },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickBtn} onPress={action.onPress}>
              <View style={[styles.quickIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Booking Detail Modal */}
      <Modal visible={!!selectedBooking} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Booking Details</Text>
              <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {selectedBooking && (
              <ScrollView contentContainerStyle={styles.sheetContent}>
                <View style={[styles.sheetIconCircle, { backgroundColor: '#dcfce7' }]}>
                  <Text style={{ fontSize: 36 }}>{selectedBooking.sportEmoji}</Text>
                </View>
                <Text style={styles.sheetVenueName}>{selectedBooking.venueName}</Text>
                <StatusBadge status={selectedBooking.status} />

                <View style={styles.detailGrid}>
                  {[
                    { icon: 'football-outline' as const, label: 'Sport',   value: selectedBooking.sport },
                    { icon: 'calendar-outline' as const, label: 'Date',    value: selectedBooking.date },
                    { icon: 'time-outline' as const,     label: 'Time',    value: selectedBooking.time },
                    ...(selectedBooking.duration ? [{ icon: 'hourglass-outline' as const, label: 'Duration', value: `${selectedBooking.duration}h` }] : []),
                    ...(selectedBooking.players  ? [{ icon: 'people-outline' as const,   label: 'Players',  value: String(selectedBooking.players) }] : []),
                    ...(selectedBooking.address  ? [{ icon: 'location-outline' as const, label: 'Address',  value: selectedBooking.address }] : []),
                    { icon: 'cash-outline' as const,     label: 'Total',   value: `PKR ${selectedBooking.price.toLocaleString()}` },
                  ].map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name={row.icon} size={18} color="#16a34a" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                  {selectedBooking.specialRequests ? (
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name="chatbox-outline" size={18} color="#16a34a" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>Special Requests</Text>
                        <Text style={styles.detailValue}>{selectedBooking.specialRequests}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {selectedBooking.status !== 'Cancelled' && (
                  <TouchableOpacity
                    style={styles.cancelBookingBtn}
                    onPress={handleCancelBooking}
                    disabled={cancellingBooking}
                  >
                    {cancellingBooking
                      ? <ActivityIndicator size="small" color="#ef4444" />
                      : <Text style={styles.cancelBookingText}>Cancel Booking</Text>
                    }
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Match Detail Modal */}
      <Modal visible={!!selectedMatch} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Match Details</Text>
              <TouchableOpacity onPress={() => setSelectedMatch(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {selectedMatch && (
              <ScrollView contentContainerStyle={styles.sheetContent}>
                <View style={[styles.sheetIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Text style={{ fontSize: 40 }}>{selectedMatch.sportEmoji}</Text>
                </View>
                <Text style={styles.sheetVenueName}>{selectedMatch.title}</Text>
                <View style={styles.detailGrid}>
                  {[
                    { icon: 'football-outline' as const,  label: 'Sport',       value: selectedMatch.sport },
                    { icon: 'people-outline' as const,    label: 'Format',      value: selectedMatch.players },
                    { icon: 'time-outline' as const,      label: 'Date & Time', value: selectedMatch.date },
                    { icon: 'location-outline' as const,  label: 'Venue',       value: selectedMatch.location },
                  ].map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name={row.icon} size={18} color="#16a34a" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setSelectedMatch(null)}>
                  <Text style={styles.primaryBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Create Match Modal */}
      <Modal visible={showCreateMatch} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Organize a Match</Text>
              <TouchableOpacity onPress={() => setShowCreateMatch(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <TextInput
                style={styles.input}
                placeholder="Match title (e.g. Sunday Kickabout)"
                placeholderTextColor="#9ca3af"
                value={matchTitle}
                onChangeText={setMatchTitle}
              />

              <Text style={styles.fieldLabel}>Sport</Text>
              <View style={styles.pillRow}>
                {SPORTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, matchSport === s && styles.pillActive]}
                    onPress={() => setMatchSport(s)}
                  >
                    <Text style={[styles.pillText, matchSport === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Format</Text>
              <View style={styles.pillRow}>
                {FORMATS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.pill, matchFormat === f && styles.pillActive]}
                    onPress={() => setMatchFormat(f)}
                  >
                    <Text style={[styles.pillText, matchFormat === f && styles.pillTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Date & time (e.g. Sat Jun 21 at 5 PM)"
                placeholderTextColor="#9ca3af"
                value={matchDate}
                onChangeText={setMatchDate}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                placeholderTextColor="#9ca3af"
                value={matchLocation}
                onChangeText={setMatchLocation}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 4 }]}
                onPress={handleCreateMatch}
                disabled={creatingMatch || !matchTitle.trim() || !matchDate.trim() || !matchLocation.trim()}
              >
                {creatingMatch
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Create Match</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Notification Modal */}
      <Modal visible={notifVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.centeredOverlay} activeOpacity={1} onPress={() => setNotifVisible(false)}>
          <View style={styles.notifBox}>
            <Text style={styles.notifTitle}>Notifications</Text>
            {[
              { icon: 'checkmark-circle' as const, color: '#16a34a', text: 'Your booking is confirmed', time: '2h ago' },
              { icon: 'trophy' as const,           color: '#f59e0b', text: 'Ramadan Cricket Cup starts in 3 days', time: '5h ago' },
              { icon: 'person-add' as const,       color: '#3b82f6', text: 'You have a new match invite', time: '1d ago' },
            ].map((n, i) => (
              <View key={i} style={styles.notifItem}>
                <Ionicons name={n.icon} size={20} color={n.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifText}>{n.text}</Text>
                  <Text style={styles.notifTime}>{n.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const isConfirmed = status === 'Confirmed';
  const isCancelled = status === 'Cancelled';
  return (
    <View style={[
      styles.confirmedBadge,
      isCancelled && { backgroundColor: '#fee2e2' },
    ]}>
      <Ionicons
        name={isConfirmed ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'time-outline'}
        size={14}
        color={isConfirmed ? '#16a34a' : isCancelled ? '#ef4444' : '#f59e0b'}
      />
      <Text style={[
        styles.confirmedText,
        isCancelled && { color: '#ef4444' },
        !isConfirmed && !isCancelled && { color: '#f59e0b' },
      ]}>{status}</Text>
    </View>
  );
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.bookingCard} onPress={onPress}>
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingEmoji}>{booking.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingVenue} numberOfLines={1}>{booking.venueName}</Text>
          <Text style={styles.bookingMeta}>{booking.date} · {booking.time}</Text>
          <Text style={styles.bookingPrice}>PKR {booking.price.toLocaleString()}</Text>
        </View>
      </View>
      <StatusBadge status={booking.status} />
    </TouchableOpacity>
  );
}

function MatchCard({ match, onPress }: { match: MatchItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress}>
      <View style={styles.matchLeft}>
        <Text style={styles.matchEmoji}>{match.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle} numberOfLines={1}>{match.title}</Text>
          <Text style={styles.matchMeta}>{match.players} · {match.date}</Text>
          <Text style={styles.matchMeta}>{match.location}</Text>
        </View>
      </View>
      <View style={styles.viewDetailsBtn}>
        <Text style={styles.viewDetailsBtnText}>Details</Text>
      </View>
    </TouchableOpacity>
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
  notifDot: {
    position: 'absolute',
    top: 0, right: 0,
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#16a34a' },
  statLbl: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  addBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyText:   { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  emptySubText:{ color: '#d1d5db', fontSize: 12 },
  emptyAction: { color: '#16a34a', fontWeight: '600', fontSize: 13, marginTop: 2 },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bookingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bookingEmoji: { fontSize: 32 },
  bookingVenue: { fontWeight: '700', color: '#111827', fontSize: 14 },
  bookingMeta:  { color: '#6b7280', fontSize: 12, marginTop: 2 },
  bookingPrice: { color: '#16a34a', fontWeight: '700', fontSize: 13, marginTop: 2 },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  matchLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  matchEmoji: { fontSize: 34, paddingTop: 2 },
  matchTitle: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 4 },
  matchMeta:  { color: '#6b7280', fontSize: 12, marginTop: 1 },
  viewDetailsBtn: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  viewDetailsBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40, height: 4,
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
  sheetContent: { padding: 20, alignItems: 'center' },
  sheetIconCircle: {
    width: 80, height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sheetVenueName: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  detailGrid: { width: '100%', gap: 12, marginTop: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailLabel: { color: '#9ca3af', fontSize: 12 },
  detailValue: { color: '#111827', fontWeight: '600', fontSize: 14 },
  cancelBookingBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelBookingText: { color: '#ef4444', fontWeight: '700' },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Create Match form
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 6 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pillText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  // Notifications
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', padding: 16, paddingTop: 80 },
  notifBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 300,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  notifTitle: { fontWeight: '700', color: '#111827', fontSize: 16, marginBottom: 12 },
  notifItem: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  notifText: { color: '#374151', fontSize: 13, lineHeight: 18 },
  notifTime: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
});
