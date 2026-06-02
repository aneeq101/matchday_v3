export type Skill = 'Beginner' | 'Intermediate' | 'Advanced';
export type Gender = 'male' | 'female';
export type Privacy = 'public' | 'private';
export type EventType = 'tournament' | 'league' | 'match';

export interface Sport {
  name: string;
  skill: Skill;
  emoji: string;
}

export interface Player {
  id: string;
  name: string;
  initials: string;
  gender: Gender;
  area: string;
  distance: string;
  bio: string;
  sports: Sport[];
  privacy: Privacy;
  joinDate: string;
  stats: { matches: number; wins: number; rank: string };
  avatarColor: string;
  offsetKm: { dx: number; dy: number };
}

export interface Post {
  id: string;
  playerId: string;
  playerName: string;
  initials: string;
  avatarColor: string;
  time: string;
  text: string;
  sports: Sport[];
  lookingFor: string;
  likes: number;
  comments: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export interface Venue {
  id: string;
  name: string;
  rating: number;
  address: string;
  sports: string[];
  distance: string;
  pricePerHour: number;
  imageColor: string;
  offsetKm?: { dx: number; dy: number };
  coord?: { latitude: number; longitude: number };
  source?: 'mock' | 'live';
}

export interface Tournament {
  id: string;
  name: string;
  type: EventType;
  sport: string;
  sportEmoji: string;
  date: string;
  location: string;
  participants: number;
  maxParticipants: number;
  entryFee: number;
  prizePool: number;
}

export interface Booking {
  id: string;
  venueName: string;
  sport: string;
  sportEmoji: string;
  date: string;
  time: string;
  price: number;
  status: 'Confirmed' | 'Pending';
}

export interface MatchItem {
  id: string;
  sport: string;
  sportEmoji: string;
  title: string;
  players: string;
  date: string;
  location: string;
}

export interface Conversation {
  id: string;
  playerId: string;
  playerName: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
  gender: Gender;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  sent: boolean;
  time: string;
}

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽',
  Cricket: '🏏',
  Tennis: '🎾',
  Basketball: '🏀',
  Hockey: '🏑',
  Badminton: '🏸',
};

export const PLAYERS: Player[] = [
  {
    id: '1',
    name: 'Ali Hassan',
    initials: 'AH',
    gender: 'male',
    area: 'Model Town',
    distance: '1.2 km',
    bio: 'Passionate footballer and cricket enthusiast. Always up for a good game!',
    sports: [
      { name: 'Football', skill: 'Advanced', emoji: '⚽' },
      { name: 'Cricket', skill: 'Beginner', emoji: '🏏' },
    ],
    privacy: 'public',
    joinDate: 'Jan 2024',
    stats: { matches: 47, wins: 32, rank: 'Gold' },
    avatarColor: '#16a34a',
    offsetKm: { dx: 0.5, dy: 1.1 },
  },
  {
    id: '2',
    name: 'Sara Ahmed',
    initials: 'SA',
    gender: 'female',
    area: 'Gulberg',
    distance: '2.8 km',
    bio: 'Tennis and badminton lover. Looking for competitive partners.',
    sports: [
      { name: 'Tennis', skill: 'Intermediate', emoji: '🎾' },
      { name: 'Badminton', skill: 'Advanced', emoji: '🏸' },
    ],
    privacy: 'public',
    joinDate: 'Mar 2024',
    stats: { matches: 31, wins: 22, rank: 'Silver' },
    avatarColor: '#8b5cf6',
    offsetKm: { dx: -2.0, dy: 2.0 },
  },
  {
    id: '3',
    name: 'Bilal Khan',
    initials: 'BK',
    gender: 'male',
    area: 'Johar Town',
    distance: '4.1 km',
    bio: 'Cricket is life. Captain of local cricket club since 2022.',
    sports: [{ name: 'Cricket', skill: 'Advanced', emoji: '🏏' }],
    privacy: 'public',
    joinDate: 'Feb 2024',
    stats: { matches: 63, wins: 45, rank: 'Platinum' },
    avatarColor: '#f59e0b',
    offsetKm: { dx: 3.0, dy: -2.8 },
  },
  {
    id: '4',
    name: 'Fatima Rizvi',
    initials: 'FR',
    gender: 'female',
    area: 'Bahria Town',
    distance: '7.3 km',
    bio: 'Basketball player. Private profile.',
    sports: [{ name: 'Basketball', skill: 'Intermediate', emoji: '🏀' }],
    privacy: 'private',
    joinDate: 'Apr 2024',
    stats: { matches: 19, wins: 11, rank: 'Bronze' },
    avatarColor: '#ec4899',
    offsetKm: { dx: -5.5, dy: -4.8 },
  },
  {
    id: '5',
    name: 'Usman Tariq',
    initials: 'UT',
    gender: 'male',
    area: 'Wapda Town',
    distance: '3.5 km',
    bio: 'Football midfielder. Weekend warrior looking for pickup games.',
    sports: [{ name: 'Football', skill: 'Intermediate', emoji: '⚽' }],
    privacy: 'public',
    joinDate: 'Dec 2023',
    stats: { matches: 28, wins: 15, rank: 'Silver' },
    avatarColor: '#3b82f6',
    offsetKm: { dx: -2.5, dy: -2.4 },
  },
  {
    id: '6',
    name: 'Zara Siddiqui',
    initials: 'ZS',
    gender: 'female',
    area: 'Garden Town',
    distance: '2.1 km',
    bio: 'Badminton champion. Looking for serious players to train with.',
    sports: [{ name: 'Badminton', skill: 'Advanced', emoji: '🏸' }],
    privacy: 'public',
    joinDate: 'Jun 2024',
    stats: { matches: 54, wins: 41, rank: 'Gold' },
    avatarColor: '#06b6d4',
    offsetKm: { dx: -1.5, dy: 1.5 },
  },
];

