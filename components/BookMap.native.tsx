import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../data/mockData';
import { latDeltaForRadius, type Coord } from '../utils/geo';

// Sport label — ASCII only (system font, renders synchronously on Android snapshot)
function sportLabel(sports: string[]): string {
  const s = (sports[0] ?? '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return 'F';
  if (s.includes('cricket')) return 'C';
  if (s.includes('basketball')) return 'Bk';
  if (s.includes('tennis')) return 'T';
  if (s.includes('badminton')) return 'Bd';
  if (s.includes('baseball')) return 'Ba';
  if (s.includes('volleyball')) return 'V';
  if (s.includes('rugby')) return 'R';
  return '?';
}

// Sport emoji — used only in the bottom tap-card (not in markers)
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

function sportColor(sports: string[]): string {
  const s = (sports[0] ?? '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return '#16a34a';
  if (s.includes('cricket')) return '#d97706';
  if (s.includes('basketball')) return '#ea580c';
  if (s.includes('tennis')) return '#2563eb';
  if (s.includes('badminton')) return '#7c3aed';
  if (s.includes('baseball')) return '#1d4ed8';
  return '#6b7280';
}

// Marker uses ASCII label + solid color so Android snapshot renders correctly.
// tracksViewChanges={false} from mount — no emoji, no shadows, no async fonts.
function VenueMarker({
  venue,
  isSelected,
  onPress,
}: {
  venue: Venue;
  isSelected: boolean;
  onPress: () => void;
}) {
  const label = sportLabel(venue.sports);
  const color = isSelected ? '#111827' : sportColor(venue.sports);

  return (
    <Marker
      coordinate={venue.coord!}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
      onPress={onPress}
    >
      <View style={styles.markerWrapper}>
        <View style={[styles.markerPin, { backgroundColor: color }, isSelected && styles.markerPinSelected]}>
          <Text style={styles.markerLabel}>{label}</Text>
        </View>
        <View style={[styles.markerPointer, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
  onRadiusChange?: (km: number) => void;
}

export default function BookMap({ location, venues, radius, onBookVenue, onRadiusChange }: Props) {
  const [selected, setSelected] = useState<Venue | null>(null);
  const mapRef = useRef<MapView>(null);
  const programmaticRef = useRef(false);
  const mapDrivenRef = useRef(false);

  const venueCenter =
    venues.length > 0
      ? {
          latitude: venues.reduce((s, v) => s + (v.coord?.latitude ?? 0), 0) / venues.length,
          longitude: venues.reduce((s, v) => s + (v.coord?.longitude ?? 0), 0) / venues.length,
        }
      : null;

  const center = location ?? venueCenter ?? { latitude: 43.6565, longitude: -79.38 };
  const delta = latDeltaForRadius(location ? radius : radius * 2);

  useEffect(() => {
    if (mapDrivenRef.current) { mapDrivenRef.current = false; return; }
    if (!mapRef.current) return;
    programmaticRef.current = true;
    mapRef.current.animateToRegion(
      { latitude: center.latitude, longitude: center.longitude, latitudeDelta: delta, longitudeDelta: delta },
      300,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude, radius]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        showsUserLocation
        showsMyLocationButton
        onPress={() => setSelected(null)}
        onRegionChangeComplete={(region) => {
          if (programmaticRef.current) { programmaticRef.current = false; return; }
          if (!onRadiusChange) return;
          const km = Math.max(1, Math.min(20, Math.round((region.latitudeDelta * 111) / 2.6)));
          mapDrivenRef.current = true;
          onRadiusChange(km);
        }}
      >
        {location && (
          <Circle
            center={location}
            radius={radius * 1000}
            fillColor="rgba(22,163,74,0.07)"
            strokeColor="#16a34a"
            strokeWidth={1.5}
          />
        )}

        {venues.map((venue) => {
          if (!venue.coord) return null;
          return (
            <VenueMarker
              key={venue.id}
              venue={venue}
              isSelected={selected?.id === venue.id}
              onPress={() => setSelected(venue)}
            />
          );
        })}
      </MapView>

      {/* Bottom tap-card — shows emoji + full details when a marker is tapped */}
      {selected && (
        <View style={styles.venueCard}>
          <View style={styles.cardRow}>
            <Text style={styles.cardEmoji}>{sportEmoji(selected.sports)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.cardAddr} numberOfLines={1}>{selected.address}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelected(null)}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.cardTags}>
            {selected.sports.map((s) => (
              <View key={s} style={styles.sportTag}>
                <Text style={styles.sportTagText}>{s}</Text>
              </View>
            ))}
            {selected.source === 'live' && (
              <View style={[styles.sportTag, styles.liveTag]}>
                <Ionicons name="radio" size={9} color="#2563eb" />
                <Text style={[styles.sportTagText, styles.liveTagText]}>Live</Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            {selected.pricePerHour > 0 ? (
              <Text style={styles.cardPrice}>
                CAD {selected.pricePerHour.toLocaleString()}
                <Text style={styles.perHr}>/hr</Text>
              </Text>
            ) : (
              <Text style={styles.cardPriceFree}>Contact venue for pricing</Text>
            )}
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => { onBookVenue(selected); setSelected(null); }}
            >
              <Text style={styles.bookBtnText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Marker — no shadow/elevation, no emoji, solid color + ASCII text
  markerWrapper: { alignItems: 'center' },
  markerPin: {
    minWidth: 36,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPinSelected: {
    borderColor: '#facc15',
    borderWidth: 3,
  },
  markerLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Bottom tap-card
  venueCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 16,
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardEmoji: { fontSize: 36, lineHeight: 42 },
  cardName: { fontWeight: '700', fontSize: 15, color: '#111827', marginBottom: 2 },
  cardAddr: { color: '#9ca3af', fontSize: 12 },
  closeBtn: { padding: 2 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sportTagText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  liveTag: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  liveTagText: { color: '#2563eb' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  perHr: { fontSize: 13, fontWeight: '400', color: '#6b7280' },
  cardPriceFree: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
  bookBtn: { backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
