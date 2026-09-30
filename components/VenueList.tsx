import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchVenues } from '../lib/venues';
import { venueDistanceKm, type Venue } from '../data/mockData';
import { useUserLocation } from '../hooks/useUserLocation';
import { formatDistance } from '../utils/geo';

// Inline venue chooser: only venues that host the given sport, nearest first
// when location is available. Used inside the challenge sheet.

interface Props {
  sport: string;
  onPick: (label: string) => void;
  onCancel: () => void;
}

let cache: Venue[] | null = null;

export default function VenueList({ sport, onPick, onCancel }: Props) {
  const { location } = useUserLocation();
  const [venues, setVenues] = useState<Venue[] | null>(cache);
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (cache) return;
    fetchVenues().then((v) => { cache = v; setVenues(v); });
  }, []);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (venues ?? [])
      .filter((v) => v.sports.some((s) => s.toLowerCase() === sport.toLowerCase()))
      .filter((v) => !q || v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q))
      .map((v) => ({ v, km: location && v.coord ? venueDistanceKm(location, v) : null }))
      .sort((a, b) => (a.km != null && b.km != null ? a.km - b.km : a.v.name.localeCompare(b.v.name)));
  }, [venues, sport, search, location]);

  return (
    <View>
      <View style={styles.topRow}>
        <Text style={styles.title}>{sport} venues{location ? ' near you' : ''}</Text>
        <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or area"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {venues === null ? (
        <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
      ) : list.length === 0 ? (
        <Text style={styles.empty}>No {sport.toLowerCase()} venues found{search ? ' for that search' : ''}.</Text>
      ) : (
        <View style={styles.listBox}>
          {list.slice(0, 40).map(({ v, km }) => (
            <TouchableOpacity
              key={v.id}
              style={styles.row}
              onPress={() => onPick(v.name + (v.address ? `, ${v.address}` : ''))}
            >
              <View style={[styles.dot, { backgroundColor: v.imageColor || '#16a34a' }]}>
                <Ionicons name="location" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {[km != null ? formatDistance(km) : null, v.address].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.price, v.pricePerHour === 0 && { color: '#16a34a' }]}>
                {v.pricePerHour > 0 ? `CAD ${v.pricePerHour}/h` : 'Free / public'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.otherLabel}>Somewhere else?</Text>
      <View style={styles.otherRow}>
        <TextInput
          style={styles.otherInput}
          value={custom}
          onChangeText={setCustom}
          placeholder="Type a place"
          placeholderTextColor="#9ca3af"
          maxLength={80}
        />
        <TouchableOpacity
          style={[styles.useBtn, !custom.trim() && { backgroundColor: '#e5e7eb' }]}
          disabled={!custom.trim()}
          onPress={() => onPick(custom.trim())}
        >
          <Text style={[styles.useText, !custom.trim() && { color: '#9ca3af' }]}>Use</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cancel: { color: '#6b7280', fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f3f4f6',
    borderRadius: 8, paddingHorizontal: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: '#111827' },
  listBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff',
  },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  price: { fontSize: 11, color: '#374151', fontWeight: '700' },
  empty: { color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  otherLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 6 },
  otherRow: { flexDirection: 'row', gap: 8 },
  otherInput: {
    flex: 1, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
  },
  useBtn: { backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  useText: { color: '#fff', fontWeight: '700' },
});
