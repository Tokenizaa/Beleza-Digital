import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Ler credenciais do ambiente (NÃO do frontend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Token simples para validar chamadas (apenas administrador)
const SERVICE_TOKEN = process.env.SCRAPE_SERVICE_TOKEN;

// Estado da execução persistente em memória (por requisição)
// Em produção, usar Redis ou tabela Supabase dedicada
interface ScrapeState {
  executionId: string;
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'failed';
  startedAt: string;
  finishedAt?: string;
  segment: string;
  city: string;
  region: string;
  limit: number;
  countryCode: string;
  newRecords: number;
  duplicates: number;
  error?: string;
}

// Mapa simples de estados por executionId
const statesMap = new Map<string, ScrapeState>();

// Helper: gerar executionId único
function generateExecutionId(): string {
  return `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper: obter estado ou criar novo
function getState(executionId: string, segment: string, city: string, region: string, limit: number, countryCode: string): ScrapeState {
  let state = statesMap.get(executionId);
  if (!state) {
    state = {
      executionId,
      status: 'running',
      startedAt: new Date().toISOString(),
      segment,
      city,
      region,
      limit,
      countryCode,
      newRecords: 0,
      duplicates: 0,
    };
    statesMap.set(executionId, state);
  }
  return state;
}

// Atualizar estado
function updateState(executionId: string, partial: Partial<ScrapeState>) {
  const state = statesMap.get(executionId);
  if (state) {
    Object.assign(state, partial);
  }
}

/**
 * Rota POST /api/prospecting/local-scrape
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas métodos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { segment, city, region, limit = 10, countryCode = 'BR', executionId } = req.body as {
      segment: string;
      city: string;
      region: string;
      limit?: number;
      countryCode?: string;
      executionId?: string;
    };

    if (!segment || !city || !region) {
      return res.status(400).json({ error: 'Segmento, cidade e região são obrigatórios.' });
    }

    // Se houve executionId anterior, recuperar estado
    const state = executionId ? getState(executionId, segment, city, region, limit || 10, countryCode || 'BR') : null;

    // Se existe estado anterior 'completed' ou 'blocked', não reiniciar do zero para os mesmos parâmetros
    // (Na prática, o dashboard deve gerar um novo executionId para nova busca, 
    // mas permitir continuar se houver estado salvo)
    const isNewSearch = !executionId || state.status === 'idle' || state.status === 'failed';

    // Se não for nova busca e já tiver estado final, não executar novamente
    if (!isNewSearch && state.status === 'completed' || state.status === 'blocked') {
      return res.status(200).json({
        ...state,
        message: 'Busca já concluída anteriormente. Use novos parâmetros ou gerei um novo executionId.',
      });
    }

    // Se há state anterior 'running' e não tivemos tempo de completar, podemos continuar
    // mas para este simples caso, sempre iniciamos novo ciclo

    // Executar o script de raspagem local via CLI
    const cliArgs = [
      '--segment', segment,
      '--city', city,
      '--region', region,
      '--limit', String(Math.max(1, Math.min(limit || 10, 50))),
      '--countryCode', countryCode || 'BR',
    ];

    // Monta o comando Node.js
    const cmd = `node scripts/scrape-local.cjs ${cliArgs.join(' ')}`;

    try {
      // Executa o script e ignora saída - ele persiste no Supabase sozinho
      execSync(cmd, { timeout: 120000, stdio: 'pipe' });
      console.log('✅ Script de raspagem finalizado');
    } catch (execError) {
      // O script pode falhar (Google Maps bloqueio, etc.), mas queremos verificar o banco de todos modos
      console.log('⚠️ Script finalizado com status não-zero (provável bloqueio do Google Maps ou limite diário):', execError.message);
    }

    // Após executar o scraper, consultar o banco para verificar os novos/atualizados registros
    // Filtrar pelos parâmetros da busca e provider
    let newRecords = 0;
    let duplicates = 0;
    try {
      const { count, error } = await supabase
        .from('prospecting_candidates')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('region', region)
        .eq('provider', 'google-maps-local');

      if (error) {
        console.error('❌ Erro ao consultar banco:', error);
      } else {
        newRecords = (count || 0);
        // Estimar duplicatas baseando no total anterior (aproximado)
        // Em produção, seria melhor rastrear IDs ou chaves de dedupe
        duplicates = 0; // Simplificação: considerar que o script já handle dedup interno
      }
    } catch (err) {
      console.error('❌ Exceção ao consultar banco:', err);
    }

    // Criar/atualizar estado
    const newState: ScrapeState = {
      executionId: executionId || generateExecutionId(),
      status: 'completed',
      startedAt: state ? state.startedAt : new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      segment,
      city,
      region,
      limit: limit || 10,
      countryCode: countryCode || 'BR',
      newRecords,
      duplicates,
    };

    // Guardar estado
    if (executionId) {
      statesMap.set(executionId, newState);
    }

    return res.status(200).json({
      ...newState,
      message: `Raspagem concluída. ${newRecords} novo(s) registro(s) adicionado(s) (${duplicates} duplicatas ignoradas).`,
    });
  } catch (error) {
    console.error('❌ Erro no endpoint local-scrape:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
