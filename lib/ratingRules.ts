// Skill ratings & badges — pure rules (no Supabase), shared by the rating
// sheet, the ratings section on profiles/teams and the full ratings screen.
//
// How it works
//  • Every rating is for one sport. The rater gives an OVERALL level (1–10,
//    required) plus optional per-skill levels and two 1–5 conduct scores.
//    Skills you haven't seen can be skipped (e.g. a keeper's finishing).
//  • The 1–10 scale has fixed meanings (RATING_LEVELS) so "7" means the same
//    thing to everyone. Tennis also shows the matching NTRP rating.
//  • Badges come from the database (rating_summary() in
//    lib/db/patch_ratings.sql), which applies BADGE_RULES below:
//      – at least 3 different people rated the overall at that level or higher
//      – and those people are at least half of everyone who rated that sport
//      – only ratings from the last 12 months count (current form)
//    Keep BADGE_TIERS in step with fn_rating_tiers() in that SQL file.

export type RatingTargetKind = 'player' | 'team';

export interface RatingLevel {
  value: number;
  name: string;
  description: string;
}

export const RATING_LEVELS: RatingLevel[] = [
  { value: 1,  name: 'Beginner',      description: 'Just starting — learning the rules and basic technique.' },
  { value: 2,  name: 'Novice',        description: 'Knows the basics but struggles to keep the game going.' },
  { value: 3,  name: 'Recreational',  description: 'Plays casually; can rally / take part but makes frequent errors.' },
  { value: 4,  name: 'Developing',    description: 'Regular player with some reliable skills; still inconsistent under pressure.' },
  { value: 5,  name: 'Intermediate',  description: 'Consistent on the basics; holds their own in social club games.' },
  { value: 6,  name: 'Club',          description: 'Solid all-round game; competitive in recreational leagues.' },
  { value: 7,  name: 'Advanced',      description: 'Strong league player with weapons and few weaknesses.' },
  { value: 8,  name: 'Expert',        description: 'Top of local leagues; competes in regional tournaments.' },
  { value: 9,  name: 'Elite',         description: 'Provincial / university / semi-pro level.' },
  { value: 10, name: 'Pro',           description: 'National or professional standard.' },
];

export function levelFor(value: number): RatingLevel {
  const v = Math.min(10, Math.max(1, Math.round(value)));
  return RATING_LEVELS[v - 1];
}

/** Colour for a 1–10 value (bars, chips). */
export function levelColor(value: number): string {
  if (value >= 9) return '#7c3aed';
  if (value >= 7) return '#16a34a';
  if (value >= 5) return '#0ea5e9';
  if (value >= 3) return '#f59e0b';
  return '#9ca3af';
}

// Tennis players think in NTRP (USTA / Tennis Canada). 1–10 → NTRP.
const NTRP: Record<number, string> = {
  1: '1.5', 2: '2.0', 3: '2.5', 4: '3.0', 5: '3.5', 6: '4.0', 7: '4.5', 8: '5.0', 9: '5.5–6.0', 10: '6.5–7.0',
};

export function ntrpFor(sport: string, value: number): string | null {
  if (sport !== 'Tennis' || !value) return null;
  return NTRP[Math.min(10, Math.max(1, Math.round(value)))] ?? null;
}

// ── Badges ───────────────────────────────────────────────────
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface BadgeInfo {
  tier: BadgeTier;
  name: string;
  min: number;          // overall rating needed (1–10)
  color: string;        // text / icon
  bg: string;           // chip background
  icon: 'medal' | 'diamond';
}

// Lowest → highest. Bronze starts at a genuinely solid level (5 = Intermediate),
// so a badge always means "good", and Diamond is reserved for elite players.
export const BADGE_TIERS: BadgeInfo[] = [
  { tier: 'bronze',   name: 'Bronze',   min: 5, color: '#9a3412', bg: '#fed7aa', icon: 'medal' },
  { tier: 'silver',   name: 'Silver',   min: 6, color: '#475569', bg: '#e2e8f0', icon: 'medal' },
  { tier: 'gold',     name: 'Gold',     min: 7, color: '#a16207', bg: '#fef08a', icon: 'medal' },
  { tier: 'platinum', name: 'Platinum', min: 8, color: '#0e7490', bg: '#cffafe', icon: 'medal' },
  { tier: 'diamond',  name: 'Diamond',  min: 9, color: '#6d28d9', bg: '#ede9fe', icon: 'diamond' },
];

export const BADGE_RULES = {
  minRaters: 3,        // at least 3 different people at that level
  minShare: 0.5,       // …who are at least half of all raters for that sport
  windowDays: 365,     // only the last 12 months count
};

export function badgeInfo(tier?: string | null): BadgeInfo | null {
  return BADGE_TIERS.find((b) => b.tier === tier) ?? null;
}

