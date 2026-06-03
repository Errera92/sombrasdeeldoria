import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useChallenges } from "@/hooks/useChallenges";
import { Toaster } from "@/components/ui/sonner";


export const Route = createFileRoute("/menu")({
  component: MenuPage,
  head: () => ({
    meta: [
      { title: "Menu Principal — Sombras de Eldoria Tower Defense" },
      { name: "description", content: "Acesse a campanha, missões, loja de upgrades e ranking global de Sombras de Eldoria. Continue sua jornada para defender o reino." },
      { property: "og:title", content: "Menu Principal — Sombras de Eldoria" },
      { property: "og:description", content: "Acesse campanha, missões, loja de upgrades e ranking global." },
      { property: "og:url", content: "https://sombrasdeeldoria.lovable.app/menu" },
    ],
    links: [{ rel: "canonical", href: "https://sombrasdeeldoria.lovable.app/menu" }],
  }),
});

function MenuPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile } = useUpgrades(user?.id);
  const { pendingCount } = useChallenges(user?.id);


  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  if (loading || !user) return <Loading />;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <Toaster />
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 0%, rgba(255,180,50,0.2), transparent 60%)" }} />

      <div className="relative mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-300/60">Bem-vindo,</div>
            <div className="font-serif text-2xl font-bold text-amber-200">{profile?.nickname ?? "…"}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-black/50 px-3 py-2">
              <span className="text-lg">💎</span>
              <span className="font-bold text-amber-300">{profile?.gems ?? 0}</span>
              <span className="text-xs uppercase text-amber-200/60">gems</span>
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
              className="rounded-md border border-amber-900/40 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800">
              Sair
            </button>
          </div>
        </header>

        <h1 className="mt-12 text-center font-serif text-5xl font-bold tracking-wider text-amber-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
          Sombras de Eldoria — Tower Defense
        </h1>
        <p className="mt-2 text-center italic text-amber-100/60">As trevas avançam. Defenda o reino.</p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <MenuButton to="/play" label="Jogar" icon="⚔️" desc="Iniciar campanha" primary />
          <MenuButton to="/missions" label="Missões" icon="📋" desc="Objetivos e recompensas" />
          <MenuButton to="/shop" label="Loja de Upgrades" icon="🛒" desc="Gaste seus gems" />
          <MenuButton to="/ranking" label="Ranking Global" icon="🏆" desc="Top 20 heróis" />
          <MenuButton to="/menu" label={`Recorde: ${profile?.high_score ?? 0}`} icon="📜" desc="Sua maior pontuação" disabled />
        </div>
      </div>
    </div>
  );
}

function MenuButton({ to, label, icon, desc, primary, disabled }: { to: string; label: string; icon: string; desc: string; primary?: boolean; disabled?: boolean }) {
  const cls = `group relative flex items-center gap-4 rounded-xl border p-5 transition ${
    primary
      ? "border-amber-500/60 bg-gradient-to-br from-amber-700/40 to-amber-900/20 hover:from-amber-600/50 hover:to-amber-800/30"
      : "border-amber-900/40 bg-black/40 hover:border-amber-700/60 hover:bg-zinc-900/60"
  } ${disabled ? "pointer-events-none opacity-60" : ""}`;
  const inner = (
    <>
      <span className="text-3xl">{icon}</span>
      <span className="flex-1">
        <span className="block font-serif text-xl font-bold text-amber-200">{label}</span>
        <span className="block text-xs text-amber-200/60">{desc}</span>
      </span>
    </>
  );
  if (disabled) return <div className={cls}>{inner}</div>;
  return <Link to={to} className={cls}>{inner}</Link>;
}

function Loading() {
  return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200 font-serif">Carregando…</div>;
}
