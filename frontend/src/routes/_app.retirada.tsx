import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, ScanFace, CheckCircle2, AlertTriangle, Ban, UtensilsCrossed, Clock, MapPin, Home, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { retiradasApi, type RetiradaValidacao } from "@/lib/api/retiradas.api";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/_app/retirada")({
  component: Retirada,
});

function Retirada() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RetiradaValidacao["beneficiario"][]>([]);
  const [validacao, setValidacao] = useState<RetiradaValidacao | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const data = await retiradasApi.buscar(q);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const selecionar = async (id: string) => {
    setResults([]);
    setQ("");
    try {
      const data = await retiradasApi.validar(id);
      setValidacao(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao validar beneficiário");
    }
  };

  const confirmar = async () => {
    if (!validacao) return;
    setLoadingConfirm(true);
    try {
      await retiradasApi.confirmar(validacao.beneficiario.id, undefined, "MANUAL");
      toast.success(`Entrega confirmada para ${validacao.beneficiario.nome.split(" ")[0]}.`);
      setValidacao(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao confirmar entrega";
      toast.error(msg);
    } finally {
      setLoadingConfirm(false);
    }
  };

  const b = validacao?.beneficiario ?? null;
  const jaRetirou = validacao?.validacoes.jaRetirou ?? false;
  const familiaJa = validacao?.validacoes.familiaJaRetirou ?? null;
  const quantidadeFamilia = validacao?.validacoes.quantidadeFamilia ?? b?.quentinhasAutorizadas ?? 0;
  const membrosFamilia = validacao?.validacoes.membrosFamilia ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Retirada de quentinhas" subtitle="Busque ou valide facialmente para confirmar a entrega." />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CPF" className="h-14 pl-10 text-lg" autoFocus />
              {loadingSearch && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <Button asChild className="h-14 px-5"><a href="/reconhecimento"><ScanFace className="mr-2 h-5 w-5" />Facial</a></Button>
          </div>

          {results.length > 0 && !validacao && (
            <ul className="divide-y rounded-xl border bg-card">
              {results.map(r => (
                <li key={r.id}>
                  <button onClick={() => selecionar(r.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted">
                    <Avatar className="h-10 w-10"><AvatarImage src={r.fotoUrl} /><AvatarFallback className="bg-primary/10 text-primary">{r.nome.split(" ").map((n: string)=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.nome}</div>
                      <div className="text-xs text-muted-foreground">{r.cpf} · {r.bairro}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {b && (
          <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="h-20 w-20"><AvatarImage src={b.fotoUrl} /><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{b.nome.split(" ").map((n: string)=>n[0]).slice(0,2).join("")}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold">{b.nome}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">CPF {b.cpf}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.bairro}</span>
                      <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{b.pessoasCasa} pessoas</span>
                      {validacao?.ultimaRetirada && (
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Última: {new Date(validacao.ultimaRetirada.data).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {membrosFamilia > 1 ? `Família (${membrosFamilia})` : "Autorizadas"}
                    </div>
                    <div className="text-3xl font-bold text-primary">{quantidadeFamilia}</div>
                    {membrosFamilia > 1 && (
                      <div className="text-[10px] text-muted-foreground">quentinhas</div>
                    )}
                  </div>
                </div>

                {jaRetirou ? (
                  <AlertBox tone="destructive" icon={Ban} title="Quentinha já retirada hoje" message="Esta pessoa já recebeu sua quentinha. Nova retirada bloqueada." />
                ) : familiaJa ? (
                  <AlertBox tone="warning" icon={AlertTriangle} title="Família já contemplada hoje" message={`${familiaJa} (mesmo endereço) já retirou hoje.`} />
                ) : (
                  <AlertBox tone="success" icon={CheckCircle2} title="Liberado para retirada" message={`${b.quentinhasAutorizadas} quentinha(s) autorizada(s).`} />
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setValidacao(null)}>Cancelar</Button>
                  <Button className="flex-1 h-14 text-base gap-2" disabled={!!familiaJa || loadingConfirm} onClick={confirmar}>
                    {loadingConfirm ? <Loader2 className="h-5 w-5 animate-spin" /> : <UtensilsCrossed className="h-5 w-5" />}
                    Confirmar entrega
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!b && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
          Busque uma pessoa ou use o reconhecimento facial para iniciar.
        </CardContent></Card>
      )}
    </div>
  );
}

function AlertBox({ tone, icon: Icon, title, message }: { tone: "success" | "warning" | "destructive"; icon: any; title: string; message: string }) {
  const map = {
    success: "bg-primary/10 text-primary border-primary/30",
    warning: "bg-warning/20 text-warning-foreground border-warning/40",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  } as const;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${map[tone]}`}>
      <Icon className="mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <div className="text-base font-bold">{title}</div>
        <div className="text-sm opacity-90">{message}</div>
      </div>
    </div>
  );
}
