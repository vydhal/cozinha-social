import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle, History,
  Pencil, Trash2, Loader2, Search, ClipboardList, Filter, FileDown, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { estoqueApi, CATEGORIAS_ESTOQUE, type ItemEstoque, type CategoriaEstoque, type TipoMovimento, type MovimentoGeral } from "@/lib/api/estoque.api";
import { formatApiError } from "@/lib/api/client";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/_app/estoque")({ component: Estoque });

const emptyForm = { nome: "", categoria: "ALIMENTO" as CategoriaEstoque, unidadeMedida: "", quantidadeAtual: "0", quantidadeMinima: "0" };
const emptyEditForm = { nome: "", categoria: "ALIMENTO" as CategoriaEstoque, unidadeMedida: "", quantidadeMinima: "0", ativo: true };

const tipoLabel: Record<string, string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" };

function exportMovimentosCsv(movimentos: MovimentoGeral[]) {
  const header = ["Data/Hora", "Produto", "Categoria", "Tipo", "Quantidade", "Unidade", "Motivo", "Quem registrou"];
  const rows = movimentos.map(m => [
    new Date(m.criadoEm).toLocaleString("pt-BR"),
    m.item.nome,
    CATEGORIAS_ESTOQUE.find(c => c.value === m.item.categoria)?.label ?? m.item.categoria,
    tipoLabel[m.tipo] ?? m.tipo,
    String(m.quantidade),
    m.item.unidadeMedida,
    m.motivo ?? "",
    m.operador.nome,
  ]);
  const csv = "﻿" + [header, ...rows].map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estoque-movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function categoriaBadge(categoria: CategoriaEstoque) {
  const cls: Record<CategoriaEstoque, string> = {
    ALIMENTO: "bg-primary/10 text-primary",
    LIMPEZA: "bg-accent/20 text-accent-foreground",
    SUPRIMENTO: "bg-secondary text-secondary-foreground",
    GAS: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    OUTRO: "bg-muted text-muted-foreground",
  };
  return <Badge className={cls[categoria]}>{CATEGORIAS_ESTOQUE.find(c => c.value === categoria)?.label}</Badge>;
}

function Estoque() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("itens");
  const [categoria, setCategoria] = useState<string>("TODOS");
  const [search, setSearch] = useState("");

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["estoque"],
    queryFn: () => estoqueApi.list(),
  });

  // Relatório de movimentações
  const [relItemId, setRelItemId] = useState("TODOS");
  const [relTipo, setRelTipo] = useState("TODOS");
  const [relDe, setRelDe] = useState("");
  const [relAte, setRelAte] = useState("");

  const { data: relatorio, isLoading: loadingRelatorio } = useQuery({
    queryKey: ["estoque-relatorio", relItemId, relTipo, relDe, relAte],
    queryFn: () => estoqueApi.relatorioMovimentos({
      itemId: relItemId !== "TODOS" ? relItemId : undefined,
      tipo: relTipo !== "TODOS" ? relTipo : undefined,
      de: relDe || undefined,
      ate: relAte || undefined,
    }),
    enabled: tab === "relatorio",
  });

  const { logoUrl, nomeCozinha } = useSettings();
  const [exportingPdf, setExportingPdf] = useState(false);

  function exportarPdf() {
    if (!relatorio || relatorio.movimentos.length === 0) return toast.error("Nenhum dado para exportar.");
    setExportingPdf(true);
    try {
      const origin = window.location.origin;
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      const logoHtml = logoUrl
        ? `<img src="${origin}${logoUrl.startsWith("/") ? logoUrl : "/" + logoUrl}" alt="Logo" style="height:60px;object-fit:contain;" />`
        : `<div style="width:60px;height:60px;background:#2f9d6b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">🍽</div>`;

      const produtoNome = relItemId !== "TODOS" ? itens.find(i => i.id === relItemId)?.nome : undefined;
      const filtros: string[] = [];
      if (produtoNome) filtros.push(`Produto: ${produtoNome}`);
      if (relTipo !== "TODOS") filtros.push(`Tipo: ${tipoLabel[relTipo]}`);
      if (relDe || relAte) filtros.push(`Período: ${relDe ? new Date(relDe + "T00:00:00").toLocaleDateString("pt-BR") : "—"} a ${relAte ? new Date(relAte + "T00:00:00").toLocaleDateString("pt-BR") : "—"}`);
      else filtros.push("Período: últimos 30 dias");

      const rows = relatorio.movimentos.map(m => `<tr>
        <td>${new Date(m.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
        <td>${m.item.nome}</td>
        <td style="text-align:center;">${tipoLabel[m.tipo] ?? m.tipo}</td>
        <td style="text-align:center;">${m.quantidade} ${m.item.unidadeMedida}</td>
        <td>${m.motivo ?? "—"}</td>
        <td>${m.operador.nome}</td>
      </tr>`).join("");

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <title>Estoque — Movimentações</title>
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
            <p>Estoque — Movimentações (entradas e saídas)</p>
            <p>Gerado em ${date} · ${filtros.join(" · ")}</p>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><strong>${relatorio.movimentos.length}</strong><span>Movimentações</span></div>
          <div class="stat"><strong>${relatorio.resumo.totalEntradas}</strong><span>Total de entradas</span></div>
          <div class="stat"><strong>${relatorio.resumo.totalSaidas}</strong><span>Total de saídas</span></div>
        </div>

        <table>
          <thead><tr>
            <th>Data/Hora</th><th>Produto</th>
            <th style="text-align:center;">Tipo</th><th style="text-align:center;">Quantidade</th>
            <th>Motivo</th><th>Quem registrou</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <img src="${origin}/rodape.png" alt="Rodapé institucional" />
        </div>

        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;

      const w = window.open("", "_blank");
      if (!w) { toast.error("Permita pop-ups para exportar PDF."); return; }
      w.document.write(html);
      w.document.close();
    } finally {
      setExportingPdf(false);
    }
  }

  const filtrados = itens.filter(i =>
    (categoria === "TODOS" || i.categoria === categoria) &&
    (!search || i.nome.toLowerCase().includes(search.toLowerCase()))
  );

  const totalBaixo = itens.filter(i => i.baixo && i.ativo).length;

  // Novo item
  const [novoOpen, setNovoOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const createMut = useMutation({
    mutationFn: () => estoqueApi.create({
      nome: form.nome,
      categoria: form.categoria,
      unidadeMedida: form.unidadeMedida,
      quantidadeAtual: parseFloat(form.quantidadeAtual) || 0,
      quantidadeMinima: parseFloat(form.quantidadeMinima) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      setNovoOpen(false);
      setForm(emptyForm);
      toast.success("Item cadastrado.");
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  // Editar item
  const [editTarget, setEditTarget] = useState<ItemEstoque | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const openEdit = (item: ItemEstoque) => {
    setEditTarget(item);
    setEditForm({ nome: item.nome, categoria: item.categoria, unidadeMedida: item.unidadeMedida, quantidadeMinima: String(item.quantidadeMinima), ativo: item.ativo });
  };

  const updateMut = useMutation({
    mutationFn: () => estoqueApi.update(editTarget!.id, {
      nome: editForm.nome,
      categoria: editForm.categoria,
      unidadeMedida: editForm.unidadeMedida,
      quantidadeMinima: parseFloat(editForm.quantidadeMinima) || 0,
      ativo: editForm.ativo,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      setEditTarget(null);
      toast.success("Item atualizado.");
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  // Remover item
  const [deleteTarget, setDeleteTarget] = useState<ItemEstoque | null>(null);
  const deleteMut = useMutation({
    mutationFn: () => estoqueApi.remove(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      setDeleteTarget(null);
      toast.success("Item removido.");
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  // Movimento (entrada/saída)
  const [movTarget, setMovTarget] = useState<{ item: ItemEstoque; tipo: TipoMovimento } | null>(null);
  const [movQuantidade, setMovQuantidade] = useState("");
  const [movMotivo, setMovMotivo] = useState("");

  const openMovimento = (item: ItemEstoque, tipo: TipoMovimento) => {
    setMovTarget({ item, tipo });
    setMovQuantidade("");
    setMovMotivo("");
  };

  const movimentoMut = useMutation({
    mutationFn: () => estoqueApi.registrarMovimento(movTarget!.item.id, {
      tipo: movTarget!.tipo,
      quantidade: parseFloat(movQuantidade) || 0,
      motivo: movMotivo || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque"] });
      setMovTarget(null);
      toast.success(movTarget?.tipo === "ENTRADA" ? "Entrada registrada." : "Saída registrada.");
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  // Histórico
  const [historicoTarget, setHistoricoTarget] = useState<ItemEstoque | null>(null);
  const { data: historico = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ["estoque-movimentos", historicoTarget?.id],
    queryFn: () => estoqueApi.movimentos(historicoTarget!.id),
    enabled: !!historicoTarget,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        subtitle="Alimentos, limpeza, suprimentos e gás usados no dia a dia."
        actions={
          tab === "itens" && (
            <Button className="gap-2" onClick={() => { setForm(emptyForm); setNovoOpen(true); }}>
              <Plus className="h-4 w-4" />Novo item
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="itens" className="gap-1.5"><Package className="h-4 w-4" />Cadastro</TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-1.5"><ClipboardList className="h-4 w-4" />Relatório</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "itens" && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{itens.filter(i => i.ativo).length}</div>
              <div className="text-xs text-muted-foreground">Itens ativos</div>
            </div>
          </CardContent>
        </Card>
        <Card className={totalBaixo > 0 ? "border-destructive/40" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{totalBaixo}</div>
              <div className="text-xs text-muted-foreground">Em estoque baixo</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {totalBaixo > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="font-medium">Estoque baixo:</span>
            {itens.filter(i => i.baixo && i.ativo).map(i => (
              <Badge key={i.id} variant="destructive" className="font-normal">{i.nome}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={categoria} onValueChange={setCategoria}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="TODOS">Todos</TabsTrigger>
            {CATEGORIAS_ESTOQUE.map(c => <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar item..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-28 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
          ))
        ) : filtrados.length === 0 ? (
          <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Nenhum item encontrado.</div>
        ) : filtrados.map(item => (
          <Card key={item.id} className={!item.ativo ? "opacity-60" : item.baixo ? "border-destructive/40" : ""}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{item.nome}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {categoriaBadge(item.categoria)}
                    {!item.ativo && <Badge variant="secondary">Inativo</Badge>}
                    {item.baixo && item.ativo && <Badge variant="destructive">Baixo</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setHistoricoTarget(item)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Histórico">
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => openEdit(item)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(item)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">{item.quantidadeAtual}</span>
                <span className="text-sm text-muted-foreground">{item.unidadeMedida}</span>
              </div>
              <div className="text-xs text-muted-foreground">Mínimo: {item.quantidadeMinima} {item.unidadeMedida}</div>

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openMovimento(item, "ENTRADA")} disabled={!item.ativo}>
                  <ArrowDownCircle className="h-3.5 w-3.5 text-primary" />Entrada
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openMovimento(item, "SAIDA")} disabled={!item.ativo}>
                  <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" />Saída
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </>}

      {tab === "relatorio" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />Filtros
              </div>
              <div className="grid min-w-[10rem] flex-1 gap-1.5">
                <Label className="text-xs">Produto</Label>
                <Select value={relItemId} onValueChange={setRelItemId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os produtos</SelectItem>
                    {itens.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-[9rem] gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={relTipo} onValueChange={setRelTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Entradas e saídas</SelectItem>
                    <SelectItem value="ENTRADA">Entrada</SelectItem>
                    <SelectItem value="SAIDA">Saída</SelectItem>
                    <SelectItem value="AJUSTE">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label className="text-xs">De</Label><Input type="date" className="w-36" value={relDe} max={relAte || undefined} onChange={e => setRelDe(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">Até</Label><Input type="date" className="w-36" value={relAte} min={relDe || undefined} onChange={e => setRelAte(e.target.value)} /></div>
              {(relItemId !== "TODOS" || relTipo !== "TODOS" || relDe || relAte) && (
                <Button variant="ghost" size="sm" onClick={() => { setRelItemId("TODOS"); setRelTipo("TODOS"); setRelDe(""); setRelAte(""); }}>
                  Limpar
                </Button>
              )}
            </CardContent>
          </Card>

          {!relDe && !relAte && (
            <p className="text-xs text-muted-foreground">Sem período selecionado, mostrando os últimos 30 dias.</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ArrowDownCircle className="h-5 w-5" /></div>
                <div>
                  <div className="text-xl font-bold leading-none">{relatorio?.resumo.totalEntradas ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Total de entradas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"><ArrowUpCircle className="h-5 w-5" /></div>
                <div>
                  <div className="text-xl font-bold leading-none">{relatorio?.resumo.totalSaidas ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Total de saídas</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Movimentações</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportMovimentosCsv(relatorio?.movimentos ?? [])} disabled={!relatorio?.movimentos.length}>
                  <FileDown className="h-3.5 w-3.5" />CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarPdf} disabled={exportingPdf || !relatorio?.movimentos.length}>
                  {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-5 py-2.5 font-medium">Data/Hora</th>
                      <th className="px-5 py-2.5 font-medium">Produto</th>
                      <th className="px-5 py-2.5 font-medium">Tipo</th>
                      <th className="px-5 py-2.5 font-medium">Quantidade</th>
                      <th className="px-5 py-2.5 font-medium">Motivo</th>
                      <th className="px-5 py-2.5 font-medium">Quem registrou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRelatorio ? (
                      <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Carregando...</td></tr>
                    ) : !relatorio || relatorio.movimentos.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Nenhuma movimentação no período.</td></tr>
                    ) : relatorio.movimentos.map(m => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-5 py-2.5 tabular-nums text-muted-foreground">{new Date(m.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="px-5 py-2.5 font-medium">{m.item.nome}</td>
                        <td className="px-5 py-2.5">
                          {m.tipo === "ENTRADA" ? (
                            <Badge className="bg-primary text-primary-foreground gap-1"><ArrowDownCircle className="h-3 w-3" />Entrada</Badge>
                          ) : m.tipo === "SAIDA" ? (
                            <Badge variant="destructive" className="gap-1"><ArrowUpCircle className="h-3 w-3" />Saída</Badge>
                          ) : (
                            <Badge variant="secondary">Ajuste</Badge>
                          )}
                        </td>
                        <td className="px-5 py-2.5 tabular-nums">{m.quantidade} {m.item.unidadeMedida}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{m.motivo ?? "—"}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{m.operador.nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: Novo item */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo item de estoque</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Arroz, Detergente, Botijão de gás" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as CategoriaEstoque }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ESTOQUE.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Unidade *</Label><Input value={form.unidadeMedida} onChange={e => setForm(f => ({ ...f, unidadeMedida: e.target.value }))} placeholder="kg, un, l, pct" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Quantidade inicial</Label><Input type="number" step="0.01" value={form.quantidadeAtual} onChange={e => setForm(f => ({ ...f, quantidadeAtual: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={form.quantidadeMinima} onChange={e => setForm(f => ({ ...f, quantidadeMinima: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!form.nome || !form.unidadeMedida) return toast.error("Preencha nome e unidade.");
              createMut.mutate();
            }} disabled={createMut.isPending}>
              {createMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar item */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar — {editTarget?.nome}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Nome</Label><Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Categoria</Label>
                <Select value={editForm.categoria} onValueChange={v => setEditForm(f => ({ ...f, categoria: v as CategoriaEstoque }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ESTOQUE.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Unidade</Label><Input value={editForm.unidadeMedida} onChange={e => setEditForm(f => ({ ...f, unidadeMedida: e.target.value }))} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={editForm.quantidadeMinima} onChange={e => setEditForm(f => ({ ...f, quantidadeMinima: e.target.value }))} /></div>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Item ativo</span>
              <Switch checked={editForm.ativo} onCheckedChange={v => setEditForm(f => ({ ...f, ativo: v }))} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Movimento (entrada/saída) */}
      <Dialog open={!!movTarget} onOpenChange={open => { if (!open) setMovTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {movTarget?.tipo === "ENTRADA" ? "Registrar entrada" : "Registrar saída"} — {movTarget?.item.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="text-xs text-muted-foreground">
              Estoque atual: <strong>{movTarget?.item.quantidadeAtual} {movTarget?.item.unidadeMedida}</strong>
            </div>
            <div className="grid gap-1.5">
              <Label>Quantidade *</Label>
              <Input type="number" step="0.01" autoFocus value={movQuantidade} onChange={e => setMovQuantidade(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea value={movMotivo} onChange={e => setMovMotivo(e.target.value)} placeholder={movTarget?.tipo === "ENTRADA" ? "Ex.: Compra, doação" : "Ex.: Uso do almoço de hoje"} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovTarget(null)}>Cancelar</Button>
            <Button onClick={() => {
              const q = parseFloat(movQuantidade);
              if (!q || q <= 0) return toast.error("Informe uma quantidade válida.");
              movimentoMut.mutate();
            }} disabled={movimentoMut.isPending}>
              {movimentoMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico */}
      <Dialog open={!!historicoTarget} onOpenChange={open => { if (!open) setHistoricoTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Histórico — {historicoTarget?.nome}</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {loadingHistorico ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : historico.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
            ) : historico.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {m.tipo === "ENTRADA" ? <ArrowDownCircle className="h-4 w-4 text-primary" /> : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
                  <div>
                    <div className="font-medium">{m.tipo === "ENTRADA" ? "Entrada" : m.tipo === "SAIDA" ? "Saída" : "Ajuste"} de {m.quantidade}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.operador.nome} · {new Date(m.criadoEm).toLocaleString("pt-BR")}
                      {m.motivo && ` · ${m.motivo}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.nome}</strong> será removido. Se já houver movimentações registradas, o item será apenas desativado para preservar o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
