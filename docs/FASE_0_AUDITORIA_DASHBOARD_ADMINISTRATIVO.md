# Fase 0 — Auditoria integral e reorganização do dashboard administrativo

**Repositório:** `Tokenizaa/Beleza-Digital`  
**Branch obrigatória:** `main`  
**Executor:** agente orquestrador local do OpenCode, com decomposição em subagentes especializados.  
**Objetivo:** entregar um dashboard administrativo coerente, navegável, testado pelo frontend real e preparado para as fases funcionais de prospecção.

## Ordem de execução

Esta é uma missão de implementação, não uma auditoria documental. O orquestrador deve inspecionar o repositório e o estado do Git, dividir o trabalho entre subagentes quando isso acelerar a execução, integrar os resultados, corrigir os problemas encontrados, testar e concluir a fase. Não parar depois de produzir um relatório ou uma lista de pendências.

### 1. Proteger a fonte da verdade
1. Inspecione branch, HEAD, estado do working tree e sincronização com `origin/main` antes de editar.
2. Preserve todo trabalho existente. **Não execute** `git reset --hard`, `git clean`, remoções em massa, force-push, criação de branch ou PR.
3. Trabalhe exclusivamente em `main`. Se houver alterações locais ou divergência, inspecione e reconcilie sem descartar dados.
4. Leia o código e a configuração reais; não presuma que documentação antiga representa o comportamento atual.

### 2. Auditar integralmente o dashboard de administração geral
Mapeie e inspecione todas as rotas, páginas, layouts, componentes, menus, diálogos, formulários, tabelas, estados vazios/erro/carregamento, permissões, autenticação, chamadas de dados e ações administrativas. Siga os fluxos entre páginas e verifique imports, componentes duplicados, navegação quebrada, links sem destino, estados inconsistentes, dados fictícios apresentados como reais, acessibilidade básica e responsividade.

Produza uma matriz verificável com: página/rota, função esperada, componentes dependentes, origem dos dados, ações disponíveis, problemas reproduzidos, correção aplicada e teste de regressão. Não considere a auditoria concluída apenas porque todas as páginas foram listadas: abra e exercite cada rota pelo frontend.

### 3. Substituir o navbar por uma sidebar
1. Remova o navbar de navegação principal do dashboard administrativo e implemente uma **sidebar única, persistente e consistente** como navegação principal.
2. Centralize nela as rotas administrativas existentes e válidas, agrupadas por finalidade, com indicação clara da seção ativa e nomes inequívocos.
3. Preserve todas as funcionalidades e rotas válidas. Não crie páginas duplicadas nem mantenha duas navegações principais concorrentes.
4. Em telas estreitas, torne a sidebar recolhível/acessível por controle de menu; em desktop, mantenha a hierarquia visual estável.
5. Garanta que links, botão de sair, estado de sessão, permissões e redirecionamentos funcionem. Não exponha páginas administrativas a usuários sem autorização.
6. Siga a linguagem visual já acordada para o produto: interface limpa e leve, tipografia clara, acento verde, poucos elementos decorativos, sem gradientes, glassmorphism ou cartões desnecessários.

### 4. Corrigir os problemas encontrados
Corrija diretamente os defeitos reproduzíveis de navegação, layout, integração e estado que pertençam ao dashboard. Reutilize componentes existentes quando adequado; evite reescritas amplas sem necessidade. Não fabrique métricas, leads, resultados de raspagem ou estados de integração. Quando um serviço externo estiver indisponível, apresente um estado honesto e acionável.

Não misture a implementação futura de todas as fases de prospecção nesta fase. Prepare a estrutura administrativa para ela, mas mantenha o escopo da Fase 0 na auditoria e experiência global do dashboard.

### 5. Testar pelo frontend real
1. Use **Playwright navegando pela interface real** para verificar login/sessão, rotas administrativas, navegação pela sidebar, responsividade, estados de carregamento/erro/vazio, ações principais e logout.
2. Não substitua os testes de interface por chamadas diretas a APIs, scripts de backend ou registros criados diretamente no banco.
3. Execute os testes automatizados relevantes, lint, verificação TypeScript e build disponíveis no projeto; corrija falhas introduzidas e falhas preexistentes que bloqueiem o dashboard.
4. Não use localhost como substituto para validar o comportamento de produção quando o cenário exige o ambiente publicado. Diferencie claramente testes locais de validação real publicada.
5. Não declare um teste aprovado se ele não foi executado. Registre evidências reproduzíveis, resultados e limitações externas reais.

### 6. Documentar e concluir
1. Atualize a documentação com a arquitetura de navegação final, inventário de rotas e componentes, problemas corrigidos, testes executados e limitações remanescentes.
2. Crie/atualize testes de regressão para os defeitos corrigidos.
3. Faça commit(s) descritivos diretamente em `main`, sem branch ou PR. Revise o diff antes do commit e confirme o estado final do Git.
4. Entregue resumo com: páginas/rotas inspecionadas, sidebar implementada, correções, testes com contagens reais, URLs/ambientes testados, commits e pendências bloqueadas por dependências externas.

## Regras de delegação do orquestrador

- Delegue em paralelo, quando seguro, inventário de rotas/componentes, auditoria de autenticação/permissões, revisão visual/responsiva e estratégia de testes.
- Dê a cada subagente escopo explícito, arquivos/áreas delimitados e instrução para não descartar mudanças nem criar branches.
- O orquestrador mantém a responsabilidade pela integração, resolução de conflitos, validação completa e commit final.
- Evite que subagentes editem simultaneamente os mesmos arquivos centrais de layout/navegação.
- Não interrompa o fluxo após o relatório de auditoria: implemente, teste, documente e finalize.

## Critérios obrigatórios de aceite

- [ ] Inventário completo das rotas/páginas administrativas confirmado pelo código e pelo navegador.
- [ ] Navbar principal substituído por uma sidebar funcional e responsiva.
- [ ] Todas as rotas válidas acessíveis pela navegação e sem duplicações.
- [ ] Autenticação, autorização, sessão e logout verificados.
- [ ] Problemas reproduzíveis do dashboard corrigidos ou registrados com bloqueador concreto.
- [ ] Testes Playwright executados pela interface real; resultados e evidências documentados.
- [ ] Testes automatizados, TypeScript/lint disponíveis e build executados; falhas relevantes resolvidas.
- [ ] Nenhum dado fictício apresentado como dado real.
- [ ] Documentação atualizada e commit(s) em `main`.
- [ ] Working tree final e sincronização com `origin/main` verificados.

**Não declarar a Fase 0 concluída enquanto os critérios acima não tiverem evidência.**
