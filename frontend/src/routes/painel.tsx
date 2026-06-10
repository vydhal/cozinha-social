import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, ArrowLeft } from "lucide-react";
import { filaApi, type FilaEntrada, type PainelPublico } from "@/lib/api/fila.api";
import { wsUrl } from "@/lib/api/client";

export const Route = createFileRoute("/painel")({ component: PainelTV });

function PainelTV() {
  const [painel, setPainel] = useState<PainelPublico>({ chamados: [], proximas: [] });

  const carregar = useCallback(async () => {
    try {
      const data = await filaApi.painel();
      if (data) setPainel(data);
    } catch { /* no-auth endpoint, safe */ }
  }, []);

  useEffect(() => {
    carregar();

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl("/fila/ws"));
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "FILA_UPDATE") carregar();
        } catch {}
      };
    } catch {}

    const interval = setInterval(carregar, 10_000);
    return () => { clearInterval(interval); ws?.close(); };
  }, [carregar]);

  const { chamados, proximas } = painel;

  return (
    <div className="min-h-svh bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-bold">Mesa do Bem</div>
              <div className="text-xs uppercase tracking-widest opacity-80">Painel de chamada</div>
            </div>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/25">
            <ArrowLeft className="h-4 w-4" />Sair do painel
          </Link>
        </header>

        <section className="mb-10">
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">Chamando agora</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {chamados.length === 0 && (
              <div className="rounded-3xl bg-white/10 p-10 text-center text-lg backdrop-blur">
                Aguardando próxima chamada…
              </div>
            )}
            <AnimatePresence>
              {chamados.map(c => (
                <motion.div
                  key={c.id}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="rounded-3xl bg-white p-8 text-foreground shadow-2xl"
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Senha</div>
                  <div className="mt-1 text-7xl font-extrabold tracking-tight text-primary tabular-nums sm:text-8xl">
                    {c.senha}
                  </div>
                  <div className="mt-3 truncate text-2xl font-semibold">{c.beneficiario.nome}</div>
                  <div className="text-sm text-muted-foreground">Dirija-se ao guichê de entrega</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">Próximas senhas</div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <AnimatePresence>
              {proximas.map(p => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl bg-white/15 p-4 text-center backdrop-blur"
                >
                  <div className="text-3xl font-bold tabular-nums">{p.senha}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <footer className="mt-12 text-center text-sm opacity-80">Aqui há lugar para todos.</footer>
      </div>
    </div>
  );
}
