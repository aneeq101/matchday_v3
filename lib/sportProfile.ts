// What a player can say about themselves for each sport — used by the
// welcome flow (app/welcome.tsx) and the Profile tab's Add / Edit Sport sheet.
// Everything here is optional apart from the sport itself.
//
// Stored in profile_sports: `skill` (Beginner / Intermediate / Advanced) and
// `details` (jsonb of label → text), e.g.
//   { "Position": "Midfielder, Forward", "Preferred foot": "Left", "Passing": "Strength" }

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export const PROFILE_SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball', 'Hockey'];

export const SPORT_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾', Basketball: '🏀', Badminton: '🏸', Baseball: '⚾', Hockey: '🏑',
};

export const SKILL_LEVELS: { level: SkillLevel; blurb: string; color: string }[] = [
  { level: 'Beginner',     blurb: 'New to it or just playing for fun',            color: '#3b82f6' },
  { level: 'Intermediate', blurb: 'Play regularly and hold my own in a game',     color: '#f59e0b' },
  { level: 'Advanced',     blurb: 'Competitive — leagues, clubs or tournaments', color: '#ef4444' },
];

export interface ProfileField {
  label: string;
  options: string[];
  multi?: boolean;       // e.g. footballers often play more than one position
}

export const SPORT_FIELDS: Record<string, ProfileField[]> = {
  Football: [
    { label: 'Position', options: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], multi: true },
    { label: 'Preferred foot', options: ['Right', 'Left', 'Both'] },
  ],
  Cricket: [
    { label: 'Role', options: ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'] },
    { label: 'Batting hand', options: ['Right', 'Left'] },
    { label: 'Bowling', options: ['Pace', 'Spin', 'Don’t bowl'] },
  ],
  Tennis: [
    { label: 'Plays', options: ['Singles', 'Doubles', 'Both'] },
    { label: 'Hand', options: ['Right', 'Left'] },
    { label: 'Backhand', options: ['One-handed', 'Two-handed'] },
  ],
  Badminton: [
    { label: 'Plays', options: ['Singles', 'Doubles', 'Mixed'], multi: true },
    { label: 'Hand', options: ['Right', 'Left'] },
  ],
  Basketball: [
    { label: 'Position', options: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'], multi: true },
  ],
  Baseball: [
    { label: 'Position', options: ['Pitcher', 'Catcher', 'Infield', 'Outfield'], multi: true },
    { label: 'Bats', options: ['Right', 'Left', 'Switch'] },
  ],
  Hockey: [
    { label: 'Position', options: ['Forward', 'Defence', 'Goalie'], multi: true },
    { label: 'Shoots', options: ['Left', 'Right'] },
  ],
};

// A handful of headline skills per sport for a quick, friendly self-check.
// Three plain-language answers instead of numbers so it never feels like a test.
export const SELF_RATING_OPTIONS = ['Working on it', 'Solid', 'Strength'] as const;

export const SELF_RATING_SKILLS: Record<string, string[]> = {
  Tennis:     ['Forehand', 'Backhand', 'Serve', 'Volleys', 'Topspin', 'Movement'],
  Badminton:  ['Smash', 'Net play', 'Clears', 'Defence', 'Footwork'],
  Football:   ['Passing', 'Dribbling', 'Shooting', 'Defending', 'Pace', 'Stamina'],
  Cricket:    ['Batting', 'Bowling', 'Fielding', 'Catching'],
  Basketball: ['Shooting', '3-pointers', 'Ball handling', 'Defence', 'Rebounding'],
  Baseball:   ['Hitting', 'Fielding', 'Throwing', 'Pitching', 'Speed'],
  Hockey:     ['Skating', 'Stickhandling', 'Shooting', 'Defence'],
};

const FIELD_LABELS = new Set(Object.values(SPORT_FIELDS).flat().map((f) => f.label));

/**
 * Short lines for a sport card: the "about" fields as they are, then the
 * self-ratings folded into one "Strengths:" line so cards stay small.
 */
export function summarizeDetails(sport: string, details: Record<string, string>): string[] {
  const selfSkills = new Set(SELF_RATING_SKILLS[sport] ?? []);
  const lines: string[] = [];
  const strengths: string[] = [];
  Object.entries(details ?? {}).forEach(([k, v]) => {
    if (!v) return;
    if (selfSkills.has(k) && !FIELD_LABELS.has(k)) {
      if (v === 'Strength') strengths.push(k);
      return;
    }
    lines.push(`${k}: ${v}`);
  });
  if (strengths.length) lines.push(`Strengths: ${strengths.join(', ')}`);
  return lines;
}
