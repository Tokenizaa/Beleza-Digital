/**
 * Rota de compatibilidade para acionamento de prospecção.
 * Delega para o handler canônico de execução (run.ts) preservando a arquitetura nativa Cloudflare.
 */
import { onRequestPost as runHandler } from './run';

export const onRequestPost = runHandler;
