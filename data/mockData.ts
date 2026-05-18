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
  coordinates: { latitude: number; longitude: number };
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
    coordinates: { latitude: 31.4834, longitude: 74.3293 },
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
    coordinates: { latitude: 31.5176, longitude: 74.3339 },
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
    coordinates: { latitude: 31.4697, longitude: 74.4077 },
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
    coordinates: { latitude: 31.4702, longitude: 74.2823 },
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
    coordinates: { latitude: 31.4469, longitude: 74.2741 },
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
