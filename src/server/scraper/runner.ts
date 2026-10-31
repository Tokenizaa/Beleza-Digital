/**
 * runner.ts — Ponte do consumidor de fila para o Worker de prospecção.
 *
 * O motor de captura original (scraper-engine, Puppeteer + Browserless) foi
 * substituído por uma arquitetura distribuída: a execução real da raspagem
 * acontece no Cloudflare Worker `prospecting-scheduler`. Este módulo expõe
 * `runScraperJob` para que o `queue-consumer.ts` possa delegar a execução
 * via HTTP ao Worker, mantendo a camada de fila desacoplada do navegador.
 *
 * Responsabilidade: apenas orquestrar a chamada ao Worker. Não grava no
 * Supabase, não qualifica, não deduplica. Apenas dispara e retorna progresso.
 */

import { getSupabase, updateJobProgress, getJob, type ScrapeJob } from '../db';
import { writeAuditLog } from '../audit-log';

interface RunScraperJobParams {
  jobId: string;
  segment: string;
  location: string;
  limitRequested: number;
  onProgress: (progress: Partial<ScrapeJob>) => Promise<void>;
  browserWsEndpoint: string;
}

interface WorkerRunPayload {
  task: 'discover';
  segment: string;
  location: string;
  limit: number;
  jobId: string;
}

/**
 * Resolve a URL do Worker de prospecção a partir do ambiente.
 * Prioriza PROSPECTING_WORKER_URL; fallbacks para BROWSER_WS_ENDPOINT se
 * o Worker não estiver exposto como HTTP (compatibilidade local).
 */
function resolveWorkerUrl(env: Record<string, unknown>): string | null {
  const url =
    String(env.PROSPECTING_WORKER_URL ?? '').trim() ||
    String(process.env.PROSPECTING_WORKER_URL ?? '').trim();
  return url || null;
}

/**
 * Envia uma tarefa de descoberta para o Worker de prospecção e aguarda o
 * resultado. O Worker é responsável por navegar no Google Maps, extrair,
 * normalizar e persistir os dados via Supabase.
 */
async function dispatchToWorker(
  workerUrl: string,
  payload: WorkerRunPayload,
  secret: string | undefined,
): Promise<{ ok: boolean; collected?: number; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min

  try {
    const response = await fetch(`${workerUrl}/api/prospecting/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        error: `Worker retornou ${response.status}: ${body.slice(0, 500)}`,
      };
    }

    const result = (await response.json()) as {
      ok?: boolean;
      total_collected?: number;
      error?: string;
    };

    return {
      ok: !!result.ok,
      collected: result.total_collected,
      error: result.error,
    };
  } catch (error: any) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Erro ao chamar Worker: ${error.message}`
          : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Executa um job de raspagem delegando para o Worker de prospecção.
 *
 * Este é o entry point esperado por `queue-consumer.ts`. Não toca diretamente
 * no navegador nem no Supabase (exceto para atualizar o progresso do job).
 */
export async function runScraperJob({
  jobId,
  segment,
  location,
  limitRequested,
  onProgress,
  browserWsEndpoint,
}: RunScraperJobParams): Promise<void> {
  const env = typeof process !== 'undefined' ? process.env : {};
  const workerUrl = resolveWorkerUrl(env as Record<string, unknown>);

  if (!workerUrl) {
    await onProgress({
      status: 'failed',
      status_message:
        'PROSPECTING_WORKER_URL não configurado. O Worker de prospecção não está disponível.',
      current_step: 'Configuração ausente',
      completed_at: new Date().toISOString(),
    });
    await writeAuditLog({
      level: 'error',
      category: 'scraper.runner',
      event: 'scraper_job.blocked',
      message: 'PROSPECTING_WORKER_URL ausente; job não pode ser executado.',
      jobId,
      metadata: { segment, location, limit: limitRequested },
    });
    return;
  }

  const secret = String(env.PROSPECTING_WORKER_SECRET ?? '').trim() || undefined;

  await onProgress({
    status: 'running',
    current_step: 'Enviando tarefa de descoberta para o Worker',
    total_found: 0,
    total_collected: 0,
    total_errors: 0,
    total_duplicates: 0,
  });

  try {
    const result = await dispatchToWorker(workerUrl, {
      task: 'discover',
      segment,
      location,
      limit: limitRequested,
      jobId,
    }, secret);

    if (!result.ok) {
      await onProgress({
        status: 'failed',
        status_message: result.error || 'Falha desconhecida no Worker.',
        current_step: 'Falha no Worker',
        completed_at: new Date().toISOString(),
      });
      await writeAuditLog({
        level: 'error',
        category: 'scraper.runner',
        event: 'scraper_job.failed',
        message: result.error || 'Falha ao executar job de raspagem.',
        jobId,
        metadata: { segment, location, limit: limitRequested },
      });
      return;
    }

    // Atualiza o job com o resultado coletado
    const job = await getJob(jobId);
    const collected = result.collected ?? 0;

    await onProgress({
      status: collected > 0 ? 'completed' : 'partial',
      total_collected: collected,
      current_step:
        collected > 0
          ? `Coleta concluída: ${collected} registro(s)`
          : 'Nenhum registro coletado',
      completed_at: new Date().toISOString(),
    });

    await writeAuditLog({
      level: 'info',
      category: 'scraper.runner',
      event: 'scraper_job.completed',
      message: `Job finalizado: ${collected} registro(s) coletado(s).`,
      jobId,
      metadata: {
        segment,
        location,
        limit: limitRequested,
        collected,
        workerUrl,
      },
    });
  } catch (error: any) {
    const message =
      error instanceof Error ? error.message : String(error);
    await onProgress({
      status: 'failed',
      status_message: 'Exceção ao executar job: ' + message.slice(0, 300),
      current_step: 'Exceção no runner',
      completed_at: new Date().toISOString(),
    });
    await writeAuditLog({
      level: 'error',
      category: 'scraper.runner',
      event: 'scraper_job.exception',
      message,
      jobId,
      metadata: { segment, location, limit: limitRequested },
    });
  }
}
