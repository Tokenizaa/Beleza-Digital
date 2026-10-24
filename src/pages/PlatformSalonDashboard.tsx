import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UnifiedAdminDashboard } from './UnifiedAdminDashboard';

export function PlatformSalonDashboard() {
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
      const { data: admin, error } = await client.from('platform_admins')
        .select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!active) return;
      if (error) {
        setChecking(false);
        return;
      }
      // Se o usuário está cadastrado como platform_admin, vai para o painel mestre.
      // Caso contrário (establishment_admin), abre o painel do salão.
      if (admin) {
        window.location.replace('/plataforma/admin');
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
    return <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-200">Verificando acesso ao salão…</main>;
  }
  // Renderiza o painel unificado com sidebar única (gestão do salão). O wrapper já validou a sessão Supabase.
  return <UnifiedAdminDashboard
    initialSection="salao-dashboard"
    preAuthenticated
    onBackToApp={() => { void supabase?.auth.signOut(); window.location.assign('/'); }}
  />;
}
