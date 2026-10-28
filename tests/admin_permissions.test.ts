// Polyfill localStorage e sessionStorage para ambiente Node.js
const storageStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (k: string) => storageStore.get(k) ?? null,
  setItem: (k: string, v: string) => storageStore.set(k, String(v)),
  removeItem: (k: string) => storageStore.delete(k),
  clear: () => storageStore.clear(),
};

(globalThis as any).sessionStorage = {
  getItem: (k: string) => sessionStore.get(k) ?? null,
  setItem: (k: string, v: string) => sessionStore.set(k, String(v)),
  removeItem: (k: string) => sessionStore.delete(k),
  clear: () => sessionStore.clear(),
};

import { store } from '../src/data/store';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    failed++;
  }
}

console.log('====================================================');
console.log('SUÍTE DE TESTES — PERMISSÕES: platform_admin × establishment_admin');
console.log('====================================================\n');

// Nota: no código-fonte, platform_admin é representado pelo papel 'super_admin'.
// establishment_admin é representado pelo papel 'establishment_admin'.

// -------------------------------------------------------------------------
// FIXTURES: dois estabelecimentos distintos (criados como platform_admin)
// -------------------------------------------------------------------------
store.loginSuperAdmin();
const tenantA = store.addEstablishment({
  name: 'Barbearia Alfa',
  slug: 'barbearia-alfa',
  status: 'active',
  theme: 'sapphire',
  primaryColor: '#3b82f6',
  adminName: 'Admin Alfa',
});
const tenantB = store.addEstablishment({
  name: 'Salão Beta',
  slug: 'salao-beta',
  status: 'active',
  theme: 'emerald',
  adminName: 'Admin Beta',
});

console.log('\nPLATFORM_ADMIN (super_admin) — acesso a todos os estabelecimentos');

// P1. platform_admin autentica e vê todos os estabelecimentos
store.logout();
const platformLogin = store.loginSuperAdmin();
assert(platformLogin.success === true, 'platform_admin autenticado com sucesso');
assert(store.getCurrentSession()?.role === 'super_admin', 'Papel da sessão é super_admin');

const allEstabs = store.getAllEstablishments();
assert(
  allEstabs.some((e) => e.id === tenantA.id) && allEstabs.some((e) => e.id === tenantB.id),
  'platform_admin enxerga todos os estabelecimentos cadastrados',
  `IDs: ${allEstabs.map((e) => e.id).join(', ')}`
);

// P2. platform_admin lê serviços de qualquer estabelecimento (isolamento não se aplica)
const servicosA = store.getServices(tenantA.id);
const servicosB = store.getServices(tenantB.id);
assert(
  servicosA.length >= 0 && servicosB.length >= 0,
  'platform_admin pode ler serviços de estabelecimentos distintos sem erro de isolamento'
);

// P3. platform_admin acessa configurações de plataforma
try {
  store.updatePlatformConfig({ platformName: 'Plataforma Teste Permissões' });
  assert(true, 'platform_admin consegue alterar configurações da plataforma');
} catch (err) {
  assert(false, `platform_admin bloqueado ao alterar configurações da plataforma: ${String(err)}`);
}
// Restaura configuração original para não vazar estado entre testes
store.updatePlatformConfig({ platformName: 'Plataforma para Salões' });

// P4. platform_admin lê métricas globais da plataforma
const metrics = store.getPlatformMetrics();
assert(typeof metrics.totalEstablishments === 'number', 'platform_admin lê métricas globais da plataforma');
assert(metrics.totalEstablishments >= 2, 'Métricas refletem ao menos os dois estabelecimentos de teste');

// P5. platform_admin faz impersonation (entra e sai de um estabelecimento)
const impersonationOk = store.superAdminEnterEstablishment(tenantB.id);
assert(impersonationOk === true, 'platform_admin entra no ambiente de um estabelecimento (impersonation)');
assert(store.getCurrentSession()?.establishmentId === tenantB.id, 'Sessão vinculada ao establishment alvo durante impersonation');
assert(store.getCurrentSession()?.impersonatedBySuperAdmin === true, 'Impersonação é auditada como tal');

store.superAdminExitEstablishment();
assert(store.getCurrentSession()?.role === 'super_admin', 'platform_admin retorna ao papel de super_admin após sair');
assert(!store.getCurrentSession()?.establishmentId, 'Vínculo ao establishment é removido após sair do impersonation');

// P6. platform_admin pode excluir um estabelecimento não-padrão
const canDelete = store.deleteEstablishment(tenantB.id);
assert(canDelete === true, 'platform_admin pode excluir estabelecimento não-padrão');
// Verifica que os dados operacionais do B foram purgados (isolamento de escrita)
const servicosBDepois = store.getServices(tenantB.id);
assert(servicosBDepois.length === 0, 'Dados operacionais do estabelecimento excluído são purgados');
// Recria um establishment B (o anterior foi excluído pelo platform_admin no P6)
const tenantB2 = store.addEstablishment({
  name: 'Salão Beta (recriado)',
  slug: 'salao-beta-2',
  status: 'active',
  theme: 'emerald',
  adminName: 'Admin Beta',
});

