import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
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

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
  onRadiusChange?: (km: number) => void;
}

export default function BookMap({ location, venues, radius, onBookVenue, onRadiusChange }: Props) {
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
              onPress={() => onBookVenue(venue)}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({});
