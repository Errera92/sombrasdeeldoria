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
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const challengesRef = useRef<ChallengeRow[]>([]);
  challengesRef.current = challenges;
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const rows = (await fetchAll()) as ChallengeRow[];
      setChallenges(rows);
      return rows;
    } catch (e) {
      console.error("[useChallenges] refresh", e);
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    if (!userId) return;
    initializedRef.current = false;
    seenRef.current = new Set();
    refresh().then((rows) => {
      if (rows) {
        for (const r of rows) seenRef.current.add(`${r.id}:${r.status}`);
      }
      initializedRef.current = true;
    });
    const tick = setInterval(refresh, 30000);

    const notify = async (challengeId: string, eventType: "INSERT" | "UPDATE") => {
      const rows = await refresh();
      if (!rows || !initializedRef.current) return;
      const row = rows.find((r) => r.id === challengeId);
      if (!row) return;
      const key = `${row.id}:${row.status}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);

      const isOpponent = row.opponent_id === userId;
      const isChallenger = row.challenger_id === userId;

      if (eventType === "INSERT" && isOpponent && row.status === "pending") {
        toast(`⚔️ ${row.challenger_nickname} te desafiou!`, {
          description: "Toque para ver o desafio.",
          action: { label: "Ver", onClick: () => navigate({ to: "/challenges" }) },
          duration: 8000,
        });
        return;
      }
      if (eventType === "UPDATE") {
        if (row.status === "accepted" && isChallenger) {
          toast(`✅ ${row.opponent_nickname} aceitou seu desafio!`);
        } else if (row.status === "declined" && isChallenger) {
          toast(`❌ ${row.opponent_nickname} recusou seu desafio.`);
        } else if (row.status === "completed") {
          if (row.winner_id === userId) toast("🏆 Você venceu o desafio! +30💎");
          else if (row.winner_id == null) toast("🤝 Desafio empatado.");
          else toast("💀 Você perdeu o desafio.");
        }
      }
    };

    const channel = supabase
      .channel(`challenges-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `challenger_id=eq.${userId}` },
        (payload) => notify((payload.new as { id: string })?.id ?? (payload.old as { id: string })?.id, payload.eventType as "INSERT" | "UPDATE"))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "challenges", filter: `opponent_id=eq.${userId}` },
        (payload) => notify((payload.new as { id: string })?.id ?? (payload.old as { id: string })?.id, payload.eventType as "INSERT" | "UPDATE"))
      .subscribe();
    return () => {
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh, navigate]);

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
