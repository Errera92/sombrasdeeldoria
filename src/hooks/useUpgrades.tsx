import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UPGRADES, computeMultipliers, type UpgradeLevels } from "@/lib/upgrades";

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

  // Realtime profile (gems / high_score)
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

    // Otimista
    const prevProfile = profile;
    const prevLevels = levels;
    const newLevels = { ...levels, [upgradeId]: current + 1 };
    setProfile({ ...profile, gems: profile.gems - def.costPerLevel });
    setLevels(newLevels);

    const { error: upErr } = await supabase.from("player_upgrades").upsert(
      { player_id: userId, upgrade_id: upgradeId, level: current + 1 },
      { onConflict: "player_id,upgrade_id" },
    );
    const { error: gemsErr } = await supabase
      .from("profiles")
      .update({ gems: prevProfile.gems - def.costPerLevel })
      .eq("id", userId);

    if (upErr || gemsErr) {
      setProfile(prevProfile);
      setLevels(prevLevels);
      toast.error("Falha ao comprar upgrade");
    } else {
      toast.success(`${def.name} → nível ${current + 1}`);
    }
  }, [userId, profile, levels]);

  const addGems = useCallback(async (amount: number) => {
    if (!userId || !profile || amount <= 0) return;
    const newGems = profile.gems + amount;
    setProfile({ ...profile, gems: newGems });
    const { error } = await supabase.from("profiles").update({ gems: newGems }).eq("id", userId);
    if (error) toast.error("Falha ao salvar gems");
  }, [userId, profile]);

  const submitScore = useCallback(async (score: number) => {
    if (!userId || !profile) return;
    if (score > profile.high_score) {
      setProfile({ ...profile, high_score: score });
      await supabase.from("profiles").update({ high_score: score }).eq("id", userId);
      toast.success(`Novo recorde: ${score}!`);
    }
  }, [userId, profile]);

  const multipliers = computeMultipliers(levels);

  return { profile, levels, loading, buyUpgrade, addGems, submitScore, multipliers, refresh };
}
