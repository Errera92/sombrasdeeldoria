import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { UPGRADES } from "@/lib/upgrades";

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
    });
    if (error) throw new Error(error.message);
    const r = Array.isArray(row) ? row[0] : row;
    return { gems: r?.gems ?? 0, level: r?.level ?? 0 };
  });
