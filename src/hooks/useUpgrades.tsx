import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UPGRADES, computeMultipliers, type UpgradeLevels } from "@/lib/upgrades";
import { purchaseUpgrade, submitGameResult } from "@/lib/game.functions";

export interface Profile {
  id: string;
  nickname: string;
  gems: number;
  high_score: number;
}

export function useUpgrades(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [levels, setLevels] = useState<UpgradeLevels>({});
  const [loading, setLoading] = useState(true);
  const purchaseFn = useServerFn(purchaseUpgrade);
  const submitFn = useServerFn(submitGameResult);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [p, u] = await Promise.all([
      supabase.from("profiles").select("id,nickname,gems,high_score").eq("id", userId).maybeSingle(),
      supabase.from("player_upgrades").select("upgrade_id,level").eq("player_id", userId),
    ]);
    if (p.data) setProfile(p.data as Profile);
    const map: UpgradeLevels = {};
    (u.data ?? []).forEach((r: any) => { map[r.upgrade_id] = r.level; });
    setLevels(map);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`profile-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as Profile))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const buyUpgrade = useCallback(async (upgradeId: string) => {
    if (!userId || !profile) return;
    const def = UPGRADES.find(u => u.id === upgradeId);
    if (!def) return;
    const current = levels[upgradeId] ?? 0;
    if (current >= def.maxLevel) { toast.error("Nível máximo atingido"); return; }
    if (profile.gems < def.costPerLevel) { toast.error("Gems insuficientes"); return; }

    try {
      const res = await purchaseFn({ data: { upgradeId } });
      setProfile({ ...profile, gems: res.gems });
      setLevels({ ...levels, [upgradeId]: res.level });
      toast.success(`${def.name} → nível ${res.level}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao comprar upgrade");
    }
  }, [userId, profile, levels, purchaseFn]);

  const submitResult = useCallback(async (wave: number, gold: number, victory: boolean) => {
    if (!userId || !profile) return;
    try {
      const res = await submitFn({ data: { wave, gold, victory } });
      setProfile({ ...profile, gems: res.gems, high_score: res.high_score });
      if (res.earned > 0) toast.success(`+${res.earned} 💎`);
      if (res.score === res.high_score && res.score > 0) toast.success(`Recorde: ${res.score}!`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar resultado");
    }
  }, [userId, profile, submitFn]);

  const multipliers = computeMultipliers(levels);

  return { profile, levels, loading, buyUpgrade, submitResult, multipliers, refresh };
}
