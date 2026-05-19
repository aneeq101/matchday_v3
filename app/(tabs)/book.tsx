import React, { useState, useEffect } from 'react';
import RadiusSlider from '../../components/RadiusSlider';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VENUES, venueDistanceKm, type Venue } from '../../data/mockData';
import { formatDistance, type Coord } from '../../utils/geo';
import { useUserLocation } from '../../hooks/useUserLocation';
import BookMap from '../../components/BookMap';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';

const TIME_SLOTS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
];
const BOOKING_SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton'];
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
              .filter(Boolean)
              .join(', ') || 'Address unknown',
          sports: [sport],
          distance: '',
          pricePerHour: 0,
          imageColor: color,
          coord: { latitude: el.lat ?? el.center.lat, longitude: el.lon ?? el.center.lon },
          source: 'live',
        }));
    } catch {
      // try next endpoint
    }
  }

  throw new Error('All Overpass endpoints failed');
}

function StarRating({ rating }: { rating: number }) {
  if (rating === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.floor(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={12}
          color="#f59e0b"
        />
      ))}
      <Text style={{ color: '#6b7280', fontSize: 12, marginLeft: 4 }}>{rating}</Text>
    </View>
  );
}

export default function BookScreen() {
  const { location, loading: locationLoading } = useUserLocation();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchText, setSearchText] = useState('');
  const [radius, setRadius] = useState(5);
  const [selectedFilter, setSelectedFilter] = useState<SportFilter>(SPORT_FILTERS[0]);
  const [liveVenues, setLiveVenues] = useState<Venue[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [bookingVenue, setBookingVenue] = useState<Venue | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Booking form state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedSport, setSelectedSport] = useState('Football');
  const [playersCount, setPlayersCount] = useState('10');
  const [specialRequests, setSpecialRequests] = useState('');

  // Live venue search via Overpass API
  useEffect(() => {
    const { osmSport } = selectedFilter;
    if (!location || !osmSport) {
      setLiveVenues([]);
      setLiveLoading(false);
      setLiveError(false);
      return;
    }

    let cancelled = false;
    setLiveLoading(true);
    setLiveError(false);

    const timer = setTimeout(() => {
      fetchOverpassVenues(location, radius, osmSport)
        .then((venues) => {
          if (!cancelled) { setLiveVenues(venues); setLiveLoading(false); }
        })
        .catch(() => {
          if (!cancelled) { setLiveVenues([]); setLiveLoading(false); setLiveError(true); }
        });
    }, 800);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [location?.latitude, location?.longitude, radius, selectedFilter.osmSport]);

  const filteredMockVenues = VENUES.filter((v) => {
    if (!v.coord) return false;
    const matchSearch =
      searchText === '' ||
      v.name.toLowerCase().includes(searchText.toLowerCase()) ||
      v.address.toLowerCase().includes(searchText.toLowerCase()) ||
      v.sports.some((s) => s.toLowerCase().includes(searchText.toLowerCase()));
    const matchRadius = !location || venueDistanceKm(location, v) <= radius;
    const matchSport =
      selectedFilter.label === 'All' ||
      v.sports.some((s) => s.toLowerCase() === selectedFilter.label.toLowerCase());
    return matchSearch && matchRadius && matchSport;
  }).sort((a, b) => {
    if (!location) return 0;
    return venueDistanceKm(location, a) - venueDistanceKm(location, b);
  });

  const filteredLiveVenues = liveVenues.filter(
    (lv) =>
      searchText === '' ||
      lv.name.toLowerCase().includes(searchText.toLowerCase()) ||
      lv.address.toLowerCase().includes(searchText.toLowerCase()),
  );

  const allVenues = [...filteredMockVenues, ...filteredLiveVenues];

  const handleBookVenue = (venue: Venue) => {
    setBookingVenue(venue);
    const sport =
      venue.sports.length === 1
        ? venue.sports[0]
        : selectedFilter.label !== 'All'
        ? selectedFilter.label
        : 'Football';
    if (BOOKING_SPORTS.includes(sport)) setSelectedSport(sport);
  };

  const totalPrice = bookingVenue ? bookingVenue.pricePerHour * selectedDuration : 0;

  const handleConfirm = () => setConfirmed(true);

  const resetBooking = () => {
    setConfirmed(false);
    setBookingVenue(null);
    setSelectedDate('');
    setSelectedTime('');
    setSelectedDuration(1);
    setSelectedSport('Football');
    setPlayersCount('10');
    setSpecialRequests('');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.headerTitle}>Book Venue</Text>
                  {(locationLoading || liveLoading) && (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                  )}
                </View>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}>
                  <Ionicons
                    name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search venues, sports..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sport filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {SPORT_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterPill, selectedFilter.label === f.label && styles.filterPillActive]}
            onPress={() => setSelectedFilter(f)}
          >
            <Text style={styles.filterPillEmoji}>{f.emoji}</Text>
            <Text style={[styles.filterPillText, selectedFilter.label === f.label && styles.filterPillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Radius slider */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="radio-button-on-outline" size={15} color="#16a34a" />
            <Text style={styles.sliderLabel}>Search Radius</Text>
          </View>
          <Text style={styles.sliderValue}>{radius} km</Text>
        </View>
        <RadiusSlider
          style={styles.slider}
          minimumValue={1}
          maximumValue={20}
          step={1}
          value={radius}
          onValueChange={(v) => setRadius(Math.round(v))}
          minimumTrackTintColor="#16a34a"
          maximumTrackTintColor="#e5e7eb"
          thumbTintColor="#16a34a"
        />
        <View style={styles.sliderTicks}>
          {[1, 5, 10, 15, 20].map((v) => (
            <Text key={v} style={[styles.sliderTick, radius === v && styles.sliderTickActive]}>
              {v}km
            </Text>
          ))}
        </View>
      </View>

      {/* Live search status bar */}
      {selectedFilter.osmSport && (
        <View style={styles.liveBar}>
          {liveLoading ? (
            <>
              <ActivityIndicator size="small" color="#16a34a" style={{ transform: [{ scale: 0.75 }] }} />
              <Text style={styles.liveBarText}>
                Searching {selectedFilter.label} venues nearby…
              </Text>
            </>
          ) : liveError ? (
            <>
              <Ionicons name="warning-outline" size={13} color="#dc2626" />
              <Text style={[styles.liveBarText, { color: '#dc2626' }]}>
                Live search unavailable — showing saved venues only
              </Text>
            </>
          ) : !location ? (
            <>
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text style={[styles.liveBarText, { color: '#9ca3af' }]}>
                Enable location to discover live venues
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="radio" size={13} color="#16a34a" />
              <Text style={styles.liveBarText}>
                {liveVenues.length} live {selectedFilter.label.toLowerCase()} venue
                {liveVenues.length !== 1 ? 's' : ''} found nearby
              </Text>
            </>
          )}
        </View>
      )}

      {viewMode === 'list' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {allVenues.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No venues match your search</Text>
              {selectedFilter.osmSport && !location && (
                <Text style={styles.emptySubText}>Enable location for live search results</Text>
              )}
            </View>
          )}
          {allVenues.map((venue) => (
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
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : (
        <BookMap
          location={location}
          venues={allVenues}
          radius={radius}
          onBookVenue={handleBookVenue}
          onSwitchToList={() => setViewMode('list')}
          onRadiusChange={setRadius}
        />
      )}

      {/* Booking Modal */}
      <Modal visible={!!bookingVenue && !confirmed} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Book Venue</Text>
              <TouchableOpacity onPress={() => setBookingVenue(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {bookingVenue && (
              <ScrollView contentContainerStyle={styles.sheetContent}>
                {/* Venue Summary */}
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

                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. May 25, 2025"
                  placeholderTextColor="#9ca3af"
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                />

                <Text style={styles.fieldLabel}>Time Slot</Text>
                <View style={styles.timeGrid}>
                  {TIME_SLOTS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeSlot, selectedTime === t && styles.timeSlotActive]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text style={[styles.timeSlotText, selectedTime === t && styles.timeSlotTextActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
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

                <Text style={styles.fieldLabel}>Number of Players</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 10"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={playersCount}
                  onChangeText={setPlayersCount}
                />

                <Text style={styles.fieldLabel}>Special Requests (optional)</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Any special requirements?"
                  placeholderTextColor="#9ca3af"
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  multiline
                />

                {/* Total — only for priced venues */}
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

                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirm Booking</Text>
                </TouchableOpacity>
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Booking Confirmed Screen */}
      <Modal visible={confirmed} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSub}>
              Your booking at {bookingVenue?.name} has been confirmed.
            </Text>

            <View style={styles.confirmDetails}>
              {selectedDate && (
                <View style={styles.confirmRow}>
                  <Ionicons name="calendar-outline" size={16} color="#16a34a" />
                  <Text style={styles.confirmRowText}>{selectedDate}</Text>
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
    <View style={styles.venueCard}>
      <View style={[styles.venueImage, { backgroundColor: venue.imageColor }]}>
        {venue.source === 'live' && (
          <View style={styles.liveOverlayBadge}>
            <Ionicons name="radio" size={10} color="#fff" />
            <Text style={styles.liveOverlayText}>Live</Text>
          </View>
        )}
        <Ionicons name="location" size={36} color="rgba(255,255,255,0.8)" />
        <Text style={styles.venueImageText}>{venue.name.split(' ')[0]}</Text>
      </View>
      <View style={styles.venueBody}>
        <View style={styles.venueNameRow}>
          <Text style={styles.venueName} numberOfLines={1}>{venue.name}</Text>
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={11} color="#6b7280" />
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        </View>
        <StarRating rating={venue.rating} />
        <View style={styles.venueAddrRow}>
          <Ionicons name="location-outline" size={12} color="#9ca3af" />
          <Text style={styles.venueAddr} numberOfLines={1}>{venue.address}</Text>
        </View>
        <View style={styles.venueSportRow}>
          {venue.sports.map((s) => (
            <View key={s} style={styles.sportTag}>
              <Text style={styles.sportTagText}>{s}</Text>
            </View>
          ))}
        </View>
        <View style={styles.venuePriceRow}>
          {venue.pricePerHour > 0 ? (
            <Text style={styles.venuePrice}>
              PKR {venue.pricePerHour.toLocaleString()}
              <Text style={styles.perHr}>/hr</Text>
            </Text>
          ) : (
            <Text style={styles.venuePriceFree}>Contact Venue</Text>
          )}
          <TouchableOpacity style={styles.bookBtn} onPress={onBook}>
            <Text style={styles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
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
  searchWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  // Sport filter pills
  filterScroll: { backgroundColor: '#fff', maxHeight: 56, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  filterPillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  filterPillEmoji: { fontSize: 14 },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterPillTextActive: { color: '#fff' },
  sliderSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sliderLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
  sliderValue: { fontSize: 14, color: '#16a34a', fontWeight: '800' },
  slider: { width: '100%', height: 36 },
  sliderTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  sliderTick: { fontSize: 10, color: '#9ca3af' },
  sliderTickActive: { color: '#16a34a', fontWeight: '700' },
  // Live search status bar
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  liveBarText: { fontSize: 12, color: '#16a34a', fontWeight: '500', flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#9ca3af', fontSize: 14, marginTop: 12 },
  emptySubText: { color: '#d1d5db', fontSize: 12, marginTop: 6, textAlign: 'center' },
  venueCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  venueImage: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  venueImageText: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '700' },
  liveOverlayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37,99,235,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveOverlayText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  venueBody: { padding: 14 },
  venueNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  venueName: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 16, marginRight: 8 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: { color: '#6b7280', fontSize: 12 },
  venueAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  venueAddr: { color: '#9ca3af', fontSize: 12, flex: 1 },
  venueSportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sportTag: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sportTagText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  venuePriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  venuePrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  perHr: { fontSize: 13, fontWeight: '400', color: '#6b7280' },
  venuePriceFree: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  bookBtn: { backgroundColor: '#16a34a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Booking modal sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '94%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sheetContent: { padding: 16 },
  venueSummary: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  venueIconBig: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  venueSummaryName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  venueSummaryAddr: { color: '#6b7280', fontSize: 12, marginTop: 2 },
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
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  timeSlot: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  timeSlotActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  timeSlotText: { color: '#6b7280', fontSize: 12 },
  timeSlotTextActive: { color: '#fff', fontWeight: '600' },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  durationBtnActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  durationBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  durationBtnTextActive: { color: '#fff' },
  sportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
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
  totalBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLbl: { color: '#374151', fontSize: 14 },
  totalAmt: { color: '#16a34a', fontWeight: '800', fontSize: 20 },
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
  // Success
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360 },
  successCircle: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  successSub: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  confirmDetails: { width: '100%', gap: 10, marginBottom: 24 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', padding: 10, borderRadius: 10 },
  confirmRowText: { color: '#374151', fontWeight: '600' },
  doneBtn: { backgroundColor: '#16a34a', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 12 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
