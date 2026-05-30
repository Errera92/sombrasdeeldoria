import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useMissions } from "@/hooks/useMission";
import { CATEGORY_LABELS, CATEGORY_COLORS, type MissionProgress } from "@/lib/missions";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/missions")({
  component: MissionsPage,
  head: () => ({ meta: [{ title: "Missões — Sombras de Eldoria" }] }),
});

function MissionsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile } = useUpgrades(user?.id);
  const { missions, loading: mLoading } = useMissions(user?.id);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const grouped = useMemo(() => {
    const g: Record<string, MissionProgress[]> = {};
    for (const m of missions) (g[m.category] ||= []).push(m);
    for (const cat of Object.keys(g)) {
      g[cat].sort((a, b) => {
        const aDone = isDone(a) ? 1 : 0;
        const bDone = isDone(b) ? 1 : 0;
        return aDone - bDone;
      });
    }
    return g;
  }, [missions]);

  if (loading || !user) {
    return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200 font-serif">Carregando…</div>;
  }

  const categoryOrder = ["stage", "phase", "combat", "economy", "mastery"];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <Toaster />
      <div className="relative mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <Link to="/menu" className="text-sm text-amber-300/80 hover:text-amber-100">← Menu</Link>
          <h1 className="font-serif text-3xl font-bold text-amber-200">📋 Missões</h1>
          <div className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-black/50 px-3 py-2">
            <span className="text-lg">💎</span>
            <span className="font-bold text-amber-300">{profile?.gems ?? 0}</span>
          </div>
        </header>

        {mLoading ? (
          <div className="mt-10 text-center text-amber-200/60">Carregando missões…</div>
        ) : missions.length === 0 ? (
          <div className="mt-10 text-center text-amber-200/60">Nenhuma missão disponível.</div>
        ) : (
          <div className="mt-8 space-y-8">
            {categoryOrder.filter(c => grouped[c]?.length).map(cat => (
              <section key={cat}>
                <h2 className="mb-3 font-serif text-xl font-bold text-amber-200">{CATEGORY_LABELS[cat] ?? cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {grouped[cat].map(m => (
                    <MissionCard key={m.id} m={m} categoryClass={CATEGORY_COLORS[cat] ?? ""} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function isDone(m: MissionProgress) {
  return !m.repeatable && m.completedAt !== null;
}

function MissionCard({ m, categoryClass }: { m: MissionProgress; categoryClass: string }) {
  const done = isDone(m);
  const repeatable = m.repeatable;
  const completed = m.completedAt !== null || m.timesCompleted > 0;
  const hasProgress = m.conditionValue > 1;
  const ratio = Math.min(1, m.progress / Math.max(1, m.conditionValue));

  const borderCls = done
    ? "border-emerald-600/70 bg-emerald-950/30 opacity-70"
    : repeatable && completed
    ? "border-blue-500/70 bg-blue-950/30"
    : categoryClass;

  return (
    <div className={`relative rounded-lg border p-4 ${borderCls}`}>
      <div className="flex items-start gap-3">
        <div className="text-3xl">{m.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-serif text-lg font-bold text-amber-100">{m.title}</h3>
            {done && (
              <span className="rounded bg-emerald-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-100">✔ Concluída</span>
            )}
            {repeatable && (
              <span className="rounded bg-blue-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-100">🔄 {m.timesCompleted}×</span>
            )}
          </div>
          <p className="mt-1 text-sm text-amber-100/70">{m.description}</p>

          {hasProgress && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded bg-black/50">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-amber-200/60">
                {m.progress} / {m.conditionValue}
              </div>
            </div>
          )}

          <div className="mt-2 text-sm font-bold text-amber-300">💎 +{m.gemsReward}</div>
        </div>
      </div>
    </div>
  );
}
