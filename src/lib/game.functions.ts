import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { UPGRADES } from "@/lib/upgrades";

const ResultSchema = z.object({
  wave: z.number().int().min(0).max(100),
  gold: z.number().int().min(0).max(100000),
  victory: z.boolean(),
});

export const submitGameResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ResultSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.rpc("process_game_result", {
      p_wave: data.wave,
      p_gold: data.gold,
      p_victory: data.victory,
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(row) ? row[0] : row;
    return {
      gems: r?.gems ?? 0,
      high_score: r?.high_score ?? 0,
      score: r?.score ?? 0,
      earned: r?.earned ?? 0,
    };
  });

const UpgradeSchema = z.object({
  upgradeId: z.string().min(1).max(64),
});

export const purchaseUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpgradeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const def = UPGRADES.find((u) => u.id === data.upgradeId);
    if (!def) throw new Error("Upgrade desconhecido");
    const { supabase } = context;
    const { data: row, error } = await supabase.rpc("process_upgrade_purchase", {
      p_upgrade_id: def.id,
      p_cost: def.costPerLevel,
      p_max_level: def.maxLevel,
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(row) ? row[0] : row;
    return { gems: r?.gems ?? 0, level: r?.level ?? 0 };
  });
