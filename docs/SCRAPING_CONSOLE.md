# Console próprio de scraping — Beleza Digital

## Arquitetura

O console fica no painel administrativo da plataforma e usa o worker `prospecting-scheduler` como motor de coleta. A implementação reaproveita/adapta o extrator, normalizadores e seletores do MapScrape v2, mas não depende de uma chamada ao serviço remoto MapScrape para executar a coleta.

## Fluxo

1. O Admin Geral configura segmento, região, país e limite.
2. `POST /api/prospecting/run` valida a sessão Supabase e a permissão em `platform_admins`.
3. A Function persiste uma tarefa idempotente em `prospecting_tasks` e solicita o processamento do worker.
4. O worker usa o binding Cloudflare Browser `BROWSER`, coleta resultados públicos e detalhes disponíveis no Google Maps.
5. Os dados normalizados usados no CRM são salvos em `prospecting_candidates`; o payload integral observado é preservado em `raw_evidence.mapsScrapeFields`, junto do estado de captura dos campos e da origem.
6. O console consulta `GET /api/prospecting/dashboard`, que também valida a permissão do Admin Geral, e atualiza automaticamente enquanto houver tarefas ativas.

## Integridade dos dados

- Nenhum candidato fictício pode ser criado para simular uma busca manual.
- A ausência de um campo significa que ele não foi observado naquela captura; não comprova inexistência.
- O painel não substitui valores ausentes por zeros ou por descrições comerciais inventadas.
- A qualificação comercial é separada dos valores efetivamente coletados.
- A tabela exibe uma janela dos registros mais recentes; a contagem de coletados usa o total informado pelo PostgREST.
- Os detalhes do registro permitem inspecionar os campos brutos e a evidência persistida.

## Limites e validação

O scraping depende da informação pública que o Google Maps expõe na sessão e pode ser afetado por alterações de interface, bloqueios ou limites do provedor. A existência do código não prova que o binding Browser está ativo em produção.

Antes de produção, validar no CI o build, o type-check, a suíte de testes, uma coleta controlada autorizada e a persistência de campos ricos no banco. Este trabalho não implanta o worker nem altera secrets ou dados de produção.
