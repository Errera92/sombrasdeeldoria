import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sombras de Eldoria — Tower Defense de Fantasia Medieval" },
      { name: "description", content: "Defenda o reino contra hordas das trevas neste tower defense de fantasia medieval sombria. Estágios desafiadores, torres únicas e upgrades épicos." },
      { property: "og:title", content: "Sombras de Eldoria — Tower Defense de Fantasia Medieval" },
      { property: "og:description", content: "Defenda o reino contra hordas das trevas neste tower defense de fantasia medieval sombria." },
      { property: "og:url", content: "https://sombrasdeeldoria.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://sombrasdeeldoria.lovable.app/" }],
  }),
});

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200 font-serif">Carregando…</div>;
  }
  return <Navigate to={session ? "/menu" : "/login"} />;
}
