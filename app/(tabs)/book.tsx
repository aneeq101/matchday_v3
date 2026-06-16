import React, { useState, useEffect, useRef } from 'react';
import RadiusSlider from '../../components/RadiusSlider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Animated,
  PanResponder,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VENUES, venueDistanceKm, type Venue } from '../../data/mockData';
import { formatDistance, type Coord } from '../../utils/geo';
import { useUserLocation } from '../../hooks/useUserLocation';
import BookMap from '../../components/BookMap';
import DatePickerField from '../../components/DatePickerField';
import { getFormatsForSport } from '../../lib/sportRules';

const LIVE_SEARCH_ENABLED = false;
const PEEK_HEIGHT = 168; // px visible when sheet is at its lowest snap

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

const BOOKING_SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];
const DURATIONS = [1, 2, 3];

const SPORT_FILTERS = [
  { label: 'All',        emoji: '🏟️', osmSport: null as string | null },
  { label: 'Football',   emoji: '⚽', osmSport: 'soccer' },
  { label: 'Cricket',    emoji: '🏏', osmSport: 'cricket' },
  { label: 'Tennis',     emoji: '🎾', osmSport: 'tennis' },
  { label: 'Basketball', emoji: '🏀', osmSport: 'basketball' },
  { label: 'Badminton',  emoji: '🏸', osmSport: 'badminton' },
  { label: 'Baseball',   emoji: '⚾', osmSport: 'baseball' },
];
type SportFilter = (typeof SPORT_FILTERS)[number];

const SPORT_COLORS: Record<string, string> = {
  soccer:     '#16a34a',
  tennis:     '#0284c7',
  cricket:    '#f59e0b',
  basketball: '#ea580c',
  badminton:  '#8b5cf6',
  baseball:   '#1d4ed8',
};

function osmToDisplaySport(osmSport: string): string {
  if (osmSport === 'soccer') return 'Football';
  return osmSport.charAt(0).toUpperCase() + osmSport.slice(1);
}

function sportEmojiStr(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return '⚽';
  if (s.includes('cricket'))    return '🏏';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('tennis'))     return '🎾';
  if (s.includes('badminton'))  return '🏸';
  if (s.includes('baseball'))   return '⚾';
  return '🏟️';
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

async function fetchOverpassVenues(
  location: Coord,
  radiusKm: number,
  osmSport: string,
): Promise<Venue[]> {
  const radiusM = Math.min(radiusKm * 1000, 10000);
  const { latitude: lat, longitude: lon } = location;
  const query = `[out:json][timeout:12];
(
  node["sport"="${osmSport}"](around:${radiusM},${lat},${lon});
  way["sport"="${osmSport}"](around:${radiusM},${lat},${lon});
  node["leisure"="pitch"]["sport"="${osmSport}"](around:${radiusM},${lat},${lon});
  way["leisure"="pitch"]["sport"="${osmSport}"](around:${radiusM},${lat},${lon});
);
out center;`;
  const sport = osmToDisplaySport(osmSport);
  const color = SPORT_COLORS[osmSport] ?? '#6b7280';
  const body = `data=${encodeURIComponent(query)}`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) continue;
      const json = await resp.json();
      return (json.elements as any[])
        .filter((el) => el.lat || el.center?.lat)
        .slice(0, 30)
        .map((el): Venue => ({
          id: `live_${el.id}`,
          name: el.tags?.name || el.tags?.['name:en'] || `${sport} Venue`,
          rating: 0,
          address:
            [el.tags?.['addr:street'], el.tags?.['addr:city']]
              .filter(Boolean).join(', ') || 'Address unknown',
          sports: [sport],
          distance: '',
          pricePerHour: 0,
          imageColor: color,
          coord: { latitude: el.lat ?? el.center.lat, longitude: el.lon ?? el.center.lon },
          source: 'live',
        }));
    } catch { /* try next */ }
  }
  throw new Error('All Overpass endpoints failed');
}