/**
 * What's needed for the next badge, from the per-tier counts the database
 * returns ({ bronze: n, silver: n, ... } = raters at that level or higher).
 */
export function nextBadgeProgress(
  current: BadgeTier | null,
  tierCounts: Partial<Record<BadgeTier, number>>,
  totalRaters: number,
): { badge: BadgeInfo; have: number; need: number; hint: string } | null {
  const idx = current ? BADGE_TIERS.findIndex((b) => b.tier === current) : -1;
  const next = BADGE_TIERS[idx + 1];
  if (!next) return null;
  const have = tierCounts[next.tier] ?? 0;
  const needShare = Math.ceil(totalRaters * BADGE_RULES.minShare);
  const need = Math.max(BADGE_RULES.minRaters, needShare);
  const hint = have >= BADGE_RULES.minRaters && have < needShare
    ? `Most raters must agree — ${have} of ${totalRaters} rate ${next.min}+`
    : `${have} of ${BADGE_RULES.minRaters} ratings at ${next.min}+ (${levelFor(next.min).name})`;
  return { badge: next, have, need, hint };
}

// ── Skills per sport ─────────────────────────────────────────
export interface SkillAttr {
  key: string;
  label: string;
  hint: string;         // what to judge
  group: string;
}

const p = (group: string, key: string, label: string, hint: string): SkillAttr => ({ key, label, hint, group });

