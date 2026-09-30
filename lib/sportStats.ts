// Per-sport stat fields — used by the Record Stats form (Profile) and the Statistics screen
export const SPORT_STAT_FIELDS: Record<string, { key: string; label: string; numeric: boolean }[]> = {
  Football: [
    { key: 'goals',        label: 'Goals',        numeric: true  },
    { key: 'assists',      label: 'Assists',       numeric: true  },
    { key: 'clean_sheets', label: 'Clean Sheets',  numeric: true  },
    { key: 'yellow_cards', label: 'Yellow Cards',  numeric: true  },
    { key: 'red_cards',    label: 'Red Cards',     numeric: true  },
  ],
  Cricket: [
    { key: 'runs',         label: 'Total Runs',    numeric: true  },
    { key: 'wickets',      label: 'Wickets',       numeric: true  },
    { key: 'batting_avg',  label: 'Batting Avg',   numeric: false },
    { key: 'bowling_avg',  label: 'Bowling Avg',   numeric: false },
    { key: 'centuries',    label: 'Centuries',     numeric: true  },
    { key: 'fifties',      label: 'Fifties',       numeric: true  },
  ],
  Tennis: [
    { key: 'aces',            label: 'Aces',           numeric: true  },
    { key: 'double_faults',   label: 'Double Faults',  numeric: true  },
    { key: 'sets_won',        label: 'Sets Won',        numeric: true  },
    { key: 'games_won',       label: 'Games Won',       numeric: true  },
    { key: 'first_serve_pct', label: 'First Serve %',   numeric: false },
  ],
  Basketball: [
    { key: 'points',         label: 'Points',      numeric: true },
    { key: 'rebounds',       label: 'Rebounds',    numeric: true },
    { key: 'assists',        label: 'Assists',      numeric: true },
    { key: 'blocks',         label: 'Blocks',       numeric: true },
    { key: 'steals',         label: 'Steals',       numeric: true },
    { key: 'three_pointers', label: '3-Pointers',   numeric: true },
  ],
  Badminton: [
    { key: 'sets_won',      label: 'Sets Won',       numeric: true },
    { key: 'points_scored', label: 'Points Scored',  numeric: true },
    { key: 'smashes',       label: 'Smashes',        numeric: true },
    { key: 'drop_shots',    label: 'Drop Shots',     numeric: true },
  ],
  Baseball: [
    { key: 'home_runs',    label: 'Home Runs',    numeric: true  },
    { key: 'hits',         label: 'Hits',          numeric: true  },
    { key: 'rbis',         label: 'RBIs',          numeric: true  },
    { key: 'batting_avg',  label: 'Batting Avg',   numeric: false },
    { key: 'stolen_bases', label: 'Stolen Bases',  numeric: true  },
  ],
  Hockey: [
    { key: 'goals',           label: 'Goals',           numeric: true },
    { key: 'assists',         label: 'Assists',          numeric: true },
    { key: 'saves',           label: 'Saves',            numeric: true },
    { key: 'penalty_minutes', label: 'Penalty Minutes',  numeric: true },
  ],
};
