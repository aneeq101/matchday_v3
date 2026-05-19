import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Venue } from '../data/mockData';
import { getVenueCoord } from '../data/mockData';
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

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

interface Props {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
}

export default function BookMap({ location, venues, radius, onBookVenue }: Props) {
  const [mapHeight, setMapHeight] = useState(500);

  // When no GPS, center on the centroid of visible venues (e.g. Toronto area)
  const venueCenter: [number, number] | null =
    venues.length > 0
      ? [
          venues.reduce((s, v) => s + (v.coord?.latitude ?? 0), 0) / venues.length,
          venues.reduce((s, v) => s + (v.coord?.longitude ?? 0), 0) / venues.length,
        ]
      : null;

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : venueCenter ?? [43.6565, -79.38]; // Toronto fallback

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
        <RecenterMap center={center} />
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
          const coord = venue.coord; // all venues here have real GPS coords
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
