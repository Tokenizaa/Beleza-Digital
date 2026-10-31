/**
 * vercelHandler.ts — Entry point serverless (stub funcional).
 *
 * O projeto BelezaDigital está direcionado ao Cloudflare Pages, não ao
 * Vercel Functions com Express. Este arquivo é mantido como stub para
 * evitar referências quebradas em qualquer ferramenta que ainda o importe.
 *
 * Retorna 503 com mensagem informativa indicando que o servidor não está
 * configurado para este runtime.
 */

import type { Request, Response } from 'express';

export default async function vercelHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(503).json({
    error: 'servidor_indisponível_para_vercel',
    message:
      'Este projeto está direcionado ao Cloudflare Pages. O vercelHandler é um stub ' +
      'mantido para evitar importações quebradas. Use o build do Cloudflare Pages ' +
      '(wrangler pages deploy) ou o Worker prospecting-scheduler.',
  });
}
