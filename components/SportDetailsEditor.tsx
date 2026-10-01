import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SKILL_LEVELS, SPORT_FIELDS, SELF_RATING_SKILLS, SELF_RATING_OPTIONS, type SkillLevel,
} from '../lib/sportProfile';

interface Props {
  sport: string;
  skill: SkillLevel;
  details: Record<string, string>;
  onChange: (skill: SkillLevel, details: Record<string, string>) => void;
}

/**
 * Level + position-type questions + an optional, collapsed "rate your own game".
 * Every answer is optional and can be changed by tapping again.
 */
export default function SportDetailsEditor({ sport, skill, details, onChange }: Props) {
  const fields = SPORT_FIELDS[sport] ?? [];
  const selfSkills = SELF_RATING_SKILLS[sport] ?? [];
  const ratedCount = selfSkills.filter((s) => details[s]).length;
  const [showSelf, setShowSelf] = useState(ratedCount > 0);

  const setDetail = (label: string, value: string | null) => {
    const next = { ...details };
    if (value) next[label] = value; else delete next[label];
    onChange(skill, next);
  };

  const toggleOption = (label: string, option: string, multi?: boolean) => {
    const current = details[label] ? details[label].split(', ') : [];
    if (!multi) {
      setDetail(label, current[0] === option ? null : option);
      return;
    }
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
    setDetail(label, next.length ? next.join(', ') : null);
  };

  return (
    <View>
      <Text style={styles.q}>How would you describe your level?</Text>
      <View style={{ gap: 8 }}>
        {SKILL_LEVELS.map((l) => {
          const on = skill === l.level;
          return (
            <TouchableOpacity
              key={l.level}
              style={[styles.levelCard, on && { borderColor: l.color, backgroundColor: `${l.color}12` }]}
              onPress={() => onChange(l.level, details)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? l.color : '#9ca3af'} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.levelName, on && { color: l.color }]}>{l.level}</Text>
                <Text style={styles.levelBlurb}>{l.blurb}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {fields.map((f) => {
        const current = details[f.label] ? details[f.label].split(', ') : [];
        return (
          <View key={f.label} style={{ marginTop: 18 }}>
            <Text style={styles.q}>
              {f.label} <Text style={styles.optional}>{f.multi ? '· pick any' : '· optional'}</Text>
            </Text>
            <View style={styles.chips}>
              {f.options.map((o) => {
                const on = current.includes(o);
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => toggleOption(f.label, o, f.multi)}
                  >
                    {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {selfSkills.length > 0 && (
        <View style={styles.selfBox}>
          <TouchableOpacity style={styles.selfHead} onPress={() => setShowSelf((v) => !v)} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={18} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.selfTitle}>Rate your own game <Text style={styles.optional}>· optional</Text></Text>
              <Text style={styles.selfSub}>
                {ratedCount ? `${ratedCount} of ${selfSkills.length} answered` : `Your ${selfSkills.slice(0, 2).join(', ').toLowerCase()} and more — helps find good matches`}
              </Text>
            </View>
            <Ionicons name={showSelf ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
          </TouchableOpacity>

          {showSelf && (
            <View style={{ marginTop: 6 }}>
              {selfSkills.map((s) => (
                <View key={s} style={styles.selfRow}>
                  <Text style={styles.selfSkill}>{s}</Text>
                  <View style={styles.selfOptions}>
                    {SELF_RATING_OPTIONS.map((o) => {
                      const on = details[s] === o;
                      return (
                        <TouchableOpacity
                          key={o}
                          style={[styles.selfChip, on && styles.chipOn]}
                          onPress={() => setDetail(s, on ? null : o)}
                          accessibilityLabel={`${s}: ${o}`}
                        >
                          <Text style={[styles.selfChipText, on && styles.chipTextOn]}>{o}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Text style={styles.selfNote}>Other players can also rate you after you play — that’s what earns badges.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  q: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  optional: { fontSize: 12, fontWeight: '500', color: '#9ca3af' },
  levelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, padding: 12, backgroundColor: '#fff',
  },
  levelName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  levelBlurb: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  chipOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextOn: { color: '#fff' },
  selfBox: {
    marginTop: 20, borderRadius: 14, borderWidth: 1, borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4', padding: 12,
  },
  selfHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selfTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  selfSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  selfRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#dcfce7' },
  selfSkill: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 6 },
  selfOptions: { flexDirection: 'row', gap: 6 },
  selfChip: {
    flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
  },
  selfChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  selfNote: { fontSize: 11, color: '#6b7280', marginTop: 8 },
});
