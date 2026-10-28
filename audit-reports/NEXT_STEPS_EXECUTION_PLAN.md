# Próximos Passos Imediatos - Execução Plan

## 1. GitHub Issues Criados (já executado)

✅ **Issue #5**: Implementar validação `succeeded === 0` no LeadsDashboard
✅ **Issue #6**: Unificar modelo de auth: Supabase real OU localStorage-only
✅ **Issue #7**: Corrigir redirect `/plataforma/acesso?mode=login` quando Supabase não configurado
✅ **Issue #8**: Fortalecer isolamento multitenant: validar `currentSession.establishmentId` vs `?tenant=`

## 2. Priorização de Domínios Críticos

### Domínios Prioritários (Fase 1 - Imediato):

| Domínio | Criticality | Impacto | Agents Assignados |
|---------|-------------|---------|-------------------|
| **Auth & Autorização** | CRITICAL | Quebra de fluxo em todos os admin gates | `agent-security-review` (primary), `agent-context` (secondary) |
| **Prospecção** | CRITICAL | Ilusão de metrics — usuário acha que busca funcionou mas não adicionou dados | `agent-backend` (primary), `agent-frontend` (secondary) |
| **Multitenant Isolamento** | CRITICAL | Bypass de checks via URL param — pode acessar dados de outros estabelecimentos | `agent-supervisor` (primary), `agent-context` (secondary) |

### Domínios Secundários (Fase 2 - Curto Prazo):
- Site Público / Demo (ALTO)
- CRM & Conversão (ALTO)
- Administração de Estabelecimentos (ALTO)

## 3. Atribuição de Agents Responsáveis

### Issue #5 - Prospecção Validation
- **Primary Agent**: `agent-backend`
- **Secondary Agent**: `agent-frontend`
- **Skills**: `firecrawl`, `agent-architecture-test`, `comprehensive-audit`
- **Task**: Add check for `succeeded === 0` in search operation handling, display warning UI, show both `succeeded` and `blocked` counts transparently
- **Estimated Effort**: 2 days (1 backend, 1 frontend)

### Issue #6 - Auth Model Unification
- **Primary Agent**: `agent-security-review`
- **Secondary Agent**: `agent-context`
- **Skills**: `comprehensive-audit`, `agent-architecture-review`
- **Task**: Decidir entre Supabase-based auth flow OR localStorage-only auth. Document decision in ADR. Remove inconsistent `!supabase` redirects.
- **Estimated Effort**: 3 days (architecture + implementation + documentation)

### Issue #7 - Redirect Fix
- **Primary Agent**: `agent-context`
- **Secondary Agent**: `agent-backend`
- **Skills**: `project-discovery`
- **Task**: When `!isSupabaseConfigured`, show "Modo demonstração" banner instead of redirecting. Keep localStorage data accessible.
- **Estimated Effort**: 2 days

### Issue #8 - Multitenant Isolation
- **Primary Agent**: `agent-supervisor`
- **Secondary Agent**: `agent-context`
- **Skills**: `project-discovery`, `agent-architecture-review`
- **Task**: Validate `currentSession.establishmentId` must match `?tenant=` param or stored `CURRENT_TENANT_ID`. Strengthen `requireTenantAccess` function.
- **Estimated Effort**: 3 days (understanding code + implementation + documentation)

## 4. Métricas de Sucesso por Domínio

### Domínio 1: Prospecção (Issue #5)
| Métrica | Target | Status |
|---------|--------|--------|
| Code check for `succeeded === 0` | 100% code coverage | ✅ Planejado |
| UI warning displayed when succeeded=0 | Shown to user | ✅ Planejado |
| Both `succeeded` and `blocked` counts displayed | UI shows both | ✅ Planejado |
| User-facing message clarity | User understands situation | ✅ Planejado |
| API response validation comprehensive | All fields checked | ✅ Planejado |

### Domínio 2: Auth (Issues #6, #7)
| Métrica | Target | Status |
|---------|--------|--------|
| Auth model decided | Documented in ADR | ✅ Planejado |
| Consistent auth gates across all pages | All 5 admin pages consistent | ✅ Planejado |
| No mixed auth approaches | Clear documentation | ✅ Planejado |
| Login/sign-out uniform | Works on all pages | ✅ Planejado |
| Demo mode banner shown when !supabase | Banner present | ✅ Planejado |
| No broken redirect URLs | URLs work or fall gracefully | ✅ Planejado |

### Domínio 3: Multitenant (Issue #8)
| Métrica | Target | Status |
|---------|--------|--------|
| currentSession.establishmentId validated | Validation code present | ✅ Planejado |
| Session mismatch prevented | No wrong tenant access | ✅ Planejado |
| Consistent isolation across pages | All admin pages respect isolation | ✅ Planejado |
| Documentation of strategy | ADR or decision log | ✅ Planejado |
| URL param cannot bypass checks | ?tenant= validated | ✅ Planejado |

## 5. Agendar Sessões de Work com Agents

### Sessão 1: Auth Model Decision Meeting
- **Data/Time**: Próxima terça-feira, 10:00-11:00
- **Agentes**: `agent-security-review`, `agent-context`, `agent-supervisor`
- **Objetivo**: Decidir modelo de auth definitivo
- **Entregável**: ADR (Architecture Decision Record) documentando abordagem escolhida
- **Preparação**: Revisar AUDIT_REPORT.md lines 160-178, AUTHENTICATION_AUDIT.md

### Sessão 2: Prospecting Validation Workshop
- **Data/Time**: Próxima quarta-feira, 14:00-16:00
- **Agentes**: `agent-backend`, `agent-frontend`
- **Objetivo**: Implementar validação succeeded === 0 e warnings no UI
- **Entregável**: PR com código de validação e warnings de interface
- **Preparação**: Revisar LeadsDashboard.tsx lines 61-73, AUDIT_RELATORIO_MODO_PROSPECCAO.md

### Sessão 3: Multitenant Isolation Review
- **Data/Time**: Próxima quinta-feira, 10:00-11:30
- **Agentes**: `agent-supervisor`, `agent-context`
- **Objetivo**: Revisar e implementar validação currentSession.establishmentId
- **Entregável**: store.ts atualizado com validação de tenant fortalecida
- **Preparação**: Revisar store.ts lines 193-202, requireTenantAccess function

### Sessão 4: Cross-Domain Integration Check
- **Data/Time**: Próxima sexta-feira, 14:00-15:00
- **Agentes**: Todos os agents das sessões anteriores + `agent-context`
- **Objetivo**: Validar que as correções integram corretamente (auth afeta CRM afeta multitenant)
- **Entregável**: Relatório de integração, lista de dependências resolvidas
- **Preparação**: Todos lerem os 4 issues criados e seus respectivos codes

## 6. Checklist de Conclusão da Fase 1

- [x] 4 GitHub Issues criados (#5, #6, #7, #8)
- [x] Domínios prioritários identificados (Auth, Prospecção, Multitenant)
- [x] Agents responsáveis atribuídos para cada issue
- [x] Métricas de sucesso definidas para cada domínio
- [x] Sessões de work agendadas (4 sessões)
- [ ] Sessão 1 realizada: Auth model decision
- [ ] Sessão 2 realizada: Prospecting validation
- [ ] Sessão 3 realizada: Multitenant isolation
- [ ] Sessão 4 realizada: Integration check
- [ ] Todas as issues implementadas e PRs abertos
- [ ] Build verde (npm run lint + npm run test)
- [ ] Relatório final da Fase 1 entregue

---
*Plano de execução gerado automaticamente baseado na auditoria completa do projeto Beleza_Digital.*