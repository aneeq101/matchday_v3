import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Venue } from '../data/mockData';
import { latDeltaForRadius, type Coord } from '../utils/geo';

const SPORT_IMAGES = {
  soccer:     require('../assets/sports/soccer.png'),
  cricket:    require('../assets/sports/cricket.png'),
  basketball: require('../assets/sports/basketball.png'),
  tennis:     require('../assets/sports/tennis.png'),
  badminton:  require('../assets/sports/badminton.png'),
  baseball:   require('../assets/sports/baseball.png'),
} as const;

type SportKey = keyof typeof SPORT_IMAGES;

function sportImage(sports: string[]): SportKey {
  const s = (sports[0] ?? '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return 'soccer';
  if (s.includes('cricket'))    return 'cricket';
  if (s.includes('basketball')) return 'basketball';
  if (s.includes('tennis'))     return 'tennis';
  if (s.includes('badminton'))  return 'badminton';
  if (s.includes('baseball'))   return 'baseball';
  return 'soccer';
}

function sportEmoji(sports: string[]): string {
  const s = (sports[0] ?? '').toLowerCase();
  if (s.includes('football') || s.includes('soccer')) return '⚽';
  if (s.includes('cricket'))    return '🏏';
  if (s.includes('basketball')) return '🏀';
  if (s.includes('tennis'))     return '🎾';
  if (s.includes('badminton'))  return '🏸';
  if (s.includes('baseball'))   return '⚾';
  return '🏟️';
}


// Android react-native-maps takes a native bitmap snapshot of the marker view.
// Strategy: keep tracksViewChanges=true until the image's onLoadEnd fires
// (image fully decoded), then wait 400 ms for the native layer to rasterise
// before freezing. A 2500 ms hard fallback covers any edge cases.
// Selection changes re-enable tracking briefly to capture the colour update.
function VenueMarker({
  venue,
  isSelected,
  onPress,
}: {
  venue: Venue;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const prevSelectedRef = useRef(isSelected);
  const frozenRef = useRef(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const freeze = useCallback(() => {
    if (frozenRef.current) return;
    frozenRef.current = true;
    setTracksViewChanges(false);
  }, []);

  // Image onLoadEnd: pixels decoded — give native 400 ms then freeze
  const handleImageLoad = useCallback(() => {
    if (frozenRef.current) return;
    freezeTimerRef.current = setTimeout(freeze, 400);
  }, [freeze]);

  // Hard fallback: freeze after 2500 ms regardless
  useEffect(() => {
    const t = setTimeout(freeze, 2500);
    return () => {
      clearTimeout(t);
      if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-enable briefly when selection state changes to capture colour update
  useEffect(() => {
    if (prevSelectedRef.current !== isSelected) {
      prevSelectedRef.current = isSelected;
      frozenRef.current = false;
      setTracksViewChanges(true);
      const t = setTimeout(() => {
        frozenRef.current = true;
        setTracksViewChanges(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isSelected]);

  const imgKey  = sportImage(venue.sports);
  const imgSize = isSelected ? 34 : 24;

  return (
    <Marker
      coordinate={venue.coord!}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
    >
      <Image
        source={SPORT_IMAGES[imgKey]}
        style={{ width: imgSize, height: imgSize }}
        resizeMode="contain"
        onLoadEnd={handleImageLoad}
      />
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
  const mapRef          = useRef<MapView>(null);
  const programmaticRef = useRef(false);
  const mapDrivenRef    = useRef(false);

  const venueCenter =
    venues.length > 0
      ? {
          latitude:  venues.reduce((s, v) => s + (v.coord?.latitude  ?? 0), 0) / venues.length,
          longitude: venues.reduce((s, v) => s + (v.coord?.longitude ?? 0), 0) / venues.length,
        }
      : null;

  const center = location ?? venueCenter ?? { latitude: 43.6565, longitude: -79.38 };
  const delta  = latDeltaForRadius(location ? radius : radius * 2);

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
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: delta, longitudeDelta: delta }}
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardEmoji:  { fontSize: 36, lineHeight: 42 },
  cardName:   { fontWeight: '700', fontSize: 15, color: '#111827', marginBottom: 2 },
  cardAddr:   { color: '#9ca3af', fontSize: 12 },
  closeBtn:   { padding: 2 },
  cardTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  sportTag: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sportTagText:  { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice:     { fontSize: 18, fontWeight: '800', color: '#111827' },
  perHr:         { fontSize: 13, fontWeight: '400', color: '#6b7280' },
  cardPriceFree: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
  bookBtn:       { backgroundColor: '#16a34a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  bookBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});
