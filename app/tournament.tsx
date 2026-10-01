import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  Platform, Modal, TextInput, RefreshControl, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  fetchTournament, fetchEntrants, fetchBracket, registerForTournament, unregisterFromTournament,
  startTournament, recordMatchResult,
} from '../lib/tournaments';
import { fetchCaptainTeams, fetchMyTeams, type Team } from '../lib/teams';
import MatchDayPanel from '../components/MatchDayPanel';
import { matchDayReached } from '../lib/matchday';
import {
  previewKnockout, computeStandings, canEditResult, totalRounds, roundName,
  type BracketMatch, type Entrant,
} from '../lib/bracket';
import BracketView from '../components/BracketView';
import { entrantNouns, isDoubles } from '../lib/sportRules';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { fetchPlayer } from '../lib/players';
import { openConversation } from '../lib/chatService';
import type { Tournament, Player } from '../data/mockData';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_COLORS: Record<string, string> = { tournament: '#8b5cf6', league: '#3b82f6', match: '#16a34a' };
const TYPE_LABELS: Record<string, string> = { tournament: 'Knockout Tournament', league: 'League', match: 'Match' };

type Confirm = { title: string; body: string; label: string; color: string; run: () => Promise<void> };

export default function TournamentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, join } = useLocalSearchParams<{ id: string; join?: string }>();

  const [t, setT]                 = useState<Tournament | null>(null);
  const [entrants, setEntrants]   = useState<Entrant[]>([]);
  const [matches, setMatches]     = useState<BracketMatch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]             = useState<'bracket' | 'entrants'>('bracket');
  const [busy, setBusy]           = useState(false);
  const [notice, setNotice]       = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm]     = useState<Confirm | null>(null);

  const [teamPicker, setTeamPicker] = useState(false);
  const [myTeams, setMyTeams]       = useState<Team[] | null>(null);

  const [resultMatch, setResultMatch] = useState<BracketMatch | null>(null);
  const [pick, setPick]               = useState<string | 'draw' | null>(null);
  const [score, setScore]             = useState('');
  const [resultError, setResultError] = useState('');
  const [profile, setProfile]         = useState<Player | null>(null);
  const [myTeamIds, setMyTeamIds]     = useState<Set<string>>(new Set());

  // Player events: tap a name to see their profile (and challenge / message them)
  const openProfile = async (e: Entrant) => {
    if (e.userId === user?.id) return;
    const p = await fetchPlayer(e.userId);
    if (p) setProfile(p);
  };

  const messagePlayer = async (p: Player) => {
    setProfile(null);
    const res = await openConversation(p.id);
    if (res.error !== undefined) { Alert.alert('Can\'t message', res.error); return; }
    router.push({ pathname: '/chat', params: { id: res.id, name: p.name, initials: p.initials, color: p.avatarColor } });
  };

  const load = useCallback(async () => {
    if (!id) return;
    const tour = await fetchTournament(id);
    setT(tour);
    if (tour) {
      const [e, m, teams] = await Promise.all([
        fetchEntrants(tour), fetchBracket(tour.id), user ? fetchMyTeams(user.id) : Promise.resolve([]),
      ]);
      setEntrants(e);
      setMatches(m);
      setMyTeamIds(new Set(teams.map((x) => x.id)));
    }
    setLoading(false);
  }, [id, user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isReal       = !!t && UUID_RE.test(t.id);
  const status       = t?.status ?? 'active';
  const isOrganiser  = !!t && !!user && t.organiserId === user.id;
  const myEntries    = entrants.filter((e) => e.userId === user?.id);
  const myIds        = new Set(myEntries.map((e) => e.id));
  const isRegistered = myEntries.length > 0;
  // In the event: signed up, on a signed-up team, or the organiser
  const isParticipant = isRegistered || isOrganiser || entrants.some((e) => myTeamIds.has(e.id));
  const dayReached   = matchDayReached(t?.startsOn);
  // Organiser can always start; once match day arrives any entrant can
  const canStart     = isOrganiser || (isRegistered && dayReached);
  const isTeam       = t?.entrantType === 'team';
  const { noun, nouns } = entrantNouns(t?.entrantType, t?.format);
  const pairs        = isTeam && isDoubles(t?.format);
  const minNeeded    = Math.max(2, t?.minParticipants ?? 2);
  const maxAllowed   = t?.maxParticipants ?? 0;
  const count        = isReal ? entrants.length : (t?.participants ?? 0);
  const isFull       = maxAllowed > 0 && count >= maxAllowed;
  const hasDraw      = t?.type === 'tournament' || t?.type === 'league';
  const league       = t?.type === 'league';

  // ── Sign up / leave ─────────────────────────────────────────
  const doRegister = async (teamId?: string) => {
    if (!user || !t || busy) return;
    setBusy(true);
    const res = await registerForTournament(t.id, user.id, teamId);
    setBusy(false);
    setTeamPicker(false);
    if (!res.ok) { setNotice({ text: res.error ?? 'Could not sign up.', error: true }); return; }
    setNotice({ text: pairs ? 'Your pair is signed up!' : isTeam ? 'Your team is signed up!' : 'You’re signed up!' });
    setTab('entrants');
    await load();
  };

  const openTeamPicker = useCallback(async () => {
    if (!user || !t) return;
    setMyTeams(null);
    setTeamPicker(true);
    setMyTeams(await fetchCaptainTeams(user.id, t.sport));
  }, [user, t]);

  const handleSignUp = () => {
    if (!user) { setNotice({ text: 'Sign in to register.', error: true }); return; }
    if (isTeam) openTeamPicker();
    else doRegister();
  };

  // Earn tab "Register" on a team event opens this screen with ?join=1
  useEffect(() => {
    if (join === '1' && t && isTeam && status === 'active' && !isRegistered && !loading) {
      openTeamPicker();
      router.setParams({ join: undefined });
    }
  }, [join, t, isTeam, status, isRegistered, loading, openTeamPicker, router]);

  const askLeave = () => setConfirm({
    title: 'Leave this event?',
    body: isTeam
      ? `${myEntries[0]?.name ?? 'Your team'} will be removed from the sign-up list.`
      : 'You’ll be removed from the sign-up list.',
    label: 'Leave',
    color: '#ef4444',
    run: async () => {
      if (!user || !t) return;
      const ok = await unregisterFromTournament(t.id, user.id);
      if (!ok) { setNotice({ text: 'Couldn’t leave — sign-ups may already be closed.', error: true }); return; }
      setNotice({ text: 'You’ve left the event.' });
      await load();
    },
  });

  // ── Organiser: start ────────────────────────────────────────
  const askStart = () => setConfirm({
    title: league ? 'Start the league?' : 'Start the tournament?',
    body: league
      ? `Sign-ups will close and fixtures will be created so every ${noun} plays every other ${noun} once (${count} ${nouns}).`
      : `Sign-ups will close and the ${count} ${nouns} will be drawn randomly into a knockout bracket.`
        + (count & (count - 1) ? ' Some will get a bye straight into the next round.' : ''),
    label: 'Start',
    color: TYPE_COLORS[t?.type ?? 'tournament'],
    run: async () => {
      if (!t) return;
      const res = await startTournament(t, entrants);
      if (!res.ok) { setNotice({ text: res.error ?? 'Could not start.', error: true }); return; }
      setNotice({ text: league ? 'League started — fixtures are ready.' : 'Tournament started — the bracket is ready!' });
      setTab('bracket');
      await load();
    },
  });

  // ── Results ─────────────────────────────────────────────────
  // The two sides can record their own game; any entrant can once match day
  // has arrived; the organiser always can. (Same rule in record_match_result.)
  const mySide = (m: BracketMatch) =>
    !!((m.aId && (myIds.has(m.aId) || myTeamIds.has(m.aId))) || (m.bId && (myIds.has(m.bId) || myTeamIds.has(m.bId))));
  const editable = (m: BracketMatch) =>
    status !== 'active' && canEditResult(m, matches, league)
    && (isOrganiser || mySide(m) || (isRegistered && dayReached));
  const canRecordAny = status !== 'active' && (isOrganiser || isRegistered || myTeamIds.size > 0);

  const openResult = (m: BracketMatch) => {
    setResultMatch(m);
    setPick(m.status === 'done' ? (m.isDraw ? 'draw' : m.winnerId) : null);
    setScore(m.score);
    setResultError('');
  };

  const saveResult = async () => {
    if (!resultMatch?.id || busy) return;
    if (!pick) { setResultError(league ? 'Choose the winner or Draw.' : 'Choose the winner.'); return; }
    setBusy(true);
    const res = await recordMatchResult(resultMatch.id, pick === 'draw' ? null : pick, pick === 'draw', score);
    setBusy(false);
    if (!res.ok) { setResultError(res.error ?? 'Could not save.'); return; }
    setResultMatch(null);
    await load();
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator size="large" color="#8b5cf6" /></View>;
  }

  const color = TYPE_COLORS[t?.type ?? 'tournament'] ?? '#8b5cf6';

  if (!t) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={[styles.header, { backgroundColor: color }]} edges={['top']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event</Text>
        </SafeAreaView>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>This event no longer exists.</Text>
        </View>
      </View>
    );
  }

  const preview = status === 'active' && t.type === 'tournament' ? previewKnockout(entrants, maxAllowed) : [];
  const standings = league && status !== 'active' ? computeStandings(entrants, matches) : [];
  const rounds = totalRounds(matches);
  const myNext = matches.find((m) => m.status === 'pending' && ((m.aId && myIds.has(m.aId)) || (m.bId && myIds.has(m.bId))) && m.aId && m.bId);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={color} />
      <SafeAreaView style={[styles.header, { backgroundColor: color }]} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t.name}</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color} />}
      >
        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <Text style={{ fontSize: 40 }}>{t.sportEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.typeBadgeText, { color }]}>
                  {TYPE_LABELS[t.type]} · {t.sport}{t.format ? ` · ${t.format}` : ''}
                </Text>
              </View>
            </View>
          </View>
          <InfoRow icon="calendar-outline" text={t.date} />
          {!!t.location && <InfoRow icon="location-outline" text={t.location} />}
          <InfoRow icon={isTeam ? 'people-outline' : 'person-outline'} text={`Open to ${nouns} · min ${minNeeded}, max ${maxAllowed}`} />
          <View style={styles.moneyRow}>
            <View style={styles.moneyBox}>
              <Text style={styles.moneyLabel}>Entry</Text>
              <Text style={styles.moneyValue}>CAD {t.entryFee.toLocaleString()}</Text>
            </View>
            <View style={styles.moneyBox}>
              <Text style={styles.moneyLabel}>Prize pool</Text>
              <Text style={[styles.moneyValue, { color: '#16a34a' }]}>CAD {t.prizePool.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Status */}
        <StatusCard
          status={status}
          count={count}
          min={minNeeded}
          max={maxAllowed}
          nouns={nouns}
          color={color}
          champion={t.championName}
          hasDraw={hasDraw}
        />

        {isReal && (
          <MatchDayPanel
            kind="event"
            id={t.id}
            isParticipant={isParticipant}
            startsOn={t.startsOn}
            readyAt={t.readyAt}
            lineup={`${count} ${count === 1 ? noun : nouns}`}
            color={color}
            finalScore={t.type === 'match'
              ? {
                  allowed: true, score: t.resultScore, note: t.resultNote, summary: t.resultSummary,
                  completed: !!t.resultScore, oneVsOne: !isTeam && maxAllowed === 2,
                }
              : undefined}
            onChanged={load}
          />
        )}

        {!!notice && (
          <View style={[styles.notice, notice.error && styles.noticeError]}>
            <Ionicons name={notice.error ? 'alert-circle' : 'checkmark-circle'} size={18} color={notice.error ? '#dc2626' : '#16a34a'} />
            <Text style={[styles.noticeText, notice.error && { color: '#b91c1c' }]}>{notice.text}</Text>
            <TouchableOpacity onPress={() => setNotice(null)}><Ionicons name="close" size={16} color="#9ca3af" /></TouchableOpacity>
          </View>
        )}

        {myNext && (
          <View style={styles.nextCard}>
            <Ionicons name="flash" size={18} color="#f59e0b" />
            <Text style={styles.nextText}>
              Your next match: <Text style={{ fontWeight: '800' }}>{myNext.aName} vs {myNext.bName}</Text>
              {' '}({roundName(myNext.round, rounds, league)})
            </Text>
          </View>
        )}

        {/* Actions */}
        {!isReal ? (
          <Text style={styles.demoNote}>Sample event — pull down to refresh once you're online.</Text>
        ) : status === 'active' ? (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {isRegistered ? (
              <View style={styles.registeredRow}>
                <View style={styles.registeredBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={styles.registeredText} numberOfLines={1}>
                    {isTeam ? `${myEntries[0].name} is signed up` : 'You’re signed up'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.leaveBtn} onPress={askLeave}>
                  <Text style={styles.leaveText}>Leave</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: color }, isFull && styles.btnDisabled]}
                onPress={handleSignUp}
                disabled={isFull || busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name={isTeam ? 'people' : 'person-add'} size={18} color="#fff" />
                    <Text style={styles.primaryText}>{isFull ? 'Event is full' : pairs ? 'Sign Up My Pair' : isTeam ? 'Sign Up My Team' : 'Sign Up'}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {canStart && hasDraw && (
              <TouchableOpacity
                style={[styles.startBtn, count < minNeeded && styles.startBtnDisabled]}
                onPress={askStart}
                disabled={count < minNeeded}
              >
                <Ionicons name="play" size={18} color={count < minNeeded ? '#9ca3af' : '#fff'} />
                <Text style={[styles.startText, count < minNeeded && { color: '#6b7280' }]}>
                  {count < minNeeded
                    ? `Need ${minNeeded - count} more ${minNeeded - count === 1 ? noun : nouns} to start`
                    : league ? 'Start League & Create Fixtures' : 'Start Tournament & Draw Bracket'}
                </Text>
              </TouchableOpacity>
            )}
            {!isOrganiser && canStart && hasDraw && (
              <Text style={styles.organiserHint}>
                <Ionicons name="information-circle-outline" size={13} color="#6b7280" />
                {' '}Match day is here and the organiser hasn’t started yet — any player can start it.
              </Text>
            )}
          </View>
        ) : null}

        {canRecordAny && hasDraw && status !== 'completed' && (
          <Text style={styles.organiserHint}>
            <Ionicons name="information-circle-outline" size={13} color="#6b7280" />
            {' '}{isOrganiser
              ? 'You’re the organiser — tap any match to enter the result.'
              : dayReached
                ? 'Tap any finished match to record its score.'
                : 'Played your match? Tap it to record the score.'}
          </Text>
        )}

        {/* Tabs */}
        {hasDraw && (
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab === 'bracket' && { backgroundColor: color }]} onPress={() => setTab('bracket')}>
              <Text style={[styles.tabText, tab === 'bracket' && styles.tabTextActive]}>
                {league ? 'Table & Fixtures' : 'Bracket'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'entrants' && { backgroundColor: color }]} onPress={() => setTab('entrants')}>
              <Text style={[styles.tabText, tab === 'entrants' && styles.tabTextActive]}>
                Signed up ({count})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {hasDraw && tab === 'bracket' ? (
          league ? (
            status === 'active' ? (
              <View style={styles.infoBox}>
                <Ionicons name="calendar-outline" size={22} color={color} />
                <Text style={styles.infoBoxText}>
                  Fixtures are created when the organiser starts the league. Every {noun} plays every other {noun} once:
                  3 points for a win, 1 for a draw.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Table</Text>
                <StandingsTable rows={standings} myIds={myIds} label={pairs ? 'Pair' : isTeam ? 'Team' : 'Player'} />
                <Text style={styles.sectionTitle}>Fixtures</Text>
                {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
                  <View key={r} style={styles.fixtureGroup}>
                    <Text style={styles.fixtureRound}>{roundName(r, rounds, true)}</Text>
                    {matches.filter((m) => m.round === r).map((m) => (
                      <FixtureRow
                        key={m.slot}
                        m={m}
                        myIds={myIds}
                        editable={editable(m)}
                        onPress={() => openResult(m)}
                      />
                    ))}
                  </View>
                ))}
              </>
            )
          ) : (
            <>
              {status === 'active' && (
                <Text style={styles.previewNote}>
                  Preview: {nouns} fill the spots in sign-up order. The final draw is random and happens when the
                  organiser starts the tournament.
                </Text>
              )}
              <View style={styles.bracketWrap}>
                <BracketView
                  matches={status === 'active' ? preview : matches}
                  preview={status === 'active'}
                  highlightIds={myIds}
                  championName={t.championName}
                  canEdit={editable}
                  onPressMatch={openResult}
                />
              </View>
            </>
          )
        ) : (
          <EntrantList
            nouns={nouns}
            entrants={entrants}
            myIds={myIds}
            isTeam={isTeam}
            max={maxAllowed}
            demo={!isReal}
            onPress={(e) => (isTeam ? router.push({ pathname: '/team', params: { id: e.id } }) : openProfile(e))}
          />
        )}
      </ScrollView>

      <PlayerProfileModal player={profile} onClose={() => setProfile(null)} onMessage={messagePlayer} />

      {/* Pick a team to sign up */}
      <Modal visible={teamPicker} animationType="slide" transparent onRequestClose={() => setTeamPicker(false)}>
        <View style={styles.sheetOverlay}>
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{pairs ? 'Which pair?' : 'Which team?'}</Text>
              <TouchableOpacity onPress={() => setTeamPicker(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16, gap: 10 }}>
              {myTeams === null ? (
                <ActivityIndicator color={color} style={{ marginVertical: 20 }} />
              ) : myTeams.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                  <Ionicons name="people-outline" size={40} color="#d1d5db" />
                  <Text style={styles.pickerEmpty}>
{pairs
                      ? `This is a doubles event. Create a ${t.sport} team with just you and your partner, then sign it up here.`
                      : `This event is for ${t.sport} teams. You need to be the captain of a ${t.sport} team to sign up.`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#8b5cf6', alignSelf: 'stretch', marginBottom: 0 }]}
                    onPress={() => { setTeamPicker(false); router.push('/my-teams'); }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.primaryText}>{pairs ? 'Create a Doubles Pair' : 'Create a Team'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.pickerHint}>{pairs ? 'Your doubles pairs' : 'Teams you captain'}</Text>
                  {myTeams.map((team) => (
                    <TouchableOpacity key={team.id} style={styles.teamOption} onPress={() => doRegister(team.id)} disabled={busy}>
                      <Ionicons name="shield-outline" size={20} color="#8b5cf6" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamOptionName}>{team.name}</Text>
                        <Text style={styles.teamOptionMeta}>{team.memberCount} member{team.memberCount === 1 ? '' : 's'}</Text>
                      </View>
                      {busy ? <ActivityIndicator color={color} /> : <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Enter a result */}
      <Modal visible={!!resultMatch} animationType="slide" transparent onRequestClose={() => setResultMatch(null)}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Match result</Text>
              <TouchableOpacity onPress={() => setResultMatch(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            {resultMatch && (
              <View style={{ padding: 16 }}>
                <Text style={styles.label}>Who won?</Text>
                {[
                  { id: resultMatch.aId!, name: resultMatch.aName },
                  { id: resultMatch.bId!, name: resultMatch.bName },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.winnerOption, pick === s.id && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]}
                    onPress={() => setPick(s.id)}
                  >
                    <Ionicons name={pick === s.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={pick === s.id ? '#16a34a' : '#9ca3af'} />
                    <Text style={styles.winnerName}>
                      {s.name}{myIds.has(s.id) || myTeamIds.has(s.id) ? (isTeam ? ' (your team)' : ' (you)') : ''} won
                    </Text>
                    {pick === s.id && <Ionicons name="trophy" size={16} color="#f59e0b" />}
                  </TouchableOpacity>
                ))}
                {league && (
                  <TouchableOpacity
                    style={[styles.winnerOption, pick === 'draw' && { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}
                    onPress={() => setPick('draw')}
                  >
                    <Ionicons name={pick === 'draw' ? 'radio-button-on' : 'radio-button-off'} size={20} color={pick === 'draw' ? '#3b82f6' : '#9ca3af'} />
                    <Text style={styles.winnerName}>It was a draw</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.label, { marginTop: 8 }]}>Score (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={score}
                  onChangeText={setScore}
                  placeholder={t.sport === 'Tennis' || t.sport === 'Badminton' ? 'e.g. 6-4 6-3' : 'e.g. 3-1'}
                  placeholderTextColor="#9ca3af"
                  maxLength={40}
                />
                <Text style={styles.hint}>Everyone in the event gets an alert with the result.</Text>
                {!league && (
                  <Text style={styles.hint}>The winner moves into the next round automatically.</Text>
                )}
                {!!resultError && <Text style={styles.error}>{resultError}</Text>}
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#16a34a', marginBottom: 0 }]} onPress={saveResult} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Result</Text>}
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm */}
      <Modal visible={!!confirm} animationType="fade" transparent onRequestClose={() => setConfirm(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{confirm?.title}</Text>
            <Text style={styles.alertBody}>{confirm?.body}</Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirm(null)} disabled={busy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: confirm?.color ?? '#ef4444' }]}
                disabled={busy}
                onPress={async () => {
                  if (!confirm) return;
                  setBusy(true);
                  await confirm.run();
                  setBusy(false);
                  setConfirm(null);
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{confirm?.label}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Pieces ────────────────────────────────────────────────────

function InfoRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color="#6b7280" />
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

function StatusCard({ status, count, min, max, nouns, color, champion, hasDraw }: {
  status: string; count: number; min: number; max: number; nouns: string; color: string;
  champion?: string | null; hasDraw: boolean;
}) {
  if (status === 'completed') {
    return (
      <View style={[styles.statusCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
        <Ionicons name="trophy" size={28} color="#f59e0b" />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{hasDraw ? `Champion: ${champion ?? '—'}` : 'Match played'}</Text>
          <Text style={styles.statusSub}>{hasDraw ? 'This event is finished.' : 'The final score is below.'}</Text>
        </View>
      </View>
    );
  }
  if (status === 'in_progress') {
    return (
      <View style={[styles.statusCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
        <Ionicons name="play-circle" size={28} color="#3b82f6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>In progress</Text>
          <Text style={styles.statusSub}>Sign-ups are closed · {count} {nouns} competing</Text>
        </View>
      </View>
    );
  }
  const pct = max > 0 ? Math.min(1, count / max) : 0;
  const ready = count >= min;
  return (
    <View style={styles.statusCard}>
      <View style={{ flex: 1 }}>
        <View style={styles.statusTop}>
          <Text style={styles.statusTitle}>Sign-ups open</Text>
          <Text style={styles.statusCount}>{count} / {max} {nouns}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: color }]} />
          {max > 0 && min <= max && (
            <View style={[styles.minMarker, { left: `${(min / max) * 100}%` as `${number}%` }]} />
          )}
        </View>
        <Text style={[styles.statusSub, ready && { color: '#16a34a', fontWeight: '600' }]}>
          {hasDraw
            ? ready
              ? `✓ Enough ${nouns} to start (minimum ${min})`
              : `Needs at least ${min} ${nouns} to start — ${min - count} more to go`
            : `Needs at least ${min} ${nouns}`}
        </Text>
      </View>
    </View>
  );
}

function EntrantList({ entrants, myIds, isTeam, max, demo, onPress, nouns }: {
  nouns: string;
  entrants: Entrant[]; myIds: Set<string>; isTeam: boolean; max: number; demo: boolean;
  onPress: (e: Entrant) => void;
}) {
  if (entrants.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name={isTeam ? 'people-outline' : 'person-outline'} size={36} color="#d1d5db" />
        <Text style={styles.emptyText}>
          {demo ? 'Sign-up list isn’t available for sample events.' : `No ${nouns} signed up yet — be the first!`}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.listCard}>
      {entrants.map((e, i) => (
        <TouchableOpacity
          key={e.id}
          style={[styles.entrantRow, i > 0 && styles.rowDivider]}
          onPress={() => onPress(e)}
          disabled={myIds.has(e.id) && !isTeam}
          activeOpacity={0.7}
        >
          <Text style={styles.entrantNum}>{i + 1}</Text>
          <View style={[styles.entrantIcon, { backgroundColor: isTeam ? '#f5f3ff' : '#f0fdf4' }]}>
            <Ionicons name={isTeam ? 'shield' : 'person'} size={16} color={isTeam ? '#8b5cf6' : '#16a34a'} />
          </View>
          <Text style={styles.entrantName} numberOfLines={1}>{e.name}</Text>
          {myIds.has(e.id)
            ? <Text style={styles.youTag}>You</Text>
            : <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
        </TouchableOpacity>
      ))}
      {max > entrants.length && (
        <Text style={styles.spotsLeft}>{max - entrants.length} spot{max - entrants.length === 1 ? '' : 's'} left</Text>
      )}
    </View>
  );
}

function StandingsTable({ rows, myIds, label }: { rows: ReturnType<typeof computeStandings>; myIds: Set<string>; label: string }) {
  return (
    <View style={styles.listCard}>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.tPos, styles.tHeadText]}>#</Text>
        <Text style={[styles.tName, styles.tHeadText]}>{label}</Text>
        {['P', 'W', 'D', 'L', 'Pts'].map((h) => <Text key={h} style={[styles.tNum, styles.tHeadText]}>{h}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={r.id} style={[styles.tableRow, styles.rowDivider, myIds.has(r.id) && { backgroundColor: '#eff6ff' }, i === 0 && r.points > 0 && { backgroundColor: '#fffbeb' }]}>
          <Text style={styles.tPos}>{i + 1}</Text>
          <Text style={styles.tName} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.tNum}>{r.played}</Text>
          <Text style={styles.tNum}>{r.won}</Text>
          <Text style={styles.tNum}>{r.drawn}</Text>
          <Text style={styles.tNum}>{r.lost}</Text>
          <Text style={[styles.tNum, { fontWeight: '800', color: '#111827' }]}>{r.points}</Text>
        </View>
      ))}
    </View>
  );
}

function FixtureRow({ m, myIds, editable, onPress }: {
  m: BracketMatch; myIds: Set<string>; editable: boolean; onPress: () => void;
}) {
  const aWon = m.status === 'done' && !m.isDraw && m.winnerId === m.aId;
  const bWon = m.status === 'done' && !m.isDraw && m.winnerId === m.bId;
  const mine = (m.aId && myIds.has(m.aId)) || (m.bId && myIds.has(m.bId));
  const Wrapper = editable ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.fixture, mine && { borderColor: '#bfdbfe', backgroundColor: '#f8fbff' }]} onPress={editable ? onPress : undefined}>
      <Text style={[styles.fixtureTeam, aWon && styles.fixtureWin]} numberOfLines={1}>{m.aName}</Text>
      <View style={styles.fixtureMid}>
        {m.status === 'done'
          ? <Text style={styles.fixtureScore}>{m.score || (m.isDraw ? 'Draw' : 'W')}</Text>
          : <Text style={[styles.fixtureVs, editable && { color: '#3b82f6', fontWeight: '700' }]}>{editable ? 'Add result' : 'vs'}</Text>}
      </View>
      <Text style={[styles.fixtureTeam, { textAlign: 'right' }, bWon && styles.fixtureWin]} numberOfLines={1}>{m.bName}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  infoTop: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 18, fontWeight: '800', color: '#111827' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoRowText: { color: '#374151', fontSize: 13, flex: 1 },
  moneyRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  moneyBox: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 10, padding: 10 },
  moneyLabel: { fontSize: 11, color: '#6b7280' },
  moneyValue: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 2 },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12,
  },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  statusCount: { fontSize: 13, fontWeight: '700', color: '#374151' },
  statusSub: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  progressTrack: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'visible' },
  progressFill: { height: 8, borderRadius: 4 },
  minMarker: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: '#111827', marginLeft: -1 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  noticeError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  noticeText: { flex: 1, color: '#15803d', fontSize: 13, fontWeight: '600' },
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderRadius: 10,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fde68a',
  },
  nextText: { flex: 1, color: '#92400e', fontSize: 13 },
  demoNote: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { backgroundColor: '#d1d5db' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: '#111827',
  },
  startBtnDisabled: { backgroundColor: '#e5e7eb' },
  startText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  registeredRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  registeredBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12,
  },
  registeredText: { flex: 1, color: '#15803d', fontWeight: '700' },
  leaveBtn: { borderWidth: 1.5, borderColor: '#fecaca', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: '#fff' },
  leaveText: { color: '#ef4444', fontWeight: '700' },
  organiserHint: { color: '#6b7280', fontSize: 12, marginBottom: 10 },
  tabs: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabText: { color: '#4b5563', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  previewNote: { color: '#6b7280', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  bracketWrap: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
  },
  infoBoxText: { flex: 1, color: '#374151', fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 4 },
  listCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16, overflow: 'hidden' },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  entrantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  entrantNum: { width: 20, color: '#9ca3af', fontWeight: '700', fontSize: 13 },
  entrantIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  entrantName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  youTag: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  spotsLeft: { textAlign: 'center', color: '#6b7280', fontSize: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  emptyText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  tableHead: { backgroundColor: '#f9fafb' },
  tHeadText: { color: '#6b7280', fontWeight: '700', fontSize: 11 },
  tPos: { width: 22, color: '#6b7280', fontWeight: '700', fontSize: 13 },
  tName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  tNum: { width: 30, textAlign: 'center', fontSize: 13, color: '#374151' },
  fixtureGroup: { marginBottom: 12 },
  fixtureRound: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 },
  fixture: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6,
  },
  fixtureTeam: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '500' },
  fixtureWin: { fontWeight: '800', color: '#15803d' },
  fixtureMid: { minWidth: 76, alignItems: 'center' },
  fixtureScore: { fontWeight: '800', color: '#111827', fontSize: 13 },
  fixtureVs: { color: '#9ca3af', fontSize: 12 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  pickerEmpty: { color: '#374151', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  pickerHint: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  teamOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 14,
  },
  teamOptionName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  teamOptionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  winnerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  winnerName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#111827', marginBottom: 8,
  },
  hint: { color: '#6b7280', fontSize: 12, marginBottom: 10 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6, textAlign: 'center' },
  alertBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 18, lineHeight: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