export const POSTS: Post[] = [
  {
    id: '1',
    playerId: '1',
    playerName: 'Ali Hassan',
    initials: 'AH',
    avatarColor: '#16a34a',
    time: '2h ago',
    text: 'Looking for someone to practice football this weekend at Model Town Sports Complex. Any takers? Bringing my own gear!',
    sports: [{ name: 'Football', skill: 'Advanced', emoji: '⚽' }],
    lookingFor: 'Practice Partner',
    likes: 12,
    comments: 3,
  },
  {
    id: '2',
    playerId: '2',
    playerName: 'Sara Ahmed',
    initials: 'SA',
    avatarColor: '#8b5cf6',
    time: '4h ago',
    text: 'Anyone up for a doubles tennis match at Gulberg Sports Arena? Looking for a partner for Saturday evening.',
    sports: [{ name: 'Tennis', skill: 'Intermediate', emoji: '🎾' }],
    lookingFor: 'Doubles Partner',
    likes: 8,
    comments: 5,
  },
  {
    id: '3',
    playerId: '3',
    playerName: 'Bilal Khan',
    initials: 'BK',
    avatarColor: '#f59e0b',
    time: '6h ago',
    text: 'Forming a cricket team for the Ramadan Cup. Need 4 more experienced players. We train every Tuesday and Thursday at DHA Cricket Ground.',
    sports: [{ name: 'Cricket', skill: 'Advanced', emoji: '🏏' }],
    lookingFor: 'Team Members',
    likes: 24,
    comments: 11,
  },
  {
    id: '4',
    playerId: '5',
    playerName: 'Usman Tariq',
    initials: 'UT',
    avatarColor: '#3b82f6',
    time: '1d ago',
    text: 'Pickup football game this Sunday at 5pm at Wapda Town ground. All skill levels welcome — come have fun!',
    sports: [{ name: 'Football', skill: 'Intermediate', emoji: '⚽' }],
    lookingFor: 'Pickup Games',
    likes: 31,
    comments: 17,
  },
  {
    id: '5',
    playerId: '6',
    playerName: 'Zara Siddiqui',
    initials: 'ZS',
    avatarColor: '#06b6d4',
    time: '1d ago',
    text: 'Looking for a badminton coach or mentor to help improve my smash technique. Intermediate to advanced level preferred.',
    sports: [{ name: 'Badminton', skill: 'Advanced', emoji: '🏸' }],
    lookingFor: 'Coach/Mentor',
    likes: 15,
    comments: 7,
  },
];

