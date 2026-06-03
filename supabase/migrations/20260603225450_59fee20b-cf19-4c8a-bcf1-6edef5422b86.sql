
-- 1. Table
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id      integer NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','in_progress','completed','declined','expired')),
  challenger_score   integer,
  opponent_score     integer,
  challenger_wave    integer,
  opponent_wave      integer,
  challenger_victory boolean,
  opponent_victory   boolean,
  winner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_id <> opponent_id),
  CHECK (stage_id >= 0 AND stage_id <= 10)
);

CREATE INDEX idx_challenges_challenger ON public.challenges(challenger_id, created_at DESC);
CREATE INDEX idx_challenges_opponent   ON public.challenges(opponent_id, created_at DESC);
CREATE INDEX idx_challenges_status     ON public.challenges(status);

-- 2. Grants
GRANT SELECT, INSERT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;

-- 3. RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create challenges as challenger"
  ON public.challenges FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = challenger_id
    AND challenger_id <> opponent_id
    AND status = 'pending'
    AND challenger_score IS NULL AND opponent_score IS NULL
    AND winner_id IS NULL
  );

-- 4. updated_at trigger (reuse existing touch_updated_at)
CREATE TRIGGER trg_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. accept_challenge
CREATE OR REPLACE FUNCTION public.accept_challenge(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.challenges
     SET status = 'accepted', updated_at = now()
   WHERE id = p_challenge_id
     AND opponent_id = v_uid
     AND status = 'pending'
     AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot accept challenge'; END IF;
END;
$$;

-- 6. decline_challenge
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
     AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot decline challenge'; END IF;
END;
$$;

-- 7. submit_challenge_result
CREATE OR REPLACE FUNCTION public.submit_challenge_result(
  p_challenge_id uuid, p_wave integer, p_gold integer, p_victory boolean
) RETURNS TABLE(status text, challenger_score integer, opponent_score integer, winner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wave int := GREATEST(0, LEAST(COALESCE(p_wave,0), 100));
  v_gold int := GREATEST(0, LEAST(COALESCE(p_gold,0), 100000));
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

-- 8. get_challenge_live
CREATE OR REPLACE FUNCTION public.get_challenge_live(p_challenge_id uuid)
RETURNS TABLE(
  challenger_nickname text, opponent_nickname text,
  challenger_score integer, opponent_score integer,
  challenger_wave  integer, opponent_wave  integer,
  status text, stage_id integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pc.nickname, po.nickname,
         c.challenger_score, c.opponent_score,
         c.challenger_wave,  c.opponent_wave,
         c.status, c.stage_id
    FROM public.challenges c
    JOIN public.profiles pc ON pc.id = c.challenger_id
    JOIN public.profiles po ON po.id = c.opponent_id
   WHERE c.id = p_challenge_id
     AND (auth.uid() = c.challenger_id OR auth.uid() = c.opponent_id);
$$;

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
