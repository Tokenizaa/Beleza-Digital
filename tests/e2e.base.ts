/**
 * ============================================================
 * E2E Base Helpers - Playwright 1.64 compatível
 * ============================================================
 * 
 * APENAS helpers e utilitários - NÃO contém test.beforeEach/test.afterEach
 * no topo de módulo (não suportado pelo Playwright).
 * 
 * Cada arquivo de teste define seus próprios hooks dentro da função runTests().
 * ============================================================
 */

// Módulo de helpers para testes e2e - imports nativos apenas
// O import de @playwright/test fica por conta dos arquivos de teste

// ============================================================
// 1. Helper de assert consistente
// ============================================================

/**
 * Função de assert estilizada para consistência entre testes.
 * Use em vez de console.log/console.error direto.
 * 
 * Importar e usar em cada teste individual.
 */
export function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
  }
}

// ============================================================
// 2. Helper HMAC (para reutilização em testes)
// ============================================================

/**
 * Gera assinatura HMAC-SHA256 hexadecimal.
 * Reutilizável em múltiplos testes da suíte.
 */
export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// 3. Funções utilitárias diversas
// ============================================================

/**
 * Formata número para ISO string consistente em testes.
 */
export function formatDateTimestamp(date: Date): string {
  return date.toISOString();
}

// ============================================================
// 4. Tipos úteis para testes
// ============================================================

/**
 * Opções padrão de teste robusto.
 */
export interface RobustTestOptions {
  /** Tempo limite em milissegundos (padrão: 60000) */
  timeout?: number;
  /** Número de retentativas (padrão: 1) */
  retries?: number;
  /** Tags para filtragem (--tag nome) */
  tags?: readonly string[];
}

/**
 * Padrão de resultado de teste.
 */
export interface TestResult {
  passed: number;
  failed: number;
  total: number;
}

// ============================================================
// Módulo finalizado - exportações individuais acima já cobrem tudo
// ============================================================