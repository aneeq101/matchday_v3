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
}

declare const BookMap: React.ComponentType<BookMapProps>;
export default BookMap;
