import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { getVenueCoord, type Venue } from '../data/mockData';
import { latDeltaForRadius, type Coord } from '../utils/geo';

function sportEmoji(sports: string[]): string {
  const s = (sports[0] ?? '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return '⚽';
  if (s.includes('cricket')) return '🏏';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('tennis')) return '🎾';
  if (s.includes('badminton')) return '🏸';
  if (s.includes('baseball')) return '⚾';
  if (s.includes('volleyball')) return '🏐';
  if (s.includes('rugby')) return '🏉';
  return '🏟️';
}

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
}

export default function BookMap({ location, venues, radius, onBookVenue }: Props) {
  const center = location ?? { latitude: 51.5074, longitude: -0.1278 };
  const delta = latDeltaForRadius(radius);

  return (
    <MapView
      style={styles.map}
      region={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
      showsUserLocation
      showsMyLocationButton
    >
      {location && (
        <Circle
          center={location}
          radius={radius * 1000}
          fillColor="rgba(22,163,74,0.08)"
          strokeColor="#16a34a"
          strokeWidth={1.5}
        />
      )}
      {venues.map((venue) => {
        const coord = getVenueCoord(location, venue);
        if (!coord) return null;
        const emoji = sportEmoji(venue.sports);
        return (
          <Marker
            key={venue.id}
            coordinate={coord}
            anchor={{ x: 0.5, y: 1 }}
            calloutAnchor={{ x: 0.5, y: 0 }}
          >
            <View style={styles.markerWrapper}>
              <Text style={styles.markerEmoji}>{emoji}</Text>
              <View style={styles.markerBubble}>
                <Text style={styles.markerName} numberOfLines={1}>{venue.name}</Text>
              </View>
              <View style={styles.markerTip} />
            </View>
            <Callout tooltip onPress={() => onBookVenue(venue)}>
              <View style={styles.callout}>
                <Text style={styles.calloutEmoji}>{emoji}</Text>
                <Text style={styles.calloutName}>{venue.name}</Text>
                <Text style={styles.calloutAddr} numberOfLines={1}>{venue.address}</Text>
                <View style={styles.calloutSports}>
                  {venue.sports.map((s) => (
                    <View key={s} style={styles.sportTag}>
                      <Text style={styles.sportTagText}>{s}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.calloutPrice}>PKR {venue.pricePerHour.toLocaleString()}/hr</Text>
                <View style={styles.calloutBtn}>
                  <Text style={styles.calloutBtnText}>Book Now</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerWrapper: { alignItems: 'center' },
  markerEmoji: { fontSize: 28, lineHeight: 32 },
  markerBubble: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    maxWidth: 140,
  },
  markerName: { fontSize: 10, fontWeight: '700', color: '#111827' },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.96)',
  },
  callout: {
    width: 210,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'center',
  },
  calloutEmoji: { fontSize: 32, marginBottom: 4 },
  calloutName: { fontWeight: '700', fontSize: 14, color: '#111827', marginBottom: 2, textAlign: 'center' },
  calloutAddr: { color: '#9ca3af', fontSize: 11, marginBottom: 8, textAlign: 'center' },
  calloutSports: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8, justifyContent: 'center' },
  sportTag: { backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0' },
  sportTagText: { color: '#16a34a', fontSize: 10, fontWeight: '600' },
  calloutPrice: { color: '#16a34a', fontWeight: '700', fontSize: 16, marginBottom: 10 },
  calloutBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 9, alignItems: 'center', width: '100%' },
  calloutBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
