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
  v_max int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_upgrade_id IS NULL OR length(p_upgrade_id) = 0 OR length(p_upgrade_id) > 64 THEN
    RAISE EXCEPTION 'invalid upgrade';
  END IF;

  CASE p_upgrade_id
    WHEN 'archer_damage'   THEN v_cost := 60;  v_max := 8;
    WHEN 'archer_range'    THEN v_cost := 50;  v_max := 7;
    WHEN 'archer_firerate' THEN v_cost := 70;  v_max := 7;
    WHEN 'dwarf_damage'    THEN v_cost := 80;  v_max := 8;
    WHEN 'dwarf_range'     THEN v_cost := 60;  v_max := 7;
    WHEN 'dwarf_firerate'  THEN v_cost := 90;  v_max := 7;
    WHEN 'mage_damage'     THEN v_cost := 100; v_max := 8;
    WHEN 'mage_range'      THEN v_cost := 80;  v_max := 7;
    WHEN 'mage_firerate'   THEN v_cost := 110; v_max := 7;
    WHEN 'mage_splash'     THEN v_cost := 120; v_max := 7;
    WHEN 'gold_bonus'      THEN v_cost := 80;  v_max := 5;
    WHEN 'starting_gold'   THEN v_cost := 100; v_max := 5;
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
GRANT EXECUTE ON FUNCTION public.process_upgrade_purchase(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_phase_result(p_wave integer, p_gold integer, p_victory boolean, p_stage_id integer, p_phase_index integer, p_took_damage boolean, p_towers_used integer, p_phase_seconds integer, p_enemies_killed integer, p_gold_spent integer, p_used_upgrade boolean, p_stage_complete boolean, p_all_phases_no_damage boolean)
RETURNS TABLE(gems integer, high_score integer, score integer, earned integer, missions_earned jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_wave int := GREATEST(0, LEAST(COALESCE(p_wave,0), 5));
  v_gold int := GREATEST(0, LEAST(COALESCE(p_gold,0), 5000));
  v_gold_spent int := GREATEST(0, LEAST(COALESCE(p_gold_spent,0), 3000));
  v_difficulty numeric := CASE p_stage_id
    WHEN 0 THEN 1.00
    WHEN 1 THEN 1.15
    WHEN 2 THEN 1.30
    WHEN 3 THEN 1.45
    WHEN 4 THEN 1.60
    WHEN 5 THEN 1.30
    ELSE 1.00
  END;
  v_score int;
  v_earned int;
  v_total_earned int := 0;
  v_earned_list jsonb := '[]'::jsonb;
  m record;
  v_current int;
  v_completed_at timestamptz;
  v_new_progress int;
  v_completes boolean;
  v_metric int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF COALESCE(p_victory,false) AND COALESCE(p_phase_seconds,0) < 5 THEN
    RAISE EXCEPTION 'implausible: phase too fast';
  END IF;
  IF COALESCE(p_enemies_killed,0) > GREATEST(1, COALESCE(p_phase_seconds,0)) * 20 THEN
    RAISE EXCEPTION 'implausible: kill rate too high';
  END IF;
  IF COALESCE(p_stage_complete,false) AND (NOT COALESCE(p_victory,false) OR COALESCE(p_phase_index,0) < 4) THEN
    RAISE EXCEPTION 'implausible: stage_complete requires final-phase victory';
  END IF;
  IF COALESCE(p_all_phases_no_damage,false) AND NOT COALESCE(p_stage_complete,false) THEN
    RAISE EXCEPTION 'implausible: no-damage stage requires stage_complete';
  END IF;
  IF COALESCE(p_towers_used,0) > 30 THEN
    RAISE EXCEPTION 'implausible: too many towers';
  END IF;

  v_score := ROUND((v_wave * 100 + v_gold + CASE WHEN COALESCE(p_victory,false) THEN 500 ELSE 0 END) * v_difficulty);
  v_earned := GREATEST(0, LEAST(v_score / 100, 200));
  v_total_earned := v_earned;

  UPDATE public.profiles p
     SET gems = p.gems + v_earned,
         high_score = GREATEST(p.high_score, v_score)
   WHERE p.id = v_uid;

  FOR m IN SELECT * FROM public.missions LOOP
    SELECT pm.progress, pm.completed_at
      INTO v_current, v_completed_at
      FROM public.player_missions pm
     WHERE pm.player_id = v_uid AND pm.mission_id = m.id
     FOR UPDATE;
    v_current := COALESCE(v_current, 0);
    v_new_progress := v_current;
    v_completes := false;

    IF v_completed_at IS NOT NULL AND NOT m.repeatable THEN
      CONTINUE;
    END IF;

    IF m.condition_type = 'stage_complete_id' THEN
      IF COALESCE(p_stage_complete,false) AND p_stage_id = m.condition_value THEN
        v_new_progress := 1; v_completes := true;
      END IF;
    ELSIF m.condition_type = 'phase_complete_count' THEN
      IF COALESCE(p_victory,false) THEN
        v_new_progress := v_current + 1;
        IF v_new_progress >= m.condition_value THEN v_completes := true; END IF;
      END IF;
    ELSIF m.condition_type = 'enemies_killed_total' THEN
      v_metric := GREATEST(0, COALESCE(p_enemies_killed,0));
      v_new_progress := LEAST(v_current + v_metric, m.condition_value);
      IF v_new_progress >= m.condition_value THEN v_completes := true; END IF;
    ELSIF m.condition_type = 'enemies_killed_phase' THEN
      IF COALESCE(p_enemies_killed,0) >= m.condition_value THEN
        v_new_progress := m.condition_value; v_completes := true;
      END IF;
    ELSIF m.condition_type = 'gold_spent_total' THEN
      v_metric := v_gold_spent;
      v_new_progress := LEAST(v_current + v_metric, m.condition_value);
      IF v_new_progress >= m.condition_value THEN v_completes := true; END IF;
    ELSIF m.condition_type = 'gold_remaining' THEN
      IF COALESCE(p_victory,false) AND v_gold >= m.condition_value THEN
        v_new_progress := m.condition_value; v_completes := true;
      END IF;
    ELSIF m.condition_type = 'phase_no_damage' THEN
      IF COALESCE(p_victory,false) AND NOT COALESCE(p_took_damage,false) THEN
        v_new_progress := v_current + 1;
        v_completes := true;
      END IF;
    ELSIF m.condition_type = 'stage_no_damage' THEN
      IF COALESCE(p_stage_complete,false) AND COALESCE(p_all_phases_no_damage,false) THEN
        v_new_progress := 1; v_completes := true;
      END IF;
    ELSIF m.condition_type = 'phase_fast' THEN
      IF COALESCE(p_victory,false) AND p_phase_seconds > 0
         AND p_phase_seconds <= m.condition_value THEN
        v_new_progress := 1; v_completes := true;
      END IF;
    ELSIF m.condition_type = 'upgrade_used' THEN
      IF COALESCE(p_used_upgrade,false) THEN
        v_new_progress := 1; v_completes := true;
      END IF;
    END IF;

    IF v_new_progress = v_current AND NOT v_completes THEN
      CONTINUE;
    END IF;

    INSERT INTO public.player_missions (player_id, mission_id, progress, times_completed, completed_at)
    VALUES (
      v_uid, m.id, v_new_progress,
      CASE WHEN v_completes THEN 1 ELSE 0 END,
      CASE WHEN v_completes THEN now() ELSE NULL END
    )
    ON CONFLICT (player_id, mission_id) DO UPDATE
    SET progress = EXCLUDED.progress,
        times_completed = public.player_missions.times_completed
                        + CASE WHEN v_completes THEN 1 ELSE 0 END,
        completed_at = COALESCE(public.player_missions.completed_at,
                                CASE WHEN v_completes THEN now() ELSE NULL END),
        updated_at = now();

    IF v_completes THEN
      UPDATE public.profiles SET gems = gems + m.gems_reward WHERE id = v_uid;
      v_total_earned := v_total_earned + m.gems_reward;
      v_earned_list := v_earned_list || jsonb_build_object(
        'id', m.id, 'title', m.title, 'gems', m.gems_reward, 'icon', m.icon
      );
      IF m.repeatable THEN
        UPDATE public.player_missions
           SET progress = 0, completed_at = NULL
         WHERE player_id = v_uid AND mission_id = m.id;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT p.gems AS gems, p.high_score AS high_score, v_score AS score, v_total_earned AS earned, v_earned_list AS missions_earned
      FROM public.profiles p WHERE p.id = v_uid;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.process_phase_result(integer,integer,boolean,integer,integer,boolean,integer,integer,integer,integer,boolean,boolean,boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_phase_result(integer,integer,boolean,integer,integer,boolean,integer,integer,integer,integer,boolean,boolean,boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.process_game_result(integer,integer,boolean);