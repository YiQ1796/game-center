CREATE TABLE historical_scores (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  lines INTEGER NOT NULL,
  played_at TEXT NOT NULL,
  replay_hash TEXT NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE INDEX highest_scores ON historical_scores (score DESC, lines DESC, played_at ASC);
