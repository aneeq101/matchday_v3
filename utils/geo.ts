export interface Coord {
  latitude: number;
  longitude: number;
}

/** Offset a coordinate by dxKm east (+) / west (-)  and dyKm north (+) / south (-) */
export function offsetCoord(base: Coord, dxKm: number, dyKm: number): Coord {
  return {
    latitude: base.latitude + dyKm / 111,
    longitude:
      base.longitude + dxKm / (111 * Math.cos((base.latitude * Math.PI) / 180)),
  };
}

/** Haversine distance in km between two coords */
export function distanceKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Returns a latitudeDelta value that shows ~radiusKm on screen with padding */
export function latDeltaForRadius(radiusKm: number): number {
  return (radiusKm / 111) * 2.6;
}

/** Format a distance nicely */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
