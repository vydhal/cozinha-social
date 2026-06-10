import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Ticket, Clock, UserCheck, UserX, Tv, Search, Printer,
  CheckCheck, PhoneCall, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { filaApi, type FilaEntrada, type FilaState } from "@/lib/api/fila.api";
import { beneficiariosApi } from "@/lib/api/beneficiarios.api";
import { wsUrl } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/_app/fila")({ component: Fichas });

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(s: FilaEntrada["status"]) {
  switch (s) {
    case "AGUARDANDO": return <Badge variant="secondary">Aguardando</Badge>;
    case "CHAMADO": return <Badge className="bg-accent text-accent-foreground hover:bg-accent">Chamado</Badge>;
    case "RETIRADO": return <Badge className="bg-primary text-primary-foreground hover:bg-primary">Retirado</Badge>;
    case "AUSENTE": return <Badge variant="destructive">Ausente</Badge>;
  }
}

function imprimirFicha(entrada: FilaEntrada) {
  const b = entrada.beneficiario;
  const agora = new Date();
  const dataExtenso = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const horaEmissao = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const qrData = encodeURIComponent(`MESA-${entrada.senha}-${agora.toISOString().slice(0, 10)}-${entrada.id}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}&margin=4`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha ${entrada.senha}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 8px 10px; background: #fff; color: #000; }
  .center { text-align: center; }
  .dashed { border-top: 1px dashed #000; margin: 8px 0; }
  .org { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .subtitle { font-size: 10px; color: #444; margin-top: 2px; }
  .senha-box { text-align: center; margin: 12px 0 8px; }
  .senha-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #555; }
  .senha-num { font-size: 52px; font-weight: bold; line-height: 1; }
  .row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px; }
  .row-label { color: #555; font-size: 10px; text-transform: uppercase; }
  .row-val { font-weight: bold; max-width: 55mm; text-align: right; word-break: break-word; }
  .qtd-box { text-align: center; margin: 10px 0; }
  .qtd-num { font-size: 28px; font-weight: bold; }
  .qtd-label { font-size: 10px; color: #555; text-transform: uppercase; }
  .qr { text-align: center; margin: 10px 0 8px; }
  .footer { text-align: center; font-size: 10px; color: #444; margin-top: 4px; }
  @media print { @page { margin: 0; size: 80mm auto; } body { padding: 5mm; } }
</style>
</head>
<body>
  <div class="center">
    <div class="org">🍽 MESA DO BEM</div>
    <div class="subtitle">Ficha de Retirada</div>
  </div>

  <div class="dashed"></div>

  <div class="senha-box">
    <div class="senha-label">Senha</div>
    <div class="senha-num">${entrada.senha}</div>
  </div>

  <div class="dashed"></div>

  <div class="row">
    <span class="row-label">Beneficiário</span>
    <span class="row-val">${b.nome}</span>
  </div>
  <div class="row">
    <span class="row-label">Data</span>
    <span class="row-val">${agora.toLocaleDateString("pt-BR")}</span>
  </div>
  <div class="row">
    <span class="row-label">Emissão</span>
    <span class="row-val">${horaEmissao}</span>
  </div>

  <div class="dashed"></div>

  <div class="qtd-box">
    <div class="qtd-num">${b.quentinhasAutorizadas}</div>
    <div class="qtd-label">Quentinha${b.quentinhasAutorizadas > 1 ? "s" : ""} autorizada${b.quentinhasAutorizadas > 1 ? "s" : ""}</div>
  </div>

  <div class="dashed"></div>

  <div class="qr">
    <img src="${qrUrl}" width="110" height="110" alt="QR" />
  </div>

  <div class="footer">
    Apresente esta ficha no momento da retirada.<br>
    Válida somente para ${agora.toLocaleDateString("pt-BR")}.<br>
    <small>${dataExtenso}</small>
  </div>

  <script>
    const img = document.querySelector('img');
    function doPrint() { window.print(); }
    if (img) {
      if (img.complete) doPrint();
      else { img.onload = doPrint; img.onerror = doPrint; }
    } else { doPrint(); }
  <\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) { toast.error("Permita pop-ups para imprimir a ficha."); return; }
  w.document.write(html);
  w.document.close();
}

// ── Componente principal ──────────────────────────────────────────────────────

function Fichas() {
  const [filaState, setFilaState] = useState<FilaState | null>(null);
  const [loading, setLoading] = useState(true);

  // Busca de beneficiário
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [gerando, setGerando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await filaApi.get();
      setFilaState(data);
    } catch {
      // silently fail — WebSocket retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl("/fila/ws"));
      ws.onmessage = (e) => {
        try { if (JSON.parse(e.data).type === "FILA_UPDATE") carregar(); } catch {}
      };
    } catch {}
    const interval = setInterval(carregar, 15_000);
    return () => { clearInterval(interval); ws?.close(); };
  }, [carregar]);

  // Debounce da busca
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (busca.length < 2) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await beneficiariosApi.list({ search: busca, limit: 6 });
        setResultados(res.items);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 350);
  }, [busca]);

  const selecionar = (b: any) => {
    setSelecionado(b);
    setBusca("");
    setResultados([]);
  };

  const gerarFicha = async () => {
    if (!selecionado) return;
    setGerando(true);
    try {
      const entrada = await filaApi.entrar(selecionado.id);
      await carregar();
      imprimirFicha(entrada);
      setSelecionado(null);
      toast.success(`Ficha ${entrada.senha} gerada para ${entrada.beneficiario.nome}.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao gerar ficha";
      toast.error(msg);
    } finally {
      setGerando(false);
    }
  };

  const chamar = async (id: string) => {
    try { await filaApi.chamar(id); await carregar(); toast.success("Senha chamada no painel."); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao chamar"); }
  };

  const concluir = async (id: string) => {
    try { await filaApi.concluir(id); await carregar(); toast.success("Retirada confirmada."); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao concluir"); }
  };

  const ausente = async (id: string) => {
    try { await filaApi.ausente(id); await carregar(); toast("Marcada como ausente."); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Erro ao marcar"); }
  };

  const queue = filaState?.fila ?? [];
  const stats = filaState?.stats;
  const chamados = queue.filter(q => q.status === "CHAMADO");
  const emitidas = stats?.emitidas ?? 0;
  const restantes = stats?.restantes ?? 0;
  const limiteDiario = stats?.limiteDiario ?? 100;
  const limiteAtingido = restantes === 0 && emitidas > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fichas"
        subtitle="Emita fichas numeradas e gerencie a retirada do dia."
        actions={<Link to="/painel"><Button variant="outline" className="gap-2"><Tv className="h-4 w-4" />Painel público</Button></Link>}
      />

      {/* ── Emitir ficha ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4" />Emitir nova ficha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {selecionado ? (
            <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={selecionado.fotoUrl} />
                <AvatarFallback className="bg-primary/15 text-primary font-bold">
                  {selecionado.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selecionado.nome}</span>
                  {selecionado.status !== "ATIVO" && (
                    <Badge variant={selecionado.status === "BLOQUEADO" ? "destructive" : "secondary"} className="text-xs">
                      {selecionado.status === "PENDENTE" ? "Pendente" : "Bloqueado"}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{selecionado.cpf} · {selecionado.bairro}</div>
                <div className="mt-0.5 text-sm font-medium text-primary">{selecionado.quentinhasAutorizadas} quentinha{selecionado.quentinhasAutorizadas > 1 ? "s" : ""} autorizada{selecionado.quentinhasAutorizadas > 1 ? "s" : ""}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setSelecionado(null)}>Trocar</Button>
                <Button size="sm" className="gap-2" onClick={gerarFicha} disabled={gerando}>
                  {gerando ? <Clock className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                  Gerar e imprimir
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Buscar beneficiário pelo nome ou CPF..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                autoComplete="off"
              />
              {buscando && (
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          )}

          {resultados.length > 0 && !selecionado && (
            <div className="divide-y rounded-xl border bg-popover shadow-lg">
              {resultados.map((b: any) => (
                <button
                  key={b.id}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => selecionar(b)}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={b.fotoUrl} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                      {b.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">{b.nome}</span>
                      {b.status !== "ATIVO" && (
                        <Badge variant={b.status === "BLOQUEADO" ? "destructive" : "secondary"} className="shrink-0 text-[10px] px-1.5 py-0">
                          {b.status === "PENDENTE" ? "Pendente" : "Bloqueado"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{b.cpf} · {b.bairro} · {b.quentinhasAutorizadas} quentinha{b.quentinhasAutorizadas > 1 ? "s" : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Resumo do dia ── */}
      {limiteAtingido && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <Ticket className="h-4 w-4 shrink-0" />
          Limite diário de {limiteDiario} fichas atingido. O admin pode aumentar em Configurações.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KCard label={`Emitidas / ${limiteDiario}`} value={`${emitidas}`} icon={Ticket} />
        <KCard label="Restantes hoje" value={restantes} icon={Clock} />
        <KCard label="Sendo chamados" value={stats?.chamado ?? "—"} icon={PhoneCall} accent />
        <KCard label="Concluídas" value={stats?.retirado ?? "—"} icon={CheckCheck} />
      </div>

      {/* ── Chamando agora ── */}
      {chamados.length > 0 && (
        <Card className="border-2 border-primary/40 bg-primary/5">
          <CardContent className="p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Chamando agora</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {chamados.map(c => (
                <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground animate-pulse-ring">
                    <div className="text-2xl font-bold">{c.senha}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{c.beneficiario.nome}</div>
                    <div className="text-xs text-muted-foreground">{c.beneficiario.quentinhasAutorizadas} quentinha{c.beneficiario.quentinhasAutorizadas > 1 ? "s" : ""}</div>
                  </div>
                  <Button size="sm" onClick={() => concluir(c.id)} className="gap-1 shrink-0">
                    <UserCheck className="h-4 w-4" />Concluir
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lista de fichas do dia ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Fichas do dia</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando fichas...</div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma ficha emitida hoje.</div>
          ) : (
            <ul className="divide-y">
              <AnimatePresence>
                {queue.map((e) => (
                  <motion.li
                    key={e.id} layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-lg font-bold tabular-nums">
                      {e.senha}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{e.beneficiario.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.beneficiario.quentinhasAutorizadas} quentinha{e.beneficiario.quentinhasAutorizadas > 1 ? "s" : ""}
                        {" · "}emitida {new Date(e.horaEntrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {statusBadge(e.status)}
                    <div className="ml-1 flex gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => imprimirFicha(e)} title="Reimprimir ficha">
                        <Printer className="h-4 w-4" />
                      </Button>
                      {e.status === "AGUARDANDO" && (
                        <Button size="sm" variant="outline" onClick={() => chamar(e.id)}>Chamar</Button>
                      )}
                      {e.status === "CHAMADO" && (
                        <Button size="sm" onClick={() => concluir(e.id)}>Concluir</Button>
                      )}
                      {e.status !== "RETIRADO" && e.status !== "AUSENTE" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => ausente(e.id)}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KCard({ label, value, icon: Icon, accent }: { label: string; value: unknown; icon: React.ElementType; accent?: boolean }) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${accent ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{String(value)}</div>
      </div>
    </CardContent></Card>
  );
}
