import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, FlatList, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VENUES, venueDistanceKm, type Venue } from '../data/mockData';
import { useUserLocation } from '../hooks/useUserLocation';
import { formatDistance } from '../utils/geo';
import BookMap from './BookMap';

interface Props {
  visible: boolean;
  sport?: string;
  onSelect: (locationName: string) => void;
  onClose: () => void;
}

const SPORTS_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

export default function LocationPickerModal({ visible, sport, onSelect, onClose }: Props) {
  const { location } = useUserLocation();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Venue | null>(null);
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const venues = useMemo(() => {
    const withCoords = VENUES.filter((v) => v.coord);
    const bySearch = search.trim()
      ? withCoords.filter(
          (v) =>
            v.name.toLowerCase().includes(search.toLowerCase()) ||
            v.address.toLowerCase().includes(search.toLowerCase()) ||
            v.sports.some((s) => s.toLowerCase().includes(search.toLowerCase())),
        )
      : withCoords;

    return bySearch.sort((a, b) => {
      const aMatch = sport ? a.sports.some((s) => s.toLowerCase().includes(sport.toLowerCase())) : false;
      const bMatch = sport ? b.sports.some((s) => s.toLowerCase().includes(sport.toLowerCase())) : false;
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      if (location) return venueDistanceKm(location, a) - venueDistanceKm(location, b);
      return 0;
    });
  }, [search, sport, location]);

  const confirm = (venue: Venue) => {
    onSelect(venue.name + (venue.address ? `, ${venue.address}` : ''));
    reset();
    onClose();
  };

  const confirmCustom = () => {
    if (!customText.trim()) return;
    onSelect(customText.trim());
    reset();
    onClose();
  };

  const reset = () => {
    setSelected(null);
    setSearch('');
    setCustomText('');
    setShowCustom(false);
    setViewMode('map');
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Pick Location</Text>
          {/* Map / List toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map-outline" size={15} color={viewMode === 'map' ? '#fff' : '#6b7280'} />
              <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={15} color={viewMode === 'list' ? '#fff' : '#6b7280'} />
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Map view ── */}
        {viewMode === 'map' && (
          <View style={styles.mapContainer}>
            <BookMap
              location={location}
              venues={venues}
              radius={50}
              onBookVenue={(venue) => setSelected(venue)}
              onSwitchToList={() => setViewMode('list')}
            />

            {/* Selected venue overlay at the bottom of map */}
            {selected ? (
              <View style={styles.mapOverlay}>
                <View style={styles.mapOverlayInfo}>
                  <Text style={styles.mapOverlayEmoji}>
                    {sport ? (SPORTS_EMOJI[sport] ?? '🏟️') : '🏟️'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapOverlayName} numberOfLines={1}>{selected.name}</Text>
                    {selected.address ? (
                      <Text style={styles.mapOverlayAddr} numberOfLines={1}>{selected.address}</Text>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity style={styles.useBtn} onPress={() => confirm(selected)}>
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.useBtnText}>Use This Venue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mapHint}>
                <Ionicons name="hand-left-outline" size={16} color="#fff" />
                <Text style={styles.mapHintText}>Tap a venue marker to select it</Text>
              </View>
            )}
          </View>
        )}

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <View style={styles.listContainer}>
            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search venues..."
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={venues}
              keyExtractor={(v) => v.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="location-outline" size={36} color="#d1d5db" />
                  <Text style={styles.emptyText}>No venues found</Text>
                </View>
              }
              renderItem={({ item: v }) => {
                const sportMatch = sport && v.sports.some((s) => s.toLowerCase().includes(sport.toLowerCase()));
                const dist = location ? formatDistance(venueDistanceKm(location, v)) : null;
                const isSelected = selected?.id === v.id;
                return (
                  <TouchableOpacity
                    style={[styles.venueRow, isSelected && styles.venueRowSelected]}
                    onPress={() => setSelected(v)}
                  >
                    <View style={[styles.venueIconBox, { backgroundColor: isSelected ? '#dcfce7' : '#f3f4f6' }]}>
                      <Text style={{ fontSize: 22 }}>
                        {sportMatch ? (SPORTS_EMOJI[sport!] ?? '🏟️') : '🏟️'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.venueName, isSelected && { color: '#16a34a' }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={styles.venueAddr} numberOfLines={1}>{v.address}</Text>
                      <View style={styles.sportTags}>
                        {v.sports.slice(0, 3).map((s) => (
                          <Text
                            key={s}
                            style={[
                              styles.sportTag,
                              sportMatch && s.toLowerCase().includes((sport ?? '').toLowerCase()) && styles.sportTagActive,
                            ]}
                          >
                            {s}
                          </Text>
                        ))}
                      </View>
                    </View>
                    <View style={styles.venueRight}>
                      {dist && <Text style={styles.distText}>{dist}</Text>}
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Custom location */}
            {showCustom ? (
              <View style={styles.customBox}>
                <TextInput
                  style={styles.customInput}
                  placeholder="e.g. Riverside Park"
                  placeholderTextColor="#9ca3af"
                  value={customText}
                  onChangeText={setCustomText}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.useBtn, !customText.trim() && styles.useBtnDisabled, { flex: 0, paddingHorizontal: 14 }]}
                  onPress={confirmCustom}
                  disabled={!customText.trim()}
                >
                  <Text style={styles.useBtnText}>Use</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.customTrigger} onPress={() => { setSelected(null); setShowCustom(true); }}>
                <Ionicons name="pencil-outline" size={16} color="#6b7280" />
                <Text style={styles.customTriggerText}>Enter a custom location</Text>
              </TouchableOpacity>
            )}

            {/* Confirm from list */}
            {selected && (
              <TouchableOpacity style={styles.useBtn} onPress={() => confirm(selected)}>
                <Ionicons name="location" size={16} color="#fff" />
                <Text style={styles.useBtnText}>Use {selected.name}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerBtn: { padding: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  toggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 2 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#16a34a' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#fff' },

  // Map
  mapContainer: { flex: 1, position: 'relative' },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 10,
    gap: 12,
  },
  mapOverlayInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapOverlayEmoji: { fontSize: 32 },
  mapOverlayName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  mapOverlayAddr: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  mapHint: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapHintText: {
    backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: 'hidden',
  },

  // List
  listContainer: { flex: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#f3f4f6', borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  venueRowSelected: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  venueIconBox: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  venueName: { fontWeight: '600', color: '#111827', fontSize: 14 },
  venueAddr: { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  sportTags: { flexDirection: 'row', gap: 4, marginTop: 4 },
  sportTag: {
    backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, fontSize: 11, color: '#6b7280',
  },
  sportTagActive: { backgroundColor: '#dcfce7', color: '#16a34a' },
  venueRight: { alignItems: 'flex-end', gap: 4 },
  distText: { color: '#9ca3af', fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: '#9ca3af', fontSize: 14 },

  // Custom location
  customTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginVertical: 8, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 10,
  },
  customTriggerText: { color: '#6b7280', fontSize: 14 },
  customBox: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginVertical: 8 },
  customInput: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
  },

  // Confirm
  useBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16a34a',
    marginHorizontal: 12, marginBottom: Platform.OS === 'ios' ? 8 : 12, marginTop: 4,
    paddingVertical: 13, borderRadius: 12,
  },
  useBtnDisabled: { backgroundColor: '#d1d5db' },
  useBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
