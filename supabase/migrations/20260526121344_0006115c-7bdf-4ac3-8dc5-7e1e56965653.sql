CREATE OR REPLACE FUNCTION public.process_upgrade_purchase(p_upgrade_id text, p_cost integer, p_max_level integer)
 RETURNS TABLE(gems integer, level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE public.profiles pr SET gems = pr.gems - v_cost WHERE pr.id = v_uid
    RETURNING pr.gems INTO v_gems;

  INSERT INTO public.player_upgrades (player_id, upgrade_id, level)
  VALUES (v_uid, p_upgrade_id, v_current + 1)
  ON CONFLICT (player_id, upgrade_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();

  RETURN QUERY SELECT v_gems, v_current + 1;
END;
$function$;