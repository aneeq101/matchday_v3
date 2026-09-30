import { supabase } from './supabase';
import { fetchPlayerStats, type PlayerStat } from './profile';
import { fetchMyMatches, fetchJoinedMatches, fetchMyTournamentCount } from './matches';
import { fetchMyTeams } from './teams';
import { fetchFollowCounts } from './follows';

export interface ActivitySummary {
  bookings: number;
  hoursBooked: number;
  matchesOrganized: number;
  matchesJoined: number;
  tournaments: number;
  teams: number;
  followers: number;
  following: number;
}

export interface StatisticsData {
  sports: PlayerStat[];
  activity: ActivitySummary;
}

/** Everything the Statistics screen needs, loaded in parallel. */
export async function fetchStatistics(userId: string): Promise<StatisticsData> {
  const [sports, bookingsRes, organized, joined, tournaments, teams, follows] = await Promise.all([
    fetchPlayerStats(userId),
    supabase.from('bookings').select('duration_hours, status').eq('user_id', userId),
    fetchMyMatches(userId),
    fetchJoinedMatches(userId),
    fetchMyTournamentCount(userId),
    fetchMyTeams(userId),
    fetchFollowCounts(userId),
  ]);

  const activeBookings = ((bookingsRes.data ?? []) as { duration_hours: number | null; status: string | null }[])
    .filter((b) => b.status !== 'cancelled');

  return {
    sports,
    activity: {
      bookings: activeBookings.length,
      hoursBooked: activeBookings.reduce((sum, b) => sum + (b.duration_hours ?? 1), 0),
      matchesOrganized: organized.length,
      matchesJoined: joined.length,
      tournaments,
      teams: teams.length,
      followers: follows.followers,
      following: follows.following,
    },
  };
}
