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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchMyMatches, createMatch, cancelMatch,
  fetchMyTournamentCount, joinMatch, leaveMatch,
  fetchOpenMatches, fetchJoinedMatches,
} from '../../lib/matches';
import {
  fetchMyRegistrations,
  unregisterFromTournament,
} from '../../lib/tournaments';
import { getFormatsForSport } from '../../lib/sportRules';
import { type Booking, type MatchItem, type Tournament } from '../../data/mockData';
import DatePickerField from '../../components/DatePickerField';
import LocationPickerModal from '../../components/LocationPickerModal';
import NotifBell from '../../components/NotifBell';
import { createNotification } from '../../lib/notifications';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';

const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];
const TIME_SLOTS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
];

function slotToHour(slot: string): number {
  const [timePart, meridiem] = slot.split(' ');
  let hour = parseInt(timePart.split(':')[0], 10);
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour;
}

function isSlotPast(slot: string, date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sel  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (sel > today) return false;
  if (sel < today) return true;
  return slotToHour(slot) <= now.getHours();
}

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
  const [openMatches, setOpenMatches]       = useState<MatchItem[]>([]);
  const [joinedMatches, setJoinedMatches]   = useState<MatchItem[]>([]);
  const [joinedMatchIds, setJoinedMatchIds] = useState<Set<string>>(new Set());
  const [myRegistrations, setMyRegistrations] = useState<Tournament[]>([]);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [joining, setJoining]               = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedMatch, setSelectedMatch]     = useState<MatchItem | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Create Match modal
  const [showCreateMatch, setShowCreateMatch]       = useState(false);
  const [matchTitle, setMatchTitle]                 = useState('');
  const [matchSport, setMatchSport]                 = useState('Football');
  const [matchFormat, setMatchFormat]               = useState('3v3');
  const [matchMaxPlayers, setMatchMaxPlayers]       = useState(6);
  const [matchDate, setMatchDate]                   = useState<Date | null>(null);
  const [matchTime, setMatchTime]                   = useState('');
  const [matchLocation, setMatchLocation]           = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [creatingMatch, setCreatingMatch]           = useState(false);
  const [createError, setCreateError]               = useState('');

  // When sport changes, reset format to first valid option
  useEffect(() => {
    const formats = getFormatsForSport(matchSport);
    if (formats.length > 0) {
      setMatchFormat(formats[0].format);
      setMatchMaxPlayers(formats[0].maxPlayers);
    }
  }, [matchSport]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [bData, mData, openData, joinedData, tCount, regs] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      fetchMyMatches(user.id),
      fetchOpenMatches(user.id),
      fetchJoinedMatches(user.id),
      fetchMyTournamentCount(user.id),
      fetchMyRegistrations(user.id),
    ]);

    if (!bData.error && bData.data) {
      setBookings(bData.data.map(dbToBooking));
    }
    setMatches(mData);
    setOpenMatches(openData);
    setJoinedMatches(joinedData);
    setJoinedMatchIds(new Set(joinedData.map((m) => m.id)));
    setTournamentCount(tCount);
    setMyRegistrations(regs);
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
    const missing: string[] = [];
    if (!matchTitle.trim()) missing.push('Title');
    if (!matchDate) missing.push('Date');
    if (!matchTime) missing.push('Time');
    if (!matchLocation.trim()) missing.push('Location');

    if (missing.length > 0) {
      setCreateError(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    setCreateError('');
    setCreatingMatch(true);

    const formattedDate = matchDate!.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });

    const newMatch = await createMatch({
      userId:        user!.id,
      title:         matchTitle.trim(),
      sport:         matchSport,
      playersFormat: matchFormat,
      maxPlayers:    matchMaxPlayers,
      matchDate:     `${formattedDate} at ${matchTime}`,
      location:      matchLocation.trim(),
    });

    if (newMatch) setMatches((prev) => [newMatch, ...prev]);

    setCreatingMatch(false);
    setShowCreateMatch(false);
    setMatchTitle('');
    setMatchDate(null);
    setMatchTime('');
    setMatchLocation('');
    setCreateError('');
  };

  const handleJoinMatch = async (matchId: string) => {
    if (!user) return;
    setJoining(matchId);
    const success = await joinMatch(matchId, user.id);
    if (success) {
      setJoinedMatchIds((prev) => new Set([...prev, matchId]));

      // Increment count in openMatches and move to joinedMatches
      setOpenMatches((prev) =>
        prev.map((m) => m.id === matchId
          ? { ...m, currentPlayers: (m.currentPlayers ?? 0) + 1 }
          : m),
      );
      const joining = openMatches.find((m) => m.id === matchId);
      if (joining) {
        setJoinedMatches((prev) => [
          { ...joining, currentPlayers: (joining.currentPlayers ?? 0) + 1 },
          ...prev,
        ]);
        // Notify the match creator
        if (joining.creatorId && joining.creatorId !== user.id) {
          const joinerName =
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email?.split('@')[0] ??
            'Someone';
          createNotification({
            userId: joining.creatorId,
            type: 'match_join',
            title: `${joinerName} joined your match`,
            body: `${joining.sport} · ${joining.location ?? ''} · ${joining.date ?? ''}`.replace(/\s·\s$/, ''),
          }).catch(() => {});
        }
      }

      if (selectedMatch?.id === matchId) {
        setSelectedMatch((prev) => prev
          ? { ...prev, currentPlayers: (prev.currentPlayers ?? 0) + 1 }
          : null);
      }
    }
    setJoining(null);
  };

  const handleLeaveMatch = async (matchId: string) => {
    if (!user) return;
    setJoining(matchId);
    const success = await leaveMatch(matchId, user.id);
    if (success) {
      setJoinedMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      setJoinedMatches((prev) => prev.filter((m) => m.id !== matchId));
      setOpenMatches((prev) =>
        prev.map((m) => m.id === matchId
          ? { ...m, currentPlayers: Math.max(0, (m.currentPlayers ?? 0) - 1) }
          : m),
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch((prev) => prev
          ? { ...prev, currentPlayers: Math.max(0, (prev.currentPlayers ?? 0) - 1) }
          : null);
      }
    }
    setJoining(null);
  };

  const handleCancelSelectedMatch = async () => {
    if (!selectedMatch) return;
    const success = await cancelMatch(selectedMatch.id);
    if (success) {
      setMatches((prev) => prev.filter((m) => m.id !== selectedMatch.id));
      setSelectedMatch(null);
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    if (!user) return;
    const ok = await unregisterFromTournament(eventId, user.id);
    if (ok) {
      setMyRegistrations((prev) => prev.filter((e) => e.id !== eventId));
      setTournamentCount((c) => Math.max(0, c - 1));
    }
  };

  const upcomingBookings = bookings.filter((b) => b.status !== 'Cancelled');
  // Open matches excludes ones the user has already joined (those go to "Joined Matches")
  const displayedOpenMatches = openMatches.filter((m) => !joinedMatchIds.has(m.id));

  // Match detail helpers
  const isOwnMatch = selectedMatch?.creatorId === user?.id;
  const isJoinedMatch = selectedMatch ? joinedMatchIds.has(selectedMatch.id) : false;
  const matchSlotsLeft = selectedMatch
    ? (selectedMatch.maxPlayers ?? 0) - (selectedMatch.currentPlayers ?? 0)
    : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>My Turf</Text>
                <NotifBell />
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
            <Text style={styles.statLbl}>My Matches</Text>
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
        {!loading && matches.length === 0 && joinedMatches.length === 0 && (
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

        {joinedMatches.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>Joined Matches</Text>
            {joinedMatches.map((m) => (
              <JoinedMatchCard
                key={m.id}
                match={m}
                joining={joining === m.id}
                onPress={() => setSelectedMatch(m)}
                onLeave={() => handleLeaveMatch(m.id)}
              />
            ))}
          </>
        )}

        {/* My Events (Play to Earn) */}
        {myRegistrations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Events (Play to Earn)</Text>
            {myRegistrations.map((event) => (
              <EarnEventCard
                key={event.id}
                event={event}
                onLeave={() => handleLeaveEvent(event.id)}
              />
            ))}
          </>
        )}

        {/* Open Matches */}
        <Text style={styles.sectionTitle}>Open Matches Near You</Text>
        {!loading && displayedOpenMatches.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color="#d1d5db" />
            <Text style={styles.emptyText}>No open matches</Text>
            <Text style={styles.emptySubText}>Be the first to organize one</Text>
          </View>
        )}
        {displayedOpenMatches.map((m) => (
          <OpenMatchCard
            key={m.id}
            match={m}
            isJoined={false}
            joining={joining === m.id}
            onPress={() => setSelectedMatch(m)}
            onJoin={() => handleJoinMatch(m.id)}
            onLeave={() => handleLeaveMatch(m.id)}
          />
        ))}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'calendar-outline' as const,  label: 'New Booking',    color: '#16a34a', onPress: () => router.push('/(tabs)/book') },
            { icon: 'football-outline' as const,  label: 'Organize Match', color: '#3b82f6', onPress: () => setShowCreateMatch(true) },
            { icon: 'trophy-outline' as const,    label: 'My Tournaments', color: '#f59e0b', onPress: () => router.push('/my-tournaments') },
            { icon: 'people-outline' as const,    label: 'My Teams',       color: '#8b5cf6', onPress: () => {} },
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
                    { icon: 'football-outline' as const, label: 'Sport',    value: selectedBooking.sport },
                    { icon: 'calendar-outline' as const, label: 'Date',     value: selectedBooking.date },
                    { icon: 'time-outline' as const,     label: 'Time',     value: selectedBooking.time },
                    ...(selectedBooking.duration ? [{ icon: 'hourglass-outline' as const, label: 'Duration', value: `${selectedBooking.duration}h` }] : []),
                    ...(selectedBooking.players  ? [{ icon: 'people-outline' as const,   label: 'Players',  value: String(selectedBooking.players) }] : []),
                    ...(selectedBooking.address  ? [{ icon: 'location-outline' as const, label: 'Address',  value: selectedBooking.address }] : []),
                    { icon: 'cash-outline' as const, label: 'Total', value: `PKR ${selectedBooking.price.toLocaleString()}` },
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

                {/* Slot progress */}
                {selectedMatch.maxPlayers != null && (
                  <View style={styles.slotContainer}>
                    <View style={styles.slotTrack}>
                      <View style={[styles.slotFill, {
                        width: `${Math.round(((selectedMatch.currentPlayers ?? 0) / selectedMatch.maxPlayers) * 100)}%`,
                      }]} />
                    </View>
                    <Text style={styles.slotLabel}>
                      {selectedMatch.currentPlayers ?? 0} / {selectedMatch.maxPlayers} players joined
                      {matchSlotsLeft > 0 ? ` · ${matchSlotsLeft} spot${matchSlotsLeft !== 1 ? 's' : ''} left` : ' · Full'}
                    </Text>
                  </View>
                )}

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

                {/* Action button based on relationship to match */}
                {isOwnMatch ? (
                  <TouchableOpacity style={styles.cancelBookingBtn} onPress={handleCancelSelectedMatch}>
                    <Text style={styles.cancelBookingText}>Cancel Match</Text>
                  </TouchableOpacity>
                ) : isJoinedMatch ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#ef4444', marginTop: 20 }]}
                    onPress={() => handleLeaveMatch(selectedMatch.id)}
                    disabled={joining === selectedMatch.id}
                  >
                    {joining === selectedMatch.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.primaryBtnText}>Leave Match</Text>
                    }
                  </TouchableOpacity>
                ) : matchSlotsLeft > 0 ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 20 }]}
                    onPress={() => handleJoinMatch(selectedMatch.id)}
                    disabled={joining === selectedMatch.id}
                  >
                    {joining === selectedMatch.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.primaryBtnText}>Join Match</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.primaryBtn, { backgroundColor: '#9ca3af', marginTop: 20 }]}>
                    <Text style={styles.primaryBtnText}>Match Full</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.closeBtn, { marginTop: 10 }]}
                  onPress={() => setSelectedMatch(null)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Create Match Modal */}
      <Modal visible={showCreateMatch} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <KeyboardAvoidingView
            style={styles.createSheet}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Organize a Match</Text>
              <TouchableOpacity onPress={() => { setShowCreateMatch(false); setCreateError(''); }}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>

              <Text style={styles.fieldLabel}>
                Match Title<Text style={styles.required}> *</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sunday Kickabout"
                placeholderTextColor="#9ca3af"
                value={matchTitle}
                onChangeText={(t) => { setMatchTitle(t); setCreateError(''); }}
              />

              <Text style={styles.fieldLabel}>
                Sport<Text style={styles.required}> *</Text>
              </Text>
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

              <Text style={styles.fieldLabel}>
                Format<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.pillRow}>
                {getFormatsForSport(matchSport).map((f) => (
                  <TouchableOpacity
                    key={f.format}
                    style={[styles.pill, matchFormat === f.format && styles.pillActive]}
                    onPress={() => {
                      setMatchFormat(f.format);
                      setMatchMaxPlayers(f.maxPlayers);
                    }}
                  >
                    <Text style={[styles.pillText, matchFormat === f.format && styles.pillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formatHint}>
                Max {matchMaxPlayers} players total
              </Text>

              <Text style={styles.fieldLabel}>
                Date<Text style={styles.required}> *</Text>
              </Text>
              <DatePickerField
                value={matchDate}
                onChange={(d) => {
                  setMatchDate(d);
                  setCreateError('');
                  if (matchTime && isSlotPast(matchTime, d)) setMatchTime('');
                }}
                placeholder="Select match date"
              />

              <Text style={styles.fieldLabel}>
                Time<Text style={styles.required}> *</Text>
              </Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map((t) => {
                  const past = isSlotPast(t, matchDate);
                  return (
                    <TouchableOpacity
                      key={t}
                      disabled={past}
                      style={[styles.timeSlot, matchTime === t && styles.timeSlotActive, past && styles.timeSlotDisabled]}
                      onPress={() => { setMatchTime(t); setCreateError(''); }}
                    >
                      <Text style={[styles.timeSlotText, matchTime === t && styles.timeSlotTextActive, past && styles.timeSlotTextDisabled]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                Location<Text style={styles.required}> *</Text>
              </Text>
              <TouchableOpacity
                style={[styles.input, styles.locationTrigger]}
                onPress={() => setShowLocationPicker(true)}
              >
                <Ionicons name="location-outline" size={18} color={matchLocation ? '#111827' : '#9ca3af'} />
                <Text style={[styles.locationTriggerText, !matchLocation && { color: '#9ca3af' }]} numberOfLines={1}>
                  {matchLocation || 'Pick location from map'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </TouchableOpacity>

              {createError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{createError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 4 }]}
                onPress={handleCreateMatch}
                disabled={creatingMatch}
              >
                {creatingMatch
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Create Match</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Location Picker */}
      <LocationPickerModal
        visible={showLocationPicker}
        sport={matchSport}
        onSelect={(loc) => { setMatchLocation(loc); setShowLocationPicker(false); setCreateError(''); }}
        onClose={() => setShowLocationPicker(false)}
      />

      {/* Notification Modal */}
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
          {match.maxPlayers != null && (
            <Text style={styles.matchSlotText}>
              {match.currentPlayers ?? 0}/{match.maxPlayers} players
            </Text>
          )}
        </View>
      </View>
      <View style={styles.viewDetailsBtn}>
        <Text style={styles.viewDetailsBtnText}>Details</Text>
      </View>
    </TouchableOpacity>
  );
}

function JoinedMatchCard({ match, joining, onPress, onLeave }: {
  match: MatchItem;
  joining: boolean;
  onPress: () => void;
  onLeave: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.matchCard, styles.joinedMatchBorder]} onPress={onPress}>
      <View style={styles.matchLeft}>
        <Text style={styles.matchEmoji}>{match.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle} numberOfLines={1}>{match.title}</Text>
          <Text style={styles.matchMeta}>{match.players} · {match.date}</Text>
          <Text style={styles.matchMeta} numberOfLines={1}>{match.location}</Text>
          {match.maxPlayers != null && (
            <Text style={styles.matchSlotText}>
              {match.currentPlayers ?? 0}/{match.maxPlayers} players
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.leaveBtn, joining && { opacity: 0.6 }]}
        onPress={onLeave}
        disabled={joining}
      >
        {joining
          ? <ActivityIndicator size="small" color="#ef4444" />
          : <Text style={styles.leaveBtnText}>Leave</Text>
        }
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function OpenMatchCard({ match, isJoined, joining, onPress, onJoin, onLeave }: {
  match: MatchItem;
  isJoined: boolean;
  joining: boolean;
  onPress: () => void;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const max = match.maxPlayers ?? 1;
  const current = match.currentPlayers ?? 0;
  const pct = Math.round((current / max) * 100);
  const slotsLeft = max - current;

  return (
    <TouchableOpacity style={styles.openMatchCard} onPress={onPress}>
      <View style={styles.matchLeft}>
        <Text style={styles.matchEmoji}>{match.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle} numberOfLines={1}>{match.title}</Text>
          <Text style={styles.matchMeta}>{match.players} · {match.date}</Text>
          <View style={styles.slotTrack}>
            <View style={[styles.slotFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.slotLabel}>
            {current}/{max} players · {slotsLeft} spot{slotsLeft !== 1 ? 's' : ''} left
          </Text>
        </View>
      </View>
      {isJoined ? (
        <TouchableOpacity style={styles.joinedBadge} onPress={onLeave} disabled={joining}>
          {joining
            ? <ActivityIndicator size="small" color="#16a34a" />
            : <>
                <Ionicons name="checkmark" size={14} color="#16a34a" />
                <Text style={styles.joinedText}>Joined</Text>
              </>
          }
        </TouchableOpacity>
      ) : slotsLeft > 0 ? (
        <TouchableOpacity
          style={[styles.joinBtn, joining && { opacity: 0.6 }]}
          onPress={onJoin}
          disabled={joining}
        >
          {joining
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.joinBtnText}>Join</Text>
          }
        </TouchableOpacity>
      ) : (
        <View style={styles.fullBadge}>
          <Text style={styles.fullText}>Full</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  tournament: '#8b5cf6',
  league:     '#3b82f6',
  match:      '#16a34a',
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  league:     'League',
  match:      'Match',
};

function EarnEventCard({ event, onLeave }: { event: Tournament; onLeave: () => void }) {
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? '#16a34a';
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
  return (
    <View style={[styles.earnCard, { borderLeftColor: typeColor }]}>
      <View style={styles.earnTop}>
        <Text style={styles.earnEmoji}>{event.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.earnTitleRow}>
            <Text style={styles.earnName} numberOfLines={1}>{event.name}</Text>
            <View style={[styles.earnTypeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.earnTypeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
            </View>
          </View>
          <Text style={styles.earnMeta}>
            {event.date}{event.location ? `  ·  ${event.location}` : ''}
          </Text>
          <View style={styles.earnFooter}>
            {event.entryFee > 0 && (
              <Text style={styles.earnFee}>Entry: PKR {event.entryFee.toLocaleString()}</Text>
            )}
            {event.prizePool > 0 && (
              <Text style={styles.earnPrize}>🏆 PKR {event.prizePool.toLocaleString()}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.earnActions}>
        <View style={styles.registeredBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
          <Text style={styles.registeredBadgeText}>Registered</Text>
        </View>
        <TouchableOpacity style={styles.earnLeaveBtn} onPress={onLeave}>
          <Text style={styles.earnLeaveBtnText}>Leave</Text>
        </TouchableOpacity>
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
  openMatchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  matchLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  matchEmoji: { fontSize: 34, paddingTop: 2 },
  matchTitle: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 4 },
  matchMeta:  { color: '#6b7280', fontSize: 12, marginTop: 1 },
  matchSlotText: { color: '#16a34a', fontSize: 11, fontWeight: '600', marginTop: 4 },
  subSectionTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 8, marginTop: 6 },
  joinedMatchBorder: { borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 58,
    alignItems: 'center',
  },
  leaveBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  viewDetailsBtn: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  viewDetailsBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  // Slot progress bar
  slotTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 2,
  },
  slotFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16a34a',
  },
  slotLabel: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  // Match detail slot section
  slotContainer: {
    width: '100%',
    marginBottom: 4,
    marginTop: 8,
  },
  // Join / joined / full badges on open match cards
  joinBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 58,
    alignItems: 'center',
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinedText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  fullBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fullText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
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
  // Sheet / Modals
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  createSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '92%',
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
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  closeBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
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
  locationTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
  },
  locationTriggerText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14 },
  required: { color: '#ef4444' },
  formatHint: { color: '#6b7280', fontSize: 12, marginTop: -8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeSlot: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  timeSlotActive:       { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  timeSlotDisabled:     { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', opacity: 0.45 },
  timeSlotText:         { fontSize: 12, color: '#374151', fontWeight: '500' },
  timeSlotTextActive:   { color: '#fff' },
  timeSlotTextDisabled: { color: '#d1d5db' },
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 },
  // Earn event cards
  earnCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  earnTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  earnEmoji: { fontSize: 32, paddingTop: 2 },
  earnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  earnName: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 },
  earnTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  earnTypeBadgeText: { fontSize: 11, fontWeight: '700' },
  earnMeta: { color: '#6b7280', fontSize: 12, marginBottom: 6 },
  earnFooter: { flexDirection: 'row', gap: 12 },
  earnFee: { color: '#374151', fontSize: 12, fontWeight: '600' },
  earnPrize: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  earnActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  registeredBadgeText: { color: '#16a34a', fontWeight: '600', fontSize: 12 },
  earnLeaveBtn: {
    borderWidth: 1.5,
    borderColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  earnLeaveBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
});