export const PLAYER_SKILLS: Record<string, SkillAttr[]> = {
  Tennis: [
    p('Strokes', 'serve',       'Serve',             'Pace, placement and first-serve %'),
    p('Strokes', 'return',      'Return of Serve',   'Neutralises big serves, attacks weak ones'),
    p('Strokes', 'forehand',    'Forehand',          'Power, depth and consistency'),
    p('Strokes', 'backhand',    'Backhand',          'Holds up under pressure, can hit winners'),
    p('Strokes', 'volley',      'Volleys',           'Clean, well-placed volleys at the net'),
    p('Strokes', 'overhead',    'Overhead / Smash',  'Puts lobs away'),
    p('Spin & Touch', 'topspin','Topspin',           'Heavy, controlled topspin off both wings'),
    p('Spin & Touch', 'slice',  'Slice & Drop Shots','Variety, touch and disguise'),
    p('Game', 'movement',       'Footwork & Movement','Court coverage, recovery, balance'),
    p('Game', 'consistency',    'Consistency',       'Unforced errors, rally tolerance'),
    p('Game', 'tactics',        'Shot Selection',    'Builds points, plays to the opponent’s weakness'),
    p('Game', 'mental',         'Mental Toughness',  'Big points, tiebreaks, comebacks'),
  ],
  Badminton: [
    p('Strokes', 'serve',     'Serve',            'Low short serve and flick/high serve'),
    p('Strokes', 'clear',     'Clears',           'Reaches the back line from both corners'),
    p('Strokes', 'smash',     'Smash',            'Steep, powerful, well-placed'),
    p('Strokes', 'drop',      'Drop Shots',       'Tight, deceptive drops'),
    p('Strokes', 'net',       'Net Play',         'Spinning net shots, kills, lifts'),
    p('Strokes', 'drive',     'Drives',           'Flat, fast exchanges'),
    p('Game', 'defence',      'Defence',          'Smash returns, retrieving'),
    p('Game', 'footwork',     'Footwork',         'Speed to all four corners, recovery'),
    p('Game', 'deception',    'Deception',        'Holds the shot, disguise'),
    p('Game', 'tactics',      'Tactics & Placement','Moves the opponent, rotation in doubles'),
    p('Game', 'stamina',      'Stamina',          'Keeps the level up through three games'),
  ],
  Football: [
    p('Technical', 'passing',     'Passing',         'Short and long range accuracy'),
    p('Technical', 'first_touch', 'First Touch',     'Controls the ball under pressure'),
    p('Technical', 'dribbling',   'Dribbling',       'Beats players 1v1'),
    p('Technical', 'finishing',   'Finishing',       'Converts chances, both feet'),
    p('Technical', 'crossing',    'Crossing',        'Quality from wide areas'),
    p('Technical', 'heading',     'Heading',         'Timing and accuracy in the air'),
    p('Defending', 'tackling',    'Tackling',        'Clean, well-timed challenges'),
    p('Defending', 'marking',     'Marking',         'Tracks runners, stays goal-side'),
    p('Defending', 'goalkeeping', 'Goalkeeping',     'Shot-stopping, handling, distribution (keepers)'),
    p('Physical', 'pace',         'Pace',            'Acceleration and top speed'),
    p('Physical', 'stamina',      'Stamina',         'Work rate for the full game'),
    p('Physical', 'strength',     'Strength',        'Holds off opponents, wins duels'),
    p('Mental', 'positioning',    'Positioning',     'In the right place, attacking and defending'),
    p('Mental', 'vision',         'Vision',          'Sees and plays the killer pass'),
  ],
  Cricket: [
    p('Batting', 'bat_technique', 'Batting Technique', 'Defence, footwork, playing straight'),
    p('Batting', 'shot_range',    'Shot Range',        'Scores all around the ground'),
    p('Batting', 'power',         'Power Hitting',     'Clears the rope when needed'),
    p('Batting', 'running',       'Running Between Wickets', 'Calling, quick singles'),
    p('Bowling', 'pace',          'Pace Bowling',      'Speed, seam and swing'),
    p('Bowling', 'spin',          'Spin Bowling',      'Turn, flight and variation'),
    p('Bowling', 'accuracy',      'Line & Length',     'Builds pressure with dot balls'),
    p('Bowling', 'death',         'Death Bowling',     'Yorkers and slower balls at the end'),
    p('Fielding', 'catching',     'Catching',          'Safe hands, in the ring and the deep'),
    p('Fielding', 'ground',       'Ground Fielding',   'Stops boundaries, quick pick-up'),
    p('Fielding', 'throwing',     'Throwing Arm',      'Flat, accurate throws, run-outs'),
    p('Fielding', 'keeping',      'Wicketkeeping',     'Takes, stumpings, standing up (keepers)'),
    p('Game', 'awareness',        'Game Awareness',    'Reads the match situation'),
    p('Game', 'temperament',      'Temperament',       'Stays calm under pressure'),
  ],
  Basketball: [
    p('Scoring', 'mid_range',   'Mid-Range Shooting', 'Pull-ups and jumpers'),
    p('Scoring', 'three',       '3-Point Shooting',   'Range and consistency'),
    p('Scoring', 'finishing',   'Finishing at the Rim','Layups and contact finishes'),
    p('Scoring', 'free_throws', 'Free Throws',        'Reliable from the line'),
    p('Playmaking', 'handles',  'Ball Handling',      'Protects the ball, creates space'),
    p('Playmaking', 'passing',  'Passing',            'Finds the open man, few turnovers'),
    p('Playmaking', 'iq',       'Court Vision / IQ',  'Reads the floor, makes the right play'),
    p('Defence', 'perimeter_d', 'Perimeter Defence',  'Stays in front, contests shots'),
    p('Defence', 'interior_d',  'Interior Defence',   'Rim protection, post defence'),
    p('Defence', 'rebounding',  'Rebounding',         'Boxes out, crashes the glass'),
    p('Physical', 'athleticism','Athleticism',        'Speed, vertical, strength'),
    p('Physical', 'hustle',     'Hustle',             'Effort plays, loose balls, transition'),
  ],
  Baseball: [
    p('Hitting', 'contact',     'Contact Hitting',    'Puts the ball in play, few strikeouts'),
    p('Hitting', 'power',       'Power',              'Extra-base hits, home runs'),
    p('Hitting', 'discipline',  'Plate Discipline',   'Works counts, lays off bad pitches'),
    p('Running', 'speed',       'Speed & Baserunning','Steals, takes the extra base'),
    p('Fielding', 'glove',      'Fielding',           'Range and sure hands'),
    p('Fielding', 'arm',        'Throwing Arm',       'Strength and accuracy'),
    p('Fielding', 'catcher',    'Catching (Catcher)', 'Framing, blocking, throwing out runners'),
    p('Pitching', 'velocity',   'Pitch Velocity',     'Fastball speed'),
    p('Pitching', 'control',    'Pitch Control',      'Throws strikes, hits spots'),
    p('Pitching', 'arsenal',    'Pitch Variety',      'Breaking balls and changeups'),
    p('Game', 'iq',             'Baseball IQ',        'Situational awareness, smart plays'),
  ],
  Hockey: [
    p('Skills', 'skating',      'Skating',            'Speed, edges, agility'),
    p('Skills', 'stickhandling','Stickhandling',      'Control in tight spaces'),
    p('Skills', 'shooting',     'Shooting',           'Accuracy and release'),
    p('Skills', 'passing',      'Passing',            'Tape-to-tape, sees the ice'),
    p('Defence', 'defence',     'Defensive Play',     'Positioning, stick checks, blocks'),
    p('Defence', 'physical',    'Physicality',        'Board battles, clean hits'),
    p('Defence', 'goaltending', 'Goaltending',        'Positioning, rebounds (goalies)'),
    p('Game', 'iq',             'Hockey IQ',          'Reads plays, smart decisions'),
    p('Game', 'stamina',        'Stamina',            'Strong shifts all game'),
  ],
};

