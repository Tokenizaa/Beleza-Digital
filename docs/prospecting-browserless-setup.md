# Operação da prospecção com Browserless

## Arquitetura

- O Worker `prospecting-scheduler` executa a fila e o agendamento a cada 5 minutos.
- A coleta do Google Maps usa Browserless `POST /function` pelo backend. O token nunca é enviado ao navegador.
- O Worker principal `beleza-digital` chama o scheduler por Service Binding (`PROSPECTING_SCHEDULER`).
- A busca manual cria uma tarefa idempotente; o scheduler processa em segundo plano e a tela acompanha a fila pelo endpoint administrativo.
- A qualificação usa os critérios cadastrais e comerciais compartilhados. Leads aprovados recebem projeto de site, cinco versões de template e publicação de demonstração.
- O CRM obtém somente links de demonstração ativos e não expirados.

## Segredos e variáveis

No Worker `prospecting-scheduler`, configurar:

- `BROWSERLESS_TOKEN`: token privado da conta Browserless.
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave de serviço do Supabase.
- `PROSPECTING_WORKER_SECRET`: segredo compartilhado para disparo imediato autenticado.

No Worker principal `beleza-digital`, configurar o mesmo valor de `PROSPECTING_WORKER_SECRET`. O Service Binding já está declarado em `wrangler.jsonc`; não é necessário publicar a URL pública do scheduler.

A variável não secreta `BROWSERLESS_BASE_URL` usa `https://production-sfo.browserless.io`. O lote do scheduler é limitado a duas tarefas por execução.

**Nunca** grave tokens ou chaves em arquivos versionados, no frontend ou em logs.

## Deploy

Executar a partir da raiz do repositório, depois de atualizar a branch:

```bash
npx wrangler secret put BROWSERLESS_TOKEN --config workers/prospecting-scheduler/wrangler.jsonc
npm run deploy:prospecting
npm run build
npm run deploy
```

Se `PROSPECTING_WORKER_SECRET` ainda não existir, definir o mesmo segredo nos dois Workers:

```bash
npx wrangler secret put PROSPECTING_WORKER_SECRET --config workers/prospecting-scheduler/wrangler.jsonc
npx wrangler secret put PROSPECTING_WORKER_SECRET --config wrangler.jsonc
```

Ao configurar um segredo compartilhado, usar exatamente o mesmo valor nos dois prompts. Não reutilizar nem imprimir esse valor em logs.

## Verificação

- `GET /api/prospecting/status`: verifica conexão com o scheduler e informa apenas presença/ausência de configuração.
- `POST /api/prospecting/run`: exige sessão de Admin Geral e enfileira uma busca manual.
- `GET /api/prospecting/dashboard`: exige sessão de Admin Geral e apresenta tarefas, candidatos e contagens reais.
- Confirmar no banco a sequência `discover → capture → qualify → generate_demo → publish_demo`.
- Confirmar cinco versões do projeto e um link ativo antes de preparar a mensagem comercial.

## Agendamento e campanhas legadas

Campanhas novas de execução pontual são gravadas com `schedule.one_time=true`. Campanhas recorrentes exigem `schedule.interval_minutes` explícito (mínimo de 5 minutos). Campanhas antigas sem uma dessas configurações são ignoradas pelo scheduler para evitar transformar buscas pontuais antigas em raspagem diária sem autorização.

## Mensagens

O CRM prepara uma mensagem click-to-chat do WhatsApp somente quando existe telefone válido e demonstração publicada. Abrir o link não envia a mensagem.

O envio automatizado pela WhatsApp Business Platform permanece separado e exige credenciais Meta, template aprovado, elegibilidade explícita, opt-in com evidência e ausência de opt-out. Não criar tarefas `send_whatsapp` automaticamente após publicar o site. Sem consentimento comprovado, o envio permanece bloqueado.

## Recuperação do legado

As tarefas antigas em `blocked` e `dead_letter` não são reabertas em massa. Primeiro validar uma busca pequena com Browserless, conferir os dados e a qualificação e só então selecionar tarefas antigas para reprocessamento idempotente.
