# E2E de produção — prospecção até proposta pronta

O teste usa a interface real do Beleza Digital e grava dados reais no Supabase de produção. Não usa fixtures, registros sintéticos nem dispara mensagens.

## Execução explícita

Configure as variáveis apenas no ambiente local do agente/terminal (nunca no repositório):

```bash
export E2E_RUN_PRODUCTION_FLOW=1
export E2E_BASE_URL=https://beleza-digital.olfnetto.workers.dev
export E2E_ADMIN_EMAIL='conta-admin-geral'
export E2E_ADMIN_PASSWORD='senha-da-conta'
export E2E_SEARCH_NICHE='barbearia'
export E2E_SEARCH_CITY='Porto Alegre'
export E2E_SEARCH_STATE='RS'

npm run test:e2e:production
```

Use um nicho/região com estabelecimentos ainda não coletados. O teste exige pelo menos um candidato novo com telefone válido e aguarda a publicação da demonstração.

## O que o Playwright executa

1. Login administrativo pela tela real.
2. Inicia uma busca no formulário de prospecção.
3. Confirma que novos candidatos foram persistidos.
4. Recarrega o painel e aguarda captura, qualificação, geração e publicação.
5. Confirma que os cinco templates estão acessíveis na demonstração pública.
6. Prepara o link wa.me e valida o texto preenchido, sem abrir o WhatsApp nem enviar.
7. Abre o site em um contexto de navegador limpo, sem sessão/localStorage administrativo.
8. Captura cada seção, a página completa e um GIF de rolagem vertical.

As capturas do estabelecimento real ficam em test-results/ e são evidências de teste; não devem ser copiadas para a landing pública. A landing usa as capturas ilustrativas de Studio Aurora geradas pela suíte playwright.templates.config.ts.

## Segurança e produção

- O teste cria candidatos reais no banco; não execute repetidamente sem necessidade.
- Nenhum passo cria tarefa send_whatsapp ou envia mensagens.
- O envio final permanece manual, após revisão humana da mensagem.
- O teste só executa com E2E_RUN_PRODUCTION_FLOW=1.
- O deploy do Worker é separado e exige marcar explicitamente deploy_worker=true no workflow manual.