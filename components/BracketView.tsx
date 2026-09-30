import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { roundName, totalRounds, type BracketMatch } from '../lib/bracket';

// Knockout bracket drawn left → right: first round, …, Final, Champion.
// Each match sits in a cell of the round's column; lines join each pair of
// matches to the match they feed in the next round.

const CARD_W = 172;
const CARD_H = 78;
const GAP = 14;            // connector width on each side of a card
const CELL_H = CARD_H + 18;
const LINE = '#cbd5e1';

interface Props {
  matches: BracketMatch[];
  preview?: boolean;                     // before the draw: empty places read "Open spot"
  highlightIds?: Set<string>;            // the viewer's own player/team
  championName?: string | null;
  canEdit?: (m: BracketMatch) => boolean;
  onPressMatch?: (m: BracketMatch) => void;
}

export default function BracketView({ matches, preview, highlightIds, championName, canEdit, onPressMatch }: Props) {
  const rounds = totalRounds(matches);
  if (rounds === 0) return null;
  const firstCount = matches.filter((m) => m.round === 1).length;
  const colH = firstCount * CELL_H;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll}>
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
        const inRound = matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
        const cellH = colH / inRound.length;
        const isFirst = r === 1;
        const isLast = r === rounds;
        return (
          <View key={r}>
            <Text style={[styles.roundTitle, { paddingLeft: isFirst ? 0 : GAP }]}>
              {roundName(r, rounds, false)}
            </Text>
            <View style={{ height: colH }}>
              {inRound.map((m) => {
                const editable = !!onPressMatch && !!canEdit?.(m);
                return (
                  <View key={`${m.round}-${m.slot}`} style={[styles.cell, { height: cellH }]}>
                    {!isFirst && <View style={[styles.hLine, { left: 0, top: cellH / 2, width: GAP }]} />}
                    <MatchCard
                      m={m}
                      preview={preview}
                      highlightIds={highlightIds}
                      editable={editable}
                      onPress={editable ? () => onPressMatch!(m) : undefined}
                      style={{ marginLeft: isFirst ? 0 : GAP }}
                    />
                    <View style={[styles.hLine, { left: (isFirst ? 0 : GAP) + CARD_W, top: cellH / 2, width: GAP }]} />
                    {!isLast && (
                      <>
                        <View
                          style={[
                            styles.vLine,
                            {
                              left: (isFirst ? 0 : GAP) + CARD_W + GAP - 1,
                              top: m.slot % 2 === 0 ? cellH / 2 : 0,
                              height: cellH / 2 + 1,
                            },
                          ]}
                        />
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Champion */}
      <View>
        <Text style={[styles.roundTitle, { paddingLeft: GAP }]}>Champion</Text>
        <View style={{ height: colH, justifyContent: 'center' }}>
          <View style={[styles.hLine, { left: 0, top: colH / 2, width: GAP }]} />
          <View style={[styles.champCard, !championName && styles.champEmpty]}>
            <Ionicons name="trophy" size={26} color={championName ? '#f59e0b' : '#d1d5db'} />
            <Text style={[styles.champName, !championName && { color: '#9ca3af' }]} numberOfLines={2}>
              {championName ?? 'To be decided'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function MatchCard({
  m, preview, highlightIds, editable, onPress, style,
}: {
  m: BracketMatch;
  preview?: boolean;
  highlightIds?: Set<string>;
  editable: boolean;
  onPress?: () => void;
  style?: object;
}) {
  const emptyLabel = preview ? 'Open spot' : 'TBD';
  const sideB = m.status === 'bye' ? 'Bye' : (m.bName ?? emptyLabel);
  let footer = '';
  if (m.status === 'bye') footer = 'Advances automatically';
  else if (m.status === 'done') footer = m.score || 'Result in';
  else if (editable) footer = 'Tap to enter result';
  else if (m.aId && m.bId) footer = 'Upcoming';

  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.card, editable && styles.cardEditable, style]} onPress={onPress} activeOpacity={0.7}>
      <Side
        name={m.aName ?? emptyLabel}
        empty={!m.aName}
        winner={!!m.winnerId && m.winnerId === m.aId && m.status === 'done'}
        loser={m.status === 'done' && !!m.winnerId && m.winnerId !== m.aId}
        mine={!!m.aId && !!highlightIds?.has(m.aId)}
      />
      <View style={styles.sideDivider} />
      <Side
        name={sideB}
        empty={!m.bName}
        winner={!!m.winnerId && m.winnerId === m.bId && m.status === 'done'}
        loser={m.status === 'done' && !!m.winnerId && m.winnerId !== m.bId}
        mine={!!m.bId && !!highlightIds?.has(m.bId)}
      />
      <Text style={[styles.footer, editable && { color: '#8b5cf6', fontWeight: '600' }]} numberOfLines={1}>
        {footer}
      </Text>
    </Wrapper>
  );
}

function Side({ name, empty, winner, loser, mine }: {
  name: string; empty: boolean; winner: boolean; loser: boolean; mine: boolean;
}) {
  return (
    <View style={[styles.side, mine && styles.sideMine, winner && styles.sideWinner]}>
      <Text
        style={[
          styles.sideName,
          empty && styles.sideEmpty,
          winner && styles.sideNameWinner,
          loser && styles.sideNameLoser,
        ]}
        numberOfLines={1}
      >
        {name}{mine ? ' (you)' : ''}
      </Text>
      {winner && <Ionicons name="checkmark-circle" size={14} color="#16a34a" />}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 4, paddingRight: 16 },
  roundTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' },
  cell: { justifyContent: 'center', width: CARD_W + GAP * 2 },
  hLine: { position: 'absolute', height: 2, backgroundColor: LINE },
  vLine: { position: 'absolute', width: 2, backgroundColor: LINE },
  card: {
    width: CARD_W, height: CARD_H, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden',
  },
  cardEditable: { borderColor: '#c4b5fd' },
  side: { flexDirection: 'row', alignItems: 'center', height: 26, paddingHorizontal: 8, gap: 4 },
  sideMine: { backgroundColor: '#eff6ff' },
  sideWinner: { backgroundColor: '#f0fdf4' },
  sideDivider: { height: 1, backgroundColor: '#f3f4f6' },
  sideName: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '500' },
  sideNameWinner: { fontWeight: '800', color: '#15803d' },
  sideNameLoser: { color: '#9ca3af' },
  sideEmpty: { color: '#9ca3af', fontStyle: 'italic' },
  footer: { fontSize: 11, color: '#6b7280', paddingHorizontal: 8, paddingTop: 4 },
  champCard: {
    marginLeft: GAP, width: 130, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', gap: 6,
  },
  champEmpty: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  champName: { fontSize: 14, fontWeight: '800', color: '#92400e', textAlign: 'center' },
});
