export interface SportFormat {
  label: string;
  format: string;
  maxPlayers: number;
}

export const SPORT_FORMATS: Record<string, SportFormat[]> = {
  Football: [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '6v6', format: '6v6', maxPlayers: 12 },
    { label: '7v7', format: '7v7', maxPlayers: 14 },
    { label: '8v8', format: '8v8', maxPlayers: 16 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ],
  Cricket: [
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '6v6', format: '6v6', maxPlayers: 12 },
    { label: '8v8', format: '8v8', maxPlayers: 16 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ],
  Tennis: [
    { label: 'Singles (1v1)', format: 'Singles', maxPlayers: 2 },
    { label: 'Doubles (2v2)', format: 'Doubles', maxPlayers: 4 },
  ],
  Basketball: [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '4v4', format: '4v4', maxPlayers: 8 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
  ],
  Badminton: [
    { label: 'Singles (1v1)', format: 'Singles', maxPlayers: 2 },
    { label: 'Doubles (2v2)', format: 'Doubles', maxPlayers: 4 },
  ],
  Baseball: [
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '7v7', format: '7v7', maxPlayers: 14 },
    { label: '9v9', format: '9v9', maxPlayers: 18 },
  ],
};

// Maximum players allowed for venue bookings (not match formats)
export const BOOKING_MAX_PLAYERS: Record<string, number> = {
  Football: 22,
  Cricket: 22,
  Tennis: 4,
  Basketball: 10,
  Badminton: 4,
  Baseball: 18,
};

export function getFormatsForSport(sport: string): SportFormat[] {
  return SPORT_FORMATS[sport] ?? [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ];
}

export function getBookingMaxPlayers(sport: string): number {
  return BOOKING_MAX_PLAYERS[sport] ?? 22;
}
