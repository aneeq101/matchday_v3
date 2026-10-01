import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Venue } from '../data/mockData';
import type { Coord } from '../utils/geo';
import { clusterVenues } from '../utils/cluster';

// Inject Leaflet CSS from CDN (runs once at module load)
if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

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

// Compact pin: the sport emoji in a white circle. The name shows on hover
// (Tooltip) and with full details on click (Popup) — no always-on labels.
const iconCache = new Map<string, L.DivIcon>();
function venueIcon(emoji: string) {
  let icon = iconCache.get(emoji);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid #16a34a;
        display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;cursor:pointer;
        box-shadow:0 1px 4px rgba(0,0,0,0.3);">${emoji}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
    });
    iconCache.set(emoji, icon);
  }
  return icon;
}

// Numbered bubble for venues that would overlap at this zoom
function clusterIcon(count: number) {
  const size = count >= 20 ? 44 : count >= 10 ? 38 : 32;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#16a34a;color:#fff;
      border:3px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;
      font:800 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,0.35);">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Reports the zoom level so markers can be grouped, and gives cluster clicks a map handle. */
function ZoomWatcher({ onZoom, mapRef }: { onZoom: (z: number) => void; mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; onZoom(map.getZoom()); }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;
    background:#16a34a;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 2px #16a34a,0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function RecenterMap({ location }: { location: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!location) return;
    map.setView(location, map.getZoom());
  }, [location?.[0], location?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MapZoomSync({
  radius,
  onRadiusChange,
}: {
  radius: number;
  onRadiusChange?: (km: number) => void;
}) {
  const map = useMap();
  const programmaticRef = useRef(false);

  // Zoom map when slider changes
  useEffect(() => {
    const targetZoom = Math.round(14 - Math.log2(Math.max(1, radius)));
    if (Math.abs(map.getZoom() - targetZoom) >= 1) {
      programmaticRef.current = true;
      map.setZoom(targetZoom);
    }
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  useMapEvents({
    zoomend: () => {
      if (programmaticRef.current) {
        programmaticRef.current = false;
        return;
      }
      if (!onRadiusChange) return;
      const zoom = map.getZoom();
      // Inverse of: zoom ≈ 14 - log2(radius)
      const km = Math.max(1, Math.min(20, Math.round(Math.pow(2, 14 - zoom))));
      onRadiusChange(km);
    },
  });

  return null;
}

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

export default function BookMap({ location, venues, radius, onBookVenue, onRadiusChange, actionLabel = 'Book Now' }: Props) {
  const [mapHeight, setMapHeight] = useState(500);
  const [zoom, setZoom] = useState(location ? 13 : 11);
  const mapRef = useRef<L.Map | null>(null);
  // A cell ≈ 56 px at this zoom (256 px tiles); from zoom 14 every venue gets its own pin
  const items = useMemo(
    () => clusterVenues(venues, zoom >= 14 ? 0 : (360 / (256 * Math.pow(2, zoom))) * 56),
    [venues, zoom],
  );

  const venueCenter: [number, number] | null =
    venues.length > 0
      ? [
          venues.reduce((s, v) => s + (v.coord?.latitude ?? 0), 0) / venues.length,
          venues.reduce((s, v) => s + (v.coord?.longitude ?? 0), 0) / venues.length,
        ]
      : null;

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : venueCenter ?? [43.6565, -79.38];

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}
    >
      <MapContainer
        center={center}
        zoom={location ? 13 : 11}
        style={{ width: '100%', height: mapHeight || 500 }}
        zoomControl
      >
        <RecenterMap location={location ? [location.latitude, location.longitude] : null} />
        <MapZoomSync radius={radius} onRadiusChange={onRadiusChange} />
        <ZoomWatcher onZoom={setZoom} mapRef={mapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {location && (
          <>
            <Circle
              center={center}
              radius={radius * 1000}
              pathOptions={{
                fillColor: '#16a34a',
                fillOpacity: 0.07,
                color: '#16a34a',
                weight: 1.5,
              }}
            />
            <Marker position={center} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {items.map((it) => {
          if (it.kind === 'cluster') {
            return (
              <Marker
                key={it.key}
                position={[it.coord.latitude, it.coord.longitude]}
                icon={clusterIcon(it.count)}
                eventHandlers={{
                  click: () => mapRef.current?.setView([it.coord.latitude, it.coord.longitude], Math.min(16, zoom + 2)),
                }}
              >
                <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                  <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'system-ui,sans-serif' }}>
                    {it.count} venues · click to zoom in
                  </span>
                </Tooltip>
              </Marker>
            );
          }
          const venue = it.venue;
          const coord = it.coord;
          return (
            <Marker
              key={venue.id}
              position={[coord.latitude, coord.longitude]}
              icon={venueIcon(sportEmoji(venue.sports))}
            >
              <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'system-ui,sans-serif' }}>
                  {venue.name}
                </span>
              </Tooltip>
              <Popup minWidth={180}>
                <div style={{ fontFamily: 'system-ui,sans-serif' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#111827' }}>
                    {venue.name}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>
                    {venue.address}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {venue.sports.map((s) => (
                      <span
                        key={s}
                        style={{
                          background: '#f0fdf4',
                          color: '#16a34a',
                          fontWeight: 600,
                          fontSize: 11,
                          padding: '2px 7px',
                          borderRadius: 4,
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
                    {venue.pricePerHour > 0 ? `CAD ${venue.pricePerHour.toLocaleString()}/hr` : 'Contact venue for price'}
                  </div>
                  <button
                    onClick={() => onBookVenue(venue)}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 0',
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                      fontSize: 13,
                    }}
                  >
                    {actionLabel}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </View>
  );
}
