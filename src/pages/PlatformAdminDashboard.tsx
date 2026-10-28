import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { UnifiedAdminDashboard } from "./UnifiedAdminDashboard";

export function PlatformAdminDashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // CONSISTÊNCIA: Quando Supabase está configurado, exigir sessão real.
    // Quando não está configurado, permitir sessão sintética (modo demo),
    // para evitar o redirecionamento quebrado que existia antes.
    let active = true;
    const verify = async () => {
      if (isSupabaseConfigured) {
        // Modo Supabase real: verificar sessão + platform_admins
        let client = supabase;
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          if (active) window.location.replace("/plataforma/acesso?mode=login");
          return;
        }
        const { data, error } = await client.from("platform_admins")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!active) return;
        if (error || !data) {
          await client.auth.signOut();
          window.location.replace("/plataforma/acesso?mode=login");
          return;
        }
        setAuthorized(true);
      } else {
        // Modo demo/synthetic: verificar sessão da store
        const store = useStore.getState();
        const storeSession = store.getCurrentSession();
        if (storeSession && storeSession.role) {
          setAuthorized(true);
        } else {
          // Nenhuma sessão válida — redirecionar para login sintético
          window.location.replace("/plataforma/acesso?mode=login");
        }
      }
      setChecking(false);
    };
    void verify();
  }, [isSupabaseConfigured]);

  if (checking || !authorized) {
    return <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-200">Verificando acesso administrativo…</main>;
  }
  // Renderiza o painel unificado.
  // Usa a seção de prospecção como inicial, pois é o módulo principal do admin.
  return <UnifiedAdminDashboard
    initialSection="prospeccao-hoje"
    preAuthenticated
    onBackToApp={() => { void supabase?.auth.signOut(); window.location.assign("/") }}
  />;
}
