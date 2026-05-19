import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import type { Coord } from '../utils/geo';

const FALLBACK: Coord = { latitude: 51.5074, longitude: -0.1278 }; // London as neutral fallback

export function useUserLocation() {
  const [location, setLocation] = useState<Coord | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            setLoading(false);
          },
          () => {
            setLocation(FALLBACK);
            setPermissionDenied(true);
            setLoading(false);
          },
          { timeout: 8000 }
        );
      } else {
        setLocation(FALLBACK);
        setLoading(false);
      }
      return;
    }

    // Native (iOS / Android)
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          setLocation(FALLBACK);
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        setLocation(FALLBACK);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { location, loading, permissionDenied };
}
