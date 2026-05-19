import React, { useState } from 'react';
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
import { formatDistance } from '../../utils/geo';
import { useUserLocation } from '../../hooks/useUserLocation';
import BookMap from '../../components/BookMap';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';

const TIME_SLOTS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
];
const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton'];
const DURATIONS = [1, 2, 3];
const RADIUS_OPTIONS = [1, 3, 5, 10, 20];

function StarRating({ rating }: { rating: number }) {
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
  const [bookingVenue, setBookingVenue] = useState<Venue | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Booking form state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedSport, setSelectedSport] = useState('Football');
  const [playersCount, setPlayersCount] = useState('10');
  const [specialRequests, setSpecialRequests] = useState('');

  const filteredVenues = VENUES.filter((v) => {
    const matchSearch =
      searchText === '' ||
      v.name.toLowerCase().includes(searchText.toLowerCase()) ||
      v.address.toLowerCase().includes(searchText.toLowerCase()) ||
      v.sports.some((s) => s.toLowerCase().includes(searchText.toLowerCase()));
    const matchRadius = !location || venueDistanceKm(location, v) <= radius;
    return matchSearch && matchRadius;
  }).sort((a, b) => {
    if (!location) return 0;
    return venueDistanceKm(location, a) - venueDistanceKm(location, b);
  });

  const totalPrice = bookingVenue ? bookingVenue.pricePerHour * selectedDuration : 0;

  const handleConfirm = () => {
    setConfirmed(true);
  };

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
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.headerTitle}>Book Venue</Text>
                  {locationLoading && (
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

      {/* Radius selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.radiusBar}
        contentContainerStyle={styles.radiusBarContent}
      >
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.radiusPill, radius === r && styles.radiusPillActive]}
            onPress={() => setRadius(r)}
          >
            <Ionicons name="radio-button-on" size={12} color={radius === r ? '#fff' : '#6b7280'} />
            <Text style={[styles.radiusPillText, radius === r && styles.radiusPillTextActive]}>
              {r} km
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {viewMode === 'list' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {filteredVenues.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No venues match your search</Text>
            </View>
          )}
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              distance={
                location
                  ? formatDistance(venueDistanceKm(location, venue))
                  : venue.distance
              }
              onBook={() => setBookingVenue(venue)}
            />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      ) : (
        <BookMap
          location={location}
          venues={filteredVenues}
          radius={radius}
          onBookVenue={setBookingVenue}
          onSwitchToList={() => setViewMode('list')}
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
                    <Text style={styles.venueSummaryPrice}>
                      PKR {bookingVenue.pricePerHour.toLocaleString()}/hr
                    </Text>
                  </View>
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
                  {SPORTS.map((s) => (
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

                {/* Total */}
                <View style={styles.totalBox}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>
                      PKR {bookingVenue.pricePerHour.toLocaleString()} × {selectedDuration}h
                    </Text>
                    <Text style={styles.totalAmt}>PKR {totalPrice.toLocaleString()}</Text>
                  </View>
                </View>

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
              <View style={styles.confirmRow}>
                <Ionicons name="cash-outline" size={16} color="#16a34a" />
                <Text style={styles.confirmRowText}>PKR {totalPrice.toLocaleString()}</Text>
              </View>
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
          <Text style={styles.venuePrice}>PKR {venue.pricePerHour.toLocaleString()}<Text style={styles.perHr}>/hr</Text></Text>
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
  searchWrapper: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
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
  radiusBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  radiusBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  radiusPillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  radiusPillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  radiusPillTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#9ca3af', fontSize: 14, marginTop: 12 },
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
  venueBody: { padding: 14 },
  venueNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  venueName: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 16, marginRight: 8 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  distanceText: { color: '#6b7280', fontSize: 12 },
  venueAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  venueAddr: { color: '#9ca3af', fontSize: 12, flex: 1 },
  venueSportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sportTag: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' },
  sportTagText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  venuePriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  venuePrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  perHr: { fontSize: 13, fontWeight: '400', color: '#6b7280' },
  bookBtn: { backgroundColor: '#16a34a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Sheet
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
