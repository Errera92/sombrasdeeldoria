
-- ============================================================
-- Missions system
-- ============================================================
CREATE TABLE public.missions (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  description     text NOT NULL,
  icon            text NOT NULL DEFAULT '🎯',
  category        text NOT NULL CHECK (category IN ('stage','phase','combat','economy','mastery')),
  gems_reward     int  NOT NULL DEFAULT 10,
  condition_type  text NOT NULL,
  condition_value int  NOT NULL DEFAULT 1,
  repeatable      boolean NOT NULL DEFAULT false,
  sort_order      int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.missions TO authenticated;
GRANT ALL    ON public.missions TO service_role;

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Missions readable by authenticated"
ON public.missions FOR SELECT TO authenticated
USING (true);

-- player progress
CREATE TABLE public.player_missions (
  player_id       uuid NOT NULL,
  mission_id      text NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress        int  NOT NULL DEFAULT 0,
  times_completed int  NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, mission_id)
);

GRANT SELECT, INSERT, UPDATE ON public.player_missions TO authenticated;
GRANT ALL ON public.player_missions TO service_role;

ALTER TABLE public.player_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own mission progress"
ON public.player_missions FOR SELECT TO authenticated
USING (auth.uid() = player_id);

-- seed missions
INSERT INTO public.missions (id,title,description,icon,category,gems_reward,condition_type,condition_value,repeatable,sort_order) VALUES
  ('stage_1','Conquistar a Floresta',     'Conclua o Estágio 1 completo.',                         '🌳','stage',  50,'stage_complete_id', 1, false, 10),
  ('stage_2','Domar o Deserto',           'Conclua o Estágio 2 completo.',                         '🏜️','stage',  75,'stage_complete_id', 2, false, 20),
  ('stage_3','Vencer o Vulcão',           'Conclua o Estágio 3 completo.',                         '🌋','stage', 100,'stage_complete_id', 3, false, 30),
  ('stage_4','Tocar o Céu',               'Conclua o Estágio 4 completo.',                         '☁️','stage', 125,'stage_complete_id', 4, false, 40),

  ('phase_count_10','Veterano',           'Complete 10 fases ao todo.',                            '⚔️','phase',  30,'phase_complete_count', 10, false, 10),
  ('phase_count_50','Mestre de Fases',    'Complete 50 fases ao todo.',                            '🛡️','phase', 100,'phase_complete_count', 50, false, 20),
  ('phase_repeat','Persistente',          'Conclua mais uma fase com vitória.',                    '🔁','phase',   5,'phase_complete_count',  1, true,  30),

  ('kill_100','Caçador',                  'Elimine 100 inimigos no total.',                        '💀','combat', 20,'enemies_killed_total', 100, false, 10),
  ('kill_500','Exterminador',             'Elimine 500 inimigos no total.',                        '☠️','combat', 60,'enemies_killed_total', 500, false, 20),
  ('kill_50_phase','Massacre',            'Mate 50 inimigos em uma única fase.',                   '🔥','combat', 25,'enemies_killed_phase',  50, false, 30),

  ('spend_1000','Investidor',             'Gaste 1000 de ouro no total.',                          '💰','economy', 20,'gold_spent_total', 1000, false, 10),
  ('rich_phase','Tesouro',                'Termine uma fase com 500 ouro ou mais.',                '🪙','economy', 30,'gold_remaining',   500, false, 20),

  ('no_damage_phase','Defesa Imbatível',  'Conclua uma fase sem perder HP.',                       '🛡️','mastery', 15,'phase_no_damage',   1, true,  10),
  ('no_damage_stage','Fortaleza',         'Conclua um estágio inteiro sem perder HP.',             '🏰','mastery',150,'stage_no_damage',   1, false, 20),
  ('fast_phase','Veloz',                  'Conclua uma fase em 60 segundos ou menos.',             '⚡','mastery', 25,'phase_fast',       60, false, 30),
  ('use_upgrade','Aprendiz das Runas',    'Ative um upgrade durante a partida.',                   '✨','mastery', 10,'upgrade_used',      1, false, 40);

-- ============================================================
-- RPC: get_player_missions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_player_missions()
RETURNS TABLE (
  id text, title text, description text, icon text, category text,
  gems_reward int, repeatable boolean,
  progress int, condition_value int, times_completed int, completed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.title, m.description, m.icon, m.category,
         m.gems_reward, m.repeatable,
         COALESCE(pm.progress, 0)        AS progress,
         m.condition_value,
         COALESCE(pm.times_completed, 0) AS times_completed,
         pm.completed_at
    FROM public.missions m
    LEFT JOIN public.player_missions pm
           ON pm.mission_id = m.id AND pm.player_id = auth.uid()
   ORDER BY m.category, m.sort_order, m.id;
$$;

-- ============================================================
-- RPC: process_phase_result
-- Awards gems + evaluates every mission. Returns updated profile
-- + score + earned + list of missions completed in this call.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_phase_result(
  p_wave int, p_gold int, p_victory boolean,
  p_stage_id int, p_phase_index int,
  p_took_damage boolean, p_towers_used int,
  p_phase_seconds int, p_enemies_killed int,
  p_gold_spent int, p_used_upgrade boolean,
  p_stage_complete boolean, p_all_phases_no_damage boolean
)
RETURNS TABLE (
  gems int, high_score int, score int, earned int,
  missions_earned jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wave int := GREATEST(0, LEAST(COALESCE(p_wave,0), 100));
  v_gold int := GREATEST(0, LEAST(COALESCE(p_gold,0), 100000));
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

  v_score := (v_wave * 100) + v_gold + CASE WHEN COALESCE(p_victory,false) THEN 500 ELSE 0 END;
  v_earned := GREATEST(0, v_score / 100);
  v_total_earned := v_earned;

  UPDATE public.profiles p
     SET gems = p.gems + v_earned,
         high_score = GREATEST(p.high_score, v_score)
   WHERE p.id = v_uid;

  -- evaluate every mission
  FOR m IN SELECT * FROM public.missions LOOP
    SELECT progress, completed_at
      INTO v_current, v_completed_at
      FROM public.player_missions
     WHERE player_id = v_uid AND mission_id = m.id
     FOR UPDATE;
    v_current := COALESCE(v_current, 0);
    v_new_progress := v_current;
    v_completes := false;

    -- one-shot missions: skip if completed and not repeatable
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
      v_metric := GREATEST(0, COALESCE(p_gold_spent,0));
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
      CONTINUE; -- nothing to write
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
      -- award gems
      UPDATE public.profiles SET gems = gems + m.gems_reward WHERE id = v_uid;
      v_total_earned := v_total_earned + m.gems_reward;
      v_earned_list := v_earned_list || jsonb_build_object(
        'id', m.id, 'title', m.title, 'gems', m.gems_reward, 'icon', m.icon
      );
      -- for repeatable: reset progress so it can be done again
      IF m.repeatable THEN
        UPDATE public.player_missions
           SET progress = 0, completed_at = NULL
         WHERE player_id = v_uid AND mission_id = m.id;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT p.gems, p.high_score, v_score, v_total_earned, v_earned_list
      FROM public.profiles p WHERE p.id = v_uid;
END;
$$;
