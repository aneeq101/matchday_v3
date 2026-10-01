import React from 'react';
import type { Venue } from '../data/mockData';
import type { Coord } from '../utils/geo';

interface BookMapProps {
  location: Coord | null;
  venues: Venue[];
  radius: number;
  onBookVenue: (venue: Venue) => void;
  onSwitchToList: () => void;
  onRadiusChange?: (km: number) => void;
  /** Button text on a tapped venue (default "Book" / "Book Now") */
  actionLabel?: string;
  /** Phone only: false = a tap calls onBookVenue straight away (the caller shows its own card) */
  showPreview?: boolean;
}

declare const BookMap: React.ComponentType<BookMapProps>;
export default BookMap;
