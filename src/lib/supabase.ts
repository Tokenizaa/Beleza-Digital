import { createClient } from '@supabase/supabase-js';

// Lê variáveis de ambiente funcionando tanto no Vite (import.meta.env preenchido)
// quanto em Node/tsx (process.env), permitindo executar testes de unidade fora do Vite.
function envVar(...keys: string[]): string | undefined {
  for (const key of keys) {
    let value: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value = (import.meta.env as any)?.[key];
    } catch {}
    if (value) return value;
    if (typeof process !== 'undefined' && process.env) {
      value = process.env[key];
      if (value) return value;
    }
  }
  return undefined;
}

const supabaseUrl =
  envVar('VITE_SUPABASE_URL', 'SUPABASE_URL') || '';

const supabasePublishableKey =
  envVar(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  ) || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false, // desliga renovação automática para evitar loop de 400 em dev local
        detectSessionInUrl: false, // desliga detecção de sessão na URL em dev local
      },
    })
  : null;
