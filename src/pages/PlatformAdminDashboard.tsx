import React, { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { UnifiedAdminDashboard, type UnifiedAdminSection } from "./UnifiedAdminDashboard";
import { store } from "../data/store";

interface PlatformAdminDashboardProps { initialSection?: UnifiedAdminSection; }

type AccessStatus = "checking" | "authorized" | "error";

export function PlatformAdminDashboard({ initialSection = "prospeccao-hoje" }: PlatformAdminDashboardProps) {
  const [status, setStatus] = useState<AccessStatus>("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const client = supabase;

    const verify = async () => {
      const version = ++requestVersion;
      setStatus("checking");

      if (isSupabaseConfigured && client) {
        try {
          const { data: { session }, error: sessionError } = await client.auth.getSession();
          if (!active || version !== requestVersion) return;
          if (sessionError) throw sessionError;
          if (!session) {
            window.location.replace("/plataforma/acesso?mode=login");
            return;
          }

          const { data, error } = await client.from("platform_admins")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (!active || version !== requestVersion) return;
          if (error) throw error;
          if (!data) {
            window.location.replace("/plataforma/acesso?mode=login&reason=admin-required");
            return;
          }
          setStatus("authorized");
        } catch (error) {
          console.error("Falha ao validar administrador da plataforma:", error);
          if (active && version === requestVersion) setStatus("error");
        }
        return;
      }

      const storeSession = store.getCurrentSession();
      if (storeSession && storeSession.role) {
        if (active && version === requestVersion) setStatus("authorized");
      } else {
        window.location.replace("/plataforma/acesso?mode=login");
      }
    };

    void verify();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.replace("/plataforma/acesso?mode=login");
        return;
      }
      // Evita executar consultas Supabase dentro do callback síncrono do Auth.
      void Promise.resolve().then(() => { if (active) void verify(); });
    }).data.subscription;

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [retryCount]);

  if (status !== "authorized") {
    return (
      <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-200">
        <div className="text-center space-y-4">
          {status === "error" ? "Não foi possível validar sua permissão administrativa. Sua sessão foi preservada." : "Verificando acesso administrativo…"}
          {status === "error" && (
            <button type="button" onClick={() => setRetryCount((value) => value + 1)} className="block mx-auto rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
              Tentar novamente
            </button>
          )}
        </div>
      </main>
    );
  }

  return <UnifiedAdminDashboard
    initialSection={initialSection}
    preAuthenticated
    excludeModules={['salao']}
    onBackToApp={() => { void client?.auth.signOut({ scope: "local" }); window.location.assign("/") }}
  />;
}
