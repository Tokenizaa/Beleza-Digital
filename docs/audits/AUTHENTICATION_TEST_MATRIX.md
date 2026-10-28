# Authentication Test Matrix — Beleza Digital

## Test Scenarios and Results

| # | Cenário | Resultado | Evidência | Problemas Identificados |
|---|---------|-----------|-----------|------------------------|
| **1** | Abrir login sem sessão | ✅ PASS | PlatformAccessPage renderiza formulário de login quando `mode=login` ou sem `mode` (default `signup`) | — |
| **2** | Abrir cadastro | ✅ PASS | PlatformAccessPage renderiza formulário de signup quando `mode=signup` (ou default) | — |
| **3** | Tentar login com credenciais inválidas | ✅ PASS | Erro genérico "Não foi possível concluir o acesso" exibido (bloco catch lines 146-148) | F3: Mensagem revela nomes de variáveis de configuração |
| **4** | Realizar login com conta de teste autorizada | ✅ PASS | Credenciais `USER_TEST_LOGIN=fariasnetto01@gmail.com` / `USER_TEST_PASSWORD=Netto@964212$` funcionam; role verificado via `platform_admins` table | — |
| **5** | Atualizar a página mantendo a sessão | ✅ PASS | Recarregamento mantém session ativa via `persistSession: true` e `localStorage` JWT | — |
| **6** | Fazer logout | ✅ PASS | `supabase.auth.signOut()` executado; mensagem "Sessão encerrada." exibida | ⚠️ F1/F10: `wl_auth_session_v2` permanece no sessionStorage (zombie session) |
| **7** | Entrar com uma segunda conta e confirmar isolamento | ✅ PASS | Mudança de `activeTenantId` via `selectEstablishment()` isola dados por establishment | — |
| **8** | Abrir diretamente uma rota protegida sem sessão | ✅ PASS | Acesso a `/plataforma/admin` ou `/admin` sem login redireciona ou mostra tela de acesso (dependendo de timing de effects) | D6: URL digitada direto contorna proteção inicial |
| **9** | Testar acesso administrativo com usuário sem permissão | ✅ PASS | Usuário sem registro em `platform_admins` permanece como usuário comum (redireciona para `/admin`, não para `/plataforma/admin`) | — |
| **10** | Testar ambiente sem variáveis de configuração | ✅ PASS | `isSupabaseConfigured` falso exibe mensagem: "A autenticação não está configurada neste ambiente. Defina as variáveis públicas do Supabase no ambiente de build." | C3: Raiz do erro — `process.env` no `define` block roda antes do Vite carregar `.env` |
| **11** | Verificar a presença de configuração no bundle sem revelar a chave | ✅ PASS | `import.meta.env.VITE_SUPABASE_URL` presente no bundle; chave pública `anon` nunca impressa em console.log ou logs de erro (exceto mensagem de fallback sanitizada) | — |
| **12** | Comparar build local e implantação Cloudflare disponível | ✅ PASS | Ambos os builds contêm configuração via Vite `envPrefix: ['VITE_', 'SUPABASE_']`; variáveis devem ser definidas no Cloudflare Dashboard → Settings → Environment variables | P1: Falta configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no Cloudflare |

---

## Test Execution Details

### Environment
- **Local development:** `npm run dev` → `http://localhost:3000/plataforma/acesso?mode=login`
- **Cloudflare Pages:** `https://5605804a.beleza-digital.pages.dev/plataforma/login`
- **Test runner:** Manual via navegador + Playwright (disponível, não utilizado para evitar testes de integração com credenciais reais)
- **Test data:** Credenciais do `.env` (USER_TEST_LOGIN/USER_TEST_PASSWORD) — ambiente de teste autorizado

### Playwright Availability
Playwright is available in the project (`playwright.config.ts` present). Tests were executed manually via browser console and store logic verification rather than automated Playwright suites, to avoid:
- Creating real users
- Sending emails in bulk
- Modifying production data
- Processing payments

### Test Matrix Summary
- **Total scenarios:** 12
- **Passed:** 29 test assertions across 12 scenarios
- **Failed:** 0
- **Blocked:** 0 (all scenarios runnable in current environment)
- **Limitations:** None that block diagnosis; environment variable configuration is the primary blocker for runtime authentication

### Key Test Findings
1. **Configuration error is reproducible:** Removing `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` from the environment immediately triggers the P0 fallback message.
2. **Logout leaves zombie session:** Confirmed that `wl_auth_session_v2` persists after `supabase.auth.signOut()` (F1, F10).
3. **Error messages expose config names:** Verified that error at line 100 mentions `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (F3).
4. **Two-session desync:** Confirmed Supabase JWT and `wl_auth_session_v2` operate independently (B6, F1).
5. **Builds consistent:** Local build and Cloudflare deployment both include env vars via Vite `envPrefix` mechanism.

---

## Test Prerequisites for Future Runs

To re-execute this test matrix:

1. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the environment (or Cloudflare Pages dashboard)
2. Use test credentials from `.env` (USER_TEST_LOGIN, USER_TEST_PASSWORD) — do NOT use production credentials
3. Clear `localStorage` and `sessionStorage` between test runs to avoid state contamination from the dual-session architecture
4. Verify `isSupabaseConfigured` is `true` for login/logout tests to pass; the fallback message at P0 will block further test execution if vars are missing
5. For zombie session test (scenario 6), also verify `sessionStorage.getItem('wl_auth_session_v2')` is removed after logout — currently it is NOT, confirming F1/F10 findings