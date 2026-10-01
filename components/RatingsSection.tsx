import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  fetchRatingSummary, fetchRatings, deleteRating, type RatingSummary, type Rating,
} from '../lib/ratings';
import {
  BADGE_TIERS, BADGE_RULES, RATEABLE_SPORTS,
  skillsFor, levelFor, levelColor, ntrpFor, nextBadgeProgress, type RatingTargetKind,
} from '../lib/ratingRules';
import BadgeChip from './BadgeChip';
import RateModal from './RateModal';

interface Props {
  kind: RatingTargetKind;
  id: string;
  name: string;
  /** Sports offered in the rating sheet (player's sports, or the team's sport). */
  sports: string[];
  canRate: boolean;
  /** Full screen: every review instead of the latest two + "See all". */
  full?: boolean;
  /** Lets the parent show badges in its own header. */
  onSummary?: (s: RatingSummary[]) => void;
  /** Your own profile / your team: show "Ask for ratings". */
  onAsk?: () => void;
  /** Open the rating sheet straight away for this sport (from a rating request). */
  autoRateSport?: string;
  /** Bump to open the sheet again for the same sport. */
  autoRateKey?: number;
  /** Called after this user saves a rating. */
  onRated?: () => void;
}

const PREVIEW_REVIEWS = 2;

