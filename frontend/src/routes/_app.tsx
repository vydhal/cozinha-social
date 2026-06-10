import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { configuracoesApi } from "@/lib/api/configuracoes.api";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("mdb-auth");
        const user = raw ? JSON.parse(raw)?.state?.user : null;
        if (!user) throw redirect({ to: "/login" });
      } catch (e) {
        if ((e as any)?.isRedirect) throw e;
        throw redirect({ to: "/login" });
      }
    }
  },
  component: () => (
    <AppShell>
      <SettingsLoader />
      <Outlet />
    </AppShell>
  ),
});

function SettingsLoader() {
  const setSettings = useSettings(s => s.set);

  const { data } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: configuracoesApi.get,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data) return;

    setSettings({
      nomeCozinha: data.nomeCozinha,
      corPrimaria: data.corPrimaria,
      mensagemBoasVindas: data.mensagemBoasVindas,
      limiteDiario: data.limiteDiario,
      tempoEsperaMin: data.tempoEsperaMin,
      logoUrl: data.logoUrl ?? undefined,
      faviconUrl: data.faviconUrl ?? undefined,
    });

    // Apply primary color to CSS variables
    if (data.corPrimaria) {
      const r = document.documentElement;
      r.style.setProperty("--primary", data.corPrimaria);
      r.style.setProperty("--ring", data.corPrimaria);
      r.style.setProperty("--sidebar-primary", data.corPrimaria);
      r.style.setProperty("--chart-1", data.corPrimaria);
    }

    // Update favicon dynamically
    if (data.faviconUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = data.faviconUrl;
    }
  }, [data, setSettings]);

  return null;
}