export const VENUES: Venue[] = [
  {
    id: '1',
    name: 'Model Town Sports Complex',
    rating: 4.5,
    address: 'Block L, Model Town, Lahore',
    sports: ['Football', 'Cricket', 'Tennis'],
    distance: '1.2 km',
    pricePerHour: 2500,
    imageColor: '#16a34a',
    offsetKm: { dx: 0.5, dy: 1.1 },
  },
  {
    id: '2',
    name: 'Gulberg Sports Arena',
    rating: 4.8,
    address: 'Main Boulevard, Gulberg III, Lahore',
    sports: ['Tennis', 'Badminton', 'Basketball'],
    distance: '2.8 km',
    pricePerHour: 3000,
    imageColor: '#3b82f6',
    offsetKm: { dx: -2.0, dy: 2.0 },
  },
  {
    id: '3',
    name: 'DHA Cricket Ground',
    rating: 4.2,
    address: 'Phase 5, DHA, Lahore',
    sports: ['Cricket', 'Football'],
    distance: '5.4 km',
    pricePerHour: 4000,
    imageColor: '#f59e0b',
    offsetKm: { dx: 4.0, dy: -3.6 },
  },
  {
    id: '4',
    name: 'Johar Town Basketball Court',
    rating: 4.0,
    address: 'Block E, Johar Town, Lahore',
    sports: ['Basketball', 'Badminton'],
    distance: '4.1 km',
    pricePerHour: 1800,
    imageColor: '#8b5cf6',
    offsetKm: { dx: -3.0, dy: -2.8 },
  },
  {
    id: '5',
    name: 'Wapda Town Football Ground',
    rating: 4.3,
    address: 'Main Boulevard, Wapda Town, Lahore',
    sports: ['Football', 'Cricket'],
    distance: '6.2 km',
    pricePerHour: 2000,
    imageColor: '#ef4444',
    offsetKm: { dx: -5.0, dy: -3.7 },
  },
  // ── GTA Toronto – real GPS coordinates ─────────────────────────────────
  {
    id: 't1',
    name: 'Scotiabank Arena',
    rating: 4.9,
    address: '40 Bay St, Toronto, ON',
    sports: ['Basketball', 'Hockey'],
    distance: '',
    pricePerHour: 85000,
    imageColor: '#1a1a2e',
    coord: { latitude: 43.6435, longitude: -79.3791 },
  },
  {
    id: 't2',
    name: 'Rogers Centre',
    rating: 4.7,
    address: '1 Blue Jays Way, Toronto, ON',
    sports: ['Baseball'],
    distance: '',
    pricePerHour: 60000,
    imageColor: '#003087',
    coord: { latitude: 43.6414, longitude: -79.3894 },
  },
  {
    id: 't3',
    name: 'BMO Field',
    rating: 4.6,
    address: '170 Princes Blvd, Toronto, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 45000,
    imageColor: '#e31837',
    coord: { latitude: 43.6335, longitude: -79.4179 },
  },
  {
    id: 't4',
    name: 'Sobeys Stadium',
    rating: 4.8,
    address: '1 Shoreham Dr, North York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 12000,
    imageColor: '#00843d',
    coord: { latitude: 43.7729, longitude: -79.4988 },
  },
  {
    id: 't5',
    name: 'Varsity Centre',
    rating: 4.3,
    address: '299 Bloor St W, Toronto, ON',
    sports: ['Football', 'Athletics'],
    distance: '',
    pricePerHour: 8000,
    imageColor: '#002a5c',
    coord: { latitude: 43.6664, longitude: -79.3993 },
  },
  {
    id: 't6',
    name: 'Lamport Stadium',
    rating: 4.1,
    address: '1155 King St W, Toronto, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 6500,
    imageColor: '#c8102e',
    coord: { latitude: 43.6412, longitude: -79.4278 },
  },
  {
    id: 't7',
    name: 'Toronto Cricket Club',
    rating: 4.4,
    address: '141 Wilson Ave, North York, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 9000,
    imageColor: '#006b3c',
    coord: { latitude: 43.7326, longitude: -79.4264 },
  },
  {
    id: 't8',
    name: 'Etobicoke Olympium',
    rating: 4.2,
    address: '590 Rathburn Rd W, Etobicoke, ON',
    sports: ['Basketball', 'Badminton'],
    distance: '',
    pricePerHour: 5500,
    imageColor: '#ff6b35',
    coord: { latitude: 43.6477, longitude: -79.5620 },
  },
  // ── Public Tennis Courts – Toronto GTA ─────────────────────────────────
  {
    id: 'tc1',
    name: 'High Park Tennis Courts',
    rating: 4.3,
    address: 'High Park Ave, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 1500,
    imageColor: '#16a34a',
    coord: { latitude: 43.6464, longitude: -79.4637 },
  },
  {
    id: 'tc2',
    name: 'Trinity Bellwoods Tennis Courts',
    rating: 4.2,
    address: 'Trinity Bellwoods Park, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 1200,
    imageColor: '#0284c7',
    coord: { latitude: 43.6454, longitude: -79.4218 },
  },
  {
    id: 'tc3',
    name: 'Ramsden Park Tennis Courts',
    rating: 4.1,
    address: 'Ramsden Park, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 1200,
    imageColor: '#7c3aed',
    coord: { latitude: 43.6754, longitude: -79.3907 },
  },
  {
    id: 'tc4',
    name: 'Christie Pits Tennis Courts',
    rating: 4.0,
    address: 'Christie Pits Park, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 1000,
    imageColor: '#b45309',
    coord: { latitude: 43.6632, longitude: -79.4197 },
  },
  {
    id: 'tc5',
    name: 'Sunnybrook Park Tennis Courts',
    rating: 4.4,
    address: 'Sunnybrook Park, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 1500,
    imageColor: '#0f766e',
    coord: { latitude: 43.7196, longitude: -79.3619 },
  },

  // ── Tennis – Additional Public Courts (Toronto) ─────────────────────────
  {
    id: 'gta_t01',
    name: 'Riverdale Park East Tennis',
    rating: 4.1,
    address: '550 Broadview Ave, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#16a34a',
    coord: { latitude: 43.6629, longitude: -79.3537 },
  },
  {
    id: 'gta_t02',
    name: 'Withrow Park Tennis Courts',
    rating: 4.0,
    address: 'Bain Ave & Logan Ave, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0284c7',
    coord: { latitude: 43.6724, longitude: -79.3565 },
  },
  {
    id: 'gta_t03',
    name: 'Dufferin Grove Tennis Courts',
    rating: 4.2,
    address: '875 Dufferin St, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#7c3aed',
    coord: { latitude: 43.6549, longitude: -79.4326 },
  },
  {
    id: 'gta_t04',
    name: 'Stanley Park Tennis Courts',
    rating: 3.9,
    address: '1055 King St W, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#b45309',
    coord: { latitude: 43.6406, longitude: -79.4160 },
  },
  {
    id: 'gta_t05',
    name: 'Eglinton Park Tennis Courts',
    rating: 4.1,
    address: '200 Eglinton Ave W, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0f766e',
    coord: { latitude: 43.6953, longitude: -79.4025 },
  },
  {
    id: 'gta_t06',
    name: 'East York Lawn Tennis Club',
    rating: 4.3,
    address: 'Cosburn Ave, East York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 2500,
    imageColor: '#16a34a',
    coord: { latitude: 43.6937, longitude: -79.3221 },
  },
  {
    id: 'gta_t07',
    name: 'Rennie Park Tennis Courts',
    rating: 3.8,
    address: 'Rennie Park, Etobicoke, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#dc2626',
    coord: { latitude: 43.7101, longitude: -79.5129 },
  },
  {
    id: 'gta_t08',
    name: 'Greenwood Park Tennis Courts',
    rating: 4.0,
    address: 'Greenwood Ave, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0284c7',
    coord: { latitude: 43.6700, longitude: -79.3295 },
  },
  {
    id: 'gta_t09',
    name: 'Dentonia Park Tennis Courts',
    rating: 4.0,
    address: '1967 Victoria Park Ave, Scarborough, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#7c3aed',
    coord: { latitude: 43.6934, longitude: -79.2977 },
  },
  {
    id: 'gta_t10',
    name: 'Wallace Emerson Tennis Courts',
    rating: 3.9,
    address: '1260 Dufferin St, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#b45309',
    coord: { latitude: 43.6622, longitude: -79.4356 },
  },

  // ── Tennis – Private Clubs (GTA) ────────────────────────────────────────
  {
    id: 'gta_t11',
    name: 'Toronto Lawn Tennis Club',
    rating: 4.8,
    address: '1 Devonshire Pl, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 8000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.6748, longitude: -79.3951 },
  },
  {
    id: 'gta_t12',
    name: 'York Tennis Club',
    rating: 4.6,
    address: '155 Renforth Dr, Etobicoke, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 7500,
    imageColor: '#9333ea',
    coord: { latitude: 43.6622, longitude: -79.5493 },
  },
  {
    id: 'gta_t13',
    name: 'Donalda Club',
    rating: 4.7,
    address: '12 Donalda Club Rd, North York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 12000,
    imageColor: '#15803d',
    coord: { latitude: 43.7555, longitude: -79.3320 },
  },
  {
    id: 'gta_t14',
    name: 'Lakeshore Lawn Tennis Club',
    rating: 4.5,
    address: 'Lakeshore Blvd W, Etobicoke, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 6500,
    imageColor: '#0369a1',
    coord: { latitude: 43.6191, longitude: -79.5109 },
  },
  {
    id: 'gta_t15',
    name: 'Humber Valley Tennis Club',
    rating: 4.4,
    address: 'Humber Valley Rd, Etobicoke, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 6000,
    imageColor: '#166534',
    coord: { latitude: 43.6670, longitude: -79.5286 },
  },
  {
    id: 'gta_t16',
    name: "Tam O'Shanter Tennis Club",
    rating: 4.2,
    address: '2481 Birchmount Rd, Scarborough, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5500,
    imageColor: '#c2410c',
    coord: { latitude: 43.7794, longitude: -79.2958 },
  },
  {
    id: 'gta_t17',
    name: 'Rosedale Tennis Club',
    rating: 4.5,
    address: 'Roxborough Dr, Toronto, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 9000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.6825, longitude: -79.3678 },
  },
  {
    id: 'gta_t18',
    name: 'North York Tennis Club',
    rating: 4.3,
    address: 'Sheppard Ave, North York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5000,
    imageColor: '#0284c7',
    coord: { latitude: 43.7510, longitude: -79.4380 },
  },

  // ── Tennis – Mississauga ─────────────────────────────────────────────────
  {
    id: 'gta_t19',
    name: 'Clarkson Lawn Tennis Club',
    rating: 4.4,
    address: '1444 Clarkson Rd N, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5500,
    imageColor: '#16a34a',
    coord: { latitude: 43.5079, longitude: -79.6279 },
  },
  {
    id: 'gta_t20',
    name: 'Port Credit Tennis Club',
    rating: 4.5,
    address: 'Port Credit, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 6000,
    imageColor: '#0284c7',
    coord: { latitude: 43.5511, longitude: -79.5814 },
  },
  {
    id: 'gta_t21',
    name: 'Streetsville Tennis Club',
    rating: 4.2,
    address: 'Streetsville, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#7c3aed',
    coord: { latitude: 43.5839, longitude: -79.7087 },
  },
  {
    id: 'gta_t22',
    name: 'Meadowvale Tennis Courts',
    rating: 4.0,
    address: 'Meadowvale, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#b45309',
    coord: { latitude: 43.5926, longitude: -79.7489 },
  },
  {
    id: 'gta_t23',
    name: 'Huron Park Recreation Tennis',
    rating: 3.9,
    address: 'Huron Park, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0f766e',
    coord: { latitude: 43.6046, longitude: -79.6900 },
  },
  {
    id: 'gta_t24',
    name: 'Erindale Park Tennis Courts',
    rating: 4.1,
    address: 'Erindale Park, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#16a34a',
    coord: { latitude: 43.5373, longitude: -79.6524 },
  },
  {
    id: 'gta_t25',
    name: 'Mississauga Valley Tennis Courts',
    rating: 4.0,
    address: 'Mississauga Valley Blvd, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0284c7',
    coord: { latitude: 43.5817, longitude: -79.6265 },
  },
  {
    id: 'gta_t26',
    name: 'Applewood Tennis Club',
    rating: 4.3,
    address: 'Applewood, Mississauga, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.5960, longitude: -79.5980 },
  },

  // ── Tennis – Brampton ────────────────────────────────────────────────────
  {
    id: 'gta_t27',
    name: 'Brampton Tennis Club',
    rating: 4.3,
    address: 'Brampton, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#dc2626',
    coord: { latitude: 43.6868, longitude: -79.7670 },
  },
  {
    id: 'gta_t28',
    name: 'Heart Lake Tennis Courts',
    rating: 4.0,
    address: 'Heart Lake Conservation Area, Brampton, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#16a34a',
    coord: { latitude: 43.7326, longitude: -79.8001 },
  },
  {
    id: 'gta_t29',
    name: "Professor's Lake Tennis Courts",
    rating: 3.9,
    address: "Professor's Lake, Brampton, ON",
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0284c7',
    coord: { latitude: 43.7168, longitude: -79.7583 },
  },

  // ── Tennis – Oakville ────────────────────────────────────────────────────
  {
    id: 'gta_t30',
    name: 'Oakville Lawn Tennis & Croquet Club',
    rating: 4.7,
    address: '109 Randall St, Oakville, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 8000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.4507, longitude: -79.6707 },
  },
  {
    id: 'gta_t31',
    name: 'Sixteen Mile Creek Tennis Club',
    rating: 4.3,
    address: 'Oakville, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5500,
    imageColor: '#9333ea',
    coord: { latitude: 43.5016, longitude: -79.6814 },
  },
  {
    id: 'gta_t32',
    name: 'Glen Abbey Community Tennis Courts',
    rating: 4.1,
    address: 'Glen Abbey, Oakville, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#15803d',
    coord: { latitude: 43.4540, longitude: -79.7380 },
  },
  {
    id: 'gta_t33',
    name: 'Bronte Tennis Club',
    rating: 4.2,
    address: 'Bronte, Oakville, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#0369a1',
    coord: { latitude: 43.4039, longitude: -79.7197 },
  },

  // ── Tennis – Burlington ──────────────────────────────────────────────────
  {
    id: 'gta_t34',
    name: 'Burlington Tennis Club',
    rating: 4.4,
    address: 'Burlington, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5000,
    imageColor: '#166534',
    coord: { latitude: 43.3460, longitude: -79.7971 },
  },
  {
    id: 'gta_t35',
    name: 'Roseland Tennis Club',
    rating: 4.5,
    address: 'Roseland, Burlington, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 6500,
    imageColor: '#c2410c',
    coord: { latitude: 43.3275, longitude: -79.7857 },
  },
  {
    id: 'gta_t36',
    name: 'Tansley Woods Tennis Courts',
    rating: 3.9,
    address: 'Tansley Woods, Burlington, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#7c3aed',
    coord: { latitude: 43.3682, longitude: -79.7547 },
  },

  // ── Tennis – Markham ─────────────────────────────────────────────────────
  {
    id: 'gta_t37',
    name: 'Markham Tennis Club',
    rating: 4.3,
    address: 'Markham, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#0284c7',
    coord: { latitude: 43.8763, longitude: -79.2617 },
  },
  {
    id: 'gta_t38',
    name: 'Unionville Club (Tennis)',
    rating: 4.6,
    address: 'Unionville, Markham, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 9000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.8584, longitude: -79.2983 },
  },
  {
    id: 'gta_t39',
    name: 'Milliken Park Tennis Courts',
    rating: 4.0,
    address: 'Milliken Park, Markham, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#16a34a',
    coord: { latitude: 43.8337, longitude: -79.2877 },
  },

  // ── Tennis – Richmond Hill ───────────────────────────────────────────────
  {
    id: 'gta_t40',
    name: 'Richmond Hill Racquet Club',
    rating: 4.5,
    address: 'Richmond Hill, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 7000,
    imageColor: '#9333ea',
    coord: { latitude: 43.8697, longitude: -79.4386 },
  },
  {
    id: 'gta_t41',
    name: 'Bayview Hill Tennis Club',
    rating: 4.4,
    address: 'Bayview Hill, Richmond Hill, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 6500,
    imageColor: '#6d28d9',
    coord: { latitude: 43.8776, longitude: -79.3836 },
  },

  // ── Tennis – Vaughan ─────────────────────────────────────────────────────
  {
    id: 'gta_t42',
    name: 'Woodbridge Tennis Club',
    rating: 4.3,
    address: 'Woodbridge, Vaughan, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 5500,
    imageColor: '#0f766e',
    coord: { latitude: 43.7900, longitude: -79.5832 },
  },
  {
    id: 'gta_t43',
    name: 'Maple Community Centre Tennis',
    rating: 4.0,
    address: 'Maple, Vaughan, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#16a34a',
    coord: { latitude: 43.8461, longitude: -79.5051 },
  },

  // ── Tennis – North York (additional) ─────────────────────────────────────
  {
    id: 'gta_t44',
    name: 'G. Ross Lord Park Tennis Courts',
    rating: 4.1,
    address: '4185 Bathurst St, North York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#0284c7',
    coord: { latitude: 43.7726, longitude: -79.4802 },
  },
  {
    id: 'gta_t45',
    name: 'Cloverdale Park Tennis Courts',
    rating: 4.0,
    address: 'Cloverdale Park, North York, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 0,
    imageColor: '#7c3aed',
    coord: { latitude: 43.7320, longitude: -79.3975 },
  },

  // ── Tennis – East GTA (Pickering, Ajax) ──────────────────────────────────
  {
    id: 'gta_t46',
    name: 'Ajax Tennis Club',
    rating: 4.2,
    address: 'Ajax, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#b45309',
    coord: { latitude: 43.8513, longitude: -79.0148 },
  },
  {
    id: 'gta_t47',
    name: 'Pickering Tennis Club',
    rating: 4.1,
    address: 'Pickering, ON',
    sports: ['Tennis'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#dc2626',
    coord: { latitude: 43.8365, longitude: -79.0874 },
  },

  // ── Football / Soccer (GTA) ──────────────────────────────────────────────
  {
    id: 'gta_s01',
    name: 'Centennial Park Stadium',
    rating: 4.4,
    address: 'Centennial Park, Etobicoke, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 6000,
    imageColor: '#16a34a',
    coord: { latitude: 43.6353, longitude: -79.5562 },
  },
  {
    id: 'gta_s02',
    name: 'Downsview Park Soccer Fields',
    rating: 4.2,
    address: '35 Carl Hall Rd, North York, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#0284c7',
    coord: { latitude: 43.7398, longitude: -79.4750 },
  },
  {
    id: 'gta_s03',
    name: 'Toronto Pan Am Sports Centre',
    rating: 4.6,
    address: '875 Morningside Ave, Scarborough, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 8000,
    imageColor: '#dc2626',
    coord: { latitude: 43.7839, longitude: -79.1862 },
  },
  {
    id: 'gta_s04',
    name: 'York Lions Stadium',
    rating: 4.3,
    address: '4700 Keele St, North York, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 7000,
    imageColor: '#dc2626',
    coord: { latitude: 43.7745, longitude: -79.5019 },
  },
  {
    id: 'gta_s05',
    name: 'Humber College Soccer Field',
    rating: 4.0,
    address: '205 Humber College Blvd, Etobicoke, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#f59e0b',
    coord: { latitude: 43.7274, longitude: -79.5987 },
  },
  {
    id: 'gta_s06',
    name: 'Earl Bales Park Soccer Fields',
    rating: 4.1,
    address: '4169 Bathurst St, North York, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 3000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.7497, longitude: -79.4388 },
  },
  {
    id: 'gta_s07',
    name: 'Chinguacousy Park Soccer Fields',
    rating: 4.3,
    address: '9050 Bramalea Rd, Brampton, ON',
    sports: ['Football'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#16a34a',
    coord: { latitude: 43.7462, longitude: -79.7637 },
  },

  // ── Cricket (GTA) ────────────────────────────────────────────────────────
  {
    id: 'gta_c01',
    name: 'Maple Cricket Club',
    rating: 4.5,
    address: 'Maple, Vaughan, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 5000,
    imageColor: '#f59e0b',
    coord: { latitude: 43.8541, longitude: -79.5006 },
  },
  {
    id: 'gta_c02',
    name: 'Scarborough Cricket Association',
    rating: 4.3,
    address: 'Scarborough, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#0284c7',
    coord: { latitude: 43.7643, longitude: -79.2467 },
  },
  {
    id: 'gta_c03',
    name: 'Centennial Park Cricket Ground',
    rating: 4.4,
    address: 'Centennial Park, Etobicoke, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 4500,
    imageColor: '#16a34a',
    coord: { latitude: 43.6406, longitude: -79.5571 },
  },
  {
    id: 'gta_c04',
    name: 'Humber Cricket Club',
    rating: 4.2,
    address: 'Humber Valley, Etobicoke, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#dc2626',
    coord: { latitude: 43.7217, longitude: -79.5890 },
  },
  {
    id: 'gta_c05',
    name: 'Erin Mills Cricket Ground',
    rating: 4.1,
    address: 'Erin Mills, Mississauga, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#7c3aed',
    coord: { latitude: 43.5437, longitude: -79.7288 },
  },
  {
    id: 'gta_c06',
    name: 'Malton Cricket Club',
    rating: 4.0,
    address: 'Malton, Mississauga, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 3000,
    imageColor: '#b45309',
    coord: { latitude: 43.7186, longitude: -79.6565 },
  },
  {
    id: 'gta_c07',
    name: 'Brampton Cricket Club',
    rating: 4.2,
    address: 'Brampton, ON',
    sports: ['Cricket'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#0f766e',
    coord: { latitude: 43.6832, longitude: -79.7585 },
  },

  // ── Basketball (GTA) ─────────────────────────────────────────────────────
  {
    id: 'gta_b01',
    name: 'Mattamy Athletic Centre',
    rating: 4.6,
    address: '50 Carlton St, Toronto, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 15000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.6594, longitude: -79.3798 },
  },
  {
    id: 'gta_b02',
    name: 'Goldring Centre (U of T)',
    rating: 4.5,
    address: '100 Devonshire Pl, Toronto, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 8000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.6619, longitude: -79.3949 },
  },
  {
    id: 'gta_b03',
    name: 'Esther Shiner Stadium',
    rating: 4.3,
    address: '4101 Bathurst St, North York, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 6000,
    imageColor: '#dc2626',
    coord: { latitude: 43.7625, longitude: -79.4250 },
  },
  {
    id: 'gta_b04',
    name: 'Albert Campbell Court',
    rating: 4.1,
    address: 'Scarborough Civic Centre, Scarborough, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#ea580c',
    coord: { latitude: 43.7649, longitude: -79.2643 },
  },
  {
    id: 'gta_b05',
    name: 'CAA Centre (Brampton)',
    rating: 4.4,
    address: '7575 Kennedy Rd S, Brampton, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 20000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.5890, longitude: -79.6474 },
  },
  {
    id: 'gta_b06',
    name: 'George Bell Arena',
    rating: 4.0,
    address: '150 Jefferson Ave, Toronto, ON',
    sports: ['Basketball'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#0284c7',
    coord: { latitude: 43.6422, longitude: -79.4696 },
  },

  // ── Badminton (GTA) ──────────────────────────────────────────────────────
  {
    id: 'gta_bd01',
    name: 'Toronto Badminton Club',
    rating: 4.4,
    address: 'Toronto, ON',
    sports: ['Badminton'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#8b5cf6',
    coord: { latitude: 43.7106, longitude: -79.3972 },
  },
  {
    id: 'gta_bd02',
    name: 'Scarborough Badminton Club',
    rating: 4.2,
    address: 'Scarborough, ON',
    sports: ['Badminton'],
    distance: '',
    pricePerHour: 3000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.7526, longitude: -79.2584 },
  },
  {
    id: 'gta_bd03',
    name: 'Markham Badminton Centre',
    rating: 4.5,
    address: 'Markham, ON',
    sports: ['Badminton'],
    distance: '',
    pricePerHour: 4000,
    imageColor: '#6d28d9',
    coord: { latitude: 43.8725, longitude: -79.2656 },
  },
  {
    id: 'gta_bd04',
    name: 'Richmond Hill Badminton Club',
    rating: 4.3,
    address: 'Richmond Hill, ON',
    sports: ['Badminton'],
    distance: '',
    pricePerHour: 3500,
    imageColor: '#5b21b6',
    coord: { latitude: 43.8828, longitude: -79.4365 },
  },
  {
    id: 'gta_bd05',
    name: 'Mississauga Badminton Club',
    rating: 4.1,
    address: 'Mississauga, ON',
    sports: ['Badminton'],
    distance: '',
    pricePerHour: 3000,
    imageColor: '#7c3aed',
    coord: { latitude: 43.5895, longitude: -79.6430 },
  },

  // ── Baseball (GTA) ───────────────────────────────────────────────────────
  {
    id: 'gta_bb01',
    name: 'Christie Pits Baseball Diamond',
    rating: 4.1,
    address: 'Christie Pits Park, Toronto, ON',
    sports: ['Baseball'],
    distance: '',
    pricePerHour: 1500,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.6620, longitude: -79.4197 },
  },
  {
    id: 'gta_bb02',
    name: 'Centennial Park Baseball Complex',
    rating: 4.0,
    address: 'Centennial Park, Etobicoke, ON',
    sports: ['Baseball'],
    distance: '',
    pricePerHour: 1500,
    imageColor: '#0369a1',
    coord: { latitude: 43.6370, longitude: -79.5550 },
  },
  {
    id: 'gta_bb03',
    name: 'Scarborough Baseball Complex',
    rating: 4.2,
    address: 'Scarborough, ON',
    sports: ['Baseball'],
    distance: '',
    pricePerHour: 2000,
    imageColor: '#1e40af',
    coord: { latitude: 43.7543, longitude: -79.2380 },
  },
  {
    id: 'gta_bb04',
    name: 'Etobicoke Baseball Complex',
    rating: 4.0,
    address: 'Etobicoke, ON',
    sports: ['Baseball'],
    distance: '',
    pricePerHour: 2000,
    imageColor: '#1d4ed8',
    coord: { latitude: 43.6410, longitude: -79.5490 },
  },
];

export const TOURNAMENTS: Tournament[] = [
  {
    id: '1',
    name: 'Lahore Premier Football League',
    type: 'league',
    sport: 'Football',
    sportEmoji: '⚽',
    date: 'Jun 15, 2025',
    location: 'Model Town Sports Complex',
    participants: 18,
    maxParticipants: 24,
    entryFee: 5000,
    prizePool: 150000,
  },
  {
    id: '2',
    name: 'Ramadan Cricket Cup',
    type: 'tournament',
    sport: 'Cricket',
    sportEmoji: '🏏',
    date: 'Jun 22, 2025',
    location: 'DHA Cricket Ground',
    participants: 10,
    maxParticipants: 16,
    entryFee: 3000,
    prizePool: 80000,
  },
  {
    id: '3',
    name: 'Tennis Doubles Showdown',
    type: 'tournament',
    sport: 'Tennis',
    sportEmoji: '🎾',
    date: 'Jul 5, 2025',
    location: 'Gulberg Sports Arena',
    participants: 6,
    maxParticipants: 16,
    entryFee: 2000,
    prizePool: 40000,
  },
  {
    id: '4',
    name: 'Sunday Pickup Football',
    type: 'match',
    sport: 'Football',
    sportEmoji: '⚽',
    date: 'May 25, 2025',
    location: 'Wapda Town Ground',
    participants: 14,
    maxParticipants: 22,
    entryFee: 500,
    prizePool: 0,
  },
];

export const BOOKINGS: Booking[] = [
  {
    id: '1',
    venueName: 'Model Town Sports Complex',
    sport: 'Football',
    sportEmoji: '⚽',
    date: 'Sat, May 24',
    time: '5:00 PM – 6:00 PM',
    price: 2500,
    status: 'Confirmed',
  },
  {
    id: '2',
    venueName: 'Gulberg Sports Arena',
    sport: 'Tennis',
    sportEmoji: '🎾',
    date: 'Sun, May 25',
    time: '7:00 AM – 8:00 AM',
    price: 3000,
    status: 'Confirmed',
  },
];

export const MY_MATCHES: MatchItem[] = [
  {
    id: '1',
    sport: 'Football',
    sportEmoji: '⚽',
    title: 'Model Town vs Gulberg FC',
    players: '11 vs 11',
    date: 'Sat, May 24 at 5 PM',
    location: 'Model Town Sports Complex',
  },
  {
    id: '2',
    sport: 'Cricket',
    sportEmoji: '🏏',
    title: 'Ramadan Cricket Cup – Round 2',
    players: '11 per side',
    date: 'Sun, May 25 at 3 PM',
    location: 'DHA Cricket Ground',
  },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    playerId: '2',
    playerName: 'Sara Ahmed',
    initials: 'SA',
    avatarColor: '#8b5cf6',
    gender: 'female',
    lastMessage: 'Sure! See you at the court on Saturday 👍',
    timestamp: '2h ago',
    unread: true,
  },
  {
    id: '2',
    playerId: '3',
    playerName: 'Bilal Khan',
    initials: 'BK',
    avatarColor: '#f59e0b',
    gender: 'male',
    lastMessage: 'Can you join our cricket team?',
    timestamp: '5h ago',
    unread: true,
  },
  {
    id: '3',
    playerId: '5',
    playerName: 'Usman Tariq',
    initials: 'UT',
    avatarColor: '#3b82f6',
    gender: 'male',
    lastMessage: 'Great game yesterday!',
    timestamp: '1d ago',
    unread: false,
  },
  {
    id: '4',
    playerId: '6',
    playerName: 'Zara Siddiqui',
    initials: 'ZS',
    avatarColor: '#06b6d4',
    gender: 'female',
    lastMessage: 'Looking forward to the match!',
    timestamp: '2d ago',
    unread: false,
  },
];

export const CHAT_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: '1', conversationId: '1', text: 'Hey Sara! Want to play doubles tennis this weekend?', sent: true, time: '10:00 AM' },
    { id: '2', conversationId: '1', text: 'Hi! That sounds great, which venue?', sent: false, time: '10:02 AM' },
    { id: '3', conversationId: '1', text: 'Gulberg Sports Arena? Saturday 4 PM?', sent: true, time: '10:05 AM' },
    { id: '4', conversationId: '1', text: 'Sure! See you at the court on Saturday 👍', sent: false, time: '10:07 AM' },
  ],
  '2': [
    { id: '1', conversationId: '2', text: 'Hey Bilal, saw your post about the cricket team', sent: true, time: '9:00 AM' },
    { id: '2', conversationId: '2', text: 'Yes! We need a good batsman. What is your skill level?', sent: false, time: '9:05 AM' },
    { id: '3', conversationId: '2', text: 'Advanced. I play for my club regularly.', sent: true, time: '9:08 AM' },
    { id: '4', conversationId: '2', text: 'Can you join our cricket team?', sent: false, time: '9:10 AM' },
  ],
  '3': [
    { id: '1', conversationId: '3', text: 'That was an amazing match!', sent: false, time: 'Yesterday' },
    { id: '2', conversationId: '3', text: 'Thanks man, you played really well too', sent: true, time: 'Yesterday' },
    { id: '3', conversationId: '3', text: 'Great game yesterday!', sent: false, time: 'Yesterday' },
  ],
  '4': [
    { id: '1', conversationId: '4', text: 'Are you coming to the badminton tournament?', sent: true, time: '2d ago' },
    { id: '2', conversationId: '4', text: 'Yes! Already registered. Looking forward to the match!', sent: false, time: '2d ago' },
  ],
};

import { offsetCoord, distanceKm } from '../utils/geo';
import type { Coord } from '../utils/geo';

export function getVenueCoord(base: Coord | null, venue: Venue): Coord | null {
  if (venue.coord) return venue.coord;
  if (!base || !venue.offsetKm) return null;
  return offsetCoord(base, venue.offsetKm.dx, venue.offsetKm.dy);
}

export function getPlayerCoord(base: Coord, player: Player) {
  return offsetCoord(base, player.offsetKm.dx, player.offsetKm.dy);
}

export function venueDistanceKm(base: Coord, venue: Venue): number {
  if (venue.coord) return distanceKm(base, venue.coord);
  if (!venue.offsetKm) return Infinity;
  return distanceKm(base, offsetCoord(base, venue.offsetKm.dx, venue.offsetKm.dy));
}

export function playerDistanceKm(base: Coord, player: Player) {
  return distanceKm(base, getPlayerCoord(base, player));
}
