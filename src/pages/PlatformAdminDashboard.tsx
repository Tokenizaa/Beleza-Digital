import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UnifiedAdminDashboard } from './UnifiedAdminDashboard';

export function PlatformAdminDashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!supabase) {
      window.location.replace('/plataforma/acesso?mode=login');
      return;
    }
    let active = true;
    const client = supabase;
    const verify = async () => {
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        if (active) window.location.replace('/plataforma/acesso?mode=login');
        return;
      }
      const { data, error } = await client.from('platform_admins')
        .select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!active) return;
      if (error || !data) {
        await client.auth.signOut();
        window.location.replace('/plataforma/acesso?mode=login');
        return;
      }
      setAuthorized(true);
      setChecking(false);
    };
    void verify();
    const { data: listener } = client.auth.onAuthStateChange(() => { void verify(); });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checking || !authorized) {
    return <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-200">Verificando acesso administrativo…</main>;
  }
  // Renderiza o painel unificado com sidebar única (Super Admin / rede). O wrapper já validou a sessão Supabase.
  return <UnifiedAdminDashboard
    initialSection="rede-saloes"
    preAuthenticated
    platformAdmin
    onBackToApp={() => { void supabase?.auth.signOut(); window.location.assign('/'); }}
  />;
}
