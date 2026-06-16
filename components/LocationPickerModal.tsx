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
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Venue | null>(null);
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const venues = useMemo(() => {
    // Only venues with real coordinates
    const withCoords = VENUES.filter((v) => v.coord);
    const bySearch = search.trim()
      ? withCoords.filter(
          (v) =>
            v.name.toLowerCase().includes(search.toLowerCase()) ||
            v.address.toLowerCase().includes(search.toLowerCase()) ||
            v.sports.some((s) => s.toLowerCase().includes(search.toLowerCase())),
        )
      : withCoords;

    // Sort: sport-matching venues first, then by distance if GPS available
    return bySearch.sort((a, b) => {
      const aMatch = sport ? a.sports.some((s) => s.toLowerCase().includes(sport.toLowerCase())) : false;
      const bMatch = sport ? b.sports.some((s) => s.toLowerCase().includes(sport.toLowerCase())) : false;
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      if (location) return venueDistanceKm(location, a) - venueDistanceKm(location, b);
      return 0;
    });
  }, [search, sport, location]);

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected.name + (selected.address ? `, ${selected.address}` : ''));
    setSelected(null);
    setSearch('');
    onClose();
  };

  const handleCustomConfirm = () => {
    if (!customText.trim()) return;
    onSelect(customText.trim());
    setCustomText('');
    setShowCustom(false);
    onClose();
  };

  const handleClose = () => {
    setSelected(null);
    setSearch('');
    setCustomText('');
    setShowCustom(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          {/* Header */}
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pick Location</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

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

          {/* Selected venue preview */}
          {selected && (
            <View style={styles.selectedBanner}>
              <Ionicons name="location" size={16} color="#16a34a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName} numberOfLines={1}>{selected.name}</Text>
                {selected.address ? <Text style={styles.selectedAddr} numberOfLines={1}>{selected.address}</Text> : null}
              </View>
            </View>
          )}

          {/* Venue list */}
          {(
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
                      <Text style={{ fontSize: 20 }}>
                        {sport && sportMatch ? (SPORTS_EMOJI[sport] ?? '🏟️') : '🏟️'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.venueName, isSelected && { color: '#16a34a' }]} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={styles.venueAddr} numberOfLines={1}>{v.address}</Text>
                      <View style={styles.sportTags}>
                        {v.sports.slice(0, 3).map((s) => (
                          <Text key={s} style={[styles.sportTag, sportMatch && s.toLowerCase().includes((sport ?? '').toLowerCase()) && styles.sportTagActive]}>
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
          )}

          {/* Custom location */}
          {showCustom ? (
            <View style={styles.customBox}>
              <TextInput
                style={styles.customInput}
                placeholder="e.g. Central Park, New York"
                placeholderTextColor="#9ca3af"
                value={customText}
                onChangeText={setCustomText}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.confirmBtn, !customText.trim() && styles.confirmBtnDisabled]}
                onPress={handleCustomConfirm}
                disabled={!customText.trim()}
              >
                <Text style={styles.confirmBtnText}>Use This</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.customTrigger} onPress={() => { setSelected(null); setShowCustom(true); }}>
              <Ionicons name="pencil-outline" size={16} color="#6b7280" />
              <Text style={styles.customTriggerText}>Enter a custom location</Text>
            </TouchableOpacity>
          )}

          {/* Confirm button */}
          {selected && (
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.confirmBtnText}>Use {selected.name}</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#f3f4f6', borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  selectedName: { fontWeight: '700', color: '#16a34a', fontSize: 14 },
  selectedAddr: { color: '#6b7280', fontSize: 12 },
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  venueRowSelected: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  venueIconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
  customTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginVertical: 8, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed',
    borderRadius: 10,
  },
  customTriggerText: { color: '#6b7280', fontSize: 14 },
  customBox: {
    flexDirection: 'row', gap: 8, marginHorizontal: 12, marginVertical: 8,
  },
  customInput: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16a34a', marginHorizontal: 12, marginBottom: Platform.OS === 'ios' ? 8 : 12,
    marginTop: 4, paddingVertical: 13, borderRadius: 12,
  },
  confirmBtnDisabled: { backgroundColor: '#d1d5db' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
