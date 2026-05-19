import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { VENUES, getVenueCoord, type Venue } from '../data/mockData';
import { latDeltaForRadius, type Coord } from '../utils/geo';

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
      initialRegion={{
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
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          coordinate={location ? getVenueCoord(location, venue) : center}
          pinColor={venue.imageColor}
        >
          <Callout tooltip onPress={() => onBookVenue(venue)}>
            <View style={styles.callout}>
              <Text style={styles.calloutName}>{venue.name}</Text>
              <Text style={styles.calloutPrice}>PKR {venue.pricePerHour.toLocaleString()}/hr</Text>
              <View style={styles.calloutBtn}>
                <Text style={styles.calloutBtnText}>Book Now</Text>
              </View>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  callout: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutName: { fontWeight: '700', fontSize: 14, color: '#111827', marginBottom: 2 },
  calloutPrice: { color: '#6b7280', fontSize: 12, marginBottom: 8 },
  calloutBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  calloutBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
