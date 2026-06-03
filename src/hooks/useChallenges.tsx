import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptChallenge as acceptFn,
  declineChallenge as declineFn,
  getMyChallenges,
  sendChallenge as sendFn,
  submitChallengeResult as submitFn,
} from "@/lib/challenge.functions";

export interface ChallengeRow {
  id: string;
  challenger_id: string;
  opponent_id: string;
  stage_id: number;
  status: "pending" | "accepted" | "in_progress" | "completed" | "declined" | "expired";
  challenger_score: number | null;
  opponent_score: number | null;
  challenger_wave: number | null;
  opponent_wave: number | null;
  challenger_victory: boolean | null;
  opponent_victory: boolean | null;
  winner_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  challenger_nickname: string;
  opponent_nickname: string;
}

export function useChallenges(userId: string | undefined) {
  const fetchAll = useServerFn(getMyChallenges);
  const sendCall = useServerFn(sendFn);
  const acceptCall = useServerFn(acceptFn);
  const declineCall = useServerFn(declineFn);
  const submitCall = useServerFn(submitFn);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refresh = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const rows = (await fetchAll()) as ChallengeRow[];
      setChallenges(rows);
    } catch (e) {
      console.error("[useChallenges] refresh", e);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const tick = setInterval(refresh, 30000);
    const channel = supabase
      .channel(`challenges-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `challenger_id=eq.${userId}` },
        () => refresh())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `opponent_id=eq.${userId}` },
        () => refresh())
      .subscribe();
    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const pendingCount = useMemo(
    () => challenges.filter((c) => c.status === "pending" && c.opponent_id === userId).length,
    [challenges, userId],
  );

  return {
    challenges,
    loading,
    pendingCount,
    refresh,
    sendChallenge: (data: { opponentId: string; stageId: number }) => sendCall({ data }),
    acceptChallenge: (challengeId: string) => acceptCall({ data: { challengeId } }),
    declineChallenge: (challengeId: string) => declineCall({ data: { challengeId } }),
    submitChallengeResult: (data: { challengeId: string; wave: number; gold: number; victory: boolean }) =>
      submitCall({ data }),
  };
}