export const TEAM_SKILLS: Record<string, SkillAttr[]> = {
  Football: [
    p('Play', 'attack',      'Attacking Play',      'Creates and finishes chances'),
    p('Play', 'defence',     'Defensive Shape',     'Compact, hard to break down'),
    p('Play', 'possession',  'Passing & Possession','Keeps the ball, builds from the back'),
    p('Play', 'pressing',    'Pressing',            'Wins the ball back high'),
    p('Play', 'set_pieces',  'Set Pieces',          'Corners and free kicks, both ends'),
    p('Play', 'goalkeeping', 'Goalkeeping',         'Quality of their keeper'),
    p('Team', 'fitness',     'Fitness',             'Same intensity for the full game'),
    p('Team', 'teamwork',    'Teamwork',            'Communication, organisation'),
  ],
  Cricket: [
    p('Play', 'batting',     'Batting Depth',       'Runs all the way down the order'),
    p('Play', 'pace',        'Pace Attack',         'Quality of the seamers'),
    p('Play', 'spin',        'Spin Attack',         'Quality of the spinners'),
    p('Play', 'fielding',    'Fielding',            'Catching, ground fielding, run-outs'),
    p('Team', 'captaincy',   'Captaincy & Tactics', 'Field placings, bowling changes'),
    p('Team', 'teamwork',    'Teamwork',            'Energy and support in the field'),
  ],
  Basketball: [
    p('Play', 'offence',     'Half-Court Offence',  'Sets, spacing, shot quality'),
    p('Play', 'defence',     'Team Defence',        'Rotations, help, communication'),
    p('Play', 'transition',  'Transition',          'Runs the floor, gets back'),
    p('Play', 'shooting',    'Shooting',            'Spacing and knock-down shooters'),
    p('Play', 'rebounding',  'Rebounding',          'Owns the glass'),
    p('Team', 'ball_movement','Ball Movement',      'Unselfish, extra pass'),
    p('Team', 'teamwork',    'Teamwork',            'Chemistry and composure'),
  ],
  Baseball: [
    p('Play', 'hitting',     'Hitting',             'Lineup depth, situational hitting'),
    p('Play', 'pitching',    'Pitching Staff',      'Starters and relief'),
    p('Play', 'defence',     'Defence',             'Clean fielding, turns double plays'),
    p('Play', 'baserunning', 'Baserunning',         'Aggressive, smart on the bases'),
    p('Team', 'teamwork',    'Teamwork',            'Communication, dugout energy'),
  ],
  Hockey: [
    p('Play', 'offence',     'Offence',             'Creates and finishes chances'),
    p('Play', 'defence',     'Defence',             'Protects the slot, clears rebounds'),
    p('Play', 'goaltending', 'Goaltending',         'Quality of their goalie'),
    p('Play', 'special',     'Special Teams',       'Power play and penalty kill'),
    p('Team', 'teamwork',    'Teamwork',            'Line changes, communication'),
  ],
};

// Tennis / badminton teams are doubles pairs
const PAIR_SKILLS: SkillAttr[] = [
  p('Play', 'serve_return', 'Serve & Return',  'Holds serve, pressures returns'),
  p('Play', 'net',          'Net Play',        'Poaching, volleys, finishing at the net'),
  p('Play', 'coverage',     'Court Coverage',  'No gaps, covers lobs'),
  p('Play', 'consistency',  'Consistency',     'Few cheap errors'),
  p('Team', 'positioning',  'Positioning & Rotation', 'Up-and-back / side-by-side at the right time'),
  p('Team', 'communication','Communication',   'Calls, switches, keeps each other up'),
];
TEAM_SKILLS.Tennis = PAIR_SKILLS;
TEAM_SKILLS.Badminton = PAIR_SKILLS;

export const RATEABLE_SPORTS = Object.keys(PLAYER_SKILLS);

export function skillsFor(kind: RatingTargetKind, sport: string): SkillAttr[] {
  return (kind === 'team' ? TEAM_SKILLS[sport] : PLAYER_SKILLS[sport]) ?? [];
}

/** Skills grouped in display order: [['Strokes', [...]], ['Game', [...]]] */
export function groupedSkills(kind: RatingTargetKind, sport: string): [string, SkillAttr[]][] {
  const out: [string, SkillAttr[]][] = [];
  for (const s of skillsFor(kind, sport)) {
    const g = out.find(([name]) => name === s.group);
    if (g) g[1].push(s); else out.push([s.group, [s]]);
  }
  return out;
}

/** Rounded mean of the skills the rater filled in — a starting point for overall. */
export function suggestedOverall(skills: Record<string, number>): number | null {
  const vals = Object.values(skills).filter((v) => v >= 1 && v <= 10);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export const CONDUCT_FIELDS = [
  { key: 'sportsmanship' as const, label: 'Sportsmanship', hint: 'Fair play, line calls, respect' },
  { key: 'reliability'   as const, label: 'Reliability',   hint:'Shows up on time, doesn’t cancel last minute' },
];

export const REVIEW_MAX = 500;
