import type { UnifiedAdminSection } from '../pages/UnifiedAdminDashboard';

const SECTION_PATHS: Record<UnifiedAdminSection, string> = {
  'salao-dashboard': '/plataforma/admin/salao',
  'salao-servicos': '/plataforma/admin/salao/servicos',
  'salao-produtos': '/plataforma/admin/salao/produtos',
  'salao-galeria': '/plataforma/admin/salao/galeria',
  'salao-agendamentos': '/plataforma/admin/salao/agendamentos',
  'salao-instagram': '/plataforma/admin/salao/instagram',
  'salao-configuracoes': '/plataforma/admin/salao/configuracoes',
  'prospeccao-hoje': '/plataforma/admin/prospeccao',
  'prospeccao-buscar': '/plataforma/admin/buscar',
  'prospeccao-crm': '/plataforma/admin/crm',
  'prospeccao-automacao': '/plataforma/admin/automacao',
  'prospeccao-scraping': '/plataforma/admin/scraping',
  'prospeccao-whatsapp': '/plataforma/admin/whatsapp',
  'rede-saloes': '/plataforma/admin/rede',
  'rede-novo': '/plataforma/admin/rede/novo',
  'rede-admins': '/plataforma/admin/rede/administradores',
  'rede-auditoria': '/plataforma/admin/rede/auditoria',
  'rede-configuracoes': '/plataforma/admin/rede/configuracoes',
  'templates-catalogo': '/plataforma/admin/templates',
};

const PATH_SECTIONS = Object.entries(SECTION_PATHS).reduce<Record<string, UnifiedAdminSection>>(
  (result, [section, path]) => {
    result[path] = section as UnifiedAdminSection;
    return result;
  },
  {},
);

export function adminSectionFromLocation(location: Pick<Location, 'pathname' | 'search' | 'hash'>): UnifiedAdminSection {
  const pathname = location.pathname.replace(/\/+$/, '') || '/plataforma/admin';
  if (PATH_SECTIONS[pathname]) return PATH_SECTIONS[pathname];

  const params = new URLSearchParams(location.search);
  const legacySection = params.get('section') || location.hash.replace(/^#/, '');
  if (legacySection === 'prospeccao-scraping' || legacySection === 'prospeccao' || legacySection === 'scraping') {
    return 'prospeccao-hoje';
  }
  if (legacySection && Object.prototype.hasOwnProperty.call(SECTION_PATHS, legacySection)) {
    return legacySection as UnifiedAdminSection;
  }
  return 'prospeccao-hoje';
}

export function adminPathForSection(section: UnifiedAdminSection): string {
  return SECTION_PATHS[section] || '/plataforma/admin';
}

export function canonicalAdminPath(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const section = adminSectionFromLocation(location);
  return location.pathname === '/plataforma/admin' && !location.search && !location.hash
    ? '/plataforma/admin'
    : adminPathForSection(section);
}
