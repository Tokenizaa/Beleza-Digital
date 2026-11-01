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


## Inventário arquivo a arquivo de `src/components/`

| Arquivo | Função efetiva lida | Reutilização no renderer white-label |
|---|---|---|
| `BusinessFacts.tsx` | Apresenta fatos agregados recebidos por props e omite valores vazios | Sim — compartilhado pelos cinco modelos |
| `FloatingWhatsApp.tsx` | CTA flutuante que depende de `useStore` e usa o cadastro global da aplicação | Não — renderer usa CTA contextual com o telefone do preview |
| `Footer.tsx` | Rodapé da aplicação, com navegação interna, empresa e store | Não — renderer mantém rodapé próprio, isolado por negócio |
| `InstagramEmbedCard.tsx` | Embed oficial de post/reel com estado e atualização via store | Não — contrato atual do preview não transporta a coleção de embeds |
| `InstagramEmbedModal.tsx` | Formulário administrativo para salvar posts/reels | Não — interface de gestão, não componente público |
| `InstagramSection.tsx` | Feed de Instagram vinculado ao store; contém estatísticas fallback | Não — evita mostrar contagens/identidade da conta de outro estabelecimento |
| `MediaModal.tsx` | Visualizador de imagem/vídeo com CTA contextual para WhatsApp | Sim — compartilhado pelos cinco modelos |
| `MobileBottomNav.tsx` | Navegação móvel entre rotas internas e menu administrativo | Não — usa `PageView` e store, não navegação por seções do site white-label |
| `MonthCalendar.tsx` | Calendário mensal de seleção de data, com dias passados e datas ocupadas desabilitados | Sim — usado na simulação de agendamento dos cinco modelos |
| `Navbar.tsx` | Navegação global da aplicação entre páginas internas | Não — contrato acoplado ao store e às rotas do app |
| `OfflineIndicator.tsx` | Indicador reativo aos eventos online/offline do navegador | Não — pertence ao shell da aplicação, não ao conteúdo comercial |
| `PWAInstallButton.tsx` | CTA para abrir instruções de instalação PWA | Não — funcionalidade do shell/app, não conteúdo do site de prospecção |
| `PWAInstallModal.tsx` | Instruções de instalação para iOS/Android/desktop e prompt nativo | Não — modal de instalação global |
| `ProductDetailModal.tsx` | Detalhes de produto, seleção de imagens e CTA WhatsApp | Sim — compartilhado pelos cinco modelos |
| `SiteSEOMetadata.tsx` | Injeta title, description, Open Graph, Twitter, canonical e JSON-LD | Sim — usado por `SharedSitePreview` |
| `SiteTemplateRenderer.tsx` | Composição dos cinco layouts e das seções comerciais compartilhadas | É o ponto de integração principal |
| `MapEmbed.tsx` (novo) | Iframe real do Google Maps baseado em endereço/cidade ou coordenadas; link externo de rota | Sim — compartilhado pelos cinco modelos e por ContactPage |

## Páginas independentes e dependências

- `GalleryPage.tsx`, `ServicesPage.tsx`, `ProductsPage.tsx`, `ContactPage.tsx` e `AppointmentPage.tsx` são páginas completas ligadas a `useStore`; não são componentes de seção neutros. `ContactPage` agora compartilha `MapEmbed`.
- `SharedSitePreview.tsx` transforma o contrato da prévia em `SiteBusinessData`, seleciona os cinco modelos e chama `SiteTemplateRenderer`.
- `PublicShowcaseDemo.tsx` contém o dataset ilustrativo exclusivo de `/demo`; `PublicDemoSelectionPage.tsx` converte versões personalizadas do backend em dados do renderer.
- `template-data-mapper.ts` normaliza dados do scraper para conteúdo gerado, enquanto `PublicDemoSelectionPage.tsx` faz o mapeamento final das versões persistidas para `ShareableSitePreview`. O renderer recebe serviços, produtos, mídia, endereço, coordenadas, reputação e canais por props.
- Dependências examinadas em `package.json`: React 19, Lucide React, Playwright e Supabase. Não há Leaflet, Mapbox GL ou SDK de mapa no pacote. O mapa existente era um iframe do Google Maps em ContactPage; a nova implementação compartilhada mantém esse provedor sem adicionar dependência ou chave de API.
- O inventário de páginas também inclui os painéis administrativos, prospecção, seleção de demonstração, preview compartilhado e onboarding; eles permanecem fora do renderer público por dependerem de estado/rotas próprias.