export default function BookScreen() {
  const { location, loading: locationLoading } = useUserLocation();
  const { user } = useAuth();
  const [searchText, setSearchText]       = useState('');
  const [radius, setRadius]               = useState(5);
  const [selectedFilter, setSelectedFilter] = useState<SportFilter>(SPORT_FILTERS[0]);
  const [liveVenues, setLiveVenues]       = useState<Venue[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);
  const [liveError, setLiveError]         = useState(false);
  const [bookingVenue, setBookingVenue]   = useState<Venue | null>(null);
  const [confirmed, setConfirmed]         = useState(false);

  // Booking form
  const [selectedDate, setSelectedDate]         = useState<Date | null>(null);
  const [selectedTime, setSelectedTime]         = useState('');
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedSport, setSelectedSport]       = useState('Football');
  const [selectedFormat, setSelectedFormat]     = useState('3v3');
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState(6);
  const [specialRequests, setSpecialRequests]   = useState('');
  const [bookingError, setBookingError]         = useState('');

  // ── Bottom sheet animation ──
  const [bodyH, setBodyH] = useState(0);
  const sheetAnim  = useRef(new Animated.Value(9999)).current;
  const currentY   = useRef(9999);
  const dragStartY = useRef(9999);

  // Snap point refs — updated when bodyH is measured
  const snapFull = useRef(12);
  const snapHalf = useRef(400);
  const snapPeek = useRef(600);

  useEffect(() => {
    const id = sheetAnim.addListener(({ value }) => { currentY.current = value; });
    return () => sheetAnim.removeListener(id);
  }, []);

  useEffect(() => {
    if (bodyH <= 0) return;
    snapFull.current = 12;
    snapHalf.current = Math.round(bodyH * 0.36);
    snapPeek.current = bodyH - PEEK_HEIGHT;
    // Start minimised (peek) — user swipes up to see list
    Animated.spring(sheetAnim, {
      toValue: snapPeek.current,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
    currentY.current = snapPeek.current;
  }, [bodyH]);

  // Collapse sheet when keyboard opens so it never fights the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const prevY = { value: snapPeek.current };

    const showSub = Keyboard.addListener(showEvent, () => {
      prevY.value = currentY.current;
      Animated.spring(sheetAnim, {
        toValue: snapPeek.current,
        useNativeDriver: true,
        damping: 24,
        stiffness: 280,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.spring(sheetAnim, {
        toValue: prevY.value,
        useNativeDriver: true,
        damping: 24,
        stiffness: 280,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const snapTo = (target: number) =>
    Animated.spring(sheetAnim, {
      toValue: target,
      useNativeDriver: true,
      damping: 24,
      stiffness: 280,
      mass: 1,
    }).start();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        dragStartY.current = currentY.current;
        sheetAnim.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const next = Math.max(
          snapFull.current,
          Math.min(snapPeek.current, dragStartY.current + g.dy),
        );
        sheetAnim.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const cur = currentY.current;
        const vel = g.vy;
        let target: number;
        if (vel > 0.5) {
          target = cur < snapHalf.current ? snapHalf.current : snapPeek.current;
        } else if (vel < -0.5) {
          target = cur > snapHalf.current ? snapHalf.current : snapFull.current;
        } else {
          const snaps = [snapFull.current, snapHalf.current, snapPeek.current];
          target = snaps.reduce((prev, curr) =>
            Math.abs(curr - cur) < Math.abs(prev - cur) ? curr : prev,
          );
        }
        snapTo(target);
      },
    }),
  ).current;

  // ── Live venue search ──
  useEffect(() => {
    if (!LIVE_SEARCH_ENABLED) return;
    const { osmSport } = selectedFilter;
    if (!location || !osmSport) {
      setLiveVenues([]); setLiveLoading(false); setLiveError(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true); setLiveError(false);
    const timer = setTimeout(() => {
      fetchOverpassVenues(location, radius, osmSport)
        .then((v) => { if (!cancelled) { setLiveVenues(v); setLiveLoading(false); } })
        .catch(() => { if (!cancelled) { setLiveVenues([]); setLiveLoading(false); setLiveError(true); } });
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [location?.latitude, location?.longitude, radius, selectedFilter.osmSport]);

  // Reset format to first valid option whenever sport changes
  useEffect(() => {
    const formats = getFormatsForSport(selectedSport);
    if (formats.length > 0) {
      setSelectedFormat(formats[0].format);
      setSelectedMaxPlayers(formats[0].maxPlayers);
    }
  }, [selectedSport]);

  // ── Venue filtering ──
  const searchSportMockVenues = VENUES.filter((v) => {
    if (!v.coord) return false;
    const matchSearch =
      searchText === '' ||
      v.name.toLowerCase().includes(searchText.toLowerCase()) ||
      v.address.toLowerCase().includes(searchText.toLowerCase()) ||
      v.sports.some((s) => s.toLowerCase().includes(searchText.toLowerCase()));
    const matchSport =
      selectedFilter.label === 'All' ||
      v.sports.some((s) => s.toLowerCase() === selectedFilter.label.toLowerCase());
    return matchSearch && matchSport;
  }).sort((a, b) => (!location ? 0 : venueDistanceKm(location, a) - venueDistanceKm(location, b)));

  const filteredMockVenues = searchSportMockVenues.filter(
    (v) => !location || venueDistanceKm(location, v) <= radius,
  );
  const filteredLiveVenues = liveVenues.filter(
    (lv) =>
      searchText === '' ||
      lv.name.toLowerCase().includes(searchText.toLowerCase()) ||
      lv.address.toLowerCase().includes(searchText.toLowerCase()),
  );
  const listVenues = [...filteredMockVenues, ...filteredLiveVenues];
  const mapVenues  = [...searchSportMockVenues, ...filteredLiveVenues];

  const handleBookVenue = (venue: Venue) => {
    setBookingVenue(venue);
    const sport =
      venue.sports.length === 1 ? venue.sports[0]
      : selectedFilter.label !== 'All' ? selectedFilter.label
      : 'Football';
    if (BOOKING_SPORTS.includes(sport)) setSelectedSport(sport);
  };

  const totalPrice = bookingVenue ? bookingVenue.pricePerHour * selectedDuration : 0;

  const handleConfirm = async () => {
    if (!bookingVenue) return;

    // Required field validation
    if (!selectedDate) {
      setBookingError('Please select a date');
      return;
    }
    if (!selectedTime) {
      setBookingError('Please select a time slot');
      return;
    }
    setBookingError('');

    if (user) {
      // Persist to Supabase — fire-and-forget (don't block the success screen)
      supabase.from('bookings').insert({
        user_id:         user.id,
        venue_name:      bookingVenue.name,
        venue_address:   bookingVenue.address,
        sport:           selectedSport,
        date:            selectedDate
                           ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                           : '',
        time_slot:       selectedTime,
        duration_hours:  selectedDuration,
        players_count:   selectedMaxPlayers,
        players_format:  selectedFormat,
        special_requests: specialRequests || null,
        total_price:     totalPrice,
        status:          'confirmed',
      }).then(({ error }) => {
        if (error) console.warn('Booking save error:', error.message);
      });
    }

    setConfirmed(true);
  };
  const resetBooking  = () => {
    setConfirmed(false); setBookingVenue(null);
    setSelectedDate(null); setSelectedTime('');
    setSelectedDuration(1); setSelectedSport('Football');
    setSelectedFormat('3v3'); setSelectedMaxPlayers(6);
    setSpecialRequests('');
    setBookingError('');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Top bar: search + sport filters ── */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.pageTitle}>Book Venue</Text>
            {(locationLoading || (LIVE_SEARCH_ENABLED && liveLoading)) && (
              <ActivityIndicator size="small" color="#16a34a" />
            )}
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{listVenues.length} venues</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search venues, sports..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sport filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {SPORT_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.label}
              style={[styles.pill, selectedFilter.label === f.label && styles.pillActive]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={styles.pillEmoji}>{f.emoji}</Text>
              <Text style={[styles.pillLabel, selectedFilter.label === f.label && styles.pillLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* ── Map area + bottom sheet ── */}
      <View
        style={styles.body}
        onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}
      >
        {/* Full-screen map */}
        <View style={StyleSheet.absoluteFill}>
          <BookMap
            location={location}
            venues={mapVenues}
            radius={radius}
            onBookVenue={handleBookVenue}
            onSwitchToList={() => snapTo(snapHalf.current)}
            onRadiusChange={setRadius}
          />
        </View>

        {/* Bottom sheet */}
        {bodyH > 0 && (
          <Animated.View
            style={[
              styles.sheet,
              { height: bodyH, transform: [{ translateY: sheetAnim }] },
            ]}
          >
            {/* Drag handle + header — panHandlers live here */}
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetCount}>
                  {listVenues.length} venue{listVenues.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.sliderRow}>
                  <Ionicons name="radio-button-on-outline" size={12} color="#16a34a" />
                  <RadiusSlider
                    style={styles.compactSlider}
                    minimumValue={1}
                    maximumValue={20}
                    step={1}
                    value={radius}
                    onValueChange={(v: number) => setRadius(Math.round(v))}
                    minimumTrackTintColor="#16a34a"
                    maximumTrackTintColor="#e5e7eb"
                    thumbTintColor="#16a34a"
                  />
                  <Text style={styles.radiusLabel}>{radius} km</Text>
                </View>
              </View>
            </View>

            {/* Venue list */}
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {listVenues.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={44} color="#d1d5db" />
                  <Text style={styles.emptyText}>No venues match your search</Text>
                  {selectedFilter.osmSport && !location && (
                    <Text style={styles.emptySubText}>Enable location for more results</Text>
                  )}
                </View>
              ) : (
                listVenues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    distance={
                      location && venue.coord
                        ? formatDistance(venueDistanceKm(location, venue))
                        : '–'
                    }
                    onBook={() => handleBookVenue(venue)}
                  />
                ))
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {/* ── Booking modal ── */}
      <Modal visible={!!bookingVenue && !confirmed} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheetOverlay}>
            <SafeAreaView style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Book Venue</Text>
                <TouchableOpacity onPress={() => setBookingVenue(null)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              {bookingVenue && (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
                <View style={[styles.venueSummary, { backgroundColor: bookingVenue.imageColor + '15' }]}>
                  <View style={[styles.venueIconBig, { backgroundColor: bookingVenue.imageColor }]}>
                    <Ionicons name="location" size={28} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.venueSummaryName}>{bookingVenue.name}</Text>
                    <Text style={styles.venueSummaryAddr}>{bookingVenue.address}</Text>
                    {bookingVenue.pricePerHour > 0 ? (
                      <Text style={styles.venueSummaryPrice}>
                        PKR {bookingVenue.pricePerHour.toLocaleString()}/hr
                      </Text>
                    ) : (
                      <Text style={[styles.venueSummaryPrice, { color: '#6b7280' }]}>
                        Contact venue for pricing
                      </Text>
                    )}
                  </View>
                  {bookingVenue.source === 'live' && (
                    <View style={styles.liveBadge}>
                      <Ionicons name="radio" size={10} color="#2563eb" />
                      <Text style={styles.liveBadgeText}>Live</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.fieldLabel}>
                  Date<Text style={styles.required}> *</Text>
                </Text>
                <DatePickerField
                  value={selectedDate}
                  onChange={(d) => {
                    setSelectedDate(d);
                    setBookingError('');
                    if (selectedTime && isSlotPast(selectedTime, d)) setSelectedTime('');
                  }}
                  placeholder="Select a date"
                />

                <Text style={styles.fieldLabel}>
                  Time Slot<Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.timeGrid}>
                  {TIME_SLOTS.map((t) => {
                    const past = isSlotPast(t, selectedDate);
                    return (
                      <TouchableOpacity
                        key={t}
                        disabled={past}
                        style={[styles.timeSlot, selectedTime === t && styles.timeSlotActive, past && styles.timeSlotDisabled]}
                        onPress={() => { setSelectedTime(t); setBookingError(''); }}
                      >
                        <Text style={[styles.timeSlotText, selectedTime === t && styles.timeSlotTextActive, past && styles.timeSlotTextDisabled]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.durationBtn, selectedDuration === d && styles.durationBtnActive]}
                      onPress={() => setSelectedDuration(d)}
                    >
                      <Text style={[styles.durationBtnText, selectedDuration === d && styles.durationBtnTextActive]}>
                        {d} {d === 1 ? 'Hour' : 'Hours'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Sport</Text>
                <View style={styles.sportRow}>
                  {BOOKING_SPORTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sportChip, selectedSport === s && styles.sportChipActive]}
                      onPress={() => setSelectedSport(s)}
                    >
                      <Text style={[styles.sportChipText, selectedSport === s && styles.sportChipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Format</Text>
                <View style={styles.sportRow}>
                  {getFormatsForSport(selectedSport).map((f) => (
                    <TouchableOpacity
                      key={f.format}
                      style={[styles.sportChip, selectedFormat === f.format && styles.sportChipActive]}
                      onPress={() => { setSelectedFormat(f.format); setSelectedMaxPlayers(f.maxPlayers); setBookingError(''); }}
                    >
                      <Text style={[styles.sportChipText, selectedFormat === f.format && styles.sportChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.fieldHint}>Max {selectedMaxPlayers} players total</Text>

                <Text style={styles.fieldLabel}>Special Requests (optional)</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Any special requirements?"
                  placeholderTextColor="#9ca3af"
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  multiline
                />

                {bookingVenue.pricePerHour > 0 && (
                  <View style={styles.totalBox}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLbl}>
                        PKR {bookingVenue.pricePerHour.toLocaleString()} × {selectedDuration}h
                      </Text>
                      <Text style={styles.totalAmt}>PKR {totalPrice.toLocaleString()}</Text>
                    </View>
                  </View>
                )}

                {bookingError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{bookingError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Booking confirmed ── */}
      <Modal visible={confirmed} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={72} color="#16a34a" style={{ marginBottom: 12 }} />
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSub}>
              Your booking at {bookingVenue?.name} has been confirmed.
            </Text>
            <View style={styles.confirmDetails}>
              {selectedDate && (
                <View style={styles.confirmRow}>
                  <Ionicons name="calendar-outline" size={16} color="#16a34a" />
                  <Text style={styles.confirmRowText}>{selectedDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
              )}
              {selectedTime && (
                <View style={styles.confirmRow}>
                  <Ionicons name="time-outline" size={16} color="#16a34a" />
                  <Text style={styles.confirmRowText}>{selectedTime} · {selectedDuration}h</Text>
                </View>
              )}
              {totalPrice > 0 && (
                <View style={styles.confirmRow}>
                  <Ionicons name="cash-outline" size={16} color="#16a34a" />
                  <Text style={styles.confirmRowText}>PKR {totalPrice.toLocaleString()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={resetBooking}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Compact horizontal venue card ──
function VenueCard({
  venue,
  distance,
  onBook,
}: {
  venue: Venue;
  distance: string;
  onBook: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.82} onPress={onBook}>
      <View style={[styles.cardThumb, { backgroundColor: venue.imageColor }]}>
        {venue.source === 'live' && (
          <View style={styles.liveChip}>
            <Text style={styles.liveChipText}>LIVE</Text>
          </View>
        )}
        <Text style={styles.cardEmoji}>{sportEmojiStr(venue.sports[0] ?? '')}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName} numberOfLines={1}>{venue.name}</Text>
          <Text style={styles.cardDist}>{distance}</Text>
        </View>
        <Text style={styles.cardAddr} numberOfLines={1}>{venue.address}</Text>
        <View style={styles.cardBottomRow}>
          {venue.pricePerHour > 0 ? (
            <Text style={styles.cardPrice}>
              PKR {venue.pricePerHour.toLocaleString()}
              <Text style={styles.perHr}>/hr</Text>
            </Text>
          ) : (
            <Text style={styles.cardPriceFree}>Contact Venue</Text>
          )}
          <TouchableOpacity style={styles.bookBtn} onPress={onBook}>
            <Text style={styles.bookBtnText}>Book</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // ── Top bar ──
  topBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  countBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  searchRow:  { paddingHorizontal: 12, paddingBottom: 10 },
  searchBox:  {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filterRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  pillActive:      { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pillEmoji:       { fontSize: 14 },
  pillLabel:       { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  pillLabelActive: { color: '#fff' },

  // ── Body (map + sheet) ──
  body: { flex: 1 },

  // ── Bottom sheet ──
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 14,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetCount:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  sliderRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactSlider: { width: 90, height: 28 },
  radiusLabel:   { fontSize: 12, fontWeight: '700', color: '#16a34a', minWidth: 36 },

  listScroll:  { flex: 1 },
  listContent: { padding: 10, gap: 8 },

  emptyState:   { alignItems: 'center', paddingVertical: 48 },
  emptyText:    { color: '#9ca3af', fontSize: 14, marginTop: 12, fontWeight: '500' },
  emptySubText: { color: '#d1d5db', fontSize: 12, marginTop: 6, textAlign: 'center' },

  // ── Venue card ──
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardThumb: { width: 76, alignItems: 'center', justifyContent: 'center' },
  liveChip:  {
    position: 'absolute',
    top: 6,
    left: 4,
    backgroundColor: 'rgba(37,99,235,0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveChipText:  { color: '#fff', fontSize: 8, fontWeight: '800' },
  cardEmoji:     { fontSize: 28 },
  cardBody:      { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'space-between' },
  cardTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardName:      { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827', marginRight: 6 },
  cardDist:      { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  cardAddr:      { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice:     { fontSize: 15, fontWeight: '800', color: '#111827' },
  perHr:         { fontSize: 11, fontWeight: '400', color: '#9ca3af' },
  cardPriceFree: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  bookBtn:       { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  bookBtnText:   { color: '#fff', fontWeight: '700', fontSize: 12 },

  // ── Booking modal ──
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '94%' },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHeader:  {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalContent: { padding: 16 },
  venueSummary: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  venueIconBig: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  venueSummaryName:  { fontWeight: '700', color: '#111827', fontSize: 15 },
  venueSummaryAddr:  { color: '#6b7280', fontSize: 12, marginTop: 2 },
  venueSummaryPrice: { color: '#16a34a', fontWeight: '700', fontSize: 14, marginTop: 4 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignSelf: 'flex-start',
  },
  liveBadgeText: { color: '#2563eb', fontSize: 10, fontWeight: '700' },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  required: { color: '#ef4444' },
  fieldHint: { color: '#9ca3af', fontSize: 12, marginTop: -10, marginBottom: 14 },
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
    marginBottom: 10,
  },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 },
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
  timeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  timeSlot:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  timeSlotActive:   { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  timeSlotDisabled: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', opacity: 0.45 },
  timeSlotText:     { color: '#6b7280', fontSize: 12 },
  timeSlotTextActive:   { color: '#fff', fontWeight: '600' },
  timeSlotTextDisabled: { color: '#d1d5db' },
  durationRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  durationBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#f9fafb' },
  durationBtnActive:     { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  durationBtnText:       { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  durationBtnTextActive: { color: '#fff' },
  sportRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  sportChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  sportChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  sportChipText:   { color: '#6b7280', fontSize: 13 },
  sportChipTextActive: { color: '#fff' },
  totalBox:  { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLbl:  { color: '#374151', fontSize: 14 },
  totalAmt:  { color: '#16a34a', fontWeight: '800', fontSize: 20 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Success ──
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:    { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360 },
  successTitle:   { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successSub:     { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  confirmDetails: { width: '100%', gap: 10, marginBottom: 24 },
  confirmRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', padding: 10, borderRadius: 10 },
  confirmRowText: { color: '#374151', fontWeight: '600' },
  doneBtn:        { backgroundColor: '#16a34a', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 12 },
  doneBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
