-- LUMIÈRE Supabase schema
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- Users (extends Supabase auth.users; one row per LUMIÈRE username)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  telegram_id TEXT UNIQUE,
  market_iq INTEGER NOT NULL DEFAULT 0,
  total_codes INTEGER NOT NULL DEFAULT 0,
  winning_codes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lumiere_users ADD CONSTRAINT lumiere_users_username_format
  CHECK (username ~ '^[A-Za-z0-9_]{3,20}$');

-- ---------------------------------------------------------------------------
-- Betting codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES lumiere_users(id),
  creator_username TEXT NOT NULL,
  platform TEXT NOT NULL,            -- 'sportybet' | 'bet9ja' | '1xbet' | '247bet' | 'other'
  platform_code TEXT,                -- the actual SportyBet/bet9ja/etc booking code
  lumiere_code TEXT UNIQUE NOT NULL, -- LM-{username}-{timestamp}
  selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_edge DECIMAL(6,4),         -- average edge across selections
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'won' | 'lost' | 'partial'
  share_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Individual selections within a code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES lumiere_codes(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  selection_type TEXT NOT NULL,      -- 'home_win' | 'away_win' | 'draw' | 'over_2.5' | 'under_2.5' | 'btts_yes' | 'btts_no'
  platform_odds DECIMAL(8,4) NOT NULL,
  txline_prob DECIMAL(5,4) NOT NULL,
  platform_prob DECIMAL(5,4) NOT NULL,
  edge DECIMAL(6,4) NOT NULL,
  from_shock BOOLEAN NOT NULL DEFAULT FALSE,
  shock_id UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'won' | 'lost' | 'void'
  match_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Odds shocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_shocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  affected_team TEXT NOT NULL,       -- 'home' | 'away'
  direction TEXT NOT NULL,           -- 'up' | 'down'
  delta DECIMAL(5,4) NOT NULL,
  window_seconds INTEGER NOT NULL,
  pre_prob DECIMAL(5,4) NOT NULL,
  post_prob DECIMAL(5,4) NOT NULL,
  trigger_event TEXT,
  trigger_minute INTEGER,
  explanation TEXT,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Match cache for the replay engine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_match_cache (
  match_id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  odds_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  shock_count INTEGER NOT NULL DEFAULT 0,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Telegram groups configured to receive big-shock broadcasts, per match
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_telegram_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, chat_id)
);

-- ---------------------------------------------------------------------------
-- Leaderboard view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW lumiere_leaderboard AS
SELECT
  username,
  market_iq,
  total_codes,
  winning_codes,
  ROUND(winning_codes::numeric / NULLIF(total_codes, 0) * 100, 1) AS win_rate
FROM lumiere_users
ORDER BY market_iq DESC
LIMIT 100;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_codes_creator ON lumiere_codes(creator_id);
CREATE INDEX IF NOT EXISTS idx_codes_status ON lumiere_codes(status);
CREATE INDEX IF NOT EXISTS idx_codes_lumiere_code ON lumiere_codes(lumiere_code);
CREATE INDEX IF NOT EXISTS idx_selections_code ON lumiere_selections(code_id);
CREATE INDEX IF NOT EXISTS idx_selections_match ON lumiere_selections(match_id);
CREATE INDEX IF NOT EXISTS idx_shocks_match ON lumiere_shocks(match_id);
CREATE INDEX IF NOT EXISTS idx_shocks_fired ON lumiere_shocks(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_groups_match ON lumiere_telegram_groups(match_id);

-- ---------------------------------------------------------------------------
-- Market IQ: atomic increment, called from the server (service role) after
-- a code resolves. Avoids a read-then-write race between concurrent settlements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_market_iq(p_user_id UUID, p_delta INTEGER)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE lumiere_users
  SET market_iq = market_iq + p_delta
  WHERE id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE lumiere_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_shocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_match_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_telegram_groups ENABLE ROW LEVEL SECURITY;

-- lumiere_users: readable by all, writable by self only
DROP POLICY IF EXISTS lumiere_users_select_all ON lumiere_users;
CREATE POLICY lumiere_users_select_all ON lumiere_users FOR SELECT USING (true);

DROP POLICY IF EXISTS lumiere_users_insert_self ON lumiere_users;
CREATE POLICY lumiere_users_insert_self ON lumiere_users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS lumiere_users_update_self ON lumiere_users;
CREATE POLICY lumiere_users_update_self ON lumiere_users FOR UPDATE USING (auth.uid() = id);

-- lumiere_codes: readable by all, writable by creator only
DROP POLICY IF EXISTS lumiere_codes_select_all ON lumiere_codes;
CREATE POLICY lumiere_codes_select_all ON lumiere_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS lumiere_codes_insert_creator ON lumiere_codes;
CREATE POLICY lumiere_codes_insert_creator ON lumiere_codes FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS lumiere_codes_update_creator ON lumiere_codes;
CREATE POLICY lumiere_codes_update_creator ON lumiere_codes FOR UPDATE USING (auth.uid() = creator_id);

-- lumiere_selections: readable by all, writable by the parent code's creator only
DROP POLICY IF EXISTS lumiere_selections_select_all ON lumiere_selections;
CREATE POLICY lumiere_selections_select_all ON lumiere_selections FOR SELECT USING (true);

DROP POLICY IF EXISTS lumiere_selections_insert_creator ON lumiere_selections;
CREATE POLICY lumiere_selections_insert_creator ON lumiere_selections FOR INSERT WITH CHECK (
  code_id IN (SELECT id FROM lumiere_codes WHERE creator_id = auth.uid())
);

DROP POLICY IF EXISTS lumiere_selections_update_creator ON lumiere_selections;
CREATE POLICY lumiere_selections_update_creator ON lumiere_selections FOR UPDATE USING (
  code_id IN (SELECT id FROM lumiere_codes WHERE creator_id = auth.uid())
);

-- lumiere_shocks / lumiere_match_cache: public read, server-only write
-- (no INSERT/UPDATE policy for anon or authenticated — only the service-role
-- key, which bypasses RLS entirely, writes these tables).
DROP POLICY IF EXISTS lumiere_shocks_select_all ON lumiere_shocks;
CREATE POLICY lumiere_shocks_select_all ON lumiere_shocks FOR SELECT USING (true);

DROP POLICY IF EXISTS lumiere_match_cache_select_all ON lumiere_match_cache;
CREATE POLICY lumiere_match_cache_select_all ON lumiere_match_cache FOR SELECT USING (true);

-- lumiere_telegram_groups: server-only in both directions (read via service
-- role from getConfiguredGroups(); no public policy needed).
