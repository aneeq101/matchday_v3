import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchPlayers } from '../lib/players';
import { fetchCaptainTeams, fetchTeamsForSport, type Team } from '../lib/teams';
import { createChallenge, type ChallengeKind } from '../lib/challenges';
import DatePickerField from './DatePickerField';
import VenueList from './VenueList';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball'];

export interface ChallengeTarget {
  kind: ChallengeKind;
  id: string;
  name: string;
  sport?: string;
}

interface Props {
  visible: boolean;
  target?: ChallengeTarget | null;   // pre-filled opponent (from a profile or team page)
  onClose: () => void;
  onSent: (message: string) => void;
}

type Option = { id: string; name: string; sub: string };

export default function ChallengeModal({ visible, target, onClose, onSent }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [myTeams, setMyTeams]   = useState<Team[] | null>(null);
  const [asTeamId, setAsTeamId] = useState<string | null>(null);  // null = challenge as myself
  const [sport, setSport]       = useState('Tennis');
  const [options, setOptions]   = useState<Option[] | null>(null);
  const [search, setSearch]     = useState('');
  const [opponent, setOpponent] = useState<Option | null>(null);
  const [date, setDate]         = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [pickingVenue, setPickingVenue] = useState(false);

  const kind: ChallengeKind = asTeamId ? 'team' : 'player';
  const asTeam = myTeams?.find((t) => t.id === asTeamId) ?? null;
  const effectiveSport = asTeam ? asTeam.sport : sport;

  // Reset whenever the sheet opens
  useEffect(() => {
    if (!visible || !user) return;
    setError(''); setSearch(''); setDate(null); setLocation(''); setMessage(''); setPickingVenue(false);
    setOpponent(target ? { id: target.id, name: target.name, sub: '' } : null);
    setSport(target?.sport ?? 'Tennis');
    setMyTeams(null);
    fetchCaptainTeams(user.id).then((teams) => {
      setMyTeams(teams);
      if (target?.kind === 'team') {
        setAsTeamId(teams.find((t) => t.sport === target.sport)?.id ?? null);
      } else {
        setAsTeamId(null);
      }
    });
  }, [visible, user, target]);

  // Load opponents for the current mode (unless one was pre-filled)
  useEffect(() => {
    if (!visible || !user || target) return;
    let cancelled = false;
    setOptions(null);
    (async () => {
      if (kind === 'team' && asTeam) {
        const teams = await fetchTeamsForSport(asTeam.sport, user.id);
        if (!cancelled) setOptions(teams.map((t) => ({ id: t.id, name: t.name, sub: `${t.area || t.sport} · ${t.memberCount} members` })));
      } else {
        const players = await fetchPlayers();
        if (!cancelled) {
          setOptions(players
            .filter((p) => UUID_RE.test(p.id) && p.id !== user.id)
            .map((p) => ({ id: p.id, name: p.name, sub: p.area })));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [visible, user, target, kind, asTeam]);

  const chooseAs = (teamId: string | null) => {
    setAsTeamId(teamId);
    setLocation('');                 // venue list depends on the sport
    if (!target) setOpponent(null);
  };

  const chooseSport = (s: string) => {
    if (s !== sport) setLocation('');
    setSport(s);
  };

  const send = async () => {
    if (sending) return;
    if (!opponent) { setError(kind === 'team' ? 'Choose a team to challenge.' : 'Choose a player to challenge.'); return; }
    if (target?.kind === 'team' && !asTeam) { setError(`You need to captain a ${target.sport} team to challenge a team.`); return; }
    if (date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (date < today) { setError('Pick a date that isn’t in the past.'); return; }
    }
    setError('');
    setSending(true);
    const res = await createChallenge({
      kind,
      sport: effectiveSport,
      challengerTeamId: asTeamId,
      opponentId: opponent.id,
      date: date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD',
      location,
      message,
    });
    setSending(false);
    if (!res.ok) { setError(res.error ?? 'Could not send the challenge.'); return; }
    onSent(res.accepted
      ? `${opponent.name} accepted your challenge! Record the result after you play.`
      : `Challenge sent to ${opponent.name}. We’ll let you know when they reply.`);
  };

  const q = search.trim().toLowerCase();
  const filtered = (options ?? []).filter((o) => !q || o.name.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q));
  const needsTeam = target?.kind === 'team' && myTeams !== null && !asTeam;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>⚔️  New Challenge</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {pickingVenue ? (
              <VenueList
                sport={effectiveSport}
                onPick={(label) => { setLocation(label); setPickingVenue(false); }}
                onCancel={() => setPickingVenue(false)}
              />
            ) : myTeams === null ? (
              <ActivityIndicator color="#f97316" style={{ marginVertical: 30 }} />
            ) : needsTeam ? (
              <View style={styles.needTeam}>
                <Ionicons name="shield-outline" size={40} color="#d1d5db" />
                <Text style={styles.needTeamText}>
                  To challenge {target!.name}, you need to be the captain of a {target!.sport} team.
                </Text>
                <TouchableOpacity style={[styles.sendBtn, { backgroundColor: '#8b5cf6', alignSelf: 'stretch' }]} onPress={() => { onClose(); router.push('/my-teams'); }}>
                  <Text style={styles.sendText}>Create a Team</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Who is challenging */}
                {target?.kind !== 'player' && myTeams.length > 0 && (
                  <>
                    <Text style={styles.label}>Challenge as</Text>
                    <View style={styles.chips}>
                      {target?.kind !== 'team' && (
                        <Chip label="Myself" icon="person" active={!asTeamId} onPress={() => chooseAs(null)} />
                      )}
                      {myTeams
                        .filter((t) => !target || t.sport === target.sport)
                        .map((t) => (
                          <Chip key={t.id} label={t.name} icon="shield" active={asTeamId === t.id} onPress={() => chooseAs(t.id)} />
                        ))}
                    </View>
                  </>
                )}

                {/* Sport — fixed by the team when challenging as a team */}
                <Text style={styles.label}>Sport</Text>
                {asTeam || target?.sport ? (
                  <Text style={styles.fixedValue}>{effectiveSport}</Text>
                ) : (
                  <View style={styles.chips}>
                    {SPORTS.map((s) => <Chip key={s} label={s} active={sport === s} onPress={() => chooseSport(s)} />)}
                  </View>
                )}

                {/* Opponent */}
                <Text style={styles.label}>Opponent</Text>
                {opponent ? (
                  <View style={styles.opponentCard}>
                    <Ionicons name={kind === 'team' ? 'shield' : 'person'} size={18} color="#f97316" />
                    <Text style={styles.opponentName}>{opponent.name}</Text>
                    {!target && (
                      <TouchableOpacity onPress={() => setOpponent(null)}>
                        <Text style={styles.change}>Change</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.pickBox}>
                    <View style={styles.searchBox}>
                      <Ionicons name="search" size={16} color="#9ca3af" />
                      <TextInput
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder={kind === 'team' ? `Search ${effectiveSport} teams` : 'Search players'}
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                    {options === null ? (
                      <ActivityIndicator color="#f97316" style={{ marginVertical: 14 }} />
                    ) : filtered.length === 0 ? (
                      <Text style={styles.emptyText}>
                        {kind === 'team' ? `No other ${effectiveSport} teams yet.` : 'No players found.'}
                      </Text>
                    ) : (
                      filtered.slice(0, 30).map((o) => (
                        <TouchableOpacity key={o.id} style={styles.optionRow} onPress={() => setOpponent(o)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.optionName}>{o.name}</Text>
                            {!!o.sub && <Text style={styles.optionSub}>{o.sub}</Text>}
                          </View>
                          <Ionicons name="add-circle-outline" size={20} color="#f97316" />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                <Text style={styles.label}>When (optional)</Text>
                <DatePickerField value={date} onChange={setDate} placeholder="Pick a date" />

                <Text style={[styles.label, { marginTop: 14 }]}>Where (optional)</Text>
                {location ? (
                  <View style={styles.opponentCard}>
                    <Ionicons name="location" size={18} color="#f97316" />
                    <Text style={[styles.opponentName, { fontSize: 14 }]} numberOfLines={2}>{location}</Text>
                    <TouchableOpacity onPress={() => setPickingVenue(true)}>
                      <Text style={styles.change}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setLocation('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.venueBtn} onPress={() => setPickingVenue(true)}>
                    <Ionicons name="location-outline" size={18} color="#f97316" />
                    <Text style={styles.venueBtnText}>Choose a {effectiveSport.toLowerCase()} venue</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                )}

                <Text style={styles.label}>Message (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Think you can beat me? 😄"
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />

                {!!error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
                  {sending ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="flash" size={18} color="#fff" />
                      <Text style={styles.sendText}>Send Challenge</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({ label, icon, active, onPress }: {
  label: string; icon?: React.ComponentProps<typeof Ionicons>['name']; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon && <Ionicons name={icon} size={13} color={active ? '#fff' : '#6b7280'} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  body: { padding: 16, paddingBottom: 30 },
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  fixedValue: { fontSize: 15, color: '#111827', fontWeight: '600', marginBottom: 14 },
  opponentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#fed7aa',
    backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  opponentName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  change: { color: '#f97316', fontWeight: '700' },
  pickBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 8, marginBottom: 14, maxHeight: 280 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f3f4f6',
    borderRadius: 8, paddingHorizontal: 10, marginBottom: 4,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: '#111827' },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionSub: { fontSize: 12, color: '#6b7280' },
  emptyText: { color: '#9ca3af', textAlign: 'center', paddingVertical: 14 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', marginBottom: 14,
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  venueBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: '#f9fafb',
  },
  venueBtnText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f97316', paddingVertical: 14, borderRadius: 12,
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  needTeam: { alignItems: 'center', gap: 12, paddingVertical: 10 },
  needTeamText: { color: '#374151', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
