
-- 1. submit_challenge_result estava com os clamps antigos de p_wave/p_gold (herdados do
--    design de 100 ondas por partida). Cada corrida hoje tem exatamente 5 ondas por fase,
--    então um cliente podia mandar wave=100 e forjar uma vitória contra um adversário real,
--    roubando os +30 gems e o resultado do desafio. Alinhado ao mesmo clamp de
--    process_phase_result (wave 0-5, gold 0-5000).
CREATE OR REPLACE FUNCTION public.submit_challenge_result(
  p_challenge_id uuid, p_wave integer, p_gold integer, p_victory boolean
) RETURNS TABLE(status text, challenger_score integer, opponent_score integer, winner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wave int := GREATEST(0, LEAST(COALESCE(p_wave,0), 5));
  v_gold int := GREATEST(0, LEAST(COALESCE(p_gold,0), 5000));
  v_score int;
  c public.challenges%ROWTYPE;
  v_winner uuid;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_score := (v_wave * 100) + v_gold + CASE WHEN COALESCE(p_victory,false) THEN 500 ELSE 0 END;

  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge not found'; END IF;
  IF v_uid <> c.challenger_id AND v_uid <> c.opponent_id THEN
    RAISE EXCEPTION 'not a participant'; END IF;
  IF c.status NOT IN ('accepted','in_progress') THEN
    RAISE EXCEPTION 'challenge not active'; END IF;

  IF v_uid = c.challenger_id THEN
    IF c.challenger_score IS NOT NULL THEN RAISE EXCEPTION 'already submitted'; END IF;
    UPDATE public.challenges
       SET challenger_score = v_score, challenger_wave = v_wave,
           challenger_victory = COALESCE(p_victory,false),
           status = CASE WHEN opponent_score IS NULL THEN 'in_progress' ELSE status END,
           updated_at = now()
     WHERE id = p_challenge_id RETURNING * INTO c;
  ELSE
    IF c.opponent_score IS NOT NULL THEN RAISE EXCEPTION 'already submitted'; END IF;
    UPDATE public.challenges
       SET opponent_score = v_score, opponent_wave = v_wave,
           opponent_victory = COALESCE(p_victory,false),
           status = CASE WHEN challenger_score IS NULL THEN 'in_progress' ELSE status END,
           updated_at = now()
     WHERE id = p_challenge_id RETURNING * INTO c;
  END IF;

  IF c.challenger_score IS NOT NULL AND c.opponent_score IS NOT NULL THEN
    IF c.challenger_score > c.opponent_score THEN v_winner := c.challenger_id;
    ELSIF c.opponent_score > c.challenger_score THEN v_winner := c.opponent_id;
    ELSE v_winner := NULL; END IF;

    v_new_status := 'completed';
    UPDATE public.challenges
       SET status = v_new_status, winner_id = v_winner, updated_at = now()
     WHERE id = p_challenge_id;

    IF v_winner IS NOT NULL THEN
      UPDATE public.profiles SET gems = gems + 30 WHERE id = v_winner;
    END IF;
  END IF;

  RETURN QUERY
    SELECT ch.status, ch.challenger_score, ch.opponent_score, ch.winner_id
      FROM public.challenges ch WHERE ch.id = p_challenge_id;
END;
$$;

-- 2. decline_challenge não conferia expires_at (accept_challenge confere). Alinhado por
--    consistência: um desafio expirado não deveria poder ser recusado, só deixar de
--    aparecer como pendente.
CREATE OR REPLACE FUNCTION public.decline_challenge(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.challenges
     SET status = 'declined', updated_at = now()
   WHERE id = p_challenge_id
     AND opponent_id = v_uid
     AND status = 'pending'
     AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot decline challenge'; END IF;
END;
$$;

-- 3. nickname_available: a checagem de disponibilidade em login.tsx rodava um SELECT direto
--    em profiles antes do usuário se autenticar. Isso funcionava quando a policy de SELECT
--    era aberta a qualquer authenticated, mas foi apertada pra "só a própria linha"
--    (migration 20260526001457) e usuário anônimo não tem SELECT nenhum na tabela — então
--    a checagem sempre voltava vazia e o erro de UNIQUE do banco estourava cru pro usuário
--    em vez do aviso amigável. Esta função expõe só um boolean, nada de dados de perfil.
CREATE OR REPLACE FUNCTION public.nickname_available(p_nickname text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE nickname = trim(p_nickname)
  );
$$;

REVOKE ALL ON FUNCTION public.nickname_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nickname_available(text) TO anon, authenticated;
