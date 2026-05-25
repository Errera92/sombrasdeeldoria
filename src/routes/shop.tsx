import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { UPGRADES } from "@/lib/upgrades";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  head: () => ({ meta: [{ title: "Loja — Sombras de Eldoria" }] }),
});

function ShopPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, levels, buyUpgrade } = useUpgrades(user?.id);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <Toaster />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <Link to="/menu" className="text-sm text-amber-300/80 hover:text-amber-200">← Menu</Link>
          <h1 className="font-serif text-2xl font-bold text-amber-200">🛒 Loja de Upgrades</h1>
          <div className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-black/50 px-3 py-2">
            <span>💎</span><span className="font-bold text-amber-300">{profile?.gems ?? 0}</span>
          </div>
        </header>

        <p className="mt-4 text-center text-sm italic text-amber-100/60">
          Upgrades permanentes — efeitos se acumulam entre todas as partidas.
        </p>

        <div className="mt-6 grid gap-3">
          {UPGRADES.map(u => {
            const lvl = levels[u.id] ?? 0;
            const maxed = lvl >= u.maxLevel;
            const canBuy = !maxed && (profile?.gems ?? 0) >= u.costPerLevel;
            const accumulated = u.kind === "percent"
              ? `+${Math.round(u.effectPerLevel * lvl * 100)}%`
              : `+${u.effectPerLevel * lvl}`;
            return (
              <div key={u.id} className="flex items-center gap-4 rounded-lg border border-amber-900/40 bg-black/40 p-4">
                <div className="text-4xl">{u.icon}</div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <h3 className="font-serif text-lg font-bold text-amber-200">{u.name}</h3>
                    <span className="text-xs uppercase text-amber-300/60">Nível {lvl}/{u.maxLevel}</span>
                  </div>
                  <p className="text-xs text-amber-100/70">{u.description}</p>
                  <p className="text-xs text-amber-300/80 mt-0.5">Acumulado: {accumulated}</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-600 transition-all" style={{ width: `${(lvl / u.maxLevel) * 100}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => buyUpgrade(u.id)}
                  disabled={!canBuy}
                  className="flex-shrink-0 rounded-md bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-800 disabled:text-zinc-400">
                  {maxed ? "MAX" : <>💎 {u.costPerLevel}</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
