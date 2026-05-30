
-- 1) Remove permissive write policies on player_upgrades
DROP POLICY IF EXISTS "Users manage own upgrades insert" ON public.player_upgrades;
DROP POLICY IF EXISTS "Users manage own upgrades update" ON public.player_upgrades;
REVOKE INSERT, UPDATE, DELETE ON public.player_upgrades FROM authenticated;

-- 2) Remove permissive update on profiles; replace with safe nickname-only RPC
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 3) Nickname length constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_nickname_length;
-- Truncate any pre-existing long nicknames so the constraint can be added safely
UPDATE public.profiles SET nickname = substr(nickname, 1, 20) WHERE length(nickname) > 20;
UPDATE public.profiles SET nickname = rpad(nickname, 3, '_') WHERE length(nickname) < 3;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nickname_length CHECK (length(nickname) BETWEEN 3 AND 20);

-- 4) Server-side guard inside handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nick TEXT;
BEGIN
  v_nick := COALESCE(NEW.raw_user_meta_data->>'nickname', 'Player_' || substr(NEW.id::text, 1, 8));
  v_nick := substr(trim(v_nick), 1, 20);
  IF length(v_nick) < 3 THEN
    v_nick := 'Player_' || substr(NEW.id::text, 1, 8);
  END IF;
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, v_nick)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 5) Safe nickname update RPC
CREATE OR REPLACE FUNCTION public.update_nickname(p_nickname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nick text := trim(COALESCE(p_nickname, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(v_nick) < 3 OR length(v_nick) > 20 THEN
    RAISE EXCEPTION 'invalid nickname length';
  END IF;
  UPDATE public.profiles SET nickname = v_nick, updated_at = now() WHERE id = v_uid;
  RETURN v_nick;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_nickname(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.update_nickname(text) TO authenticated;

-- 6) Replace process_upgrade_purchase to derive cost/max server-side
DROP FUNCTION IF EXISTS public.process_upgrade_purchase(text, integer, integer);

CREATE OR REPLACE FUNCTION public.process_upgrade_purchase(p_upgrade_id text)
RETURNS TABLE(gems integer, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_current int;
  v_gems int;
  v_cost int;
  v_max  int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_upgrade_id IS NULL OR length(p_upgrade_id) = 0 OR length(p_upgrade_id) > 64 THEN
    RAISE EXCEPTION 'invalid upgrade';
  END IF;

  -- Server-authoritative upgrade definitions (mirror of src/lib/upgrades.ts)
  CASE p_upgrade_id
    WHEN 'archer_damage'    THEN v_cost := 60;  v_max := 5;
    WHEN 'archer_range'     THEN v_cost := 50;  v_max := 5;
    WHEN 'archer_firerate'  THEN v_cost := 70;  v_max := 5;
    WHEN 'dwarf_damage'     THEN v_cost := 80;  v_max := 5;
    WHEN 'dwarf_range'      THEN v_cost := 60;  v_max := 5;
    WHEN 'dwarf_firerate'   THEN v_cost := 90;  v_max := 5;
    WHEN 'mage_damage'      THEN v_cost := 100; v_max := 5;
    WHEN 'mage_range'       THEN v_cost := 80;  v_max := 5;
    WHEN 'mage_splash'      THEN v_cost := 120; v_max := 5;
    WHEN 'gold_bonus'       THEN v_cost := 80;  v_max := 3;
    WHEN 'starting_gold'    THEN v_cost := 100; v_max := 3;
    ELSE RAISE EXCEPTION 'unknown upgrade';
  END CASE;

  SELECT pr.gems INTO v_gems FROM public.profiles pr WHERE pr.id = v_uid FOR UPDATE;
  IF v_gems IS NULL THEN RAISE EXCEPTION 'profile missing'; END IF;

  SELECT COALESCE(pu.level, 0) INTO v_current
    FROM public.player_upgrades pu
   WHERE pu.player_id = v_uid AND pu.upgrade_id = p_upgrade_id;
  v_current := COALESCE(v_current, 0);

  IF v_current >= v_max THEN RAISE EXCEPTION 'max level'; END IF;
  IF v_gems < v_cost THEN RAISE EXCEPTION 'insufficient gems'; END IF;

  UPDATE public.profiles pr SET gems = pr.gems - v_cost WHERE pr.id = v_uid
    RETURNING pr.gems INTO v_gems;

  INSERT INTO public.player_upgrades (player_id, upgrade_id, level)
  VALUES (v_uid, p_upgrade_id, v_current + 1)
  ON CONFLICT (player_id, upgrade_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();

  RETURN QUERY SELECT v_gems, v_current + 1;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.process_upgrade_purchase(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_upgrade_purchase(text) TO authenticated;

-- 7) Lock down newer RPCs from anon access
REVOKE EXECUTE ON FUNCTION public.get_player_missions() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_player_missions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.process_phase_result(integer,integer,boolean,integer,integer,boolean,integer,integer,integer,integer,boolean,boolean,boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_phase_result(integer,integer,boolean,integer,integer,boolean,integer,integer,integer,integer,boolean,boolean,boolean) TO authenticated;

-- Also lock other game RPCs as defense in depth
REVOKE EXECUTE ON FUNCTION public.process_game_result(integer,integer,boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.process_game_result(integer,integer,boolean) TO authenticated;
