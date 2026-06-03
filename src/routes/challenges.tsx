import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useChallenges, type ChallengeRow } from "@/hooks/useChallenges";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/challenges")({
  component: ChallengesPage,
  head: () => ({
    meta: [
      { title: "Desafios — Sombras de Eldoria Tower Defense" },
      { name: "description", content: "Desafie outros heróis em duelos assíncronos no Tower Defense de Sombras de Eldoria e acompanhe placares ao vivo." },
      { property: "og:title", content: "Desafios PvP — Sombras de Eldoria" },
      { property: "og:description", content: "Duelos assíncronos com placar ao vivo." },
      { property: "og:url", content: "https://sombrasdeeldoria.lovable.app/challenges" },
    ],
    links: [{ rel: "canonical", href: "https://sombrasdeeldoria.lovable.app/challenges" }],
  }),
});

export const STAGE_NAMES: Record<number, string> = {
  0: "Floresta Sombria",
  1: "Ruínas de Pedra",
  2: "Portão das Trevas",
  3: "Cavernas Profundas",
  4: "Trono do Senhor",
  5: "Vila Velha",
};

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ChallengesPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { challenges, loading: chLoading, pendingCount, acceptChallenge, declineChallenge } = useChallenges(user?.id);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const pending = useMemo(
    () => challenges.filter((c) => c.status === "pending" && c.opponent_id === user?.id),
    [challenges, user?.id],
  );
  const ongoing = useMemo(
    () => challenges.filter((c) => c.status === "accepted" || c.status === "in_progress"),
    [challenges],
  );
  const history = useMemo(
    () => challenges.filter((c) => c.status === "completed" || c.status === "declined" || c.status === "expired"),
    [challenges],
  );

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-amber-100">
      <Toaster />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
          <Link to="/menu" className="text-sm text-amber-300/80 hover:text-amber-200">← Menu</Link>
          <h1 className="font-serif text-2xl font-bold text-amber-200">⚔️ Desafios</h1>
          <span className="w-16" />
        </header>

        <Tabs defaultValue="pending" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-950 border border-amber-900/40">
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
              Pendentes {pendingCount > 0 && <Badge className="ml-2 bg-red-600 text-white">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="ongoing" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
              Em Andamento
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {chLoading && <div className="text-amber-200/60 italic text-sm">Carregando…</div>}
            {!chLoading && pending.length === 0 && <Empty text="Nenhum desafio pendente." />}
            {pending.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-amber-900/40 bg-black/40 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-900/40 font-serif text-lg text-amber-200">
                  {c.challenger_nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-serif text-amber-200">{c.challenger_nickname} te desafiou</div>
                  <div className="text-xs text-amber-200/60">Estágio: {STAGE_NAMES[c.stage_id] ?? `#${c.stage_id}`} · expira em {timeLeft(c.expires_at)}</div>
                </div>
                <Button size="sm" className="bg-amber-700 hover:bg-amber-600 text-amber-50"
                  onClick={async () => { try { await acceptChallenge(c.id); toast.success("Desafio aceito!"); } catch (e: any) { toast.error(e.message); } }}>
                  Aceitar
                </Button>
                <Button size="sm" variant="outline" className="border-amber-900/60 text-amber-200 hover:bg-amber-950/40"
                  onClick={async () => { try { await declineChallenge(c.id); toast.success("Desafio recusado"); } catch (e: any) { toast.error(e.message); } }}>
                  Recusar
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="ongoing" className="mt-4 space-y-3">
            {!chLoading && ongoing.length === 0 && <Empty text="Nenhum desafio em andamento." />}
            {ongoing.map((c) => <OngoingCard key={c.id} c={c} meId={user.id} navigate={navigate} />)}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {!chLoading && history.length === 0 && <Empty text="Nenhum histórico ainda." />}
            {history.map((c) => {
              const iWon = c.winner_id === user.id;
              const iLost = c.status === "completed" && c.winner_id && c.winner_id !== user.id;
              const myScore = c.challenger_id === user.id ? c.challenger_score : c.opponent_score;
              const oppScore = c.challenger_id === user.id ? c.opponent_score : c.challenger_score;
              const oppName = c.challenger_id === user.id ? c.opponent_nickname : c.challenger_nickname;
              return (
                <div key={c.id} className="rounded-lg border border-amber-900/40 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-xs text-amber-200/60">
                    <span>{STAGE_NAMES[c.stage_id] ?? `Estágio #${c.stage_id}`}</span>
                    <span className="uppercase">{c.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className={`font-serif ${iWon ? "text-amber-300 font-bold" : ""}`}>Você: {myScore ?? "—"}</div>
                    <div className="text-amber-200/40">vs</div>
                    <div className={`font-serif ${iLost ? "text-amber-300 font-bold" : ""}`}>{oppName}: {oppScore ?? "—"}</div>
                  </div>
                  {iWon && <div className="mt-2 text-center text-sm text-amber-300">🏆 Vitória — +30 💎</div>}
                  {c.status === "declined" && <div className="mt-2 text-center text-sm italic text-amber-200/50">Desafio recusado</div>}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-amber-900/30 bg-black/30 px-4 py-8 text-center italic text-amber-200/50">{text}</div>;
}

interface LiveData {
  challenger_score: number | null;
  opponent_score: number | null;
  challenger_wave: number | null;
  opponent_wave: number | null;
  status: string;
}

function OngoingCard({ c, meId, navigate }: { c: ChallengeRow; meId: string; navigate: ReturnType<typeof useNavigate> }) {
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<LiveData>({
    challenger_score: c.challenger_score,
    opponent_score: c.opponent_score,
    challenger_wave: c.challenger_wave,
    opponent_wave: c.opponent_wave,
    status: c.status,
  });

  useEffect(() => {
    if (!expanded) return;
    const channel = supabase
      .channel(`challenge-live-${c.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "challenges", filter: `id=eq.${c.id}` },
        (payload) => {
          const n = payload.new as any;
          setLive({
            challenger_score: n.challenger_score,
            opponent_score: n.opponent_score,
            challenger_wave: n.challenger_wave,
            opponent_wave: n.opponent_wave,
            status: n.status,
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [expanded, c.id]);

  const iAmChallenger = c.challenger_id === meId;
  const mySubmitted = iAmChallenger ? c.challenger_score !== null : c.opponent_score !== null;

  return (
    <div className="rounded-lg border border-amber-900/40 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-serif text-amber-200">{c.challenger_nickname} <span className="text-amber-200/40">vs</span> {c.opponent_nickname}</div>
          <div className="text-xs text-amber-200/60">{STAGE_NAMES[c.stage_id] ?? `Estágio #${c.stage_id}`}</div>
        </div>
        {mySubmitted ? (
          <span className="text-xs italic text-amber-300 animate-pulse">Aguardando adversário…</span>
        ) : (
          <Button size="sm" className="bg-amber-700 hover:bg-amber-600 text-amber-50"
            onClick={() => navigate({ to: "/play", search: { challengeId: c.id, stageId: c.stage_id } as any })}>
            Jogar agora
          </Button>
        )}
      </div>
      <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs text-amber-300/70 hover:text-amber-200">
        {expanded ? "▲ Ocultar placar" : "▼ Ver placar ao vivo"}
      </button>
      {expanded && (
        <div className="mt-3 overflow-hidden rounded border border-amber-900/30">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-amber-300/70">
              <tr><th className="px-2 py-1 text-left">Jogador</th><th className="px-2 py-1">Onda</th><th className="px-2 py-1">Score</th></tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-900"><td className="px-2 py-1">{c.challenger_nickname}</td><td className="px-2 py-1 text-center">{live.challenger_wave ?? "—"}</td><td className="px-2 py-1 text-center font-mono">{live.challenger_score ?? "—"}</td></tr>
              <tr className="border-t border-zinc-900"><td className="px-2 py-1">{c.opponent_nickname}</td><td className="px-2 py-1 text-center">{live.opponent_wave ?? "—"}</td><td className="px-2 py-1 text-center font-mono">{live.opponent_score ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
