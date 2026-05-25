import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sombras de Eldoria — Tower Defense" },
      { name: "description", content: "Defenda a base contra as hordas das trevas em um Tower Defense de fantasia épica medieval sombria." },
    ],
  }),
});

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200 font-serif">Carregando…</div>;
  }
  return <Navigate to={session ? "/menu" : "/login"} />;
}
