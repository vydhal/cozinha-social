import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, ScanFace, CheckCircle2, Ban, UtensilsCrossed,
  Clock, MapPin, Home, Loader2, CalendarDays, CalendarClock, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { retiradasApi, type RetiradaValidacao, type VinculadoRetirada } from "@/lib/api/retiradas.api";
import { ApiError } from "@/lib/api/client";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/retirada")({
  component: Retirada,
});

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function isToday(d: Date) {
  const today = new Date();
  return toIsoDate(d) === toIsoDate(today);
}

function Retirada() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RetiradaValidacao["beneficiario"][]>([]);
  const [validacao, setValidacao] = useState<RetiradaValidacao | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  // Fluxo de retirada por procuração: depois que A retira, oferecemos retirar
  // as quentinhas dos vinculados (que têm "Pode retirar") que ainda não foram.
  const [procuracao, setProcuracao] = useState<{ anchorNome: string; membros: VinculadoRetirada[] } | null>(null);
  const [procuracaoSel, setProcuracaoSel] = useState<Set<string>>(new Set());
  const [loadingProcuracao, setLoadingProcuracao] = useState(false);

  // Date state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showDateConfirm, setShowDateConfirm] = useState(false);

  const dateIsToday = isToday(selectedDate);
  const dateStr = toIsoDate(selectedDate);

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

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    setCalendarOpen(false);
    if (isToday(day)) {
      setSelectedDate(day);
      setValidacao(null);
    } else {
      setPendingDate(day);
      setShowDateConfirm(true);
    }
  };

  const confirmDateChange = () => {
    if (pendingDate) {
      setSelectedDate(pendingDate);
      setValidacao(null);
    }
    setShowDateConfirm(false);
    setPendingDate(null);
  };

  const selecionar = async (id: string) => {
    setResults([]);
    setQ("");
    try {
      const data = await retiradasApi.validar(id, dateStr);
      setValidacao(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao validar beneficiário");
    }
  };

  const confirmar = async () => {
    if (!validacao) return;
    setLoadingConfirm(true);
    try {
      const anchorNome = validacao.beneficiario.nome;
      await retiradasApi.confirmar(validacao.beneficiario.id, undefined, "MANUAL", dateIsToday ? undefined : dateStr);
      toast.success(`Entrega confirmada para ${anchorNome.split(" ")[0]}.`);

      // Vinculados que ainda não retiraram → oferece retirada por procuração.
      const elegiveis = validacao.validacoes.vinculados.filter((v) => !v.jaRetirou);
      if (elegiveis.length > 0) {
        setProcuracao({ anchorNome, membros: elegiveis });
        setProcuracaoSel(new Set(elegiveis.map((v) => v.id)));
      }
      setValidacao(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao confirmar entrega";
      toast.error(msg);
    } finally {
      setLoadingConfirm(false);
    }
  };

  const confirmarProcuracao = async () => {
    if (!procuracao) return;
    const selecionados = procuracao.membros.filter((m) => procuracaoSel.has(m.id));
    if (selecionados.length === 0) { setProcuracao(null); return; }
    setLoadingProcuracao(true);
    let ok = 0;
    for (const m of selecionados) {
      try {
        await retiradasApi.confirmar(m.id, undefined, "MANUAL", dateIsToday ? undefined : dateStr, procuracao.anchorNome);
        ok++;
      } catch (err) {
        toast.error(`${m.nome.split(" ")[0]}: ${err instanceof ApiError ? err.message : "erro ao retirar"}`);
      }
    }
    if (ok > 0) toast.success(`${ok} retirada(s) por procuração registrada(s) por ${procuracao.anchorNome.split(" ")[0]}.`);
    setLoadingProcuracao(false);
    setProcuracao(null);
  };

  const toggleProcuracao = (id: string) => {
    setProcuracaoSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const b = validacao?.beneficiario ?? null;
  const jaRetirou = validacao?.validacoes.jaRetirou ?? false;
  const quantidade = validacao?.validacoes.quantidade ?? b?.quentinhasAutorizadas ?? 0;
  const vinculados = validacao?.validacoes.vinculados ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Retirada de quentinhas" subtitle="Busque ou valide facialmente para confirmar a entrega." />

      {/* Seletor de data */}
      <Card className={!dateIsToday ? "border-warning/60 bg-warning/5" : ""}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${dateIsToday ? "bg-primary/10 text-primary" : "bg-warning/20 text-warning-foreground"}`}>
            {dateIsToday ? <CalendarDays className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            {dateIsToday ? (
              <div className="font-semibold text-sm">Registrando para hoje</div>
            ) : (
              <div className="font-semibold text-sm text-warning-foreground">Data retroativa — registrando para:</div>
            )}
            <div className={`text-xs mt-0.5 ${dateIsToday ? "text-muted-foreground" : "font-bold text-warning-foreground"}`}>
              {formatDateBR(selectedDate)}
            </div>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-2">
                <CalendarDays className="h-4 w-4" />
                Alterar data
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDaySelect}
                disabled={(day) => day > new Date()}
                defaultMonth={selectedDate}
                locale={ptBR}
              />
              {!dateIsToday && (
                <div className="border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => { setSelectedDate(new Date()); setValidacao(null); setCalendarOpen(false); }}
                  >
                    Voltar para hoje
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de data retroativa */}
      <AlertDialog open={showDateConfirm} onOpenChange={setShowDateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-warning-foreground" />
              Confirmar data retroativa?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você selecionou uma data passada:</p>
                <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-center">
                  <span className="text-base font-bold text-warning-foreground">
                    {pendingDate ? formatDateBR(pendingDate) : ""}
                  </span>
                </div>
                <p>Todas as retiradas registradas nesta sessão serão salvas com essa data. Isso é usado para lançamento retroativo de entregas feitas manualmente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDate(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDateChange}>
              Confirmar — usar esta data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de retirada por procuração (vinculados) */}
      <AlertDialog open={!!procuracao} onOpenChange={(v) => { if (!v && !loadingProcuracao) setProcuracao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Retirar pela família vinculada?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  <span className="font-semibold text-foreground">{procuracao?.anchorNome.split(" ")[0]}</span>{" "}
                  tem direito a retirar a quentinha de:
                </p>
                <div className="divide-y rounded-xl border">
                  {procuracao?.membros.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                      <Checkbox checked={procuracaoSel.has(m.id)} onCheckedChange={() => toggleProcuracao(m.id)} />
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={m.fotoUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {m.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{m.nome}</div>
                        <div className="text-xs text-muted-foreground">{m.cpf}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs">Cada selecionado gera uma retirada própria (1 quentinha), registrada como retirada por {procuracao?.anchorNome.split(" ")[0]}.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingProcuracao} onClick={() => setProcuracao(null)}>
              Não, só a dele
            </AlertDialogCancel>
            <Button className="gap-2" disabled={loadingProcuracao || procuracaoSel.size === 0} onClick={confirmarProcuracao}>
              {loadingProcuracao ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}
              Retirar selecionadas ({procuracaoSel.size})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Busca */}
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
                    <Avatar className="h-10 w-10"><AvatarImage src={r.fotoUrl} /><AvatarFallback className="bg-primary/10 text-primary">{r.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
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
                  <Avatar className="h-20 w-20"><AvatarImage src={b.fotoUrl} /><AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{b.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
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
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Autorizadas</div>
                    <div className="text-3xl font-bold text-primary">{quantidade}</div>
                  </div>
                </div>

                {!dateIsToday && (
                  <AlertBox
                    tone="warning"
                    icon={CalendarClock}
                    title={`Registro para ${selectedDate.toLocaleDateString("pt-BR")}`}
                    message="Esta entrega será salva com a data retroativa selecionada."
                  />
                )}

                {jaRetirou ? (
                  <AlertBox tone="destructive" icon={Ban} title={`Quentinha já retirada em ${selectedDate.toLocaleDateString("pt-BR")}`} message="Esta pessoa já recebeu sua quentinha nesta data. Nova retirada bloqueada." />
                ) : (
                  <AlertBox
                    tone="success"
                    icon={CheckCircle2}
                    title="Liberado para retirada"
                    message={
                      vinculados.length > 0
                        ? `${quantidade} quentinha(s) autorizada(s). Após confirmar, você poderá retirar também pelos vinculados.`
                        : `${quantidade} quentinha(s) autorizada(s).`
                    }
                  />
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setValidacao(null)}>Cancelar</Button>
                  <Button className="flex-1 h-14 text-base gap-2" disabled={!!jaRetirou || loadingConfirm} onClick={confirmar}>
                    {loadingConfirm ? <Loader2 className="h-5 w-5 animate-spin" /> : <UtensilsCrossed className="h-5 w-5" />}
                    {dateIsToday ? "Confirmar entrega" : `Registrar em ${selectedDate.toLocaleDateString("pt-BR")}`}
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
