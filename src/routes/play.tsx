import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpgrades } from "@/hooks/useUpgrades";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({ meta: [{ title: "Jogar — Sombras de Eldoria" }] }),
});

function PlayPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, multipliers, addGems, submitScore } = useUpgrades(user?.id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sentBootstrapRef = useRef(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  // Push bootstrap config to iframe once both profile & iframe are ready.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !profile || sentBootstrapRef.current) return;
    const send = () => {
      iframe.contentWindow?.postMessage({
        type: "td:bootstrap",
        nickname: profile.nickname,
        gems: profile.gems,
        multipliers,
      }, "*");
      sentBootstrapRef.current = true;
    };
    // Try immediately; also bind to load event in case iframe not ready yet.
    send();
    iframe.addEventListener("load", send);
    return () => iframe.removeEventListener("load", send);
  }, [profile, multipliers]);

  // Keep HUD gems live: forward updates whenever profile.gems changes.
  useEffect(() => {
    if (!profile) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "td:update", nickname: profile.nickname, gems: profile.gems,
    }, "*");
  }, [profile?.gems, profile?.nickname]);

  // Listen for game events from the iframe.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "td:stageComplete") {
        const score = Math.max(0, d.score | 0);
        const earned = Math.floor(score / 100);
        if (earned > 0) addGems(earned);
        submitScore(score);
      } else if (d.type === "td:exit") {
        navigate({ to: "/menu" });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [addGems, submitScore, navigate]);

  if (loading || !user) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      <Toaster />
      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2 text-xs text-amber-200 border-b border-amber-900/30">
        <Link to="/menu" className="hover:text-amber-100">← Menu</Link>
        <span className="font-serif">{profile?.nickname}</span>
        <span>💎 <span className="font-bold text-amber-300">{profile?.gems ?? 0}</span></span>
      </div>
      <iframe
        ref={iframeRef}
        src="/game.html"
        title="Sombras de Eldoria"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
