import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, ScanFace, ListOrdered, UtensilsCrossed,
  BarChart3, ClipboardList, UserCog, Settings, Shield, LogOut, Menu, Tv,
  Plus, MoreHorizontal,
} from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, useSettings } from "@/lib/store";
import { authApi } from "@/lib/api/auth.api";
import { cn } from "@/lib/utils";

type UserRole = "SUPERADMIN" | "ADMIN" | "COLABORADOR";

const nav: { to: string; label: string; icon: React.ElementType; roles?: UserRole[] }[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/retirada", label: "Retirada", icon: UtensilsCrossed },
  { to: "/reconhecimento", label: "Facial", icon: ScanFace },
  { to: "/fila", label: "Fila", icon: ListOrdered },
  { to: "/beneficiarios", label: "Beneficiários", icon: Users },
  { to: "/lista-diaria", label: "Lista diária", icon: ClipboardList },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/equipe", label: "Equipe", icon: UserCog, roles: ["SUPERADMIN", "ADMIN"] },
  { to: "/admin", label: "Superadmin", icon: Shield, roles: ["SUPERADMIN"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["SUPERADMIN", "ADMIN"] },
];

const bottomNavMain = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/retirada", label: "Retirada", icon: UtensilsCrossed },
  { to: "/lista-diaria", label: "Lista diária", icon: ClipboardList },
];

const moreNavItems: { to: string; label: string; icon: React.ElementType; roles?: UserRole[] }[] = [
  { to: "/beneficiarios", label: "Beneficiários", icon: Users },
  { to: "/reconhecimento", label: "Facial", icon: ScanFace },
  { to: "/fila", label: "Fila", icon: ListOrdered },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["SUPERADMIN", "ADMIN"] },
  { to: "/equipe", label: "Equipe", icon: UserCog, roles: ["SUPERADMIN", "ADMIN"] },
  { to: "/admin", label: "Superadmin", icon: Shield, roles: ["SUPERADMIN"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["SUPERADMIN", "ADMIN"] },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  const { logoUrl, nomeCozinha } = useSettings();
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
        {logoUrl
          ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          : <UtensilsCrossed className="h-5 w-5" />
        }
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold">{nomeCozinha || "Mesa do Bem"}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cozinha comunitária</div>
        </div>
      )}
    </div>
  );
}

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation();
  const { user } = useAuth();
  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(user?.role as UserRole));
  return (
    <nav className="flex flex-col gap-1 px-3">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const INACTIVITY_MS = 30 * 60 * 1000;

function useInactivityLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        logout();
        navigate({ to: "/login" });
      }, INACTIVITY_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [logout, navigate]);
}

function MobileBottomNav({ user, onLogout }: { user: { role?: string; nome?: string } | null; onLogout: () => void }) {
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleMore = moreNavItems.filter(i => !i.roles || i.roles.includes(user?.role as UserRole));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 items-end">
        {/* Painel + Retirada */}
        {bottomNavMain.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn("flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}
                activeOptions={{ exact: item.to === "/" }}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}

        {/* FAB central — Novo cadastro */}
        <li className="flex justify-center pb-2">
          <Link
            to="/beneficiarios/novo"
            className="flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
            style={{ width: 52, height: 52, marginBottom: 2 }}
          >
            <Plus className="h-6 w-6" />
          </Link>
        </li>

        {/* Lista diária */}
        {bottomNavMain.slice(2).map((item) => {
          const Icon = item.icon;
          const active = loc.pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn("flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}

        {/* Mais */}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex w-full flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
                Mais
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
              <SheetHeader className="mb-4">
                <SheetTitle className="text-left text-sm">Menu</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 pb-4">
                {visibleMore.map((item) => {
                  const Icon = item.icon;
                  const active = loc.pathname === item.to || (item.to !== "/" && loc.pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { setMoreOpen(false); onLogout(); }}
                  className="flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, refreshToken, originalSession, stopImpersonation } = useAuth();
  useInactivityLogout();
  const { nomeCozinha } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    if (refreshToken) authApi.logout(refreshToken).catch(() => {});
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {originalSession && (
        <div className="z-50 flex shrink-0 items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
          <span>Modo visualização: você está simulando o acesso de <strong>{user?.nome}</strong> ({user?.role})</span>
          <button
            onClick={() => { stopImpersonation(); navigate({ to: "/" }); }}
            className="rounded-md bg-amber-950/20 px-3 py-1 text-xs font-semibold hover:bg-amber-950/30"
          >
            Sair da simulação
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar">
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <SidebarLinks />
          </div>
          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.nome?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "MB"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{user?.nome ?? "Convidado"}</div>
                <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{user?.role ?? "—"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          {/* Topbar */}
          <header className="shrink-0 sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:h-16 lg:px-6">
            <div className="lg:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="border-b px-5 py-4 text-left">
                    <SheetTitle><Logo /></SheetTitle>
                  </SheetHeader>
                  <div className="py-3">
                    <SidebarLinks onNavigate={() => setOpen(false)} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 border-t bg-background p-3">
                    <Button variant="outline" className="w-full" onClick={() => { handleLogout(); setOpen(false); }}>
                      <LogOut className="mr-2 h-4 w-4" /> Sair
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="lg:hidden"><Logo compact /></div>
            <div className="hidden truncate text-sm font-semibold text-muted-foreground lg:block">{nomeCozinha}</div>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/painel" className="hidden sm:inline-flex">
                <Button variant="outline" size="sm" className="gap-2">
                  <Tv className="h-4 w-4" /> Modo painel
                </Button>
              </Link>
              <Avatar className="h-8 w-8 lg:hidden">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.nome?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "MB"}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <motion.main
            key={typeof window !== "undefined" ? window.location.pathname : ""}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 overflow-y-auto px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-6"
          >
            {children}
          </motion.main>
        </div>
      </div>

      {/* Mobile bottom nav — fora da área scrollável, sempre visível */}
      <MobileBottomNav user={user} onLogout={handleLogout} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
