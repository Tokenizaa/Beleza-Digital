# Prospecção, qualificação e oferta comercial

**Status:** diretriz de produto para orientar a evolução da implementação existente.  
**Princípio:** simplificar o fluxo e reutilizar os recursos já implementados; esta documentação não afirma que todas as etapas estejam concluídas em produção.

## Objetivo

Transformar a raspagem de estabelecimentos em um fluxo único: coleta pública → qualificação baseada em evidências → demonstração de site → preparação da abordagem manual pelo WhatsApp. O CRM é o ponto central de acompanhamento.

## Fluxo esperado

1. **Raspar agora:** iniciar a coleta imediatamente a partir da ação do usuário. Não exigir a criação de campanha recorrente para executar uma busca manual.
2. **Coletar dados públicos:** nome, categoria, endereço, telefone, site, nota, quantidade de avaliações, fotos e demais campos realmente disponíveis na fonte. Registrar origem e momento da coleta.
3. **Deduplicar:** evitar múltiplos registros do mesmo negócio sem apagar evidências anteriores.
4. **Qualificar automaticamente:** aplicar regras explícitas ao perfil e aos dados coletados; inspecionar o site com Playwright quando houver URL válida e acessível.
5. **Disponibilizar no CRM:** exibir dados observados, critérios, evidências, limitações, resultado da qualificação e próxima ação recomendada.
6. **Preparar demonstração:** gerar uma prévia com template compatível com o segmento e apenas dados verificados. Não inventar serviços, preços, horários, equipe ou funcionalidades.
7. **Preparar abordagem:** selecionar uma mensagem de marketing compatível com segmento e oportunidade; oferecer um botão para abrir o WhatsApp com número e texto pré-preenchido. O envio é manual.

## Qualificação baseada em evidências

### 1. Segmento
Inferir o segmento a partir da categoria e do nome do Google Maps, confirmando com o site quando possível. Exemplos: salão de beleza, barbearia, estética, manicure e cabeleireiro. Usar o resultado para selecionar template e mensagem, sem tratar inferências como fatos confirmados.

### 2. Presença e qualidade do site
Distinguir: sem site identificado; site acessível; site inacessível ou inspeção inconclusiva; site com problemas observados; site funcional sem problemas evidentes. A inspeção com Playwright pode verificar DOM/conteúdo, links, informações de contato, experiência móvel e caminhos de agendamento. Não concluir que um site é ruim só porque falhou uma requisição ou bloqueou automação.

### 3. Perfil Google Maps / Google Business Profile
Usar apenas sinais públicos disponíveis na coleta: nota, total e recência observável de avaliações, respostas públicas do proprietário quando acessíveis, fotos, categoria, completude das informações e links de contato. Avaliações e fotos são sinais de atividade pública, não prova de leads, faturamento ou conversão.

### 4. Redes sociais
Detectar links públicos para Instagram/Facebook no perfil ou site. Só analisar conteúdo público acessível, respeitando limitações e controles de acesso da plataforma. Registrar indisponibilidade quando não for possível inspecionar. Seguidores, curtidas e frequência de publicação são indicadores parciais; não representam quantidade real de leads. Não tentar acessar contas privadas nem contornar bloqueios.

### 5. Oportunidade de conversão
Verificar evidências observáveis como ausência de site, ausência de informações essenciais, contato difícil, ausência de chamada para ação ou falta de caminho claro de agendamento. Cada recomendação deve apontar a evidência que a motivou.

## Resultado da qualificação

Evitar uma pontuação opaca. Exibir uma classificação simples (por exemplo: alta oportunidade, oportunidade identificada, precisa de análise ou baixa prioridade) acompanhada dos motivos e da confiança/limitação da análise. Ausência de dados não equivale a avaliação negativa. As regras devem ser determinísticas, configuráveis e testáveis.

## Campanhas de marketing

Campanhas são **configurações de segmentação e abordagem comercial**, não o mecanismo obrigatório de disparo da raspagem. Podem definir segmento-alvo, sinais de oportunidade, template de demonstração, mensagem, critérios de prioridade e próxima ação.

Exemplos:
- Barbearia sem site → demonstração com serviços, localização e contato por WhatsApp.
- Salão sem site → demonstração com serviços e agendamento, se essas informações forem verificadas.
- Estabelecimento com site e problemas concretos → mensagem baseada nas melhorias realmente observadas.
- Presença digital consistente sem oportunidade clara → não priorizar automaticamente.

A campanha recorrente só deve existir quando o usuário escolher explicitamente uma rotina recorrente.

## Oferta comercial e hospedagem

O processo comercial deve comportar três alternativas, apresentadas conforme a preferência do cliente:
- **Plano A — site no domínio/hospedagem do cliente:** manter o site no ambiente que o cliente já possui, quando tecnicamente compatível.
- **Plano B — domínio próprio e hospedagem externa, como Hostinger:** orientar a contratação/configuração quando o cliente preferir essa opção; confirmar custos, requisitos e compatibilidade antes de prometer.
- **Plano C — hospedagem gerenciada pela Beleza Digital:** publicar no ambiente da plataforma, conforme os recursos e condições comerciais realmente disponíveis.

Essas alternativas são opções comerciais do produto; a existência desta diretriz não significa que automação, integração, preço ou provisionamento de cada plano já estejam implementados.

## CRM e estados

O CRM deve centralizar, no mesmo registro:
- dados originais da coleta, fonte e data;
- deduplicação e histórico relevante;
- segmento e qualificação com motivos/evidências;
- estado da inspeção do site;
- link e estado da demonstração;
- campanha/mensagem sugerida;
- estado da abordagem manual e retorno comercial;
- preferência de hospedagem, quando informada pelo cliente.

Estados sugeridos: coletado, qualificando, qualificado, demonstração pendente, demonstração pronta, abordagem preparada, contato realizado manualmente, respondeu, convertido ou não priorizar. Não registrar envio como realizado apenas porque o WhatsApp foi aberto.

## Limites e privacidade

Usar somente dados públicos pertinentes à prospecção comercial. Separar fatos observados de inferências e hipóteses. Não afirmar métricas privadas (leads, alcance detalhado, conversões ou faturamento) sem acesso autorizado. Respeitar termos, controles de acesso, limites técnicos e pedidos de não contato/opt-out. A mensagem deve ser personalizada, transparente e passível de revisão antes do envio.

## Critérios de aceite para a evolução

- O botão de raspagem inicia a coleta sem depender de agendamento recorrente.
- A qualificação é executada após a coleta e persiste os motivos/evidências.
- O site é inspecionado apenas quando existe URL e a inspeção é segura e possível.
- Falhas de inspeção são representadas como inconclusivas, não como prova de baixa qualidade.
- O CRM apresenta dados, qualificação, demonstração e abordagem no mesmo registro.
- Segmento e evidências determinam template/mensagem sem inventar fatos.
- O WhatsApp abre com mensagem preparada, mas o usuário realiza o envio manual.
- As opções de hospedagem são apresentadas conforme preferência, sem prometer integrações ainda não comprovadas.
- Testes cobrem deduplicação, regras de qualificação, ausência de dados, falhas de site e preparação de mensagens.
