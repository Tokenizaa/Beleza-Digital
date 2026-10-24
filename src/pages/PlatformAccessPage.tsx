import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CircleAlert, CreditCard, LogIn, LogOut, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_brl_cents: number;
  billing_period: 'one_time' | 'monthly' | 'yearly';
  access_days: number;
  max_booking_horizon_days: number;
};

type Payment = {
  id: string;
  checkout_url?: string;
  qr_url?: string;
  pix_copy_paste?: string;
};

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function PlatformAccessPage() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialDemoToken = queryParams.get('demoToken') || '';
  const initialVersionId = queryParams.get('versionId') || '';
  const initialSalonName = queryParams.get('name') || '';
  const initialMode = queryParams.get('mode') || 'signup';

  const [mode, setMode] = useState<'signup' | 'login'>(initialMode === 'login' ? 'login' : 'signup');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [salonName, setSalonName] = useState(initialSalonName);
  const [slug, setSlug] = useState(slugify(initialSalonName));
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSalonName));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);

  // Sync mode with URL
  useEffect(() => {
    window.history.replaceState({}, '', `/plataforma/acesso?mode=${mode}${initialDemoToken ? `&demoToken=${initialDemoToken}` : ''}${initialVersionId ? `&versionId=${initialVersionId}` : ''}${initialSalonName ? `&name=${encodeURIComponent(initialSalonName)}` : ''}`);
  }, [mode, initialDemoToken, initialVersionId, initialSalonName]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const refreshAdmin = async (userId: string) => {
      const { data: adminRow } = await client.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
      setIsPlatformAdmin(Boolean(adminRow));
    };
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      if (data.session) void refreshAdmin(data.session.user.id);
      else setIsPlatformAdmin(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (session) void refreshAdmin(session.user.id);
      else setIsPlatformAdmin(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Redirect platform admins to the admin panel immediately when detected
    if (sessionEmail && isPlatformAdmin && window.location.pathname !== '/plataforma/admin') {
      window.location.replace('/plataforma/admin');
    }
  }, [sessionEmail, isPlatformAdmin]);

  useEffect(() => {
    if (!supabase || !sessionEmail || isPlatformAdmin) return;
    supabase.from('billing_plans').select('id,slug,name,description,price_brl_cents,billing_period,access_days,max_booking_horizon_days')
      .eq('is_active', true).order('display_order').then(({ data, error: queryError }) => {
        if (queryError) setError('Não foi possível carregar os planos disponíveis.');
        else setPlans((data ?? []) as Plan[]);
      });
  }, [sessionEmail, isPlatformAdmin]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) {
      setError('O acesso à plataforma ainda não foi configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (password.length < 10) throw new Error('Use uma senha com pelo menos 10 caracteres.');
        if (slugify(salonName).length < 2) throw new Error('Informe um nome válido para o salão.');
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              signup_type: 'salon_owner',
              owner_name: ownerName.trim(),
              establishment_name: salonName.trim(),
              establishment_slug: slugify(slug || salonName),
              demo_token: initialDemoToken || undefined,
              selected_version_id: initialVersionId || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setSessionEmail(data.user?.email ?? email);
          setMessage('Conta criada. Seu salão foi cadastrado como rascunho; escolha um plano para ativá-lo.');
        } else {
          setMessage('Cadastro iniciado. Confirme o e-mail enviado e depois entre para continuar a contratação.');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(), password,
        });
        if (signInError) throw signInError;
        const { data: adminRow, error: roleError } = await supabase
          .from('platform_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (roleError) throw new Error('Não foi possível confirmar o tipo desta conta. Tente novamente.');
        const isAdminAccount = Boolean(adminRow);
        setSessionEmail(data.user.email ?? email);
        if (isAdminAccount) {
          window.location.replace('/plataforma/admin');
          return;
        }
        setMessage('Login do salão realizado.');
        window.location.replace('/admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o acesso.');
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async (planId: string) => {
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Entre novamente para continuar.');
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível gerar a cobrança PIX.');
      setPayment(body.payment as Payment);
      setMessage('Cobrança PIX criada. A ativação ocorre somente após confirmação do pagamento pela VenoPag.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar cobrança.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    try {
      // Clear only this browser's persisted session so a previous account
      // cannot keep the login screen hidden when another user needs to sign in.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      setPayment(null);
      setSessionEmail(null);
      setIsPlatformAdmin(false);
      setPlans([]);
      setMode('login');
      setMessage('Sessão encerrada. Entre com outra conta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível encerrar a sessão.');
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-6"><div className="max-w-lg rounded-2xl border border-neutral-800 p-8"><CircleAlert className="mb-4 text-amber-400" /><h1 className="text-2xl font-semibold">Acesso à plataforma</h1><p className="mt-3 text-neutral-400">A autenticação não está configurada neste ambiente. Defina as variáveis públicas do Supabase no ambiente de build.</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft size={16} /> Voltar ao site</a>
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-amber-400/10 p-3 text-amber-300"><Building2 /></div><div><p className="text-xs uppercase tracking-widest text-neutral-500">Plataforma de sites personalizados</p><h1 className="text-2xl font-semibold">{sessionEmail ? (isPlatformAdmin ? 'Administração geral' : 'Área do estabelecimento') : mode === 'signup' ? 'Criar conta' : 'Entrar na plataforma'}</h1></div></div>

          {sessionEmail ? (
            <div className="space-y-5">
              <p className="text-sm text-neutral-300">Sessão: <strong>{sessionEmail}</strong></p>
              <button type="button" disabled={busy} onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50">
                <LogOut size={16} /> Trocar de conta
              </button>
              {isPlatformAdmin ? (
                <div className="rounded-xl border border-emerald-800 p-4">
                  <p className="font-medium">Administrador geral ativo</p>
                  <p className="mt-1 text-sm text-neutral-400">Esta conta tem permissão administrativa geral da plataforma.</p>
                  <p className="mt-3 text-sm text-amber-300">Redirecionando para o painel administrativo...</p>
                </div>
              ) : (
                <>
                  {plans.length === 0 ? <p className="text-sm text-neutral-400">Nenhum plano está publicado para contratação no momento.</p> : plans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 p-4">
                      <div><p className="font-medium">{plan.name}</p><p className="mt-1 text-sm text-neutral-400">{plan.description || `${plan.access_days} dias de acesso`}</p><p className="mt-1 text-xs text-neutral-500">Agenda até {plan.max_booking_horizon_days} dias à frente</p><p className="mt-2 font-semibold">{formatPrice(plan.price_brl_cents)} <span className="text-xs font-normal text-neutral-500">/ {plan.billing_period === 'one_time' ? 'pagamento único' : plan.billing_period === 'monthly' ? 'mês (renovação não automática)' : 'ano (renovação não automática)'}</span></p></div>
                      <button disabled={busy} onClick={() => startPayment(plan.id)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"><CreditCard size={16} /> Contratar</button>
                    </div>
                  ))}
                  {payment && <div className="space-y-3 rounded-xl border border-emerald-800 p-4"><p className="font-medium">Pagamento PIX</p>{payment.qr_url && <img src={payment.qr_url} alt="QR Code PIX" className="mx-auto max-h-56 rounded-lg bg-white p-2" />}{payment.pix_copy_paste && <><textarea readOnly value={payment.pix_copy_paste} className="w-full rounded-lg bg-neutral-950 p-3 text-xs" /><button onClick={() => navigator.clipboard.writeText(payment?.pix_copy_paste || '')} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm">Copiar código PIX</button></>}{payment.checkout_url && <a className="block text-sm text-amber-300 underline" href={payment.checkout_url} target="_blank" rel="noreferrer">Abrir checkout VenoPag</a>}</div>}
                </>
              )}
              <button onClick={logout} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><LogOut size={16} /> Sair</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {initialDemoToken && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  Demonstração vinculada: os dados e o modelo escolhido serão associados à sua nova conta.
                </div>
              )}
              {mode === 'signup' && <><label className="block text-sm">Seu nome<input required autoComplete="name" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3" /></label><label className="block text-sm">Nome do salão<input required maxLength={120} value={salonName} onChange={e => { setSalonName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3" /></label><label className="block text-sm">Endereço do site (identificador)<input required maxLength={45} value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }} placeholder="meu-salao" className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3" /><span className="mt-1 block text-xs text-neutral-500">Pode ser ajustado posteriormente, se estiver disponível.</span></label></>}
              <label className="block text-sm">E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3" /></label>
              <label className="block text-sm">Senha<input required type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 10 : 1} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3" /></label>
              {error && <p role="alert" className="rounded-lg bg-rose-950/50 p-3 text-sm text-rose-300">{error}</p>}
              {message && <p role="status" className="rounded-lg bg-neutral-800 p-3 text-sm text-neutral-300">{message}</p>}
              <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50">{busy ? 'Aguarde...' : mode === 'signup' ? <><UserPlus size={17} /> Criar conta e salão</> : <><LogIn size={17} /> Entrar</>}</button>
              <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setMessage(''); }} className="w-full text-sm text-neutral-400 hover:text-white">{mode === 'signup' ? 'Já tem uma conta? Entrar' : 'Ainda não tem conta? Cadastrar salão'}</button>
            </form>
          )}
          {error && sessionEmail && <p role="alert" className="mt-4 rounded-lg bg-rose-950/50 p-3 text-sm text-rose-300">{error}</p>}
          {message && sessionEmail && <p role="status" className="mt-4 rounded-lg bg-neutral-800 p-3 text-sm text-neutral-300">{message}</p>}
        </div>
        <p className="mt-5 text-center text-xs text-neutral-500">Cada salão possui sua própria conta e seus próprios dados. A confirmação do pagamento é processada no servidor.</p>
      </div>
    </main>
  );
}