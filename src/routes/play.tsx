import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { useMissions } from "@/hooks/useMission";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({
    meta: [
      { title: "Jogar — Sombras de Eldoria Tower Defense" },
      { name: "description", content: "Inicie a campanha de Sombras de Eldoria. Posicione torres, ative upgrades e enfrente hordas crescentes em estágios procedurais." },
      { property: "og:title", content: "Jogar Sombras de Eldoria — Campanha Tower Defense" },
      { property: "og:description", content: "Posicione torres, ative upgrades e enfrente hordas crescentes em estágios procedurais." },
      { property: "og:url", content: "https://sombrasdeeldoria.lovable.app/play" },
    ],
    links: [{ rel: "canonical", href: "https://sombrasdeeldoria.lovable.app/play" }],
  }),
});

function PlayPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, levels, multipliers, refresh: refreshProfile } = useUpgrades(user?.id);
  const { submitResult: submitMission } = useMissions(user?.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sentBootstrapRef = useRef(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !profile || sentBootstrapRef.current) return;
    const send = () => {
      iframe.contentWindow?.postMessage({
        type: "td:bootstrap",
        nickname: profile.nickname,
        gems: profile.gems,
        multipliers,
        towerUpgrades: levels,
      }, window.location.origin);
      sentBootstrapRef.current = true;
    };
    send();
    iframe.addEventListener("load", send);
    return () => iframe.removeEventListener("load", send);
  }, [profile, levels, multipliers]);

  useEffect(() => {
    if (!profile) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "td:update", nickname: profile.nickname, gems: profile.gems,
    }, window.location.origin);
  }, [profile?.gems, profile?.nickname]);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "td:stageComplete") {
        const result = await submitMission({
          wave:              Number(d.wave) | 0,
          gold:              Number(d.gold) | 0,
          victory:           !!d.victory,
          stageId:           Number(d.stageId) | 0,
          phaseIndex:        Number(d.phaseIndex) | 0,
          tookDamage:        !!d.tookDamage,
          towersUsed:        Number(d.towersUsed) | 0,
          phaseSeconds:      Number(d.phaseSeconds) | 0,
          enemiesKilled:     Number(d.enemiesKilled) | 0,
          goldSpent:         Number(d.goldSpent) | 0,
          usedUpgrade:       !!d.usedUpgrade,
          stageComplete:     !!d.stageComplete,
          allPhasesNoDamage: !!d.allPhasesNoDamage,
        });
        if (result?.earned && result.earned > 0) toast.success(`+${result.earned} 💎`);
        if (result?.missionsEarned?.length) {
          for (const m of result.missionsEarned) {
            toast.success(`${m.icon} ${m.title} — +${m.gems} 💎`);
          }
        }
        refreshProfile();
      } else if (d.type === "td:exit") {
        navigate({ to: "/menu" });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [submitMission, refreshProfile, navigate]);

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      <Toaster />
      <h1 className="sr-only">Jogar Sombras de Eldoria — Campanha Tower Defense</h1>
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2 text-xs text-amber-200 border-b border-amber-900/30">
        <Link to="/menu" className="hover:text-amber-100">← Menu</Link>
        <span className="font-serif">{profile?.nickname}</span>
        <span>💎 <span className="font-bold text-amber-300">{profile?.gems ?? 0}</span></span>
      </div>
      <iframe
        ref={iframeRef}
        src="/game.html"
        title="Sombras de Eldoria"
        className="flex-1 w-full border-0 block mx-auto"
        style={{ display: "block", margin: "0 auto" }}
      />
    </div>
  );
}
