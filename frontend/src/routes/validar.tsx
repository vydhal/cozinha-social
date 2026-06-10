import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, UtensilsCrossed, CheckCircle2, AlertCircle,
  FileText, User, Calendar, MapPin, ShieldCheck,
} from "lucide-react";
import { relatoriosApi, type DocumentoValidacao, type RetiradaValidacaoDoc } from "@/lib/api/relatorios.api";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/validar")({
  validateSearch: (s: Record<string, unknown>) => ({ codigo: String(s.codigo ?? "") }),
  component: Validar,
});

function Validar() {
  const { codigo: codigoParam } = useSearch({ from: "/validar" });
  const { logoUrl, nomeCozinha } = useSettings();

  const [input, setInput] = useState(codigoParam ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocumentoValidacao | RetiradaValidacaoDoc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (codigoParam) buscar(codigoParam);
  }, []);

  async function buscar(codigo?: string) {
    const code = (codigo ?? input).trim();
    if (!code) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await relatoriosApi.validarCodigo(code);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Código não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-3 mb-2">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-contain" />
              : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><UtensilsCrossed className="h-6 w-6" /></div>
            }
          </div>
          <h1 className="text-2xl font-bold">{nomeCozinha || "Mesa do Bem"}</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm">Validação de documentos autenticados</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Informe o código do documento (REL-…) ou o ID de uma retirada individual para verificar a autenticidade.
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: REL-20260609-A7B2C ou UUID da retirada"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && buscar()}
                className="font-mono text-sm"
              />
              <Button onClick={() => buscar()} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Result: Documento */}
        {result?.tipo === "documento" && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base text-primary">Documento autenticado</CardTitle>
              </div>
              <Badge className="w-fit font-mono text-xs bg-primary/10 text-primary border-primary/30">
                <FileText className="h-3 w-3 mr-1" />
                {result.codigo}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Período" value={result.periodo} />
              <Row
                label="Intervalo"
                value={`${new Date(result.dataInicio).toLocaleDateString("pt-BR")} a ${new Date(result.dataFim).toLocaleDateString("pt-BR")}`}
              />
              {result.bairro && <Row label="Bairro" value={result.bairro} />}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{result.totalRetiradas}</div>
                  <div className="text-xs text-muted-foreground">Retiradas registradas</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{result.totalQuentinhas}</div>
                  <div className="text-xs text-muted-foreground">Quentinhas distribuídas</div>
                </div>
              </div>
              <Row label="Gerado por" value={result.geradoPor} />
              <Row label="Gerado em" value={new Date(result.geradoEm).toLocaleString("pt-BR")} />
            </CardContent>
          </Card>
        )}

        {/* Result: Retirada individual */}
        {result?.tipo === "retirada" && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base text-primary">Retirada autenticada</CardTitle>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
                  ID: {result.id.substring(0, 8)}…
                </Badge>
                {result.metodoRetirada === "FACIAL"
                  ? <Badge className="bg-primary/10 text-primary border-primary/20">Facial</Badge>
                  : <Badge variant="secondary">Manual</Badge>}
                {result.status === "ENTREGUE"
                  ? <Badge className="bg-green-100 text-green-700 border-green-200">Entregue</Badge>
                  : <Badge variant="secondary">{result.status}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-semibold">{result.beneficiario.nome}</div>
                  <div className="text-xs text-muted-foreground">CPF: {result.beneficiario.cpf}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{result.beneficiario.bairro}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  {new Date(result.data).toLocaleDateString("pt-BR")} às {new Date(result.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <Row label="Quantidade de quentinhas" value={String(result.quantidade)} />
              <Row label="Operador" value={result.operador} />
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Esta página é de acesso público para verificação de autenticidade.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
