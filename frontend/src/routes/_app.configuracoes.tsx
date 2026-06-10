import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Smartphone, Bell, Wifi, Download, Palette, Save,
  Image, Globe, Loader2, Lock, Camera,
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { configuracoesApi, type Config } from "@/lib/api/configuracoes.api";
import { authApi } from "@/lib/api/auth.api";

export const Route = createFileRoute("/_app/configuracoes")({ component: Config });

function Config() {
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";

  // Configurações globais (superadmin)
  const { data: cfg } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: configuracoesApi.get,
    enabled: isSuperAdmin,
  });

  const [identity, setIdentity] = useState({
    nomeCozinha: "", corPrimaria: "#2f9d6b", mensagemBoasVindas: "", limiteDiario: 100, tempoEsperaMin: 5,
  });

  useEffect(() => {
    if (cfg) {
      setIdentity({
        nomeCozinha: cfg.nomeCozinha,
        corPrimaria: cfg.corPrimaria,
        mensagemBoasVindas: cfg.mensagemBoasVindas,
        limiteDiario: cfg.limiteDiario,
        tempoEsperaMin: cfg.tempoEsperaMin,
      });
    }
  }, [cfg]);

  const saveCfgMut = useMutation({
    mutationFn: () => configuracoesApi.update(identity),
    onSuccess: (data) => { qc.setQueryData(["configuracoes"], data); toast.success("Configurações salvas."); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const logoMut = useMutation({
    mutationFn: (f: File) => configuracoesApi.uploadLogo(f),
    onSuccess: (data) => { qc.setQueryData(["configuracoes"], data); toast.success("Logo atualizado."); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar logo"),
  });

  const faviconMut = useMutation({
    mutationFn: (f: File) => configuracoesApi.uploadFavicon(f),
    onSuccess: (data) => { qc.setQueryData(["configuracoes"], data); toast.success("Favicon atualizado."); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar favicon"),
  });

  // Perfil pessoal
  const avatarRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({ nome: user?.nome ?? "", telefone: "" });
  const [senha, setSenha] = useState({ atual: "", nova: "", confirmar: "" });

  const updateProfileMut = useMutation({
    mutationFn: () => authApi.updateProfile({ nome: profile.nome }),
    onSuccess: (u) => {
      setUser({ nome: u.nome, avatar: u.avatar });
      toast.success("Perfil atualizado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar perfil"),
  });

  const avatarMut = useMutation({
    mutationFn: (f: File) => authApi.uploadAvatar(f),
    onSuccess: (u) => { setUser({ avatar: u.avatar }); toast.success("Avatar atualizado."); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar avatar"),
  });

  const changePassMut = useMutation({
    mutationFn: () => authApi.changePassword(senha.atual, senha.nova),
    onSuccess: () => { setSenha({ atual: "", nova: "", confirmar: "" }); toast.success("Senha alterada."); },
    onError: (e: any) => toast.error(e.message ?? "Senha atual incorreta"),
  });

  const handleChangePass = () => {
    if (!senha.atual || !senha.nova) return toast.error("Preencha todos os campos.");
    if (senha.nova !== senha.confirmar) return toast.error("Nova senha não confere.");
    if (senha.nova.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres.");
    changePassMut.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Conta, preferências e personalização do sistema." />

      {/* PERFIL PESSOAL */}
      <Card>
        <CardHeader><CardTitle className="text-base">Seu perfil</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {user?.nome?.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow"
                onClick={() => avatarRef.current?.click()}
              >
                <Camera className="h-3 w-3" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) avatarMut.mutate(f); }} />
            </div>
            <div>
              <div className="font-semibold">{user?.nome}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="text-xs text-muted-foreground capitalize">{user?.role?.toLowerCase()}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={profile.nome} onChange={e => setProfile(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email (somente leitura)</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>
          <Button onClick={() => updateProfileMut.mutate()} disabled={updateProfileMut.isPending} className="gap-2">
            {updateProfileMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </Button>

          <Separator />

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" />Alterar senha</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Senha atual</Label>
                <Input type="password" value={senha.atual} onChange={e => setSenha(s => ({ ...s, atual: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input type="password" value={senha.nova} onChange={e => setSenha(s => ({ ...s, nova: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar</Label>
                <Input type="password" value={senha.confirmar} onChange={e => setSenha(s => ({ ...s, confirmar: e.target.value }))} />
              </div>
            </div>
            <Button variant="outline" className="mt-3 gap-2" onClick={handleChangePass} disabled={changePassMut.isPending}>
              {changePassMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PERSONALIZAÇÃO — apenas superadmin */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />Identidade da plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome da cozinha</Label>
                <Input
                  value={identity.nomeCozinha}
                  onChange={e => setIdentity(i => ({ ...i, nomeCozinha: e.target.value }))}
                  placeholder="Mesa do Bem"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Cor primária</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={identity.corPrimaria}
                    onChange={e => setIdentity(i => ({ ...i, corPrimaria: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded border"
                  />
                  <Input
                    value={identity.corPrimaria}
                    onChange={e => setIdentity(i => ({ ...i, corPrimaria: e.target.value }))}
                    placeholder="#2f9d6b"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Limite diário de quentinhas</Label>
                <Input
                  type="number"
                  value={identity.limiteDiario}
                  onChange={e => setIdentity(i => ({ ...i, limiteDiario: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Mensagem de boas-vindas</Label>
                <Textarea
                  rows={2}
                  value={identity.mensagemBoasVindas}
                  onChange={e => setIdentity(i => ({ ...i, mensagemBoasVindas: e.target.value }))}
                  placeholder="Bem-vindo! Aqui há lugar para todos."
                />
              </div>
            </div>

            {/* Uploads */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Image className="h-3.5 w-3.5" />Logo</Label>
                {cfg?.logoUrl && (
                  <img src={cfg.logoUrl} alt="Logo" className="h-12 w-auto rounded border object-contain" />
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) logoMut.mutate(f); }} />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => logoRef.current?.click()}
                  disabled={logoMut.isPending}
                >
                  {logoMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                  {cfg?.logoUrl ? "Substituir logo" : "Enviar logo"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Favicon (.ico / .png)</Label>
                {cfg?.faviconUrl && (
                  <img src={cfg.faviconUrl} alt="Favicon" className="h-8 w-8 rounded border object-contain" />
                )}
                <input ref={faviconRef} type="file" accept="image/x-icon,image/png,image/svg+xml" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) faviconMut.mutate(f); }} />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => faviconRef.current?.click()}
                  disabled={faviconMut.isPending}
                >
                  {faviconMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {cfg?.faviconUrl ? "Substituir favicon" : "Enviar favicon"}
                </Button>
              </div>
            </div>

            <Button onClick={() => saveCfgMut.mutate()} disabled={saveCfgMut.isPending} className="gap-2">
              {saveCfgMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar identidade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* APLICATIVO */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4" />Aplicativo (PWA)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Item icon={Download} title="Instalar no celular" desc="Tenha a Mesa do Bem como app na tela inicial."
              action={<Button variant="outline" size="sm" onClick={() => toast.info("Use 'Adicionar à tela inicial' no menu do navegador.")}>Instalar</Button>} />
            <Item icon={Bell} title="Notificações" desc="Aviso quando uma senha for chamada." action={<Switch defaultChecked />} />
            <Item icon={Wifi} title="Modo offline visual" desc="Mantém telas acessíveis sem internet." action={<Switch defaultChecked />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aparência</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Item title="Tema escuro" desc="Use no modo noturno (aplica .dark)."
              action={<Switch onCheckedChange={(v) => document.documentElement.classList.toggle("dark", v)} />} />
            <Item title="Tipografia grande" desc="Aumenta contraste para uso em campo." action={<Switch />} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Item({ icon: Icon, title, desc, action }: { icon?: React.ElementType; title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
      {Icon && <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      {action}
    </div>
  );
}
