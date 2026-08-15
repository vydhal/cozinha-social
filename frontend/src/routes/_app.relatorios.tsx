import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Utensils, TrendingUp, Users, UserX, Percent, FileDown, Printer, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { relatoriosApi } from "@/lib/api/relatorios.api";
import { useSettings, useAuth } from "@/lib/store";

export const Route = createFileRoute("/_app/relatorios")({ component: Relatorios });

function getDateRange(periodo: string, dataInicio?: string, dataFim?: string): { de: Date; ate: Date } {
  const now = new Date();
  if (periodo === "personalizado" && dataInicio && dataFim) {
    return { de: new Date(dataInicio + "T00:00:00"), ate: new Date(dataFim + "T23:59:59") };
  }
  switch (periodo) {
    case "hoje": return { de: new Date(new Date().setHours(0, 0, 0, 0)), ate: new Date() };
    case "semana": {
      const mon = new Date(now);
      const day = now.getDay() || 7;
      mon.setDate(now.getDate() - day + 1);
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      return { de: mon, ate: sun };
    }
    case "mes":
      return { de: new Date(now.getFullYear(), now.getMonth(), 1), ate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    case "ano":
      return { de: new Date(now.getFullYear(), 0, 1), ate: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    default:
      return { de: new Date(now.getFullYear(), now.getMonth(), 1), ate: new Date() };
  }
}

function Relatorios() {
  const tip = { backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;
  const [periodo, setPeriodo] = useState("mes");
  const [bairro, setBairro] = useState("todos");
  const today = new Date().toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(today);
  const [dataFim, setDataFim] = useState(today);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingBase, setExportingBase] = useState(false);

  const { logoUrl, nomeCozinha } = useSettings();
  const user = useAuth(s => s.user);
  const isSuperAdmin = user?.role === "SUPERADMIN";
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => relatoriosApi.deletarRetirada(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorio"] });
      toast.success("Retirada excluída com sucesso.");
      setConfirmDeleteId(null);
    },
    onError: () => toast.error("Erro ao excluir retirada."),
  });

  const { data: evolucao = [] } = useQuery({
    queryKey: ["evolucao-mensal"],
    queryFn: () => relatoriosApi.evolucaoMensal(),
  });

  const { data: bairros = [] } = useQuery({
    queryKey: ["relatorios-bairros", periodo],
    queryFn: () => relatoriosApi.bairros({ periodo: periodo as any }),
  });

  const { data: frequentes = [] } = useQuery({
    queryKey: ["familias-frequentes"],
    queryFn: () => relatoriosApi.familiasFrequentes(),
  });

  const isCustom = periodo === "personalizado";
  const { data: relatorio } = useQuery({
    queryKey: ["relatorio", periodo, bairro, isCustom ? dataInicio : null, isCustom ? dataFim : null],
    queryFn: () => relatoriosApi.relatorio({
      periodo,
      ...(isCustom && { de: dataInicio, ate: dataFim }),
      bairro: bairro !== "todos" ? bairro : undefined,
    }),
  });

  const stats = relatorio?.stats;
  const retiradas: any[] = (relatorio?.retiradas as any[]) ?? [];

  const periodoLabel: Record<string, string> = { hoje: "Hoje", semana: "Semana", mes: "Mês", ano: "Ano", personalizado: "Personalizado" };

  function fmtData(data: string) {
    // data é @db.Date → vem como ISO UTC midnight → usar UTC para evitar virar dia anterior em UTC-3
    return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  function fmtHora(horario: string) {
    return new Date(horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function exportCsv() {
    if (!retiradas.length) return toast.error("Nenhum dado para exportar.");
    const header = ["Beneficiário", "CPF", "Bairro", "Qtd", "Data", "Horário", "Método", "Retirado por", "Status"];
    const rows = retiradas.map(r => [
      r.beneficiario?.nome ?? "",
      r.beneficiario?.cpf ?? "",
      r.beneficiario?.bairro ?? "",
      String(r.quantidade),
      fmtData(r.data ?? r.horario),
      fmtHora(r.horario),
      r.metodoRetirada === "FACIAL" ? "Facial" : "Manual",
      r.retiradoPorNome ?? "",
      r.status === "ENTREGUE" ? "Entregue" : r.status === "DUPLICADO_BLOQUEADO" ? "Bloqueado" : "Ausente",
    ]);
    const csv = [header, ...rows].map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  }

  async function exportPdf() {
    if (!stats) return toast.error("Nenhum dado para exportar.");
    setExportingPdf(true);
    try {
      const { de, ate } = getDateRange(periodo, dataInicio, dataFim);
      const docRes = await relatoriosApi.gerarDocumento({
        periodo: periodoLabel[periodo] ?? periodo,
        dataInicio: de.toISOString(),
        dataFim: ate.toISOString(),
        totalRetiradas: stats.total,
        totalQuentinhas: stats.quentinhas,
        bairro: bairro !== "todos" ? bairro : undefined,
      });
      const codigo = docRes.codigo;
      const origin = window.location.origin;
      const validarUrl = `${origin}/validar?codigo=${codigo}`;
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const logoHtml = logoUrl
        ? `<img src="${origin}${logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl}" alt="Logo" style="height:60px;object-fit:contain;" />`
        : `<div style="width:60px;height:60px;background:#2f9d6b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">🍽</div>`;

      const rows = retiradas.map(r => {
        const isFacial = r.metodoRetirada === "FACIAL";
        const shortId = isFacial ? r.id?.substring(0, 8) : "";
        const metodoCell = isFacial
          ? `<span style="color:#2f9d6b;font-weight:600;">Facial</span><br/><span style="font-size:9px;color:#888;font-family:monospace;">${shortId}</span>`
          : `<span style="color:#666;">Manual</span>`;
        const retiradoPor = r.retiradoPorNome
          ? `<br/><span style="font-size:9px;color:#888;">retirado por ${r.retiradoPorNome}</span>`
          : "";
        return `<tr>
          <td>${r.beneficiario?.nome ?? "—"}${retiradoPor}</td>
          <td>${r.beneficiario?.cpf ?? "—"}</td>
          <td>${r.beneficiario?.bairro ?? "—"}</td>
          <td style="text-align:center;">${r.quantidade}</td>
          <td>${fmtData(r.data ?? r.horario)}</td>
          <td>${fmtHora(r.horario)}</td>
          <td style="text-align:center;">${metodoCell}</td>
          <td>${r.status === "ENTREGUE" ? "Entregue" : r.status === "DUPLICADO_BLOQUEADO" ? "Bloqueado" : "Ausente"}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <title>Relatório — ${periodoLabel[periodo] ?? periodo}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 0 24px; }
          .header { display: flex; align-items: center; gap: 16px; padding: 20px 0 12px; border-bottom: 3px solid #2f9d6b; margin-bottom: 16px; }
          .header-text h1 { font-size: 18px; color: #111; }
          .header-text p { font-size: 11px; color: #555; margin-top: 2px; }
          .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
          .stat { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 90px; flex: 1; }
          .stat strong { display: block; font-size: 20px; color: #2f9d6b; }
          .stat span { font-size: 10px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 80px; }
          th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 6px 8px; text-align: left; border: 1px solid #e0e0e0; }
          td { border: 1px solid #e8e8e8; padding: 5px 8px; vertical-align: middle; font-size: 11px; }
          tr:nth-child(even) td { background: #fafafa; }
          .auth-box { border: 1.5px solid #2f9d6b; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; background: #f0faf5; }
          .auth-box .code { font-family: monospace; font-size: 16px; font-weight: bold; color: #2f9d6b; letter-spacing: 2px; }
          .auth-box small { font-size: 10px; color: #555; display: block; margin-top: 4px; }
          .footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; }
          .footer img { width: 100%; display: block; }
          @media print {
            body { padding: 0 16px; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; }
          }
        </style>
      </head><body>
        <div class="header">
          ${logoHtml}
          <div class="header-text">
            <h1>${nomeCozinha || "Mesa do Bem"}</h1>
            <p>Relatório de Retiradas — ${periodoLabel[periodo] ?? periodo}</p>
            <p>Gerado em ${date}${bairro !== "todos" ? ` · Bairro: ${bairro}` : ""}</p>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><strong>${stats.total}</strong><span>Total distribuído</span></div>
          <div class="stat"><strong>${stats.quentinhas}</strong><span>Quentinhas</span></div>
          <div class="stat"><strong>${stats.mediadiaria?.toFixed(1) ?? "—"}</strong><span>Média diária</span></div>
          <div class="stat"><strong>${stats.familias}</strong><span>Famílias</span></div>
          <div class="stat"><strong>${stats.ausencias}</strong><span>Ausências</span></div>
          <div class="stat"><strong>${stats.taxa}%</strong><span>Taxa de utilização</span></div>
        </div>

        <table>
          <thead><tr>
            <th>Beneficiário</th><th>CPF</th><th>Bairro</th>
            <th style="text-align:center;">Qtd</th><th>Data</th><th>Horário</th>
            <th style="text-align:center;">Método</th><th>Status</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#888;padding:12px;">Nenhuma retirada no período.</td></tr>'}</tbody>
        </table>

        <div class="auth-box">
          <div style="font-size:10px;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;">Documento autenticado</div>
          <div class="code">${codigo}</div>
          <small>Valide este documento em: <strong>${validarUrl}</strong></small>
          <small style="margin-top:2px;">Retiradas com método "Facial" possuem ID individual para validação. Entre em <strong>${origin}/validar</strong> e informe o ID.</small>
        </div>

        <div class="footer">
          <img src="${origin}/rodape.png" alt="Rodapé institucional" />
        </div>

        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const w = window.open("", "_blank");
      if (!w) return toast.error("Permita pop-ups para exportar PDF.");
      w.document.write(html);
      w.document.close();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar documento.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function exportBaseUsuarios() {
    setExportingBase(true);
    try {
      const base = await relatoriosApi.baseUsuarios({
        periodo,
        ...(isCustom && { de: dataInicio, ate: dataFim }),
        bairro: bairro !== "todos" ? bairro : undefined,
      });
      if (!base.usuarios.length) { toast.error("Nenhuma retirada no período para gerar a base."); return; }

      const origin = window.location.origin;
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const { de, ate } = getDateRange(periodo, dataInicio, dataFim);
      const periodoTxt = `${de.toLocaleDateString("pt-BR")} a ${ate.toLocaleDateString("pt-BR")}`;
      const logoHtml = logoUrl
        ? `<img src="${origin}${logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl}" alt="Logo" style="height:60px;object-fit:contain;" />`
        : `<div style="width:60px;height:60px;background:#2f9d6b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">🍽</div>`;

      const fmtDia = (d: string) =>
        new Date(d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

      const blocks = base.usuarios.map(u => {
        const linhas = u.retiradas.map(r => {
          const metodo = r.metodoRetirada === "FACIAL" ? "facial" : "manual";
          const proc = r.retiradoPorNome ? ` — retirado por ${r.retiradoPorNome}` : "";
          return `<li>${fmtDia(r.data)} — ${r.quantidade} quentinha(s) (${metodo})${proc}</li>`;
        }).join("");
        return `<div class="user">
          <div class="user-head"><strong>${u.nome}</strong> retirou ${u.totalQuentinhas} quentinha(s)
            <span class="sub">${u.cpf} · ${u.bairro || "—"}</span></div>
          <ul>${linhas}</ul>
        </div>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <title>Base de usuários — ${nomeCozinha || "Mesa do Bem"}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 0 24px; }
          .header { display: flex; align-items: center; gap: 16px; padding: 20px 0 12px; border-bottom: 3px solid #2f9d6b; margin-bottom: 16px; }
          .header-text h1 { font-size: 18px; color: #111; }
          .header-text p { font-size: 11px; color: #555; margin-top: 2px; }
          .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
          .stat { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 120px; flex: 1; }
          .stat strong { display: block; font-size: 20px; color: #2f9d6b; }
          .stat span { font-size: 10px; color: #666; }
          .user { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #eee; break-inside: avoid; }
          .user-head { font-size: 14px; margin-bottom: 4px; }
          .user-head .sub { color: #888; font-size: 10px; margin-left: 8px; }
          ul { list-style: none; padding-left: 14px; }
          li { font-size: 11px; color: #333; padding: 2px 0; text-transform: capitalize; }
          .footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; }
          .footer img { width: 100%; display: block; }
          .content { margin-bottom: 80px; }
        </style>
      </head><body>
        <div class="header">
          ${logoHtml}
          <div class="header-text">
            <h1>${nomeCozinha || "Mesa do Bem"}</h1>
            <p>Base de usuários — demonstrativo por pessoa</p>
            <p>Período: ${periodoLabel[periodo] ?? periodo} (${periodoTxt})${bairro !== "todos" ? ` · Bairro: ${bairro}` : ""} · Gerado em ${date}</p>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><strong>${base.totalUsuarios}</strong><span>Usuários atendidos</span></div>
          <div class="stat"><strong>${base.totalQuentinhas}</strong><span>Quentinhas no período</span></div>
        </div>
        <div class="content">${blocks}</div>
        <div class="footer"><img src="${origin}/rodape.png" alt="Rodapé institucional" /></div>
        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const w = window.open("", "_blank");
      if (!w) return toast.error("Permita pop-ups para exportar a base.");
      w.document.write(html);
      w.document.close();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar a base de usuários.");
    } finally {
      setExportingBase(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores e comparativos da cozinha."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={exportCsv}><FileDown className="h-4 w-4" />CSV</Button>
            <Button variant="outline" className="gap-2" onClick={exportPdf} disabled={exportingPdf}>
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportBaseUsuarios} disabled={exportingBase}>
              {exportingBase ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Base usuários
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimir</Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select value={periodo} onValueChange={v => { setPeriodo(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isCustom ? (
            <>
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input type="date" value={dataInicio} max={dataFim} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={dataFim} min={dataInicio} onChange={e => setDataFim(e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="space-y-1.5">
            <Label>Bairro</Label>
            <Select value={bairro} onValueChange={setBairro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {bairros.map((b: any) => (
                  <SelectItem key={b.bairro} value={b.bairro}>{b.bairro}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={Utensils} label="Total distribuído" value={stats?.total ?? "—"} hint="no período" />
        <StatCard icon={TrendingUp} label="Média diária" value={stats?.mediadiaria?.toFixed(1) ?? "—"} accent="accent" />
        <StatCard icon={Users} label="Famílias atendidas" value={stats?.familias ?? "—"} />
        <StatCard icon={UserX} label="Ausências" value={stats?.ausencias ?? "—"} accent="warning" />
        <StatCard icon={Percent} label="Taxa de utilização" value={stats ? `${stats.taxa}%` : "—"} accent="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tendência mensal</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tip} />
                <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por bairro</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={bairros}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="bairro" stroke="var(--muted-foreground)" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="familias" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Beneficiários recorrentes</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer>
            <BarChart data={frequentes} layout="vertical" margin={{ left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis type="category" dataKey="nome" stroke="var(--muted-foreground)" fontSize={12} width={120} />
              <Tooltip contentStyle={tip} />
              <Legend />
              <Bar dataKey="retiradas" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de retiradas</CardTitle></CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-medium">Beneficiário</th>
                  <th className="px-5 py-2 font-medium">Bairro</th>
                  <th className="px-5 py-2 font-medium">Qtd</th>
                  <th className="px-5 py-2 font-medium">Data</th>
                  <th className="px-5 py-2 font-medium">Horário</th>
                  <th className="px-5 py-2 font-medium">Método</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  {isSuperAdmin && <th className="px-3 py-2 font-medium w-10" />}
                </tr>
              </thead>
              <tbody>
                {retiradas.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 8 : 7} className="px-5 py-6 text-center text-muted-foreground">Nenhuma retirada no período.</td></tr>
                ) : retiradas.slice(0, 20).map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-5 py-2">
                      {r.beneficiario?.nome ?? "—"}
                      {r.retiradoPorNome && (
                        <span className="block text-xs text-muted-foreground">retirado por {r.retiradoPorNome}</span>
                      )}
                    </td>
                    <td className="px-5 py-2">{r.beneficiario?.bairro ?? "—"}</td>
                    <td className="px-5 py-2">{r.quantidade}</td>
                    <td className="px-5 py-2 tabular-nums">{fmtData(r.data ?? r.horario)}</td>
                    <td className="px-5 py-2 tabular-nums">{fmtHora(r.horario)}</td>
                    <td className="px-5 py-2">
                      {r.metodoRetirada === "FACIAL"
                        ? <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">Facial</Badge>
                        : <Badge variant="secondary">Manual</Badge>}
                    </td>
                    <td className="px-5 py-2">
                      {r.status === "ENTREGUE"
                        ? <Badge className="bg-primary text-primary-foreground">Entregue</Badge>
                        : r.status === "DUPLICADO_BLOQUEADO"
                        ? <Badge variant="destructive">Bloqueado</Badge>
                        : <Badge variant="secondary">Ausente</Badge>}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDeleteId(r.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir retirada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. O registro será removido do banco de dados e os totais do relatório serão recalculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
