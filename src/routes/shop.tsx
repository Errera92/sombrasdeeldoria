import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { UPGRADES_BY_TOWER, type TowerType, type UpgradeDef } from "@/lib/upgrades";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  head: () => ({ meta: [{ title: "Loja — Sombras de Eldoria" }] }),
});

const SECTIONS: { key: TowerType; label: string; icon: string; accent: string; border: string; bg: string }[] = [
  { key: "archer", label: "Arqueiro Élfico", icon: "🏹", accent: "text-emerald-300", border: "border-emerald-700/50", bg: "from-emerald-950/40 to-black/30" },
  { key: "dwarf",  label: "Anão de Pedra",   icon: "🔨", accent: "text-amber-700",   border: "border-amber-900/60",  bg: "from-stone-900/60 to-black/30" },
  { key: "mage",   label: "Mago das Runas",  icon: "🔮", accent: "text-purple-300",  border: "border-purple-800/50", bg: "from-purple-950/40 to-black/30" },
  { key: "global", label: "Global",          icon: "🌍", accent: "text-amber-300",   border: "border-amber-700/60",  bg: "from-amber-950/40 to-black/30" },
];

function ShopPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, levels, buyUpgrade } = useUpgrades(user?.id);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <Toaster />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <Link to="/menu" className="text-sm text-amber-300/80 hover:text-amber-200">← Menu</Link>
          <h1 className="font-serif text-2xl font-bold text-amber-200">🛒 Loja de Upgrades</h1>
          <div className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-black/50 px-3 py-2">
            <span>💎</span><span className="font-bold text-amber-300">{profile?.gems ?? 0}</span>
          </div>
        </header>

        <p className="mt-4 text-center text-sm italic text-amber-100/60">
          Upgrades permanentes — desbloqueie torres para ativá-las durante as partidas gastando ouro.
        </p>

        <div className="mt-6 space-y-6">
          {SECTIONS.map(section => {
            const items = UPGRADES_BY_TOWER[section.key];
            if (!items || items.length === 0) return null;
            return (
              <section key={section.key} className={`rounded-xl border ${section.border} bg-gradient-to-br ${section.bg} p-4`}>
                <h2 className={`mb-3 font-serif text-xl font-bold ${section.accent} flex items-center gap-2`}>
                  <span>{section.icon}</span>{section.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map(u => (
                    <UpgradeCard
                      key={u.id}
                      def={u}
                      level={levels[u.id] ?? 0}
                      gems={profile?.gems ?? 0}
                      onBuy={() => buyUpgrade(u.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UpgradeCard({ def, level, gems, onBuy }: { def: UpgradeDef; level: number; gems: number; onBuy: () => void }) {
  const maxed = level >= def.maxLevel;
  const canBuy = !maxed && gems >= def.costPerLevel;
  const accumulated = def.kind === "percent"
    ? `+${Math.round(def.effectPerLevel * level * 100)}%`
    : `+${def.effectPerLevel * level}`;
  const active = level > 0 && def.towerType !== "global";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-900/40 bg-black/40 p-3">
      <div className="text-3xl">{def.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-serif text-base font-bold text-amber-200">{def.name}</h3>
          <span className="text-[10px] uppercase text-amber-300/60">Nv {level}/{def.maxLevel}</span>
          {active && (
            <span className="rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-200 border border-blue-500/40">
              🔓 Ativo em jogo
            </span>
          )}
        </div>
        <p className="text-xs text-amber-100/70">{def.description}</p>
        <p className="text-[11px] text-amber-300/80 mt-0.5">Acumulado: {accumulated}</p>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-amber-600 transition-all" style={{ width: `${(level / def.maxLevel) * 100}%` }} />
        </div>
      </div>
      <button
        onClick={onBuy}
        disabled={!canBuy}
        className="flex-shrink-0 rounded-md bg-gradient-to-b from-amber-600 to-amber-800 px-3 py-2 text-xs font-bold text-white shadow disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-800 disabled:text-zinc-400">
        {maxed ? "MAX" : <>💎 {def.costPerLevel}</>}
      </button>
    </div>
  );
}
