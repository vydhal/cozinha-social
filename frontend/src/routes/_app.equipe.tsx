import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Mail, Phone, Shield, Pencil, Trash2, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { equipeApi, type TeamUser } from "@/lib/api/equipe.api";
import { authApi } from "@/lib/api/auth.api";
import { useAuth, type UserRole } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/equipe")({ component: Equipe });

function roleBadge(role: TeamUser["role"]) {
  if (role === "SUPERADMIN") return <Badge className="bg-accent text-accent-foreground">Superadmin</Badge>;
  if (role === "ADMIN") return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
  return <Badge variant="secondary">Colaborador</Badge>;
}

const emptyForm = { nome: "", email: "", senha: "", role: "COLABORADOR", cargo: "", telefone: "" };

function Equipe() {
  const qc = useQueryClient();
  const { user: me, startImpersonation } = useAuth();
  const isSuperAdmin = me?.role === "SUPERADMIN";
  const navigate = useNavigate();
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const handleImpersonate = async (u: TeamUser) => {
    setImpersonating(u.id);
    try {
      const res = await authApi.impersonate(u.id);
      startImpersonation(
        { id: res.user.id, nome: res.user.nome, email: res.user.email, role: res.user.role as UserRole, avatar: res.user.avatar, cargo: res.user.cargo, unidadeId: res.user.unidadeId },
        res.token,
      );
      toast.success(`Simulando acesso de ${u.nome}`);
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao simular acesso");
    } finally {
      setImpersonating(null);
    }
  };

  // Criar
  const [novoOpen, setNovoOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Editar
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamUser | null>(null);
  const [editForm, setEditForm] = useState<{ nome: string; email: string; cargo: string; telefone: string; role: TeamUser["role"] }>({ nome: "", email: "", cargo: "", telefone: "", role: "COLABORADOR" });

  // Deletar
  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);

  const { data: team = [], isLoading: loadingTeam } = useQuery({ queryKey: ["equipe"], queryFn: equipeApi.list });
  const { data: logs = [], isLoading: loadingLogs } = useQuery({ queryKey: ["equipe-logs"], queryFn: () => equipeApi.getLogs(20) });

  const createMut = useMutation({
    mutationFn: () => equipeApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      setNovoOpen(false);
      setForm(emptyForm);
      toast.success("Usuário criado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar usuário"),
  });

  const updateMut = useMutation({
    mutationFn: () => equipeApi.update(editTarget!.id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      setEditOpen(false);
      toast.success("Usuário atualizado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const toggleMut = useMutation({
    mutationFn: equipeApi.toggleStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipe"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: () => equipeApi.remove(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe"] });
      setDeleteTarget(null);
      toast.success("Usuário removido.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const openEdit = (u: TeamUser) => {
    setEditTarget(u);
    setEditForm({ nome: u.nome, email: u.email, cargo: u.cargo ?? "", telefone: u.telefone ?? "", role: u.role });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
        subtitle="Usuários, permissões e atividade."
        actions={isSuperAdmin && (
          <Button className="gap-2" onClick={() => { setForm(emptyForm); setNovoOpen(true); }}>
            <Plus className="h-4 w-4" />Novo usuário
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loadingTeam
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-24 animate-pulse rounded-lg bg-muted" /></CardContent></Card>
            ))
          : team.map((u) => (
              <Card key={u.id} className={u.status === "INATIVO" ? "opacity-60" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={u.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {u.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{u.nome}</div>
                      <div className="text-xs text-muted-foreground">{u.cargo ?? "—"}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {roleBadge(u.role)}
                      {isSuperAdmin && me?.id !== u.id && (
                        <>
                          <button
                            onClick={() => openEdit(u)}
                            className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{u.email}</div>
                    {u.telefone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{u.telefone}</div>}
                  </div>
                  {isSuperAdmin && me?.id !== u.id && (
                    <div className="flex items-center justify-between border-t pt-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Acesso ativo</span>
                        <Switch
                          checked={u.status === "ATIVO"}
                          onCheckedChange={() => toggleMut.mutate(u.id)}
                          disabled={toggleMut.isPending}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        disabled={u.status !== "ATIVO" || impersonating === u.id}
                        onClick={() => handleImpersonate(u)}
                      >
                        {impersonating === u.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <UserCheck className="h-3 w-3" />}
                        Simular
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" />Permissões por perfil</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="overflow-x-auto"><table className="w-full">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Recurso</th>
                <th className="py-2 font-medium">Colab.</th>
                <th className="py-2 font-medium">Admin</th>
                <th className="py-2 font-medium">Super</th>
              </tr></thead>
              <tbody>
                {[
                  ["Confirmar retirada", "✓", "✓", "✓"],
                  ["Cadastrar beneficiários", "✓", "✓", "✓"],
                  ["Excluir cadastros", "—", "✓", "✓"],
                  ["Ver relatórios", "—", "✓", "✓"],
                  ["Gerenciar equipe", "—", "—", "✓"],
                  ["Configurar plataforma", "—", "—", "✓"],
                ].map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r[0]}</td>
                    <td className="py-2 text-muted-foreground">{r[1]}</td>
                    <td className="py-2 text-muted-foreground">{r[2]}</td>
                    <td className="py-2 text-muted-foreground">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Logs de atividade</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {loadingLogs ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem atividade registrada.</div>
            ) : logs.map((l: any) => (
              <div key={l.id} className="flex gap-3 rounded-xl bg-muted/40 p-3 text-sm">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {l.user?.nome?.split(" ").map((p: string) => p[0]).join("") ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.acao.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.user?.nome} · {new Date(l.criadoEm).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Novo usuário */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Senha * (mín. 6 caracteres)</Label><Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Perfil</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COLABORADOR">Colaborador</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!form.nome || !form.email || !form.senha) return toast.error("Preencha nome, email e senha.");
              createMut.mutate();
            }} disabled={createMut.isPending}>
              {createMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar usuário */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar — {editTarget?.nome}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Nome</Label><Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Cargo</Label><Input value={editForm.cargo} onChange={e => setEditForm(f => ({ ...f, cargo: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label>Telefone</Label><Input value={editForm.telefone} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Perfil</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COLABORADOR">Colaborador</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.nome}</strong> será removido e não poderá mais acessar o sistema. Esta ação não pode ser desfeita.
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
