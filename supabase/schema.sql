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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lumiere_users_username_format'
  ) THEN
    ALTER TABLE lumiere_users ADD CONSTRAINT lumiere_users_username_format
      CHECK (username ~ '^[A-Za-z0-9_]{3,20}$');
  END IF;
END
$$;

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
  edge_verified BOOLEAN NOT NULL DEFAULT FALSE,
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
  fingerprint TEXT UNIQUE,
  telegram_broadcasted_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'replay')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing projects receive new columns without having to recreate tables.
ALTER TABLE lumiere_selections ADD COLUMN IF NOT EXISTS edge_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lumiere_shocks ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE lumiere_shocks ADD COLUMN IF NOT EXISTS telegram_broadcasted_at TIMESTAMPTZ;
ALTER TABLE lumiere_shocks ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lumiere_shocks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live';
DO $$ BEGIN
  ALTER TABLE lumiere_shocks
    ADD CONSTRAINT lumiere_shocks_source_check CHECK (source IN ('live', 'replay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shocks_fingerprint ON lumiere_shocks(fingerprint) WHERE fingerprint IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Follow/Fade: one market call per authenticated user and odds shock.
-- The resolver compares a future TxLINE 1X2 update with the stored shock.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lumiere_market_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES lumiere_users(id) ON DELETE CASCADE,
  shock_id UUID NOT NULL REFERENCES lumiere_shocks(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('follow', 'fade')),
  affected_team TEXT NOT NULL CHECK (affected_team IN ('home', 'away')),
  pre_prob DECIMAL(6,5) NOT NULL,
  post_prob DECIMAL(6,5) NOT NULL,
  target_event_at TIMESTAMPTZ NOT NULL,
  resolved_prob DECIMAL(6,5),
  retention DECIMAL(9,5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push')),
  iq_delta INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (user_id, shock_id)
);

-- Immutable audit trail. A unique source key makes IQ scoring idempotent even
-- when multiple stream relays observe the same TxLINE update.
CREATE TABLE IF NOT EXISTS lumiere_iq_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES lumiere_users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_type, source_id)
);

-- Click attribution exists even before affiliate programmes are activated.
CREATE TABLE IF NOT EXISTS lumiere_affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID REFERENCES lumiere_codes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES lumiere_users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  destination_host TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS lumiere_telegram_code_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES lumiere_codes(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_status TEXT,
  UNIQUE (code_id, chat_id)
);

-- ---------------------------------------------------------------------------
-- Leaderboard view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW lumiere_leaderboard AS
SELECT
  u.username,
  u.market_iq,
  u.total_codes,
  u.winning_codes,
  ROUND(u.winning_codes::numeric / NULLIF(u.total_codes, 0) * 100, 1) AS win_rate,
  COUNT(c.id) AS market_calls,
  COUNT(c.id) FILTER (WHERE c.status = 'won') AS correct_calls,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.status = 'won')::numeric /
    NULLIF(COUNT(c.id) FILTER (WHERE c.status IN ('won', 'lost')), 0) * 100,
    1
  ) AS call_accuracy
FROM lumiere_users u
LEFT JOIN lumiere_market_calls c ON c.user_id = u.id AND c.verified = TRUE
GROUP BY u.id, u.username, u.market_iq, u.total_codes, u.winning_codes
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
CREATE INDEX IF NOT EXISTS idx_telegram_code_watches_code ON lumiere_telegram_code_watches(code_id);
CREATE INDEX IF NOT EXISTS idx_market_calls_pending ON lumiere_market_calls(match_id, target_event_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_market_calls_user ON lumiere_market_calls(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iq_events_user ON lumiere_iq_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_platform ON lumiere_affiliate_clicks(platform, created_at DESC);

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

CREATE OR REPLACE FUNCTION apply_market_iq_event(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_id TEXT,
  p_delta INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO lumiere_iq_events(user_id, source_type, source_id, delta, metadata)
  VALUES (p_user_id, p_source_type, p_source_id, p_delta, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE lumiere_users SET market_iq = market_iq + p_delta WHERE id = p_user_id;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION increment_code_metric(p_lumiere_code TEXT, p_metric TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_metric = 'view' THEN
    UPDATE lumiere_codes SET view_count = view_count + 1 WHERE lumiere_code = p_lumiere_code;
  ELSIF p_metric = 'share' THEN
    UPDATE lumiere_codes SET share_count = share_count + 1 WHERE lumiere_code = p_lumiere_code;
  ELSE
    RAISE EXCEPTION 'Unsupported metric: %', p_metric;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION increment_user_stat(p_user_id UUID, p_stat TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_stat = 'total_codes' THEN
    UPDATE lumiere_users SET total_codes = total_codes + 1 WHERE id = p_user_id;
  ELSIF p_stat = 'winning_codes' THEN
    UPDATE lumiere_users SET winning_codes = winning_codes + 1 WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported user stat: %', p_stat;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION claim_shock_broadcast(p_shock_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE lumiere_shocks
  SET telegram_broadcasted_at = NOW()
  WHERE id = p_shock_id AND telegram_broadcasted_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_market_call(
  p_call_id UUID,
  p_resolved_prob NUMERIC,
  p_retention NUMERIC,
  p_status TEXT,
  p_iq_delta INTEGER,
  p_event_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  call_user_id UUID;
  call_verified BOOLEAN;
  updated_count INTEGER;
BEGIN
  UPDATE lumiere_market_calls
  SET resolved_prob = p_resolved_prob,
      retention = p_retention,
      status = p_status,
      iq_delta = CASE WHEN verified THEN p_iq_delta ELSE 0 END,
      resolved_at = p_event_at
  WHERE id = p_call_id AND status = 'pending'
  RETURNING user_id, verified INTO call_user_id, call_verified;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RETURN FALSE;
  END IF;

  IF call_verified THEN
    PERFORM apply_market_iq_event(
      call_user_id,
      'market_call',
      p_call_id::text,
      p_iq_delta,
      jsonb_build_object(
        'status', p_status,
        'retention', p_retention,
        'resolved_prob', p_resolved_prob,
        'txline_event_at', p_event_at
      )
    );
  END IF;
  RETURN TRUE;
END;
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
ALTER TABLE lumiere_market_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_iq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_telegram_code_watches ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS lumiere_market_calls_select_self ON lumiere_market_calls;
CREATE POLICY lumiere_market_calls_select_self ON lumiere_market_calls FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS lumiere_iq_events_select_self ON lumiere_iq_events;
CREATE POLICY lumiere_iq_events_select_self ON lumiere_iq_events FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS lumiere_match_cache_select_all ON lumiere_match_cache;
CREATE POLICY lumiere_match_cache_select_all ON lumiere_match_cache FOR SELECT USING (true);

-- lumiere_telegram_groups: server-only in both directions (read via service
-- role from getConfiguredGroups(); no public policy needed).