export default function RatingsSection({ kind, id, name, sports, canRate, full, onSummary, onAsk, autoRateSport, autoRateKey, onRated }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary]   = useState<RatingSummary[]>([]);
  const [ratings, setRatings]   = useState<Rating[]>([]);
  const [sport, setSport]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [showRate, setShowRate] = useState(false);
  const [showHow, setShowHow]   = useState(false);
  const [toDelete, setToDelete] = useState<Rating | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([fetchRatingSummary(kind, id), fetchRatings(kind, id)]);
    setSummary(s);
    setRatings(r);
    onSummary?.(s);
    setSport((cur) => (cur && s.some((x) => x.sport === cur) ? cur : s[0]?.sport ?? ''));
    setLoading(false);
  }, [kind, id]);

  useEffect(() => { setLoading(true); setSport(''); load(); }, [load]);

  useEffect(() => {
    if (autoRateSport && canRate) setShowRate(true);
  }, [autoRateSport, autoRateKey, canRate]);

  const current = summary.find((s) => s.sport === sport);
  const sportRatings = ratings.filter((r) => r.sport === sport);
  const reviews = sportRatings.filter((r) => r.review || full);
  const shownReviews = full ? reviews : reviews.slice(0, PREVIEW_REVIEWS);

  // Rating sheet: player's own sports first; fall back to every sport we have skills for
  const rateSports = (() => {
    const own = sports.filter((s) => RATEABLE_SPORTS.includes(s));
    const list = own.length ? own : kind === 'team' ? sports : RATEABLE_SPORTS;
    return autoRateSport && !list.includes(autoRateSport) ? [autoRateSport, ...list] : list;
  })();

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const ok = await deleteRating(toDelete.id);
    setDeleting(false);
    setToDelete(null);
    if (ok) load();
  };

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
        <TouchableOpacity onPress={() => setShowHow(true)} accessibilityLabel="How ratings and badges work" hitSlop={8}>
          <Ionicons name="information-circle-outline" size={18} color="#6b7280" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {onAsk && (
          <TouchableOpacity style={styles.askBtn} onPress={onAsk}>
            <Ionicons name="paper-plane-outline" size={14} color="#16a34a" />
            <Text style={styles.askBtnText}>Ask for ratings</Text>
          </TouchableOpacity>
        )}
        {canRate && (
          <TouchableOpacity style={styles.rateBtn} onPress={() => setShowRate(true)}>
            <Ionicons name="star" size={14} color="#fff" />
            <Text style={styles.rateBtnText}>Rate</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#16a34a" style={{ marginVertical: 12 }} />
      ) : summary.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="star-half-outline" size={30} color="#d1d5db" />
          <Text style={styles.emptyText}>No ratings yet</Text>
          {onAsk && (
            <Text style={styles.emptySub}>Ask people you’ve played with to rate {kind === 'team' ? 'your team' : 'your game'} — it builds trust and earns badges.</Text>
          )}
          {canRate && (
            <Text style={styles.emptySub}>Played with or against {name}? Be the first to rate {kind === 'team' ? 'them' : 'their game'}.</Text>
          )}
        </View>
      ) : (
        <>
          {summary.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {summary.map((s) => (
                <TouchableOpacity
                  key={s.sport}
                  style={[styles.tab, sport === s.sport && styles.tabOn]}
                  onPress={() => setSport(s.sport)}
                >
                  <Text style={[styles.tabText, sport === s.sport && styles.tabTextOn]}>{s.sport}</Text>
                  {s.badge && <Ionicons name={s.badge === 'diamond' ? 'diamond' : 'medal'} size={12} color={sport === s.sport ? '#fff' : BADGE_TIERS.find((b) => b.tier === s.badge)?.color} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {current && <SummaryCard s={current} kind={kind} />}

          {/* Reviews */}
          {shownReviews.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {shownReviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  r={r}
                  kind={kind}
                  mine={!!user && r.raterUserId === user.id}
                  onDelete={() => setToDelete(r)}
                />
              ))}
            </View>
          )}
          {!full && sportRatings.length > 0 && (
            <TouchableOpacity
              style={styles.seeAll}
              onPress={() => router.push({ pathname: '/ratings', params: { kind, id, name } })}
            >
              <Text style={styles.seeAllText}>
                See all {sportRatings.length} rating{sportRatings.length === 1 ? '' : 's'}
                {current && current.reviews ? ` · ${current.reviews} review${current.reviews === 1 ? '' : 's'}` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#16a34a" />
            </TouchableOpacity>
          )}
        </>
      )}

      {canRate && (
        <RateModal
          visible={showRate}
          targetKind={kind}
          targetId={id}
          targetName={name}
          sports={rateSports}
          initialSport={autoRateSport || sport || undefined}
          onClose={() => setShowRate(false)}
          onSaved={() => { load(); onRated?.(); }}
        />
      )}

      {/* How it works */}
      <Modal visible={showHow} animationType="fade" transparent onRequestClose={() => setShowHow(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.howBox}>
            <Text style={styles.howTitle}>How ratings & badges work</Text>
            <Text style={styles.howText}>
              Players and teams rate each other per sport: an overall level from 1 (beginner) to 10 (pro), plus individual skills and conduct. Rating again updates your earlier rating.
            </Text>
            {BADGE_TIERS.map((b) => (
              <View key={b.tier} style={styles.howRow}>
                <BadgeChip tier={b.tier} />
                <Text style={styles.howRowText}>{b.min}+ · {levelFor(b.min).name}</Text>
              </View>
            ))}
            <Text style={styles.howText}>
              To earn a badge, at least {BADGE_RULES.minRaters} different people (or teams) must rate the overall at that level or higher, and they must be at least half of everyone who rated that sport. Only ratings from the last 12 months count, so badges reflect current form.
            </Text>
            <Text style={styles.howText}>“Played together” means the app found a completed match, challenge or shared team between you.</Text>
            <TouchableOpacity style={styles.howBtn} onPress={() => setShowHow(false)}>
              <Text style={styles.howBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete my rating */}
      <Modal visible={!!toDelete} animationType="fade" transparent onRequestClose={() => setToDelete(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.howBox}>
            <Text style={styles.howTitle}>Delete your rating?</Text>
            <Text style={styles.howText}>Your {toDelete?.sport} rating and review of {name} will be removed.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setToDelete(null)} disabled={deleting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ s, kind }: { s: RatingSummary; kind: RatingTargetKind }) {
  const rated = skillsFor(kind, s.sport).filter((a) => s.skills[a.key] !== undefined);
  const lvl = levelFor(s.avgOverall);
  const ntrp = ntrpFor(s.sport, s.avgOverall);
  const progress = nextBadgeProgress(s.badge, s.tierCounts, s.raters);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.bigScore}>
          <Text style={[styles.bigNum, { color: levelColor(s.avgOverall) }]}>{s.avgOverall.toFixed(1)}</Text>
          <Text style={styles.outOf}>/10</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.levelName}>{lvl.name}{ntrp ? ` · NTRP ≈ ${ntrp}` : ''}</Text>
          <Text style={styles.meta}>
            {s.raters} rater{s.raters === 1 ? '' : 's'}
            {s.verified ? ` · ${s.verified} played together` : ''}
          </Text>
          {s.badge ? <BadgeChip tier={s.badge} sport={s.sport} size="md" /> : (
            <Text style={styles.noBadge}>No badge yet</Text>
          )}
        </View>
      </View>

      {progress && (
        <View style={styles.progress}>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>Next: {progress.badge.name}</Text>
            <Text style={styles.progressCount}>{Math.min(progress.have, progress.need)}/{progress.need}</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.min(100, (progress.have / progress.need) * 100)}%` as any, backgroundColor: progress.badge.color }]} />
          </View>
          <Text style={styles.progressHint}>{progress.hint}</Text>
        </View>
      )}

      {rated.length > 0 && (
        <View style={styles.skills}>
          {rated.map((a) => {
            const v = s.skills[a.key];
            return (
              <View key={a.key} style={styles.skillRow}>
                <Text style={styles.skillName} numberOfLines={1}>{a.label}</Text>
                <View style={styles.skillBarBg}>
                  <View style={[styles.skillBarFill, { width: `${v * 10}%` as any, backgroundColor: levelColor(v) }]} />
                </View>
                <Text style={styles.skillNum}>{v.toFixed(1)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {(s.sportsmanship !== null || s.reliability !== null) && (
        <View style={styles.conduct}>
          {s.sportsmanship !== null && (
            <View style={styles.conductItem}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.conductText}>{s.sportsmanship.toFixed(1)} Sportsmanship</Text>
            </View>
          )}
          {s.reliability !== null && (
            <View style={styles.conductItem}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.conductText}>{s.reliability.toFixed(1)} Reliability</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function ReviewCard({ r, kind, mine, onDelete }: { r: Rating; kind: RatingTargetKind; mine: boolean; onDelete: () => void }) {
  const skillLabels = new Map(skillsFor(kind, r.sport).map((a) => [a.key, a.label]));
  const top = Object.entries(r.skills).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const when = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <View style={[styles.avatar, { backgroundColor: r.raterColor }]}>
          {r.raterTeamId
            ? <Ionicons name="people" size={15} color="#fff" />
            : <Text style={styles.avatarText}>{r.raterInitials}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewer} numberOfLines={1}>{r.raterName}{r.raterTeamId ? ' (team)' : ''}</Text>
          <Text style={styles.reviewMeta}>
            {when}{r.playedTogether ? ' · ✓ Played together' : ''}
          </Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: levelColor(r.overall) }]}>
          <Text style={styles.scorePillText}>{r.overall}/10</Text>
        </View>
        {mine && (
          <TouchableOpacity onPress={onDelete} hitSlop={8} accessibilityLabel="Delete my rating">
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
      {!!r.review && <Text style={styles.reviewText}>{r.review}</Text>}
      {top.length > 0 && (
        <View style={styles.reviewSkills}>
          {top.map(([k, v]) => (
            <Text key={k} style={styles.reviewSkill}>{skillLabels.get(k) ?? k} {v}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  rateBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  askBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  askBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  emptyBox: {
    alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 16,
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  emptyText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  emptySub: { color: '#9ca3af', fontSize: 12, textAlign: 'center' },
  tabs: { gap: 8, paddingBottom: 10 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  tabOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bigScore: { flexDirection: 'row', alignItems: 'baseline' },
  bigNum: { fontSize: 38, fontWeight: '900' },
  outOf: { fontSize: 14, color: '#9ca3af', fontWeight: '700', marginLeft: 2 },
  levelName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280' },
  noBadge: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  progress: { marginTop: 14, padding: 10, backgroundColor: '#f9fafb', borderRadius: 10 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  progressCount: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  barBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  progressHint: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  skills: { marginTop: 14, gap: 7 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillName: { width: 118, fontSize: 12, color: '#374151', fontWeight: '600' },
  skillBarBg: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  skillBarFill: { height: 8, borderRadius: 4 },
  skillNum: { width: 28, fontSize: 12, fontWeight: '800', color: '#111827', textAlign: 'right' },
  conduct: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  conductItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  conductText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  seeAllText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  review: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  reviewer: { fontSize: 13, fontWeight: '700', color: '#111827' },
  reviewMeta: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scorePillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  reviewText: { fontSize: 13, color: '#374151', lineHeight: 19, marginTop: 8 },
  reviewSkills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reviewSkill: {
    fontSize: 11, color: '#374151', fontWeight: '600',
    backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  howBox: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 400, gap: 10 },
  howTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  howText: { fontSize: 13, color: '#4b5563', lineHeight: 19 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howRowText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  howBtn: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  howBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  deleteBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#ef4444' },
  deleteText: { color: '#fff', fontWeight: '700' },
});
