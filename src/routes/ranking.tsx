import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({
    meta: [
      { title: "Ranking Global — Sombras de Eldoria Tower Defense" },
      { name: "description", content: "Veja os 20 melhores defensores do reino no ranking global de Sombras de Eldoria e dispute as primeiras posições." },
      { property: "og:title", content: "Ranking Global — Top 20 Heróis de Sombras de Eldoria" },
      { property: "og:description", content: "Veja os 20 melhores defensores do reino e dispute as primeiras posições." },
      { property: "og:url", content: "https://sombrasdeeldoria.lovable.app/ranking" },
    ],
    links: [{ rel: "canonical", href: "https://sombrasdeeldoria.lovable.app/ranking" }],
  }),
});

interface Row { id: string; nickname: string; high_score: number; }
interface MyRank { nickname: string; high_score: number; rank: number; }

function RankingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<MyRank | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [top, mine] = await Promise.all([
        supabase.rpc("get_top_rankings", { limit_count: 20 }),
        supabase.rpc("get_my_rank"),
      ]);
      if (cancelled) return;
      setRows((top.data ?? []) as Row[]);
      const myRow = (mine.data ?? [])[0] as MyRank | undefined;
      if (myRow && !(top.data ?? []).find((r: any) => r.id === user.id)) {
        setMe(myRow);
      } else {
        setMe(null);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <Link to="/menu" className="text-sm text-amber-300/80 hover:text-amber-200">← Menu</Link>
          <h1 className="font-serif text-2xl font-bold text-amber-200">🏆 Ranking Global</h1>
          <span className="w-16" />
        </header>

        <div className="mt-6 overflow-hidden rounded-lg border border-amber-900/40 bg-black/40">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-amber-300/70">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                <th className="px-3 py-2 text-left font-semibold">Herói</th>
                <th className="px-3 py-2 text-right font-semibold">Recorde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-zinc-900 ${r.id === user.id ? "bg-amber-900/30 text-amber-200" : ""}`}>
                  <td className="px-3 py-2 font-bold">{i + 1}</td>
                  <td className="px-3 py-2">{r.nickname}{r.id === user.id && <span className="ml-2 text-xs text-amber-400">(você)</span>}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.high_score}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center italic text-amber-200/50">Nenhum recorde ainda. Seja o primeiro!</td></tr>
              )}
              {me && (
                <tr className="border-t-2 border-amber-700 bg-amber-900/40 text-amber-200">
                  <td className="px-3 py-2 font-bold">{me.rank}</td>
                  <td className="px-3 py-2">{me.nickname} <span className="text-xs text-amber-400">(você)</span></td>
                  <td className="px-3 py-2 text-right font-mono">{me.high_score}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
