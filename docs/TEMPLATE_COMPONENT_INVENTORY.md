# Inventário funcional e critérios de aceite — cinco templates

Referência: `main` em 2026-11-01. Este inventário descreve implementações lidas no código, não inferências por busca textual.

## Matriz de inventário funcional

| Área | Implementação encontrada | Estado real antes desta alteração | Decisão de integração |
|---|---|---|---|
| Mapa/localização | `ContactPage.tsx` possuía iframe Google Maps; `SiteTemplateRenderer.tsx` mostrava somente endereço/link | Mapa incorporado existia apenas na página de contato do app; demonstração não tinha mapa | Criado `MapEmbed.tsx` compartilhado e integrado ao renderer e ContactPage |
| Galeria | `MediaModal.tsx`; grade própria no renderer | Modal de imagem/vídeo funcional; grade do renderer usa `businessData.media` | Reutilizar modal existente e manter grade temática compartilhada |
| Instagram | `InstagramSection.tsx`, `InstagramEmbedCard.tsx`, `InstagramEmbedModal.tsx` | Componentes funcionais, mas acoplados a `useStore`/estado administrativo e estatísticas padrão; renderer só apresenta link do perfil | Não importar componentes administrativos para preview público nem exibir métricas inventadas; link do perfil condicionado à URL real |
| Avaliações/reputação | `BusinessFacts.tsx` | Exibe nota, quantidade, faixa, status e horário quando informados; não há componente de avaliações individuais no renderer | Integrado no renderer; não inventar depoimentos |
| Informações/horários | `BusinessFacts.tsx` e bloco de contato do renderer | Fatos agregados funcionais; contato exibia textos de fallback mesmo sem dados | Ocultar cada dado/seção ausente; preservar dados reais |
| Serviços | Seções próprias em cada layout e `ServicesPage.tsx` | Renderer usa `businessData.services`; página administrativa usa store global | Preservar seções por template; não acoplar páginas globais |
| Produtos | `ProductDetailModal.tsx` e seção compartilhada no renderer | Modal e detalhe funcionais; cards usam `businessData.products` | Reutilizar modal nos cinco modelos |
| Calendário/agendamento | `MonthCalendar.tsx` | Calendário seleciona datas; renderer usa horários fixos e confirmação explicitamente simulada | Manter como prévia, nunca declarar reserva real ou disponibilidade confirmada |
| WhatsApp/contato | `FloatingWhatsApp.tsx`, helpers do store, links no renderer | Floating action é acoplada ao store da aplicação; renderer cria link por telefone | Renderer mantém CTA contextual usando somente telefone/WhatsApp válido |
| Navegação | `Navbar.tsx`, `MobileBottomNav.tsx` | Navegação entre páginas internas via `PageView`, não âncoras de site white-label | Não reutilizar em preview isolado; seletor de templates e âncoras permanecem locais |
| Rodapé | `Footer.tsx` | Usa `useStore`, empresa e rotas internas | Rodapé white-label próprio evita dependência do painel/app |
| SEO | `SiteSEOMetadata.tsx`, `seo-utils.ts` | Injeta title, description, OG, Twitter, canonical e JSON-LD na prévia compartilhada | Já integrado por `SharedSitePreview` |

## Critérios objetivos de aceite por template

Todos os cinco devem passar os critérios comuns: (1) layout responsivo sem overflow horizontal em 390 px e 1440 px; (2) identidade de composição, tipografia, hierarquia e tratamento de imagens além da cor; (3) serviços, produtos, mídia, Instagram, fatos e contatos só aparecem quando houver dados correspondentes; (4) mapa incorporado aparece somente com endereço/cidade ou par latitude/longitude e tem link externo para rota; (5) modal de mídia e produto abre/fecha e WhatsApp só é habilitado com número; (6) calendário é apresentado como simulação, nunca como reserva real; (7) nenhuma avaliação, preço, horário, telefone ou endereço fictício em preview personalizado; (8) SEO da prévia corresponde aos dados recebidos.

| Template | Critério visual específico | Critério de conteúdo |
|---|---|---|
| Ouro Clássico | Hero central editorial serifado, moldura e acentos âmbar, serviços em destaque | Priorizar serviços; mostrar galeria/produtos/Instagram apenas com dados |
| Preto Esmeralda | Composição urbana de alto contraste, títulos fortes, galeria antes dos serviços | Priorizar portfólio e imagens reais; ocultar galeria vazia |
| Minimal Studio | Layout claro, espaçamento amplo, tipografia leve e cartões discretos | Priorizar fatos essenciais, serviços e fotos reais; sem blocos vazios |
| Safira Executivo | Hierarquia corporativa, azul profundo, blocos organizados de confiança | Priorizar produtos/serviços e fatos verificáveis; não criar selos ou reputação |
| Rubi Lounge | Composição editorial, serifas/itálicos, ritmo visual e imagens de ambiente | Priorizar experiência por imagens e serviços reais; não inventar atributos sensoriais |

## Limites da inspeção

Os componentes de navegação/rodapé e Instagram citados acima dependem do store da aplicação e não são plug-ins neutros para o renderer white-label. As páginas independentes também são páginas completas ligadas ao estado global, não componentes de seção. Reutilização deve respeitar esse contrato, não importar componentes que mostrem dados de outra empresa ou métricas padrão.
