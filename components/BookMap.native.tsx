import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Image, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { venueDistanceKm, type Venue } from '../data/mockData';
import { latDeltaForRadius, formatDistance, type Coord } from '../utils/geo';
import { clusterVenues } from '../utils/cluster';

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



// Android react-native-maps snapshots the marker view as a bitmap.
// Keep tracksViewChanges=true until onLoadEnd fires (image decoded),
// then wait 400 ms for the native layer to rasterise before freezing.
// A 2500 ms hard fallback handles any edge cases.
function VenueMarker({
  venue,
  onPress,
}: {
  venue: Venue;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const frozenRef      = useRef(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const freeze = useCallback(() => {
    if (frozenRef.current) return;
    frozenRef.current = true;
    setTracksViewChanges(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (frozenRef.current) return;
    freezeTimerRef.current = setTimeout(freeze, 400);
  }, [freeze]);

  useEffect(() => {
    const t = setTimeout(freeze, 2500);
    return () => {
      clearTimeout(t);
      if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imgKey  = sportImage(venue.sports);
  const imgSize = 28;

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

// Numbered bubble for venues that would overlap. Plain circle + digits only
// (Android snapshots marker views; see VenueMarker) — frozen after 500 ms.
function ClusterMarker({ coord, count, onPress }: { coord: Coord; count: number; onPress: () => void }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(t);
  }, []);
  const size = count >= 20 ? 44 : count >= 10 ? 38 : 32;
  return (
    <Marker coordinate={coord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks} onPress={onPress}>
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  );
}

const SPORT_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾', Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
  onRadiusChange?: (km: number) => void;
  /** Button text on a tapped venue (default "Book" / "Book Now") */
  actionLabel?: string;
  /** Phone only: false = a tap calls onBookVenue straight away (the caller shows its own card) */
  showPreview?: boolean;
}

export default function BookMap({ location, venues, radius, onBookVenue, onRadiusChange, actionLabel = 'Book', showPreview = true }: Props) {
  const mapRef          = useRef<MapView>(null);
  const programmaticRef = useRef(false);
  const mapDrivenRef    = useRef(false);
  const [selected, setSelected] = useState<Venue | null>(null);

  const venueCenter =
    venues.length > 0
      ? {
          latitude:  venues.reduce((s, v) => s + (v.coord?.latitude  ?? 0), 0) / venues.length,
          longitude: venues.reduce((s, v) => s + (v.coord?.longitude ?? 0), 0) / venues.length,
        }
      : null;

  const center = location ?? venueCenter ?? { latitude: 43.6565, longitude: -79.38 };
  const delta  = latDeltaForRadius(location ? radius : radius * 2);

  // Current zoom drives grouping: about 7 bubbles fit across the map height;
  // zoomed in closer than ~3 km every venue gets its own pin
  const [latDelta, setLatDelta] = useState(delta);
  const items = useMemo(
    () => clusterVenues(venues, latDelta < 0.03 ? 0 : latDelta / 7),
    [venues, latDelta],
  );

  const zoomInto = (coord: Coord) => {
    const d = Math.max(0.01, latDelta / 3);
    // Not programmatic: the radius slider should follow this zoom
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: d, longitudeDelta: d }, 350);
  };

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
        onPress={(e) => { if (e.nativeEvent.action !== 'marker-press') setSelected(null); }}
        onRegionChangeComplete={(region: Region) => {
          setLatDelta(region.latitudeDelta);
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

        {items.map((it) => it.kind === 'cluster' ? (
          <ClusterMarker key={it.key} coord={it.coord} count={it.count} onPress={() => { setSelected(null); zoomInto(it.coord); }} />
        ) : (
          <VenueMarker key={it.key} venue={it.venue} onPress={() => (showPreview ? setSelected(it.venue) : onBookVenue(it.venue))} />
        ))}
      </MapView>

      {/* Tapped venue: quick look before booking (top of the map — the list sheet peeks at the bottom) */}
      {selected && (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {selected.sports.map((s) => SPORT_EMOJI[s] ?? '').join(' ')}
              {location ? `  ·  ${formatDistance(venueDistanceKm(location, selected))}` : ''}
              {'  ·  '}
              {selected.pricePerHour > 0 ? `CAD ${selected.pricePerHour.toLocaleString()}/hr` : 'Contact venue'}
            </Text>
            {!!selected.address && <Text style={styles.cardAddr} numberOfLines={1}>{selected.address}</Text>}
          </View>
          <TouchableOpacity style={styles.cardBook} onPress={() => { onBookVenue(selected); setSelected(null); }}>
            <Text style={styles.cardBookText}>{actionLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: { backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  clusterText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  card: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  cardName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#374151', marginTop: 2 },
  cardAddr: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  cardBook: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  cardBookText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
