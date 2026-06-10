import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, UtensilsCrossed, AlertCircle } from "lucide-react";
import { configuracoesApi } from "@/lib/api/configuracoes.api";
import { useQuery } from "@tanstack/react-query";
import { maskCpf, maskCep } from "@/lib/utils";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? "") }),
  component: CadastroPublico,
});

const UF_OPTS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function CadastroPublico() {
  const { token } = useSearch({ from: "/cadastro" });

  const { data: statusData, isLoading: checkingToken } = useQuery({
    queryKey: ["cadastro-publico-status", token],
    queryFn: () => configuracoesApi.verificarTokenCadastro(token),
    enabled: !!token,
  });

  const ativo = statusData?.data?.ativo ?? false;

  const [form, setForm] = useState({
    nome: "", cpf: "", rg: "", nascimento: "", telefone: "",
    cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "",
    pessoasCasa: 1, nomesMoradores: "", quentinhasAutorizadas: 1, observacoes: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const buscarCep = async (cep: string) => {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) return;
      if (data.logradouro) set("endereco", data.logradouro);
      if (data.bairro) set("bairro", data.bairro);
      if (data.localidade) set("cidade", data.localidade);
      if (data.uf) set("uf", data.uf);
    } catch {}
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!form.nome || !form.cpf || !form.nascimento || !form.endereco || !form.bairro || !form.cidade || !form.cep) {
      setErro("Preencha todos os campos obrigatórios (*).");
      return;
    }
    setEnviando(true);
    try {
      const res = await configuracoesApi.registrarPublico(token, {
        ...form,
        pessoasCasa: Number(form.pessoasCasa),
        quentinhasAutorizadas: Number(form.quentinhasAutorizadas),
      });
      if (res.error) { setErro(res.error); return; }
      setSucesso(true);
    } catch {
      setErro("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !ativo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Link inválido ou inativo</h1>
          <p className="text-sm text-muted-foreground">
            Este link de cadastro não está disponível no momento. Procure a equipe da cozinha para mais informações.
          </p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center space-y-4">
          <CheckCircle className="mx-auto h-14 w-14 text-primary" />
          <h1 className="text-2xl font-bold">Cadastro enviado!</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi recebido e está aguardando aprovação da equipe. Em breve você poderá retirar sua quentinha.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-2">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Cadastro de beneficiário</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados para receber sua quentinha. O cadastro será analisado pela equipe.</p>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *" placeholder="Seu nome completo" className="sm:col-span-2"
                value={form.nome} onChange={e => set("nome", e.target.value)} required />
              <Field label="CPF *" placeholder="000.000.000-00"
                value={form.cpf} onChange={e => set("cpf", maskCpf(e.target.value))} required />
              <Field label="Data de nascimento *" type="date"
                value={form.nascimento} onChange={e => set("nascimento", e.target.value)} required />
              <Field label="RG" placeholder="00.000.000-0"
                value={form.rg} onChange={e => set("rg", e.target.value)} />
              <Field label="Telefone" placeholder="(00) 00000-0000"
                value={form.telefone} onChange={e => set("telefone", e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-6">
              <Field label="CEP *" placeholder="00000-000" className="sm:col-span-2"
                value={form.cep} onChange={e => set("cep", maskCep(e.target.value))}
                onBlur={() => buscarCep(form.cep)} required />
              <Field label="Logradouro *" placeholder="Rua / Avenida" className="sm:col-span-3"
                value={form.endereco} onChange={e => set("endereco", e.target.value)} required />
              <Field label="Nº" placeholder="s/n" className="sm:col-span-1"
                value={form.numero} onChange={e => set("numero", e.target.value)} />
              <Field label="Bairro *" className="sm:col-span-3"
                value={form.bairro} onChange={e => set("bairro", e.target.value)} required />
              <Field label="Cidade *" className="sm:col-span-2"
                value={form.cidade} onChange={e => set("cidade", e.target.value)} required />
              <div className="space-y-1.5 sm:col-span-1">
                <Label>UF</Label>
                <Select value={form.uf} onValueChange={v => set("uf", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UF_OPTS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Família</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pessoas na casa</Label>
                <Input type="number" min={1} max={20} value={form.pessoasCasa}
                  onChange={e => set("pessoasCasa", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quentinhas necessárias</Label>
                <Input type="number" min={1} max={10} value={form.quentinhasAutorizadas}
                  onChange={e => set("quentinhasAutorizadas", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nomes das pessoas que moram com você</Label>
                <Textarea placeholder="Liste os nomes dos moradores" rows={2}
                  value={form.nomesMoradores} onChange={e => set("nomesMoradores", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea placeholder="Informações adicionais (opcional)" rows={2}
                  value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full gap-2" disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Enviando..." : "Enviar cadastro"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Seus dados serão analisados pela equipe da cozinha antes da aprovação.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, className, ...rest }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input {...rest} />
    </div>
  );
}
