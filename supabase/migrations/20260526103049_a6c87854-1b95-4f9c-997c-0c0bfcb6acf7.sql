
-- 1) Scope realtime to the user's own profile channel
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Users receive own profile channel"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (realtime.topic() = 'profile-' || (select auth.uid())::text);

-- 2) Explicitly revoke from anon (PUBLIC revoke earlier didn't always drop anon grant)
REVOKE EXECUTE ON FUNCTION public.get_top_rankings(int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_rank() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_top_rankings(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;

-- 3) Server-side game result: client cannot set arbitrary gems/score
CREATE OR REPLACE FUNCTION public.process_game_result(
  p_wave int,
  p_gold int,
  p_victory boolean
)
RETURNS TABLE (gems int, high_score int, score int, earned int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wave int := GREATEST(0, LEAST(COALESCE(p_wave, 0), 100));
  v_gold int := GREATEST(0, LEAST(COALESCE(p_gold, 0), 100000));
  v_score int;
  v_earned int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  v_score := (v_wave * 100) + v_gold + CASE WHEN COALESCE(p_victory, false) THEN 500 ELSE 0 END;
  v_earned := GREATEST(0, v_score / 100);

  UPDATE public.profiles p
     SET gems = p.gems + v_earned,
         high_score = GREATEST(p.high_score, v_score)
   WHERE p.id = v_uid;

  RETURN QUERY
    SELECT p.gems, p.high_score, v_score, v_earned
      FROM public.profiles p WHERE p.id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_game_result(int,int,boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_game_result(int,int,boolean) TO authenticated;

-- 4) Server-side upgrade purchase: server enforces cost/level cap
CREATE OR REPLACE FUNCTION public.process_upgrade_purchase(
  p_upgrade_id text,
  p_cost int,
  p_max_level int
)
RETURNS TABLE (gems int, level int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current int;
  v_gems int;
  v_cost int := GREATEST(0, LEAST(COALESCE(p_cost, 0), 100000));
  v_max  int := GREATEST(1, LEAST(COALESCE(p_max_level, 1), 99));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_upgrade_id IS NULL OR length(p_upgrade_id) = 0 OR length(p_upgrade_id) > 64 THEN
    RAISE EXCEPTION 'invalid upgrade';
  END IF;

  SELECT pr.gems INTO v_gems FROM public.profiles pr WHERE pr.id = v_uid FOR UPDATE;
  IF v_gems IS NULL THEN
    RAISE EXCEPTION 'profile missing';
  END IF;

  SELECT COALESCE(pu.level, 0) INTO v_current
    FROM public.player_upgrades pu
   WHERE pu.player_id = v_uid AND pu.upgrade_id = p_upgrade_id;
  v_current := COALESCE(v_current, 0);

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'max level';
  END IF;
  IF v_gems < v_cost THEN
    RAISE EXCEPTION 'insufficient gems';
  END IF;

  UPDATE public.profiles p
     SET gems = p.gems - v_cost
   WHERE p.id = v_uid
  RETURNING p.gems INTO v_gems;

  INSERT INTO public.player_upgrades (player_id, upgrade_id, level)
  VALUES (v_uid, p_upgrade_id, v_current + 1)
  ON CONFLICT (player_id, upgrade_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();

  RETURN QUERY SELECT v_gems, v_current + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_upgrade_purchase(text,int,int) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_upgrade_purchase(text,int,int) TO authenticated;
