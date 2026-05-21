import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { Venue } from '../data/mockData';
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

function VenueMarker({
  venue,
  emoji,
  isSelected,
  onPress,
}: {
  venue: Venue;
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  return (
    <Marker
      coordinate={venue.coord!}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
    >
      <View
        style={[styles.markerOuter, isSelected && styles.markerOuterSelected]}
        onLayout={() => setTracksViewChanges(false)}
      >
        <View style={[styles.markerCircle, { backgroundColor: venue.imageColor ?? '#16a34a' }]}>
          <Text style={styles.markerEmoji}>{emoji}</Text>
        </View>
        <View style={[styles.markerBubble, isSelected && styles.markerBubbleSelected]}>
          <Text
            style={[styles.markerName, isSelected && styles.markerNameSelected]}
            numberOfLines={1}
          >
            {venue.name}
          </Text>
        </View>
        <View style={[styles.markerTip, isSelected && styles.markerTipSelected]} />
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
  // Prevents onRegionChangeComplete from firing during a programmatic animateToRegion
  const programmaticRef = useRef(false);
  // Prevents animateToRegion from firing when the radius change originated from the map
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

  // Sync map view when radius slider or GPS location changes
  useEffect(() => {
    if (mapDrivenRef.current) {
      mapDrivenRef.current = false;
      return;
    }
    if (!mapRef.current) return;
    programmaticRef.current = true;
    mapRef.current.animateToRegion(
      {
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
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
          if (programmaticRef.current) {
            programmaticRef.current = false;
            return;
          }
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
            fillColor="rgba(22,163,74,0.08)"
            strokeColor="#16a34a"
            strokeWidth={1.5}
          />
        )}
        {venues.map((venue) => {
          const coord = venue.coord;
          if (!coord) return null;
          const emoji = sportEmoji(venue.sports);
          const isSelected = selected?.id === venue.id;
          return (
            <VenueMarker
              key={venue.id}
              venue={venue}
              emoji={emoji}
              isSelected={isSelected}
              onPress={() => setSelected(venue)}
            />
          );
        })}
      </MapView>

      {selected && (
        <View style={styles.venueCard}>
          <View style={styles.cardRow}>
            <Text style={styles.cardEmoji}>{sportEmoji(selected.sports)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.cardAddr} numberOfLines={1}>{selected.address}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                PKR {selected.pricePerHour.toLocaleString()}
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
  markerOuter: { alignItems: 'center', minWidth: 70 },
  markerOuterSelected: { transform: [{ scale: 1.18 }] },
  markerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  markerEmoji: {
    fontSize: Platform.OS === 'android' ? 22 : 24,
    lineHeight: Platform.OS === 'android' ? 28 : 30,
    textAlign: 'center',
    includeFontPadding: false,
  },
  markerBubble: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    maxWidth: 130,
  },
  markerBubbleSelected: { backgroundColor: '#16a34a' },
  markerName: { fontSize: 10, fontWeight: '700', color: '#111827' },
  markerNameSelected: { color: '#fff' },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.97)',
  },
  markerTipSelected: { borderTopColor: '#16a34a' },
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
