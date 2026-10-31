# Modelo de dados — prospecção automatizada e sites white-label

## Entidades

| Tabela | Responsabilidade |
|---|---|
| `platform_admins` | Identidade administrativa; a autorização efetiva exige claim confiável emitida pelo backend. |
| `establishments` | Clientes com site e configuração de marca. Yeshua é apenas um registro inicial. |
| `establishment_memberships` | Vínculo entre usuário e estabelecimento, com papel. |
| `prospects` | Negócios descobertos antes de virarem clientes, com dados originais, fonte, campos normalizados, chave de deduplicação e qualificação. |
| `prospecting_campaigns` | Segmento/região, fonte configurada, regras, agenda, limites e estado operacional de cada campanha. |
| `prospecting_tasks` | Fila durável de descoberta, captura, qualificação, geração de demonstração e envio, com idempotência, tentativas, locks e erros. |
| `prospect_events` | Histórico append-only de eventos do funil e evidências do provedor. |
| `prospect_outbound_messages` | Tentativas de contato e estados confirmados pelo provedor, incluindo falha e opt-out. |
| `site_templates` / `site_template_versions` | Catálogo de modelos e versões imutáveis de configuração. |
| `site_projects` | Projeto vinculado a um prospect ou a um estabelecimento convertido. |
| `site_project_versions` | Histórico imutável de versões da demonstração e seleção de modelo. |
| `audit_events` | Registro de ações relevantes de segurança, administração e publicação. |

## Fluxo de dados

```text
Campanha configurada
  -> tarefa de descoberta
  -> prospect + fonte/data/evidências
  -> normalização + deduplicação persistente
  -> qualificação determinística e explicável
  -> projeto de demonstração + versão do modelo
  -> landing page pública individual
  -> seleção pública de modelo + nova versão
  -> verificação de elegibilidade/base legal para contato
  -> tarefa de WhatsApp + status confirmado pelo provedor
  -> resposta/interesse/opt-out
  -> fase posterior: cadastro -> estabelecimento -> pagamento -> ativação
```

A execução deve ser assíncrona, idempotente e independente de navegador aberto. Revisão humana pode existir para exceções, mas não é um gate obrigatório do fluxo normal.

## Regras de integridade

- `captured_data` mantém o dado original; `qualification` guarda score, critérios e razões. Não confundir hipótese com fato.
- `public_source_urls`, `source_name` e `source_captured_at` preservam a procedência. Evidências devem ser suficientes para auditar cada etapa.
- `dedupe_key` é uma chave determinística criada a partir de identidade normalizada e protegida por índice único. Não criar uma chave a partir de informação insuficiente.
- O score de qualificação nunca equivale a consentimento ou autorização para enviar mensagens.
- O contato por WhatsApp deve falhar fechado: exige elegibilidade explícita, registro de opt-in aplicável e ausência de opt-out. Um telefone encontrado publicamente não comprova consentimento.
- `prospecting_tasks.idempotency_key` impede que retentativas criem efeitos duplicados. Workers reivindicam tarefas com bloqueio atômico; locks antigos podem ser recuperados respeitando o limite de tentativas.
- `prospect_events` mantém o histórico do funil. Eventos repetidos do provedor são deduplicados por identificador quando disponível.
- `prospect_outbound_messages` diferencia enfileirado, tentativa, enviado, entregue/lido (quando informado), falha, resposta e opt-out. Enfileirar ou copiar uma mensagem não significa que ela foi enviada.
- `site_projects` exige exatamente um contexto: prospect não convertido ou estabelecimento convertido. Cada versão aponta para uma versão imutável do modelo.
- A demonstração pública deve usar uma camada de leitura restrita; não conceder leitura anônima ampla das tabelas operacionais.
- RLS e autorização devem ser testadas no banco real. Não considerar migration aplicada apenas porque está no Git.
- A chave service-role só pode ser usada em servidor confiável, nunca no browser. Tabelas de fila e escrita operacional não devem ser expostas aos papéis anon/authenticated.
- A conversão preserva prospect, histórico, projeto e modelo escolhido; não duplica o lead.

## Estado de implementação (2026-10-20)

As migrations `20261020185512_prospecting_automation_foundation.sql`, `20261020185517_prospecting_worker_rpc.sql` e `20261020185601_prospecting_service_role_grants.sql` e `20261020190124_prospecting_index_policy_tuning.sql` foram aplicadas ao projeto Supabase `ifkqrtjhdnolkuucgbpb`. A existência das tabelas, RLS, privilégios da fila e a capacidade de executar a função de claim foram verificadas por consulta SQL. `src/lib/prospecting.ts` contém funções puras para normalização, deduplicação, score explicável e gate de elegibilidade para WhatsApp.

**Ainda não comprovado:** execução real de workers, fornecedor de descoberta conectado, integração WhatsApp configurada, persistência do dashboard substituindo `localStorage`, landing page comercial completa e certificação E2E. A presença de esquema ou código não deve ser descrita como integração operacional.
