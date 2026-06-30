import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UtensilsCrossed, CheckCircle2, Users, Home, TrendingUp, AlertTriangle,
  Ban, MapPin, ArrowRight, ScanFace, UserCheck,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import { relatoriosApi } from "@/lib/api/relatorios.api";
import { retiradasApi } from "@/lib/api/retiradas.api";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: kpis } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => relatoriosApi.dashboard(),
    refetchInterval: 30_000,
  });

  const { data: evolucao } = useQuery({
    queryKey: ["evolucao-mensal"],
    queryFn: () => relatoriosApi.evolucaoMensal(),
  });

  const { data: bairros } = useQuery({
    queryKey: ["bairros"],
    queryFn: () => relatoriosApi.bairros(),
  });

  const { data: famFrequentes } = useQuery({
    queryKey: ["familias-frequentes"],
    queryFn: () => relatoriosApi.familiasFrequentes(),
  });

  const { data: listaHoje } = useQuery({
    queryKey: ["lista-diaria"],
    queryFn: () => retiradasApi.listaDiaria(),
    refetchInterval: 30_000,
  });

  const { data: distribuicaoSemana } = useQuery({
    queryKey: ["distribuicao-semana"],
    queryFn: () => relatoriosApi.distribuicaoSemana(),
    refetchInterval: 60_000,
  });

  const { data: horariosPico } = useQuery({
    queryKey: ["horarios-pico"],
    queryFn: () => relatoriosApi.horariosPico(),
    refetchInterval: 60_000,
  });

  const limiteDiario = kpis?.limiteDiario ?? 100;
  const entreguesHoje = kpis?.entreguesHoje ?? 0;
  const disponiveis = kpis?.disponiveisHoje ?? limiteDiario;
  const cotaPct = Math.round((entreguesHoje / limiteDiario) * 100);

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bom dia 👋"
        subtitle="Visão geral da distribuição de hoje."
        actions={
          <>
            <Link to="/retirada"><Button className="gap-2"><UtensilsCrossed className="h-4 w-4" /> Nova retirada</Button></Link>
            <Link to="/reconhecimento"><Button variant="outline" className="gap-2"><ScanFace className="h-4 w-4" /> Validar facial</Button></Link>
          </>
        }
      />

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={UtensilsCrossed} label="Disponíveis hoje" value={disponiveis} hint={`de ${limiteDiario}`} accent="primary" delay={0} />
        <StatCard icon={CheckCircle2} label="Entregues" value={entreguesHoje} hint="atualizado agora" accent="accent" delay={0.05} />
        <StatCard icon={Users} label="Fila virtual" value={kpis?.filaVirtual ?? "—"} hint="aguardando" accent="muted" delay={0.1} />
        <StatCard icon={Home} label="Famílias atendidas" value={kpis?.familiasAtendidas ?? "—"} hint="únicas hoje" accent="primary" delay={0.15} />
        <StatCard icon={TrendingUp} label="Média semanal" value={kpis?.mediaSemanal ?? "—"} hint="quentinhas/dia" accent="muted" delay={0.2} />
        <StatCard icon={CheckCircle2} label="Comparecimento" value={kpis ? `${kpis.comparecimento}%` : "—"} hint="esta semana" accent="accent" delay={0.25} />
        <StatCard icon={Ban} label="Tentativas duplicadas" value={kpis?.tentativasDuplicadas ?? "—"} hint="hoje" accent="destructive" delay={0.3} />
        <Link to="/beneficiarios" search={{ biometria: "verificada" }}>
          <StatCard icon={UserCheck} label="Cadastros completos" value={kpis?.cadastrosCompletos ?? "—"} hint="com biometria" accent="primary" delay={0.35} />
        </Link>
        <Link to="/beneficiarios" search={{ biometria: "pendente" }}>
          <StatCard icon={AlertTriangle} label="Cadastros incompletos" value={kpis?.cadastrosIncompletos ?? "—"} hint="sem biometria" accent="warning" delay={0.4} />
        </Link>
      </div>

      {/* Cota progress */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Cota diária</div>
              <div className="text-xs text-muted-foreground">
                {entreguesHoje} de {limiteDiario} quentinhas entregues
              </div>
            </div>
            <Badge variant={cotaPct > 85 ? "destructive" : "secondary"}>{cotaPct}%</Badge>
          </div>
          <Progress value={cotaPct} className="h-3" />
        </CardContent>
      </Card>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Distribuição da semana</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={distribuicaoSemana ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="entregues" stackId="a" fill="var(--chart-1)" radius={[6, 6, 0, 0]} name="Entregues" />
                <Bar dataKey="ausentes" stackId="a" fill="var(--chart-2)" radius={[6, 6, 0, 0]} name="Ausentes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horários de pico</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <AreaChart data={horariosPico ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="qtd" stroke="var(--chart-2)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolução mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={evolucao ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Famílias mais frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(famFrequentes ?? []).map((f, i) => (
              <div key={f.familiaId} className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{f.nome}</div>
                  <Progress value={(f.retiradas / ((famFrequentes?.[0]?.retiradas ?? 1))) * 100} className="mt-1 h-1.5" />
                </div>
                <div className="text-sm font-bold tabular-nums">{f.retiradas}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bairros + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Frequência por bairro</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={bairros ?? []} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="bairro" stroke="var(--muted-foreground)" fontSize={12} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="familias" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                { icon: AlertTriangle, color: "text-warning-foreground bg-warning/30", titulo: "Cota próxima do limite", texto: `Restam ${disponiveis} quentinhas para hoje.` },
                { icon: Ban, color: "text-destructive bg-destructive/10", titulo: "Tentativas duplicadas", texto: `${kpis?.tentativasDuplicadas ?? 0} tentativa(s) bloqueada(s) hoje.` },
                { icon: Users, color: "text-primary bg-primary/10", titulo: "Cadastros incompletos", texto: `${kpis?.cadastrosIncompletos ?? 0} beneficiário(s) sem biometria.`, link: "/beneficiarios" as const, search: { biometria: "pendente" } },
              ] satisfies { icon: typeof AlertTriangle; color: string; titulo: string; texto: string; link?: "/beneficiarios"; search?: { biometria: string } }[]
            ).map((a, i) => {
              const I = a.icon;
              const content = (
                <div className="flex gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${a.color}`}>
                    <I className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{a.titulo}</div>
                    <div className="text-xs text-muted-foreground">{a.texto}</div>
                  </div>
                </div>
              );
              return a.link ? (
                <Link key={i} to={a.link} search={a.search}>{content}</Link>
              ) : (
                <div key={i}>{content}</div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent withdrawals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Últimas retiradas</CardTitle>
          <Link to="/lista-diaria"><Button variant="ghost" size="sm" className="gap-1">Ver tudo <ArrowRight className="h-4 w-4" /></Button></Link>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2.5 font-medium">Beneficiário</th>
                  <th className="px-5 py-2.5 font-medium">Bairro</th>
                  <th className="px-5 py-2.5 font-medium">Qtd</th>
                  <th className="px-5 py-2.5 font-medium">Horário</th>
                  <th className="px-5 py-2.5 font-medium">Operador</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(listaHoje?.retiradas ?? []).slice(0, 8).map((w) => (
                  <tr key={w.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-2.5 font-medium">{w.beneficiario.nome}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{w.beneficiario.bairro}</td>
                    <td className="px-5 py-2.5 tabular-nums">{w.quantidade}</td>
                    <td className="px-5 py-2.5 tabular-nums">{new Date(w.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{w.operador.nome}</td>
                    <td className="px-5 py-2.5">
                      {w.status === "ENTREGUE" ? (
                        <Badge className="bg-primary text-primary-foreground">Entregue</Badge>
                      ) : w.status === "DUPLICADO_BLOQUEADO" ? (
                        <Badge variant="destructive">Bloqueado</Badge>
                      ) : (
                        <Badge variant="secondary">Ausente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {!listaHoje && (
                  <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
