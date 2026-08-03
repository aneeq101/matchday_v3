import { supabase } from './supabase';
import { VENUES, type Venue } from '../data/mockData';

function dbToVenue(row: Record<string, unknown>): Venue {
  const latitude = row.latitude as number | null;
  const longitude = row.longitude as number | null;
  const coord: Venue['coord'] =
    latitude != null && longitude != null ? { latitude, longitude } : undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    rating: Number(row.rating),
    address: row.address as string,
    sports: (row.sports as string[]) ?? [],
    distance: '',
    pricePerHour: Number(row.price_per_hour),
    imageColor: row.image_color as string,
    coord,
    source: (row.source as Venue['source']) ?? 'mock',
  };
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from('venues').select('*');
  if (error || !data?.length) return VENUES;
  return data.map(dbToVenue);
}
