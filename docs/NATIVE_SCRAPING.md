# Raspagem nativa de estabelecimentos

## Decisão de arquitetura

A coleta do Beleza Digital roda no próprio worker de prospecção com Cloudflare Playwright e o binding de navegador já configurado. O worker não chama a API do MapScrape, não precisa de `MAPSCRAPE_API_KEY` e não depende do deployment `mapscrape-v2.vercel.app`.

O código do extrator foi adaptado dos componentes internos de extração/normalização do projeto MapScrape para preservar a cobertura dos campos, não o serviço remoto, o banco ou a fila dele.

## Campos capturados quando expostos pela ficha pública

- Identidade e contato: nome, categoria, endereço, telefone, site, URL do Maps, ID de origem, código postal, cidade, estado e país.
- Reputação e operação: nota, quantidade de avaliações, distribuição por estrelas, faixa de preço, status de funcionamento, horários semanais e próxima abertura.
- Conteúdo e conversão: descrição, serviços/atributos, link de agendamento, redes sociais e código Plus.
- Mídia: fotos, vídeos, logo/perfil e itens de mídia tipados.
- Avaliações: avaliações individuais visíveis, tópicos, destaques, mídia anexada e respostas do proprietário quando exibidas.
- Outros dados públicos: horários de pico/popularidade, atributos de acessibilidade e estado de captura por campo.

A disponibilidade varia conforme a ficha e o que o Google Maps expõe naquela sessão. Campo vazio significa **não observado nesta captura**, não inexistência confirmada. Não se inventam valores ausentes.

## Persistência e deduplicação

O worker mantém os campos principais em `prospecting_candidates` e preserva o registro completo de captura em `raw_evidence.mapsScrapeFields`, incluindo listas e objetos serializados, além do estado de cada campo. A deduplicação continua baseada na chave estável já usada pela fila de prospecção.

## Validação exigida antes da produção

1. Executar os testes automatizados e o type-check do worker.
2. Fazer uma busca de teste controlada e verificar no banco campos simples e ricos (avaliações, mídia, atributos, horários e redes sociais).
3. Confirmar que a fila registra progresso/erros, deduplica resultados e consegue retomar tarefas.
4. Só então aprovar merge/deploy. O PR não altera `main` nem a produção por conta própria.
