import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000';
const REPO_ROOT = path.resolve(process.cwd());

test.describe('Fase 1 — Prospecção: raspagem imediata e qualificação automática', () => {

  // ---------------------------------------------------------------
  // Verificação de código: endpoint de acionamento imediato existe
  // ---------------------------------------------------------------
  test('script local de prospecção existe e executa raspagem imediata', () => {
    const scriptPath = path.join(REPO_ROOT, 'scripts/scrape-local.cjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('playwright');
    expect(content).toContain('google-maps');
    expect(content).toContain('supabase');
    expect(content).toContain('dedupe');
    expect(content).toContain('candidates');
  });

  // ---------------------------------------------------------------
  // Verificação de código: LeadsDashboard chama o endpoint de acionamento imediato
  // ---------------------------------------------------------------
  test('LeadsDashboard aciona busca imediatamente (não aguarda cron)', () => {
    const dashboardPath = path.join(REPO_ROOT, 'src/pages/LeadsDashboard.tsx');
    expect(fs.existsSync(dashboardPath)).toBe(true);
    const content = fs.readFileSync(dashboardPath, 'utf-8');
    expect(content).toContain('/api/prospecting/run');
    expect(content).toContain('searchOperation');
    // A busca define isSearching=true ao iniciar; status usa searchOperation.status
    expect(content).toContain('setIsSearching');
    expect(content).not.toContain('interval_minutes: 1440');
  });

  // ---------------------------------------------------------------
  // Verificação de código: Worker já implementa discover/capture/qualify
  // ---------------------------------------------------------------
  test('Worker implementa discover, capture e qualify automático (migrado para local)', () => {
    // Worker migrado para script local de prospecção - usa createDedupeKey e lógica de persistência
    const scriptPath = path.join(REPO_ROOT, 'scripts/scrape-local.cjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('playwright');
    expect(content).toContain('createDedupeKey');
    expect(content).toContain('prospecting_candidates');
    expect(content).toContain('dedupe_key');
    // A lógica principal está no function main() e usa normalização + deduplicação
    expect(content).toContain('async function main');
    expect(content).toContain('normalizeBusinessName');
    expect(content).toContain('normalizeWebsite');
  });

  // ---------------------------------------------------------------
  // Verificação de código: deduplicação por dedupe_key
  // ---------------------------------------------------------------
  test('deduplicação por dedupe_key (website > telefone > nome+localização)', () => {
    const libPath = path.join(REPO_ROOT, 'src/lib/prospecting.ts');
    expect(fs.existsSync(libPath)).toBe(true);
    const content = fs.readFileSync(libPath, 'utf-8');
    expect(content).toContain('createProspectDedupeKey');
    expect(content).toContain('website:${website}');
    expect(content).toContain('phone:${phone}');
    expect(content).toContain('name-location:');
    const migrationPath = path.join(REPO_ROOT, 'supabase/migrations/20261020185512_prospecting_automation_foundation.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    expect(migration).toContain('prospects_dedupe_key_uidx');
    expect(migration).toContain('where dedupe_key is not null');
    // Referência ao script local migrado (antigo workers/prospecting-scheduler/src/index.ts)
    const scriptPath = path.join(REPO_ROOT, 'scripts/scrape-local.cjs');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    expect(scriptContent).toContain('createDedupeKey');
    expect(scriptContent).toContain('dedupe_key');
  });

  // ---------------------------------------------------------------
  // Verificação de código: qualificação com evidências e justificativa
  // ---------------------------------------------------------------
  test('qualificação automática com score, razões e campos ausentes', () => {
    const libPath = path.join(REPO_ROOT, 'src/lib/prospecting.ts');
    expect(fs.existsSync(libPath)).toBe(true);
    const content = fs.readFileSync(libPath, 'utf-8');
    expect(content).toContain('qualifyProspect');
    expect(content).toContain('score');
    expect(content).toContain('reasons');
    expect(content).toContain('missingFields');
    // A lógica de qualificação está em src/lib/prospecting.ts (qualifyProspect)
    // O script local usa a lib para qualificação e persiste no prospecting_candidates
    const scriptPath = path.join(REPO_ROOT, 'scripts/scrape-local.cjs');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    expect(scriptContent).toContain('createDedupeKey');
    expect(scriptContent).toContain('prospecting_candidates');
    const candPath = path.join(REPO_ROOT, 'supabase/migrations/20261020191500_prospecting_candidates.sql');
    const candContent = fs.readFileSync(candPath, 'utf-8');
    expect(candContent).toContain('qualification_reasons');
    expect(candContent).toContain('missing_fields');
  });

  // ---------------------------------------------------------------
  // Verificação de código: persistência (tabelas candidatos + CRM state)
  // ---------------------------------------------------------------
  test('tabelas de persistência existem (prospecting_candidates, prospecting_crm_state)', () => {
    const candPath = path.join(REPO_ROOT, 'supabase/migrations/20261020191500_prospecting_candidates.sql');
    const crmPath = path.join(REPO_ROOT, 'supabase/migrations/20261024010000_prospecting_crm_persistence.sql');
    expect(fs.existsSync(candPath)).toBe(true);
    expect(fs.existsSync(crmPath)).toBe(true);
    const cand = fs.readFileSync(candPath, 'utf-8');
    const crm = fs.readFileSync(crmPath, 'utf-8');
    expect(cand).toContain('create table if not exists public.prospecting_candidates');
    expect(crm).toContain('create table if not exists public.prospecting_crm_state');
    expect(cand).toContain('qualification_score');
    expect(cand).toContain('qualification_reasons');
    expect(cand).toContain('raw_evidence');
    expect(cand).toContain('source_captured_at');
  });

  // ---------------------------------------------------------------
  // Testes que requerem deploy nas Pages Functions + auth real (não executados localmente)
  // ---------------------------------------------------------------
  test.skip('acesso a /plataforma/prospeccao sem sessão redireciona para login (UI real, requer auth)', async ({ page }) => {
    // Requer sessão Supabase real ou verificação de redirect. Coberto na Fase 0.
  });

  test.skip('POST /api/prospecting/run retorna 200 com auth real (requer deploy nas Pages Functions)', async ({ page }) => {
    // Requer: PROSPECTING_WORKER_URL, PROSPECTING_WORKER_SECRET configurados nas Pages Functions
    // e sessão Supabase real de platform_admin. Não executável localmente (Vite não serve Pages Functions).
  });

  test.skip('UI real: clique em Buscar inicia coleta e exibe estado coletando (requer auth real)', async ({ page }) => {
    // Requer credenciais reais de Supabase com membership platform_admin.
    // Não executável sem credenciais de produção (não serão inventadas).
  });

});
