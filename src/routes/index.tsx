import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="h-screen w-screen bg-black">
      <iframe
        src="/game.html"
        title="Sombras de Eldoria"
        className="h-full w-full border-0"
      />
    </div>
  );
}
