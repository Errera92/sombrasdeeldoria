
-- 1) Profiles: restrict SELECT to own row
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Player upgrades: restrict SELECT to own rows
DROP POLICY IF EXISTS "Upgrades viewable by authenticated" ON public.player_upgrades;
CREATE POLICY "Users can view own upgrades"
  ON public.player_upgrades FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- 3) Public ranking via SECURITY DEFINER function (only safe columns)
CREATE OR REPLACE FUNCTION public.get_top_rankings(limit_count int DEFAULT 20)
RETURNS TABLE (id uuid, nickname text, high_score int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nickname, high_score
  FROM public.profiles
  ORDER BY high_score DESC
  LIMIT GREATEST(1, LEAST(limit_count, 100));
$$;

REVOKE ALL ON FUNCTION public.get_top_rankings(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_top_rankings(int) TO authenticated;

-- Function to get own rank position
CREATE OR REPLACE FUNCTION public.get_my_rank()
RETURNS TABLE (nickname text, high_score int, rank bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT id, nickname, high_score,
           RANK() OVER (ORDER BY high_score DESC) AS rank
    FROM public.profiles
  )
  SELECT nickname, high_score, rank FROM ranked WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_rank() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;

-- 4) Realtime: restrict channel subscriptions to authenticated users only
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
