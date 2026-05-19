import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Venue } from '../data/mockData';
import type { Coord } from '../utils/geo';

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

function createVenueIcon(emoji: string, name: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="font-size:30px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35));">${emoji}</div>
        <div style="
          background:rgba(255,255,255,0.97);
          border-radius:6px;
          padding:2px 8px;
          font-size:11px;
          font-weight:700;
          color:#111827;
          margin-top:3px;
          box-shadow:0 2px 6px rgba(0,0,0,0.22);
          white-space:nowrap;
          max-width:150px;
          overflow:hidden;
          text-overflow:ellipsis;
          border:1px solid rgba(0,0,0,0.06);
        ">${name}</div>
      </div>
    `,
    iconSize: [160, 60],
    iconAnchor: [80, 60],
    popupAnchor: [0, -62],
  });
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
}

export default function BookMap({ location, venues, radius, onBookVenue, onRadiusChange }: Props) {
  const [mapHeight, setMapHeight] = useState(500);

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

        {venues.map((venue) => {
          const coord = venue.coord;
          if (!coord) return null;
          return (
            <Marker
              key={venue.id}
              position={[coord.latitude, coord.longitude]}
              icon={createVenueIcon(sportEmoji(venue.sports), venue.name)}
            >
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
                    PKR {venue.pricePerHour.toLocaleString()}/hr
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
                    Book Now
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