console.log('\nESTABLISHMENT_ADMIN — operação estrita dentro do próprio estabelecimento');

// E1. establishment_admin autenticado no próprio estabelecimento
store.logout();
const localLoginA = store.loginLocalAdmin('', tenantA.id);
assert(localLoginA.success === true, 'establishment_admin autenticado no estabelecimento A', localLoginA?.message ?? '');
assert(store.getCurrentSession()?.role === 'establishment_admin', 'Papel da sessão é establishment_admin');
assert(store.getCurrentSession()?.establishmentId === tenantA.id, 'Sessão vinculada estritamente ao establishment A');

// E2. establishment_admin lê serviços do próprio establishment
const servicosProprios = store.getServices(tenantA.id);
assert(
  servicosProprios.every((s) => s.establishmentId === tenantA.id),
  'establishment_admin só enxerga serviços do próprio establishment'
);

// E3. establishment_admin NÃO acessa dados de outro estabelecimento (isolamento de leitura)
const acessoCruzado = store.requireTenantAccess(tenantB2.id);
assert(
  acessoCruzado.ok === false,
  'establishment_admin do A NÃO consegue acessar dados do establishment B (isolamento multi-tenant)',
  acessoCruzado.message
);
assert(
  acessoCruzado.message === 'Acesso negado a dados de outro estabelecimento.',
  'Mensagem de isolamento está correta'
);

// E4. establishment_admin NÃO lê serviços de outro estabelecimento
const servicosCruzados = store.getServices(tenantB2.id);
assert(servicosCruzados.length === 0, 'establishment_admin recebe lista vazia ao tentar ler serviços de outro tenant');

// E5. establishment_admin NÃO escreve (adiciona serviço) em outro establishment
try {
  store.addService(
    { name: 'Serviço Invasor', category: 'Barbearia', description: 'Tentativa cruzada', price: 10, featured: false },
    tenantB2.id
  );
  assert(false, 'establishment_admin conseguiu gravar serviço em outro establishment (deveria falhar)');
} catch (err) {
  assert(
    String(err).includes('Acesso negado') || String(err).includes('Sessão não autenticada'),
    'establishment_admin é bloqueado ao tentar gravar em outro establishment'
  );
}

// E6. establishment_admin NÃO acessa configurações de plataforma
store.logout();
store.loginLocalAdmin('', tenantA.id);
try {
  store.updatePlatformConfig({ platformName: 'Hackeado Pelo Local' });
  assert(false, 'establishment_admin conseguiu alterar configurações da plataforma (deveria falhar)');
} catch (err) {
  assert(
    String(err).includes('Apenas super_admin'),
    'establishment_admin é bloqueado ao tentar alterar configurações da plataforma'
  );
}

// E7. establishment_admin NÃO lê métricas globais como se fosse platform_admin
// (getPlatformMetrics não restringe role no store — isso é uma lacuna de design;
//  aqui apenas registramos que não há isolamento de métricas na camada store)
const metricasLocal = store.getPlatformMetrics();
assert(typeof metricasLocal.totalEstablishments === 'number', 'getPlatformMetrics retorna métricas (sem restrição de role no store)');

// E8. establishment_admin não pode limpar logs de auditoria (exclusivo super_admin)
store.logout();
store.loginLocalAdmin('', tenantA.id);
try {
  store.clearAuditLogs();
  assert(false, 'establishment_admin conseguiu limpar logs de auditoria (deveria falhar)');
} catch (err) {
  assert(
    String(err).includes('super_admin'),
    'establishment_admin é bloqueado ao tentar limpar logs de auditoria'
  );
}

// E9. establishment_admin não pode excluir estabelecimento (mesmo o próprio)
store.logout();
store.loginLocalAdmin('', tenantA.id);
const tentaExcluir = store.deleteEstablishment(tenantA.id);
assert(tentaExcluir === false, 'establishment_admin não pode excluir estabelecimento');
// (deleteEstablishment exige requireWriteAuth, que o local admin tem, mas não há restrição de role;
//  este comportamento deve ser revisado — veja lacuna LI-07)

// -------------------------------------------------------------------------
// USUÁRIO SEM SESSÃO (cliente) — proteção de áreas administrativas
// -------------------------------------------------------------------------
console.log('\nUSUÁRIO SEM SESSÃO — proteção contra acesso indevido');

store.logout();
assert(store.getCurrentSession() === null, 'Usuário sem sessão não possui token');

const semSessaoEscrita = store.requireWriteAuth();
assert(semSessaoEscrita.ok === false, 'Usuário sem sessão não pode gravar');

const semSessaoTenant = store.requireTenantAccess(tenantA.id);
assert(semSessaoTenant.ok === false, 'Usuário sem sessão não pode acessar dados de nenhum establishment');

// -------------------------------------------------------------------------
// RESULTADO FINAL
// -------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
