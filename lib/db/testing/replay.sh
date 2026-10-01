#!/usr/bin/env bash
# Replays every migration in lib/db (in the order they were applied to the
# live Supabase project) into a throwaway PostGIS container, so new SQL can be
# tested before it is run in Supabase.
#
#   bash lib/db/testing/replay.sh            # start container + replay everything
#   bash lib/db/testing/replay.sh my.sql     # ...then also apply my.sql
#   docker exec -it mdtest psql -U postgres  # poke around afterwards
#   docker rm -f mdtest                      # clean up
#
# Act as a signed-in user inside psql with:
#   set role authenticated; set request.jwt.claim.sub = '<user uuid>';
set -euo pipefail
cd "$(dirname "$0")/../../.."

NAME=mdtest
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pw postgis/postgis:15-3.4 >/dev/null

# The image restarts Postgres once during init — wait for the second "ready"
for _ in $(seq 1 60); do
  [ "$(docker logs "$NAME" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ] && break
  sleep 2
done

run() {  # pg_net is a Supabase extension; the stubs provide net.http_post instead
  sed 's/^CREATE EXTENSION IF NOT EXISTS pg_net.*$//I' "$1" \
    | docker exec -i "$NAME" psql -U postgres -q 2>&1 | grep -E 'ERROR' | sed "s|^|  $1: |" || true
}

docker exec -i "$NAME" psql -U postgres -q < lib/db/testing/supabase_stubs.sql >/dev/null 2>&1

ORDER=(
  supabase/schema.sql
  lib/db/migration.sql
  lib/db/patch_conv_rls.sql
  lib/db/patch_conv_functions.sql
  lib/db/patch_dedup_conversations.sql
  lib/db/patch_triggers_and_inbox.sql   # one harmless "cannot change return type" error on replay
  lib/db/patch_comments_media_sports_stats.sql
  lib/db/patch_player_stats.sql
  lib/db/patch_all_users_stats.sql
  lib/db/patch_profile_sports_rls.sql
  lib/db/patch_remove_dummy_stats.sql
  lib/db/patch_media_columns.sql
  lib/db/patch_matches.sql
  lib/db/patch_bookings.sql
  lib/db/patch_match_joining.sql
  lib/db/patch_creator_autojoin.sql
  lib/db/patch_earn_events.sql
  lib/db/patch_social.sql
  lib/db/patch_venues.sql
  lib/db/patch_earn_capacity.sql
  lib/db/patch_earn_tournaments_gta.sql
  lib/db/patch_phase4_complete.sql
  lib/db/patch_brackets_challenges.sql
  lib/db/patch_event_rules.sql
  lib/db/patch_ratings.sql
  lib/db/patch_team_sizes_event_alerts.sql
  lib/db/patch_challenge_popup.sql
  lib/db/patch_rating_requests.sql
)
for f in "${ORDER[@]}" "$@"; do run "$f"; done
echo "Replayed ${#ORDER[@]} migrations$([ $# -gt 0 ] && echo " + $*") into container '$NAME'."
