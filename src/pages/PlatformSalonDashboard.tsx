import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { store } from '../data/store';
import { establishmentRepository } from '../data/establishmentRepository';
import { UnifiedAdminDashboard } from './UnifiedAdminDashboard';

type AccessState = 'checking' | 'authorized' | 'denied';

export function PlatformSalonDashboard() {
  const [access, setAccess] = useState<AccessState>('checking');
  const [checkingMessage, setCheckingMessage] = useState('Verificando acesso ao estabelecimento…');

  useEffect(() => {
    if (!supabase) {
      window.location.replace('/plataforma/acesso?mode=login');
      return;
    }

    let active = true;
    let resolving = false;
    let denying = false;
    const client = supabase;

    const deny = (reason: string) => {
      if (!active || denying) return;
      denying = true;
      store.logout();
      window.location.replace(`/plataforma/acesso?mode=login&reason=${encodeURIComponent(reason)}`);
    };

    const verify = async () => {
      if (resolving) return;
      resolving = true;
      try {
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          deny('session-required');
          return;
        }

        const { data: admin, error: adminError } = await client
          .from('platform_admins')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (adminError) throw adminError;
        if (!active) return;
        if (admin) {
          window.location.replace('/plataforma/admin');
          return;
        }

        const { data: memberships, error: membershipError } = await client
          .from('establishment_memberships')
          .select('establishment_id, role, establishments(id, slug, name, status, logo_url, primary_color, secondary_color, contact, brand_settings, created_at, updated_at)')
          .eq('user_id', session.user.id);
        if (membershipError) throw membershipError;

        const membership = (memberships || []).find((item) =>
          ['owner', 'admin', 'editor', 'viewer'].includes(item.role)
        );
        if (!membership) {
          deny('membership-required');
          return;
        }

        const related = membership.establishments as unknown;
        const establishment = (Array.isArray(related) ? related[0] : related) as Record<string, unknown> | null;
        if (!establishment || establishment.id !== membership.establishment_id) {
          deny('establishment-unavailable');
          return;
        }
        if (establishment.status === 'inactive' || establishment.status === 'archived') {
          deny('establishment-inactive');
          return;
        }

        const establishmentId = String(establishment.id);
        const [profile, services, products, media, appointments, clients] = await Promise.all([
          establishmentRepository.getProfile(establishmentId),
          establishmentRepository.listServices(establishmentId),
          establishmentRepository.listProducts(establishmentId),
          establishmentRepository.listMedia(establishmentId),
          establishmentRepository.listAppointments(establishmentId).catch(() => []),
          establishmentRepository.listClients(establishmentId).catch(() => []),
        ]);
        if (!active) return;
        store.hydrateSupabaseSession({
          accessToken: session.access_token,
          userName: session.user.user_metadata?.owner_name || session.user.email || 'Administrador',
          establishment: { ...establishment, ...profile },
          membershipRole: membership.role as 'owner' | 'admin' | 'editor' | 'viewer',
          services,
          products,
          media,
          appointments,
          clients,
        });
        if (active) setAccess('authorized');
      } catch (error) {
        console.error('Falha ao validar acesso ao estabelecimento:', error);
        if (active) {
          setCheckingMessage('Não foi possível validar sua associação ao estabelecimento.');
          setAccess('denied');
        }
      } finally {
        resolving = false;
      }
    };

    void verify();
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        deny('session-required');
        return;
      }
      void verify();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (access !== 'authorized') {
    return <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-200">{access === 'denied' ? checkingMessage : 'Verificando acesso ao estabelecimento…'}</main>;
  }

  return <UnifiedAdminDashboard
    initialSection="salao-dashboard"
    preAuthenticated
    excludeModules={['prospeccao', 'rede', 'templates']}
    onBackToApp={async () => {
      await supabase?.auth.signOut({ scope: 'local' });
      store.logout();
      window.location.assign('/');
    }}
  />;
}
