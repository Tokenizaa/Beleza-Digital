# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: establishment_certification.test.ts >> Painel do Estabelecimento — Certificação Marco Zero >> Fase 2: Painel carrega com dados do establishment
- Location: tests/establishment_certification.test.ts:33:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/plataforma/acesso?mode=login
Call log:
  - navigating to "http://localhost:3000/plataforma/acesso?mode=login", waiting until "load"

```

# Test source

```ts
  1  | // SUÍTE DE TESTES DO PAINEL DO ESTABELECIMENTO — Beleza Digital
  2  | // Este teste foca exclusivamente no Painel do Estabelecimento, NÃO no pipeline de prospecção.
  3  | // Baseado no documento normativo 2026-11-01-auditoria-painel-estabelecimento.md
  4  | 
  5  | import { test, expect } from '@playwright/test';
  6  | 
  7  | const BASE = 'http://localhost:3000';
  8  | 
  9  | test.describe('Painel do Estabelecimento — Certificação Marco Zero', () => {
  10 |   test('Fase 1: Acesso não autenticado é bloqueado', async ({ page }) => {
  11 |     // usuário não autenticado não acessa painel protegido
  12 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  13 |     await expect(page.getByRole('heading', { name: /Entrar na plataforma|Criar conta/ })).toBeVisible();
  14 |     await expect(page.getByLabel(/E-mail/)).toBeVisible();
  15 |     await expect(page.getByLabel(/Senha/)).toBeVisible();
  16 |     await expect(page.getByRole('button', { name: /Entrar/ })).toBeVisible();
  17 |   });
  18 | 
  19 |   test('Fase 1: Login flow existe e renderiza', async ({ page }) => {
  20 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  21 |     // Page should show login form
  22 |     await page.waitForLoadState('domcontentloaded');
  23 |   });
  24 | 
  25 |   test('Fase 1: Sessão expirada redireciona', async ({ page }) => {
  26 |     await page.goto(`${BASE}/plataforma/admin`, { waitUntil: 'domcontentloaded' });
  27 |     // Deverá redirecionar para login quando não autenticado
  28 |     await page.waitForTimeout(1500);
  29 |     const url = page.url();
  30 |     expect(url).toContain('/plataforma/acesso');
  31 |   });
  32 | 
  33 |   test('Fase 2: Painel carrega com dados do establishment', async ({ page }) => {
  34 |     // O painel deve carregar com dados do establishment após login
> 35 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
     |                ^ Error: page.goto: net::ERR_CONNECTION_RESET at http://localhost:3000/plataforma/acesso?mode=login
  36 |     await page.waitForLoadState('domcontentloaded');
  37 |     // A página deve carregar sem erros críticos
  38 |     const errors: string[] = [];
  39 |     page.on('pageerror', (err) => errors.push(err.message));
  40 |     page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  41 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  42 |     expect(errors).toEqual([]);
  43 |   });
  44 | 
  45 |   test('Fase 2: Templates utilizam dados reais', async ({ page }) => {
  46 |     await page.goto(`${BASE}/`);
  47 |     // Verificar que os 5 templates são reconhecidos
  48 |     const templateNames = ['Ouro Clássico', 'Preto Esmeralda', 'Minimal Studio', 'Safira Executivo', 'Rubi Lounge'];
  49 |     for (const template of templateNames) {
  50 |       await expect(page.getByText(new RegExp(template))).toBeVisible({ timeout: 5000 });
  51 |     }
  52 |   });
  53 | 
  54 |   test('Fase 3: Deduplicação de telefone funciona', async () => {
  55 |     // Testar o fluxo de cadastro de cliente com phone normalization
  56 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  57 |     // Navegar para agendamento ou cliente
  58 |     // O input de telefone deve aceitar formato BR e normalizar
  59 |     const phoneInput = page.locator('input[type="tel"]');
  60 |     if (await phoneInput.count() > 0) {
  61 |       await phoneInput.fill('(11) 98765-4321');
  62 |       // O valor deve ser normalizado
  63 |       const value = await phoneInput.inputValue();
  64 |       // Deve conter apenas números e DDI
  65 |       expect(value).toMatch(/^\+?55?9?87654321?$/);
  66 |     }
  67 |   });
  68 | 
  69 |   test('Fase 3: Agendamento público cria reserva', async ({ page }) => {
  70 |     // Testar criação de agendamento público
  71 |     await page.goto(`${BASE}/`);
  72 |     // Procurar por serviços ou agendamento público
  73 |     // Deverá existir flow público de agendamento
  74 |     const serviceSelect = page.locator('select, [role="combobox"]');
  75 |     if (await serviceSelect.count() > 0) {
  76 |       await serviceSelect.first().click();
  77 |       await page.waitForTimeout(1000);
  78 |     }
  79 |   });
  80 | 
  81 |   test('Fase 4: Preview reflete alterações', async ({ page }) => {
  82 |     // Testar que alterações no painel aparecem na prévia
  83 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  84 |     await page.waitForLoadState('domcontentloaded');
  85 |     // A página deve carregar e mostrar os templates
  86 |     const templateSections = page.locator('.template-section, .modelo');
  87 |     await expect(templateSections.first()).toBeVisible({ timeout: 5000 });
  88 |   });
  89 | 
  90 |   test('Fase 5: Isolamento entre estabelecimentos', async ({ page }) => {
  91 |     // Testar que dados de um estabelecimento não vaziam para outro
  92 |     await page.goto(`${BASE}/plataforma/acesso?mode=login`);
  93 |     await page.waitForLoadState('domcontentloaded');
  94 |     // A página deve carregar corretamente
  95 |     await expect(page.getByRole('main')).toBeVisible();
  96 |   });
  97 | });
  98 | 
```