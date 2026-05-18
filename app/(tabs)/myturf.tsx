import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOOKINGS, MY_MATCHES, type Booking, type MatchItem } from '../../data/mockData';

export default function MyTurfScreen() {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const [notifVisible, setNotifVisible] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.safeHeader}>
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{BOOKINGS.length}</Text>
            <Text style={styles.statLbl}>Bookings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{MY_MATCHES.length}</Text>
            <Text style={styles.statLbl}>Matches</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>1</Text>
            <Text style={styles.statLbl}>Tournaments</Text>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        {BOOKINGS.map((b) => (
          <BookingCard key={b.id} booking={b} onPress={() => setSelectedBooking(b)} />
        ))}

        {/* My Matches */}
        <Text style={styles.sectionTitle}>My Matches</Text>
        {MY_MATCHES.map((m) => (
          <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />
        ))}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { icon: 'calendar-outline' as const, label: 'New Booking', color: '#16a34a' },
            { icon: 'trophy-outline' as const, label: 'My Tournaments', color: '#f59e0b' },
            { icon: 'bar-chart-outline' as const, label: 'Statistics', color: '#3b82f6' },
            { icon: 'people-outline' as const, label: 'My Teams', color: '#8b5cf6' },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={styles.quickBtn}>
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
                <View style={[styles.confirmedBadge]}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                  <Text style={styles.confirmedText}>{selectedBooking.status}</Text>
                </View>

                <View style={styles.detailGrid}>
                  {[
                    { icon: 'football-outline' as const, label: 'Sport', value: selectedBooking.sport },
                    { icon: 'calendar-outline' as const, label: 'Date', value: selectedBooking.date },
                    { icon: 'time-outline' as const, label: 'Time', value: selectedBooking.time },
                    { icon: 'cash-outline' as const, label: 'Total', value: `PKR ${selectedBooking.price.toLocaleString()}` },
                  ].map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name={row.icon} size={18} color="#16a34a" />
                      </View>
                      <View>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.cancelBookingBtn}>
                  <Text style={styles.cancelBookingText}>Cancel Booking</Text>
                </TouchableOpacity>
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
                    { icon: 'football-outline' as const, label: 'Sport', value: selectedMatch.sport },
                    { icon: 'people-outline' as const, label: 'Format', value: selectedMatch.players },
                    { icon: 'time-outline' as const, label: 'Date & Time', value: selectedMatch.date },
                    { icon: 'location-outline' as const, label: 'Venue', value: selectedMatch.location },
                  ].map((row) => (
                    <View key={row.label} style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name={row.icon} size={18} color="#16a34a" />
                      </View>
                      <View>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>View Full Lineup</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Notification Modal */}
      <Modal visible={notifVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.centeredOverlay} activeOpacity={1} onPress={() => setNotifVisible(false)}>
          <View style={styles.notifBox}>
            <Text style={styles.notifTitle}>Notifications</Text>
            {[
              { icon: 'checkmark-circle' as const, color: '#16a34a', text: 'Your booking at Model Town is confirmed', time: '2h ago' },
              { icon: 'trophy' as const, color: '#f59e0b', text: 'Ramadan Cricket Cup starts in 3 days', time: '5h ago' },
              { icon: 'person-add' as const, color: '#3b82f6', text: 'Bilal Khan invited you to join his team', time: '1d ago' },
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

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.bookingCard} onPress={onPress}>
      <View style={styles.bookingLeft}>
        <Text style={styles.bookingEmoji}>{booking.sportEmoji}</Text>
        <View>
          <Text style={styles.bookingVenue} numberOfLines={1}>{booking.venueName}</Text>
          <Text style={styles.bookingMeta}>{booking.date} · {booking.time}</Text>
          <Text style={styles.bookingPrice}>PKR {booking.price.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.confirmedBadge}>
        <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
        <Text style={styles.confirmedText}>{booking.status}</Text>
      </View>
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
          <Text style={styles.matchMeta}>
            <Ionicons name="people-outline" size={12} color="#9ca3af" /> {match.players}
          </Text>
          <Text style={styles.matchMeta}>
            <Ionicons name="time-outline" size={12} color="#9ca3af" /> {match.date}
          </Text>
          <Text style={styles.matchMeta}>
            <Ionicons name="location-outline" size={12} color="#9ca3af" /> {match.location}
          </Text>
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
  safeHeader: { backgroundColor: '#16a34a' },
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
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 6 },
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
  bookingMeta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
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
  matchMeta: { color: '#6b7280', fontSize: 12, marginTop: 1 },
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
    width: 48,
    height: 48,
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
    maxHeight: '85%',
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
  sheetContent: { padding: 20, alignItems: 'center' },
  sheetIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sheetVenueName: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  detailGrid: { width: '100%', gap: 12, marginTop: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
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
