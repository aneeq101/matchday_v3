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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchMyMatches, createMatch, cancelMatch,
  fetchMyTournamentCount, joinMatch, leaveMatch,
  fetchOpenMatches, fetchJoinedMatches, fetchMatch,
} from '../../lib/matches';
import {
  fetchMyRegistrations,
  fetchTournaments,
  unregisterFromTournament,
  eventIsPast,
  eventCategory,
  categoryMoney,
  categoryLabel,
} from '../../lib/tournaments';
import { getFormatsForSport } from '../../lib/sportRules';
import { type Booking, type MatchItem, type Tournament, type EventCategory } from '../../data/mockData';
import CategoryPicker from '../../components/CategoryPicker';
import CreateEventModal from '../../components/CreateEventModal';
import DatePickerField from '../../components/DatePickerField';
import LocationPickerModal from '../../components/LocationPickerModal';
import NotifBell from '../../components/NotifBell';
import { toISODate, canRecordFinal, isPastGame, gameStart } from '../../lib/matchday';
import MatchDayPanel from '../../components/MatchDayPanel';
import { createNotification } from '../../lib/notifications';
import { useUserLocation } from '../../hooks/useUserLocation';
import { fetchSettings, EVENT_ALERT_RADII } from '../../lib/settings';
import { distanceKm, formatDistance, type Coord } from '../../utils/geo';

const FIELD_IMAGE = 'https://image.pollinations.ai/prompt/close%20up%20ground%20level%20shot%20real%20football%20pitch%20grass%20sharp%20green%20grass%20blades%20foreground%20white%20painted%20center%20circle%20line%20shallow%20depth%20of%20field%20bokeh%20golden%20hour%20lighting%20photorealistic%20ultra%20detailed%20grass%20texture%20dew%20drops%20cinematic%20dark%20moody%20tone%20portrait%20no%20people?width=1080&height=1920&seed=42&nologo=true&model=flux';

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
    category:        (row.category as EventCategory) ?? undefined,
    entryFee:        Number(row.entry_fee ?? 0),
    prizePool:       Number(row.prize_pool ?? 0),
  };
}

type TurfTab = 'upcoming' | 'near' | 'past';

// Same steps as Nearby Event Alerts; starts at the player's alert distance
const NEAR_RADII = EVENT_ALERT_RADII;

