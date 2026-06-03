import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UuidSchema = z.object({ challengeId: z.string().uuid() });

const SendSchema = z.object({
  opponentId: z.string().uuid(),
  stageId: z.number().int().min(0).max(10),
});

const SubmitSchema = z.object({
  challengeId: z.string().uuid(),
  wave: z.number().int().min(0).max(100),
  gold: z.number().int().min(0).max(100000),
  victory: z.boolean(),
});

export const sendChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.opponentId === userId) throw new Error("Você não pode desafiar a si mesmo");
    const { data: row, error } = await supabase
      .from("challenges")
      .insert({
        challenger_id: userId,
        opponent_id: data.opponentId,
        stage_id: data.stageId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const acceptChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UuidSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_challenge", { p_challenge_id: data.challengeId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const declineChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UuidSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decline_challenge", { p_challenge_id: data.challengeId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitChallengeResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubmitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("submit_challenge_result", {
      p_challenge_id: data.challengeId,
      p_wave: data.wave,
      p_gold: data.gold,
      p_victory: data.victory,
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(rows) ? rows[0] : rows;
    return {
      status: r?.status ?? "in_progress",
      challengerScore: r?.challenger_score ?? null,
      opponentScore: r?.opponent_score ?? null,
      winnerId: r?.winner_id ?? null,
    };
  });

export const getMyChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("challenges")
      .select("id, challenger_id, opponent_id, stage_id, status, challenger_score, opponent_score, challenger_wave, opponent_wave, challenger_victory, opponent_victory, winner_id, expires_at, created_at, updated_at")
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .neq("status", "expired")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ids = new Set<string>();
    for (const r of rows) { ids.add(r.challenger_id); ids.add(r.opponent_id); }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", Array.from(ids));
    const map = new Map<string, string>();
    for (const p of profs ?? []) map.set(p.id, p.nickname);
    return rows.map((r) => ({
      ...r,
      challenger_nickname: map.get(r.challenger_id) ?? "—",
      opponent_nickname: map.get(r.opponent_id) ?? "—",
    }));
  });
