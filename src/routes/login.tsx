import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Sombras de Eldoria" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session) navigate({ to: "/menu" }); }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!nickname.trim() || nickname.trim().length < 3 || nickname.trim().length > 20) { toast.error("Nickname precisa ter entre 3 e 20 caracteres"); return; }
        // Check nickname availability
        const { data: exists } = await supabase.from("profiles").select("id").eq("nickname", nickname).maybeSingle();
        if (exists) { toast.error("Esse nickname já está em uso"); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { nickname: nickname.trim() },
            emailRedirectTo: `${window.location.origin}/menu`,
          },
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Conta criada! Verifique seu e-mail (ou entre direto se confirmação estiver desabilitada).");
        // Try immediate sign-in (works if email auto-confirm is on)
        const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
        if (sErr) {
          toast.message("Confirme o e-mail antes de entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); return; }
      }
    } finally { setBusy(false); }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-black text-amber-200">Carregando…</div>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-black via-zinc-950 to-zinc-900 px-4">
      <Toaster />
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,200,100,0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(180,80,255,0.1), transparent 50%)" }} />
      <div className="relative w-full max-w-md rounded-xl border border-amber-900/40 bg-black/70 p-8 shadow-2xl backdrop-blur">
        <h1 className="text-center font-serif text-3xl font-bold tracking-wide text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Sombras de Eldoria
        </h1>
        <p className="mt-1 text-center text-sm text-amber-100/60 italic">
          {mode === "signin" ? "Entre no reino" : "Forje sua lenda"}
        </p>

        <div className="mt-6 flex gap-2 rounded-lg bg-zinc-900/60 p-1">
          {(["signin", "signup"] as const).map(m => (
            <button key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                mode === m ? "bg-amber-700 text-white shadow" : "text-amber-200/70 hover:text-amber-100"
              }`}>
              {m === "signin" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/70">Nickname</label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
                maxLength={20}
                className="mt-1 w-full rounded-md border border-amber-900/40 bg-zinc-950 px-3 py-2 text-amber-100 outline-none focus:border-amber-600"
                placeholder="Cavaleiro Sombrio"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/70">E-mail</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="mt-1 w-full rounded-md border border-amber-900/40 bg-zinc-950 px-3 py-2 text-amber-100 outline-none focus:border-amber-600"
              placeholder="voce@eldoria.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/70">Senha</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="mt-1 w-full rounded-md border border-amber-900/40 bg-zinc-950 px-3 py-2 text-amber-100 outline-none focus:border-amber-600"
              placeholder="••••••"
            />
          </div>
          <button
            type="submit" disabled={busy}
            className="mt-2 w-full rounded-md bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2.5 font-bold text-white shadow-lg transition hover:from-amber-500 hover:to-amber-700 disabled:opacity-50">
            {busy ? "Aguarde…" : mode === "signin" ? "Entrar no Reino" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