export default function MyTurfScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { action } = useLocalSearchParams<{ action?: string }>();

  useEffect(() => {
    if (action === 'createMatch') {
      setShowCreateMatch(true);
      // Clear the param so re-entering the tab doesn't re-trigger
      router.replace('/(tabs)/myturf');
    }
  }, [action]);

  const [bookings, setBookings]             = useState<Booking[]>([]);
  const [matches, setMatches]               = useState<MatchItem[]>([]);
  const [openMatches, setOpenMatches]       = useState<MatchItem[]>([]);
  const [joinedMatches, setJoinedMatches]   = useState<MatchItem[]>([]);
  const [joinedMatchIds, setJoinedMatchIds] = useState<Set<string>>(new Set());
  const [myRegistrations, setMyRegistrations] = useState<Tournament[]>([]);
  const [allEvents, setAllEvents]           = useState<Tournament[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [tournamentCount, setTournamentCount] = useState(0);
  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [joining, setJoining]               = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [tab, setTab]                         = useState<TurfTab>('upcoming');
  const { location: myLocation, loading: locating } = useUserLocation();
  const [nearRadius, setNearRadius]           = useState(25);
  const [showUnplaced, setShowUnplaced]       = useState(false);
  useEffect(() => {
    if (!user) return;
    fetchSettings(user.id)
      .then((st) => { if (NEAR_RADII.includes(st.eventAlertRadiusKm)) setNearRadius(st.eventAlertRadiusKm); })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedMatch, setSelectedMatch]     = useState<MatchItem | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Create Match modal
  const [showCreateMatch, setShowCreateMatch]       = useState(false);
  const [matchTitle, setMatchTitle]                 = useState('');
  const [matchSport, setMatchSport]                 = useState('Football');
  const [matchFormat, setMatchFormat]               = useState('3v3');
  const [matchMaxPlayers, setMatchMaxPlayers]       = useState(6);
  const [matchDate, setMatchDate]                   = useState<Date | null>(null);
  const [matchCategory, setMatchCategory]           = useState<EventCategory>('friendly');
  const [matchFee, setMatchFee]                     = useState('');
  const [matchPrize, setMatchPrize]                 = useState('');
  const [matchTime, setMatchTime]                   = useState('');
  const [matchLocation, setMatchLocation]           = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [matchCoord, setMatchCoord] = useState<{ latitude: number; longitude: number } | null>(null);
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

    const [bData, mData, openData, joinedData, tCount, regs, evs] = await Promise.all([
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
      fetchTournaments(),
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
    setAllEvents(evs);
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
    const money = categoryMoney(matchCategory, matchFee, matchPrize);
    if (money.error) {
      setCreateError(money.error);
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
      startsOn:      toISODate(matchDate!),
      category:      matchCategory,
      entryFee:      money.entryFee,
      prizePool:     money.prizePool,
      latitude:      matchCoord?.latitude ?? null,
      longitude:     matchCoord?.longitude ?? null,
    });

    if (!newMatch) {
      setCreatingMatch(false);
      setCreateError('Couldn’t create the match. Please try again.');
      return;
    }
    setMatches((prev) => [newMatch, ...prev]);

    setCreatingMatch(false);
    setShowCreateMatch(false);
    setMatchTitle('');
    setMatchDate(null);
    setMatchTime('');
    setMatchLocation('');
    setMatchCoord(null);
    setMatchCategory('friendly');
    setMatchFee('');
    setMatchPrize('');
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
    } else {
      Alert.alert('Couldn\'t leave', 'Sign-ups for this event may already be closed.');
    }
  };

  // Games that have started or been played move from the upcoming lists to "Past"
  const bookingIsPast = (b: Booking) => isPastGame({ date: b.date, time: b.time });
  const activeBookings   = bookings.filter((b) => b.status !== 'Cancelled');
  const upcomingBookings = activeBookings.filter((b) => !bookingIsPast(b));
  const pastBookings     = activeBookings.filter(bookingIsPast)
    .sort((a, b) => (gameStart(null, b.date, b.time)?.getTime() ?? 0) - (gameStart(null, a.date, a.time)?.getTime() ?? 0));
  const upcomingMatches       = matches.filter((m) => !isPastGame(m));
  const upcomingJoinedMatches = joinedMatches.filter((m) => !isPastGame(m));
  const pastMatches = [...matches, ...joinedMatches].filter((m) => isPastGame(m))
    .sort((a, b) => (gameStart(b.startsOn, b.date)?.getTime() ?? 0) - (gameStart(a.startsOn, a.date)?.getTime() ?? 0));
  // Open matches excludes ones the user has already joined (those go to "Joined Matches") and ones already played
  const displayedOpenMatches = openMatches.filter((m) => !joinedMatchIds.has(m.id) && !isPastGame(m));
  const upcomingEvents = myRegistrations.filter((t) => !eventIsPast(t));
  const pastEvents     = myRegistrations.filter(eventIsPast)
    .sort((a, b) => (gameStart(b.startsOn, b.date)?.getTime() ?? 0) - (gameStart(a.startsOn, a.date)?.getTime() ?? 0));
  const pastCount = pastMatches.length + pastEvents.length + pastBookings.length;
  // Friendly events (free, no prize) live here, not in Play to Earn: ones still open
  // for sign-ups that I haven't joined yet (joined ones are under Upcoming → My Events)
  const registeredEventIds = new Set(myRegistrations.map((t) => t.id));
  const friendlyEvents = allEvents.filter((t) =>
    eventCategory(t) === 'friendly' && (t.status ?? 'active') === 'active'
    && !eventIsPast(t) && !registeredEventIds.has(t.id));

  // Near me: within the chosen distance of my GPS position, nearest first. Games
  // with no map point (typed-in place) can't be measured — offered separately.
  // Without GPS everything is listed, as before.
  const distTo = (c?: Coord | null) => (myLocation && c ? distanceKm(myLocation, c) : null);
  const nearFilter = <T extends { coord?: Coord | null }>(list: T[]) => {
    if (!myLocation) return { inRange: list, unplaced: [] as T[] };
    return {
      inRange: list
        .filter((x) => x.coord && distTo(x.coord)! <= nearRadius)
        .sort((a, b) => distTo(a.coord)! - distTo(b.coord)!),
      unplaced: list.filter((x) => !x.coord),
    };
  };
  const nearMatches = nearFilter(displayedOpenMatches);
  const nearEvents  = nearFilter(friendlyEvents);
  const unplacedCount = nearMatches.unplaced.length + nearEvents.unplaced.length;
  const nearMatchList = showUnplaced ? [...nearMatches.inRange, ...nearMatches.unplaced] : nearMatches.inRange;
  const nearEventList = showUnplaced ? [...nearEvents.inRange, ...nearEvents.unplaced] : nearEvents.inRange;
  const distLabel = (c?: Coord | null) => {
    const d = distTo(c);
    return d == null ? undefined : formatDistance(d);
  };
  const upcomingCount = upcomingBookings.length + upcomingMatches.length + upcomingJoinedMatches.length + upcomingEvents.length;

  const QUICK_ACTIONS = [
    { icon: 'calendar-outline' as const,  label: 'New Booking',    color: '#16a34a', onPress: () => router.push('/(tabs)/book') },
    { icon: 'football-outline' as const,  label: 'Organize Match', color: '#3b82f6', onPress: () => setShowCreateMatch(true) },
    { icon: 'happy-outline' as const,     label: 'Friendly Event', color: '#0369a1', onPress: () => setShowCreateEvent(true) },
    { icon: 'trophy-outline' as const,    label: 'My Tournaments', color: '#f59e0b', onPress: () => router.push('/my-tournaments') },
    { icon: 'people-outline' as const,    label: 'My Teams',       color: '#8b5cf6', onPress: () => router.push('/my-teams') },
    { icon: 'flash-outline' as const,     label: 'Challenges',     color: '#f97316', onPress: () => router.push('/challenges') },
    { icon: 'podium-outline' as const,    label: 'Play to Earn',   color: '#0ea5e9', onPress: () => router.push('/(tabs)/earn') },
  ];
  const TABS: Array<{ key: TurfTab; label: string; count: number }> = [
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { key: 'near',     label: 'Near me',  count: nearMatches.inRange.length + nearEvents.inRange.length },
    { key: 'past',     label: 'Past',     count: pastCount },
  ];

  // Match detail helpers
  const isOwnMatch = selectedMatch?.creatorId === user?.id;
  const isJoinedMatch = selectedMatch ? joinedMatchIds.has(selectedMatch.id) : false;
  const matchSlotsLeft = selectedMatch
    ? (selectedMatch.maxPlayers ?? 0) - (selectedMatch.currentPlayers ?? 0)
    : 0;

  return (
    <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.root} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <View style={styles.headerBg}>
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>My Turf</Text>
                <NotifBell />
              </View>
            </SafeAreaView>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
      >
        {/* Quick Actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
          style={styles.quickScroll}
        >
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickBtn} onPress={action.onPress} accessibilityRole="button">
              <View style={[styles.quickIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

        {/* Upcoming · Near me · Past */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, on && styles.tabBtnActive]}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[styles.tabCount, on && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, on && styles.tabCountTextActive]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && <ActivityIndicator color="#16a34a" style={{ marginVertical: 12 }} />}

        {/* ── Upcoming: my bookings, matches and events ── */}
        {tab === 'upcoming' && !loading && (
          upcomingCount === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyCardTitle}>Nothing coming up</Text>
              <Text style={styles.emptyCardText}>Book a venue, organize a match or join an event and it will show here.</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/book')}>
                  <Text style={styles.emptyBtnText}>Book a venue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateMatch(true)}>
                  <Text style={styles.emptyBtnText}>Organize a match</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab('near')}>
                  <Text style={styles.emptyBtnText}>Find a game</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {upcomingBookings.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Bookings</Text>
                  {upcomingBookings.map((b) => (
                    <BookingCard key={b.id} booking={b} onPress={() => setSelectedBooking(b)} />
                  ))}
                </>
              )}

              {upcomingMatches.length > 0 && (
                <>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>My Matches</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateMatch(true)}>
                      <Ionicons name="add" size={16} color="#16a34a" />
                      <Text style={styles.addBtnText}>Organize</Text>
                    </TouchableOpacity>
                  </View>
                  {upcomingMatches.map((m) => (
                    <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />
                  ))}
                </>
              )}

              {upcomingJoinedMatches.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Joined Matches</Text>
                  {upcomingJoinedMatches.map((m) => (
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

              {upcomingEvents.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>My Events</Text>
                  {upcomingEvents.map((event) => (
                    <EarnEventCard
                      key={event.id}
                      event={event}
                      onOpen={() => router.push({ pathname: '/tournament', params: { id: event.id } })}
                      onLeave={() => handleLeaveEvent(event.id)}
                    />
                  ))}
                </>
              )}
            </>
          )
        )}

        {/* ── Near me: open matches + friendly events within a distance ── */}
        {tab === 'near' && (
          <View style={styles.nearBar}>
            {myLocation ? (
              <>
                <Ionicons name="navigate" size={14} color="#16a34a" />
                <Text style={styles.nearBarLabel}>Within</Text>
                {NEAR_RADII.map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.radiusChip, nearRadius === km && styles.radiusChipActive]}
                    onPress={() => setNearRadius(km)}
                    accessibilityState={{ selected: nearRadius === km }}
                  >
                    <Text style={[styles.radiusChipText, nearRadius === km && styles.radiusChipTextActive]}>{km} km</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text style={styles.nearBarHint}>
                  {locating ? 'Finding your location…' : 'Turn on location to see games near you — showing everything for now.'}
                </Text>
              </>
            )}
          </View>
        )}
        {tab === 'near' && !loading && (
          nearMatchList.length === 0 && nearEventList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyCardTitle}>
                {myLocation ? `Nothing open within ${nearRadius} km` : 'Nothing open right now'}
              </Text>
              <Text style={styles.emptyCardText}>
                {myLocation && nearRadius < NEAR_RADII[NEAR_RADII.length - 1]
                  ? 'Try a bigger distance, or be the first — organize a match or host a friendly event.'
                  : 'Be the first — organize a match or host a friendly event and players can join.'}
              </Text>
              <View style={styles.emptyActions}>
                {myLocation && nearRadius < NEAR_RADII[NEAR_RADII.length - 1] && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setNearRadius(NEAR_RADII[NEAR_RADII.length - 1])}>
                    <Text style={styles.emptyBtnText}>Show up to {NEAR_RADII[NEAR_RADII.length - 1]} km</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateMatch(true)}>
                  <Text style={styles.emptyBtnText}>Organize a match</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateEvent(true)}>
                  <Text style={styles.emptyBtnText}>Host a friendly event</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {nearMatchList.length > 0 && <Text style={styles.sectionTitle}>Open Matches</Text>}
              {nearMatchList.map((m) => (
                <OpenMatchCard
                  key={m.id}
                  match={m}
                  distance={distLabel(m.coord)}
                  isJoined={false}
                  joining={joining === m.id}
                  onPress={() => setSelectedMatch(m)}
                  onJoin={() => handleJoinMatch(m.id)}
                  onLeave={() => handleLeaveMatch(m.id)}
                />
              ))}
              {nearEventList.length > 0 && (
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>🤝 Friendly Events</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateEvent(true)}>
                    <Ionicons name="add" size={16} color="#16a34a" />
                    <Text style={styles.addBtnText}>Host</Text>
                  </TouchableOpacity>
                </View>
              )}
              {nearEventList.map((event) => (
                <EarnEventCard
                  key={event.id}
                  event={event}
                  distance={distLabel(event.coord)}
                  registered={false}
                  onOpen={() => router.push({ pathname: '/tournament', params: { id: event.id } })}
                />
              ))}
            </>
          )
        )}
        {tab === 'near' && !loading && unplacedCount > 0 && (
          <TouchableOpacity style={styles.unplacedBtn} onPress={() => setShowUnplaced((v) => !v)}>
            <Text style={styles.unplacedText}>
              {showUnplaced
                ? 'Hide games with no map location'
                : `+ ${unplacedCount} game${unplacedCount === 1 ? '' : 's'} with no map location (distance unknown)`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Past: games and events that have started or been played ── */}
        {tab === 'past' && !loading && (
          pastCount === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyCardTitle}>No past games yet</Text>
              <Text style={styles.emptyCardText}>Matches, events and bookings move here once they’ve been played.</Text>
            </View>
          ) : (
            <>
              {pastMatches.length > 0 && <Text style={styles.sectionTitle}>Matches</Text>}
              {pastMatches.map((m) => (
                <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />
              ))}
              {pastEvents.length > 0 && <Text style={styles.sectionTitle}>Events</Text>}
              {pastEvents.map((event) => (
                <EarnEventCard
                  key={event.id}
                  event={event}
                  onOpen={() => router.push({ pathname: '/tournament', params: { id: event.id } })}
                />
              ))}
              {pastBookings.length > 0 && <Text style={styles.sectionTitle}>Bookings</Text>}
              {pastBookings.map((b) => (
                <BookingCard key={b.id} booking={b} onPress={() => setSelectedBooking(b)} />
              ))}
            </>
          )
        )}
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
                    { icon: 'trophy-outline' as const, label: 'Category', value: categoryLabel(selectedBooking) },
                    { icon: 'cash-outline' as const, label: 'Total', value: `CAD ${selectedBooking.price.toLocaleString()}` },
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

                <MatchDayPanel
                  kind="match"
                  id={selectedMatch.id}
                  isParticipant={isOwnMatch || isJoinedMatch}
                  startsOn={selectedMatch.startsOn}
                  readyAt={selectedMatch.readyAt}
                  lineup={`${selectedMatch.currentPlayers ?? 0} players`}
                  finalScore={{
                    allowed: true,
                    score: selectedMatch.resultScore,
                    note: selectedMatch.resultNote,
                    summary: selectedMatch.resultSummary,
                    completed: selectedMatch.status === 'completed',
                    oneVsOne: selectedMatch.maxPlayers === 2,
                  }}
                  onChanged={async () => {
                    const fresh = await fetchMatch(selectedMatch.id);
                    if (fresh) setSelectedMatch(fresh);
                    loadData();
                  }}
                />

                <View style={styles.detailGrid}>
                  {[
                    { icon: 'football-outline' as const,  label: 'Sport',       value: selectedMatch.sport },
                    { icon: 'people-outline' as const,    label: 'Format',      value: selectedMatch.players },
                    { icon: 'time-outline' as const,      label: 'Date & Time', value: selectedMatch.date },
                    { icon: 'location-outline' as const,  label: 'Venue',       value: selectedMatch.location },
                    { icon: 'trophy-outline' as const,    label: 'Category',    value: categoryLabel(selectedMatch) },
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

                {/* Action button based on relationship to match (none once it's been played) */}
                {selectedMatch.status === 'completed' || isPastGame(selectedMatch) ? null : isOwnMatch ? (
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

              <CategoryPicker
                value={matchCategory}
                onChange={(c) => { setMatchCategory(c); setCreateError(''); }}
                entryFee={matchFee}
                prizePool={matchPrize}
                onEntryFee={setMatchFee}
                onPrizePool={(v) => { setMatchPrize(v); setCreateError(''); }}
                spots={matchMaxPlayers}
                what="match"
              />

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

      <CreateEventModal
        visible={showCreateEvent}
        category="friendly"
        onClose={() => setShowCreateEvent(false)}
        onCreated={(saved) => { setAllEvents((prev) => [saved, ...prev]); setTab('near'); }}
      />

      {/* Location Picker */}
      <LocationPickerModal
        visible={showLocationPicker}
        sport={matchSport}
        onSelect={(loc, coord) => { setMatchLocation(loc); setMatchCoord(coord ?? null); setShowLocationPicker(false); setCreateError(''); }}
        onClose={() => setShowLocationPicker(false)}
      />

      {/* Notification Modal */}
    </ImageBackground>
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
          <Text style={styles.bookingPrice}>CAD {booking.price.toLocaleString()}</Text>
          {eventCategory(booking) === 'prize' && <Text style={styles.categoryText}>{categoryLabel(booking)}</Text>}
        </View>
      </View>
      <StatusBadge status={booking.status} />
    </TouchableOpacity>
  );
}

/** "Final: 5–3" once played, "Record the score" when it's time, "Ready for match day" when full. */
function MatchStatusLine({ match }: { match: MatchItem }) {
  if (match.status === 'completed' && match.resultScore) {
    return (
      <Text style={styles.matchFinalText}>
        🏆 Final: {match.resultScore}{match.resultSummary ? ` · ${match.resultSummary}` : ''}
      </Text>
    );
  }
  if (canRecordFinal(match.startsOn, match.readyAt)) {
    return <Text style={styles.matchActionText}>✏️ Played? Record the score</Text>;
  }
  if (match.readyAt) {
    return <Text style={styles.matchActionText}>📣 Ready for match day</Text>;
  }
  return null;
}

function MatchCard({ match, onPress }: { match: MatchItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress}>
      <View style={styles.matchLeft}>
        <Text style={styles.matchEmoji}>{match.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle} numberOfLines={1}>{match.title}</Text>
          <Text style={styles.matchMeta}>{match.players} · {match.date}</Text>
          {eventCategory(match) === 'prize' && <Text style={styles.categoryText}>{categoryLabel(match)}</Text>}
          <Text style={styles.matchMeta}>{match.location}</Text>
          {match.maxPlayers != null && (
            <Text style={styles.matchSlotText}>
              {match.currentPlayers ?? 0}/{match.maxPlayers} players
            </Text>
          )}
          <MatchStatusLine match={match} />
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
          {eventCategory(match) === 'prize' && <Text style={styles.categoryText}>{categoryLabel(match)}</Text>}
          <Text style={styles.matchMeta} numberOfLines={1}>{match.location}</Text>
          {match.maxPlayers != null && (
            <Text style={styles.matchSlotText}>
              {match.currentPlayers ?? 0}/{match.maxPlayers} players
            </Text>
          )}
          <MatchStatusLine match={match} />
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

function OpenMatchCard({ match, distance, isJoined, joining, onPress, onJoin, onLeave }: {
  match: MatchItem;
  distance?: string;
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
          {!!distance && <Text style={styles.distanceText}>📍 {distance} away</Text>}
          {eventCategory(match) === 'prize' && <Text style={styles.categoryText}>{categoryLabel(match)}</Text>}
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

function EarnEventCard({ event, onOpen, onLeave, registered = true, distance }: {
  event: Tournament; onOpen: () => void; onLeave?: () => void;
  /** "2.4 km" — shown on Near me */
  distance?: string;
  /** false = an event I can still join (Near me): show spots left + "View & join" */
  registered?: boolean;
}) {
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? '#16a34a';
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
  const open = (event.status ?? 'active') === 'active';
  return (
    <TouchableOpacity style={[styles.earnCard, { borderLeftColor: typeColor }]} onPress={onOpen} activeOpacity={0.85}>
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
          {!!distance && <Text style={styles.distanceText}>📍 {distance} away</Text>}
          <View style={styles.earnFooter}>
            {eventCategory(event) === 'friendly' && <Text style={styles.earnFee}>Free to join</Text>}
            {event.entryFee > 0 && (
              <Text style={styles.earnFee}>Entry: CAD {event.entryFee.toLocaleString()}</Text>
            )}
            {event.prizePool > 0 && (
              <Text style={styles.earnPrize}>🏆 CAD {event.prizePool.toLocaleString()}</Text>
            )}
          </View>
        </View>
      </View>
      {!registered ? (
        <View style={styles.earnActions}>
          <Text style={styles.earnFee}>
            {event.participants}/{event.maxParticipants} signed up
            {event.maxParticipants > event.participants ? ` · ${event.maxParticipants - event.participants} left` : ' · Full'}
          </Text>
          <View style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>View & join</Text>
          </View>
        </View>
      ) : (
      <View style={styles.earnActions}>
        <View style={styles.registeredBadge}>
          <Ionicons name={open ? 'checkmark-circle' : 'git-network-outline'} size={14} color="#16a34a" />
          <Text style={styles.registeredBadgeText}>
            {open ? 'Registered' : event.status === 'completed' ? 'Finished · See results' : 'Live · See bracket'}
          </Text>
        </View>
        {open && onLeave && (
          <TouchableOpacity style={styles.earnLeaveBtn} onPress={onLeave}>
            <Text style={styles.earnLeaveBtnText}>Leave</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
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
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.93)',
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 10, marginTop: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  addBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  emptySubText:{ color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  bookingCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
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
    backgroundColor: 'rgba(255,255,255,0.93)',
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
    backgroundColor: 'rgba(255,255,255,0.93)',
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
  matchFinalText: { color: '#92400e', fontSize: 12, fontWeight: '800', marginTop: 4 },
  matchActionText: { color: '#7c3aed', fontSize: 12, fontWeight: '700', marginTop: 4 },
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
  quickScroll: { marginHorizontal: -16, marginBottom: 12 },
  quickRow: { paddingHorizontal: 16, gap: 8 },
  quickBtn: {
    width: 84,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  quickIcon: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: '#374151', textAlign: 'center', lineHeight: 14 },
  // Sheet / Modals
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  createSheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
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
    backgroundColor: 'rgba(255,255,255,0.93)',
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
  nearBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  nearBarLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginRight: 2 },
  nearBarHint: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 16 },
  radiusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#f3f4f6' },
  radiusChipActive: { backgroundColor: '#16a34a' },
  radiusChipText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  radiusChipTextActive: { color: '#fff' },
  distanceText: { fontSize: 12, fontWeight: '700', color: '#16a34a', marginTop: 2 },
  unplacedBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  unplacedText: { color: '#fff', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center' },
  tabBar: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 14, padding: 4, gap: 4, marginBottom: 14,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: '#16a34a' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#fff' },
  tabCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: '#e5e7eb', alignItems: 'center' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  tabCountTextActive: { color: '#fff' },
  emptyCard: {
    alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 16,
    paddingVertical: 24, paddingHorizontal: 18, marginBottom: 12,
  },
  emptyCardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptyCardText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  emptyBtn: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  emptyBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  categoryText: { color: '#a16207', fontSize: 12, fontWeight: '700', marginTop: 2 },
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
