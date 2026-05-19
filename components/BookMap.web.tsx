import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../data/mockData';
import type { Coord } from '../utils/geo';

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
}

export default function BookMap({ onSwitchToList }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={64} color="#d1d5db" />
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.sub}>Interactive map is available on iOS &amp; Android</Text>
      <TouchableOpacity style={styles.btn} onPress={onSwitchToList}>
        <Text style={styles.btnText}>Switch to List View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#374151' },
  sub: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  btn: { marginTop: 8, backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});
