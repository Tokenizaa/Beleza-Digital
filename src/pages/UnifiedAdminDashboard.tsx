import React, { useState, useEffect } from 'react';
import { useStore } from '../data/store';
import { AdminPage } from './AdminPage';
import { SuperAdminPage } from './SuperAdminPage';
import { LeadsDashboard } from './LeadsDashboard';
import { SiteTemplateRenderer } from '../components/SiteTemplateRenderer';
import { SITE_TEMPLATES_LIST, SiteVariationId } from '../types/templates';
import { AdminTab, SuperAdminTab } from '../types';
import {
  LayoutDashboard,
  Scissors,
  ShoppingBag,
  Images,
  Calendar,
  Instagram,
  Settings,
  Compass,
  Search,
  Users,
  Activity,
  Building2,
  Plus,
  ShieldCheck,
  Lock,
  Sliders,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Check,
  Building,
  KeyRound,
  Eye,
  Store,
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export type UnifiedAdminSection =
  // Módulo 1: Gestão do Salão
  | 'salao-dashboard'
  | 'salao-servicos'
  | 'salao-produtos'
  | 'salao-galeria'
  | 'salao-agendamentos'
  | 'salao-instagram'
  | 'salao-configuracoes'
  // Módulo 2: Prospecção & Raspagem (CRM Alvanto)
  | 'prospeccao-hoje'
  | 'prospeccao-buscar'
  | 'prospeccao-crm'
  | 'prospeccao-automacao'
  // Módulo 3: Rede White-Label & Super Admin
  | 'rede-saloes'
  | 'rede-novo'
  | 'rede-admins'
  | 'rede-auditoria'
  | 'rede-configuracoes'
  // Módulo 4: Catálogo de Modelos
  | 'templates-catalogo';

interface UnifiedAdminDashboardProps {
  initialSection?: UnifiedAdminSection;
  onBackToApp?: () => void;
  /** Quando verdadeiro, o painel já foi autorizado pelo wrapper de rota (Supabase) e salta o gate de login interno. */
  preAuthenticated?: boolean;
}

export const UnifiedAdminDashboard: React.FC<UnifiedAdminDashboardProps> = ({
  initialSection = 'salao-dashboard',
  onBackToApp,
  preAuthenticated = false,
}) => {
  const { establishment, allEstablishments, session, platformConfig, store } = useStore();

  const [activeSection, setActiveSection] = useState<UnifiedAdminSection>(initialSection);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [establishmentDropdownOpen, setEstablishmentDropdownOpen] = useState(false);

  // Collapsible modules state in sidebar
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({
    salao: false,
    prospeccao: false,
    rede: false,
    templates: false,
  });

  const toggleModuleCollapse = (modKey: string) => {
    setCollapsedModules((prev) => ({ ...prev, [modKey]: !prev[modKey] }));
  };

  // Auth State
  const {
    isAuthenticated: storeIsAuthenticated,
    login,
    logout,
    isSupabaseConfigured,
    userRole,
  } = useStore();

  // Derived auth state: user is authorized if they have a session with appropriate role
  const isAuthorized =
    userRole === 'super_admin' ||
    userRole === 'establishment_admin';

  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(
    preAuthenticated || storeIsAuthenticated || Boolean(isAuthorized)
  );
  const [authError, setAuthError] = useState<string | null>(null);

  // Template Showcase preview state
  const [selectedShowcaseTemplate, setSelectedShowcaseTemplate] = useState<SiteVariationId>('ouro-classico');

  // Handle Login (via Supabase Auth quando configurado; sessão local da store como mecanismo da plataforma)
  const handleLogin = (isSuper: boolean) => {
    setAuthError(null);
    try {
      const role = isSuper ? 'super_admin' : 'establishment_admin';
      const result = login(role, isSuper ? undefined : session?.establishmentId);
      if (result.success && result.session) {
        setIsAuthenticatedState(true);
      } else {
        setAuthError(result.message || 'Não foi possível estabelecer a sessão. Verifique suas permissões.');
      }
    } catch (err) {
      setAuthError(
        'Não foi possível estabelecer a sessão. Verifique suas permissões no Supabase Auth.'
      );
    }
  };

  const handleLogout = () => {
    logout(); // encerra sessão da store e do Supabase (quando configurado)
    setIsAuthenticatedState(false);
  };

  const handleSelectEstablishment = (estId: string) => {
    store.selectEstablishment(estId);
    setEstablishmentDropdownOpen(false);
  };

  // Synchronize section changes from sub-components
  const handleAdminPageTabChange = (tab: AdminTab) => {
    const map: Record<AdminTab, UnifiedAdminSection> = {
      dashboard: 'salao-dashboard',
      servicos: 'salao-servicos',
      produtos: 'salao-produtos',
      galeria: 'salao-galeria',
      videos: 'salao-galeria',
      agendamentos: 'salao-agendamentos',
      instagram: 'salao-instagram',
      configuracoes: 'salao-configuracoes',
    };
    if (map[tab]) setActiveSection(map[tab]);
  };

  const handleLeadsDashboardTabChange = (tab: 'hoje' | 'buscar' | 'empresas') => {
    const map: Record<'hoje' | 'buscar' | 'empresas', UnifiedAdminSection> = {
      hoje: 'prospeccao-hoje',
      buscar: 'prospeccao-buscar',
      empresas: 'prospeccao-crm',
    };
    if (map[tab]) setActiveSection(map[tab]);
  };

  const handleSuperAdminTabChange = (tab: SuperAdminTab) => {
    const map: Partial<Record<SuperAdminTab, UnifiedAdminSection>> = {
      overview: 'rede-saloes',
      establishments: 'rede-saloes',
      'new-establishment': 'rede-novo',
      administrators: 'rede-admins',
      'audit-logs': 'rede-auditoria',
      settings: 'rede-configuracoes',
    };
    if (map[tab]) setActiveSection(map[tab]!);
  };

  // If not authenticated, render clean Unified Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
              Área Administrativa Unificada
            </span>
            <h1 className="text-2xl font-bold font-display text-neutral-100 mt-1">
              {establishment.name}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Acesse o painel do salão ou o painel mestre de prospecção e rede
            </p>
          </div>

          <div className="space-y-3 text-left">
            {authError && (
              <p className="text-xs text-rose-400 mt-2 font-medium">
                {authError}
              </p>
            )}
            <button
              onClick={() => handleLogin(false)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Entrar como Administrador do Estabelecimento
            </button>
            <button
              onClick={() => handleLogin(true)}
              className="w-full py-3.5 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Entrar como Super Administrador da Plataforma
            </button>
          </div>

          <div className="pt-4 border-t border-neutral-800 text-xs text-neutral-400 flex flex-col gap-2">
            <span>
              A autenticação é gerenciada exclusivamente pelo Supabase Auth.
            </span>
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="text-amber-400 hover:underline cursor-pointer text-xs"
              >
                Voltar ao site público
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER MAIN CONTENT VIEW BASED ON ACTIVE SECTION
  // ----------------------------------------------------
  const renderContent = () => {
    // Módulo 1: Gestão do Salão
    if (activeSection.startsWith('salao-')) {
      const tabMap: Record<string, AdminTab> = {
        'salao-dashboard': 'dashboard',
        'salao-servicos': 'servicos',
        'salao-produtos': 'produtos',
        'salao-galeria': 'galeria',
        'salao-agendamentos': 'agendamentos',
        'salao-instagram': 'instagram',
        'salao-configuracoes': 'configuracoes',
      };
      const initialTab = tabMap[activeSection] || 'dashboard';
      return (
        <AdminPage
          key={`admin-${establishment.id}-${initialTab}`}
          initialTab={initialTab}
          embeddedInUnifiedAdmin={true}
          onTabChange={handleAdminPageTabChange}
          onBackToApp={onBackToApp}
        />
      );
    }

    // Módulo 2: Prospecção & Raspagem de Leads (CRM & Prospecção Aprovado)
    if (
      activeSection === 'prospeccao-hoje' ||
      activeSection === 'prospeccao-buscar' ||
      activeSection === 'prospeccao-crm' ||
      activeSection === 'prospeccao-automacao'
    ) {
      const tabMap: Record<string, 'hoje' | 'buscar' | 'empresas'> = {
        'prospeccao-hoje': 'hoje',
        'prospeccao-buscar': 'buscar',
        'prospeccao-crm': 'empresas',
        'prospeccao-automacao': 'hoje',
      };
      const currentTab = tabMap[activeSection] || 'hoje';
      return (
        <LeadsDashboard
          key="leads-dashboard-unified"
          initialTab={currentTab}
          embeddedInUnifiedAdmin={true}
          onTabChange={handleLeadsDashboardTabChange}
        />
      );
    }

    // Módulo 3: Rede White-Label & Super Admin
    if (activeSection.startsWith('rede-')) {
      const tabMap: Record<string, SuperAdminTab> = {
        'rede-saloes': 'establishments',
        'rede-novo': 'new-establishment',
        'rede-admins': 'administrators',
        'rede-auditoria': 'audit-logs',
        'rede-configuracoes': 'settings',
      };
      const initialTab = tabMap[activeSection] || 'establishments';
      return (
        <SuperAdminPage
          key="super-admin-unified"
          initialTab={initialTab}
          embeddedInUnifiedAdmin={true}
          autoAuthenticated={true}
          onTabChange={handleSuperAdminTabChange}
          onEnterEstablishmentAdmin={(estId) => {
            store.selectEstablishment(estId);
            setActiveSection('salao-dashboard');
          }}
          onBackToApp={onBackToApp}
        />
      );
    }

    // Módulo 4: Catálogo de Modelos (Templates)
    if (activeSection === 'templates-catalogo') {
      const currentConfig =
        SITE_TEMPLATES_LIST.find((t) => t.id === selectedShowcaseTemplate) ||
        SITE_TEMPLATES_LIST[0];

      return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Catálogo Oficial
                </span>
                <span className="text-xs text-neutral-400">5 Modelos de Alta Conversão</span>
              </div>
              <h2 className="text-2xl font-bold font-display text-white mt-1">
                Modelos de Sites para Salões & Barbearias
              </h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                Todos os modelos utilizam os mesmos componentes profissionais (Hero, Agenda, Serviços, Produtos, Galeria, Contato). O cliente pode alternar entre os 5 modelos com 1 clique antes ou depois de contratar.
              </p>
            </div>

            <button
              onClick={() => {
                store.updateEstablishment(establishment.id, {
                  primaryColor: currentConfig.primaryColor,
                  tagline: currentConfig.tagline,
                });
                alert(`Modelo "${currentConfig.name}" aplicado ao salão "${establishment.name}" com sucesso!`);
              }}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Modelo ao Salão Atual</span>
            </button>
          </div>

          {/* 5 Templates Cards Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SITE_TEMPLATES_LIST.map((template, idx) => {
              const isSelected = selectedShowcaseTemplate === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedShowcaseTemplate(template.id)}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'border-amber-500 bg-neutral-900 shadow-xl ring-2 ring-amber-500/50'
                      : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        0{idx + 1}
                      </span>
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: template.primaryColor }}
                      />
                    </div>
                    <h3 className="font-bold text-sm text-white">{template.name}</h3>
                    <p className="text-[11px] text-neutral-400 line-clamp-2">
                      {template.tagline}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">
                      {isSelected ? 'Em visualização' : 'Clique para ver'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Live Preview Box */}
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                <span className="text-xs text-neutral-400 ml-2 font-mono">
                  https://seusalao.com.br/demo?modelo={currentConfig.id}
                </span>
              </div>
              <span className="text-xs font-semibold text-neutral-300">
                Visualização ao Vivo: {currentConfig.name}
              </span>
            </div>

            <div className="max-h-[800px] overflow-y-auto">
              <SiteTemplateRenderer
                businessData={{
                  name: establishment.name,
                  category: 'Barbearia & Estética Premium',
                  tagline: currentConfig.tagline,
                  description: establishment.tagline || 'Excelência em atendimento masculino com cortes modernos, barba terapia e ambiente climatizado.',
                  phone: establishment.phone || establishment.whatsapp,
                  whatsapp: establishment.whatsappClean || establishment.whatsapp,
                  address: establishment.address || 'Endereço não informado',
                  city: establishment.cityState || 'Porto Alegre - RS',
                  logoUrl: establishment.logoUrl || '/logo.jpg',
                  coverUrl: establishment.coverUrl || 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80',
                }}
                initialVariation={selectedShowcaseTemplate}
                isDemoSelection={true}
                onSelectVariation={(varId) => setSelectedShowcaseTemplate(varId)}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row font-sans antialiased">
      {/* ---------------------------------------------------- */}
      {/* SIDEBAR NAVEGAÇÃO DIVIDIDA EM MÓDULOS E SUBMENUS     */}
      {/* ---------------------------------------------------- */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {/* Logo & Platform Brand */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">
                  Painel Administrativo
                </h1>
                <p className="text-[10px] text-neutral-400">
                  {platformConfig.platformName}
                </p>
              </div>
            </div>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ESTABLISHMENT SELECTOR DROPDOWN */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Salão Ativo
            </label>
            <button
              type="button"
              onClick={() => setEstablishmentDropdownOpen(!establishmentDropdownOpen)}
              className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 flex items-center justify-between text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {establishment.name}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">
                    /{establishment.slug}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {establishmentDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl p-1.5 z-50 max-h-56 overflow-y-auto space-y-1">
                {allEstablishments.map((est) => (
                  <button
                    key={est.id}
                    onClick={() => handleSelectEstablishment(est.id)}
                    className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition ${
                      est.id === establishment.id
                        ? 'bg-amber-500/10 text-amber-300 font-bold'
                        : 'text-neutral-300 hover:bg-neutral-900'
                    }`}
                  >
                    <span className="truncate">{est.name}</span>
                    {est.id === establishment.id && (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </button>
                ))}
                <div className="pt-1.5 border-t border-neutral-800">
                  <button
                    onClick={() => {
                      setActiveSection('rede-novo');
                      setEstablishmentDropdownOpen(false);
                    }}
                    className="w-full p-2 rounded-lg text-left text-xs text-amber-400 hover:bg-neutral-900 flex items-center gap-1.5 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar Novo Salão</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ---------------------------------------------------- */}
          {/* MÓDULOS E SUBMENUS                                   */}
          {/* ---------------------------------------------------- */}
          <nav className="space-y-5">
            {/* MÓDULO 1: GESTÃO DO SALÃO */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleModuleCollapse('salao')}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gestão do Salão</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    collapsedModules.salao ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {!collapsedModules.salao && (
                <div className="space-y-0.5 pl-2 border-l border-neutral-800 ml-3">
                  {[
                    { id: 'salao-dashboard', label: 'Dashboard & Faturamento', icon: LayoutDashboard },
                    { id: 'salao-servicos', label: 'Serviços & Preços', icon: Scissors },
                    { id: 'salao-produtos', label: 'Produtos & Estoque', icon: ShoppingBag },
                    { id: 'salao-galeria', label: 'Galeria & Vídeos', icon: Images },
                    { id: 'salao-agendamentos', label: 'Agenda & Horários', icon: Calendar },
                    { id: 'salao-instagram', label: 'Feed Instagram', icon: Instagram },
                    { id: 'salao-configuracoes', label: 'Configurações do Salão', icon: Settings },
                  ].map((sub) => {
                    const Icon = sub.icon;
                    const isActive = activeSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveSection(sub.id as UnifiedAdminSection);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MÓDULO 2: PROSPECÇÃO & RASPAGEM (CRM ALVANTO) */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleModuleCollapse('prospeccao')}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  <span>Prospecção & Raspagem</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    collapsedModules.prospeccao ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {!collapsedModules.prospeccao && (
                <div className="space-y-0.5 pl-2 border-l border-neutral-800 ml-3">
                  {[
                    { id: 'prospeccao-hoje', label: 'Painel do Dia (Hoje)', icon: Compass },
                    { id: 'prospeccao-buscar', label: 'Nova Busca & Raspagem', icon: Search },
                    { id: 'prospeccao-crm', label: 'Pipeline CRM & Empresas', icon: Users },
                  ].map((sub) => {
                    const Icon = sub.icon;
                    const isActive = activeSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveSection(sub.id as UnifiedAdminSection);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? 'bg-purple-600 text-white font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MÓDULO 3: REDE WHITE-LABEL & SUPER ADMIN */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleModuleCollapse('rede')}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-neutral-400 hover:text-white uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Rede & Super Admin</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    collapsedModules.rede ? '-rotate-90' : ''
                  }`}
                />
              </button>

              {!collapsedModules.rede && (
                <div className="space-y-0.5 pl-2 border-l border-neutral-800 ml-3">
                  {[
                    { id: 'rede-saloes', label: `Salões da Rede (${allEstablishments.length})`, icon: Building2 },
                    { id: 'rede-novo', label: 'Cadastrar Novo Salão', icon: Plus },
                    { id: 'rede-admins', label: 'Administradores Gerais', icon: ShieldCheck },
                    { id: 'rede-auditoria', label: 'Auditoria & Logs', icon: Lock },
                    { id: 'rede-configuracoes', label: 'Planos & Configurações', icon: Sliders },
                  ].map((sub) => {
                    const Icon = sub.icon;
                    const isActive = activeSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveSection(sub.id as UnifiedAdminSection);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MÓDULO 4: CATÁLOGO DE MODELOS */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('templates-catalogo');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeSection === 'templates-catalogo'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>5 Modelos de Sites</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">
                  5
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 space-y-2">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-300 hover:bg-neutral-900 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Site Público</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT WRAPPER                                 */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Header */}
        <header className="h-16 border-b border-neutral-800 bg-neutral-950 px-4 flex items-center justify-between md:hidden sticky top-0 z-20">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg bg-neutral-900 text-neutral-300 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-white truncate max-w-[200px]">
            {establishment.name}
          </span>

          {onBackToApp ? (
            <button
              onClick={onBackToApp}
              className="text-xs text-amber-400 hover:underline"
            >
              Ver Site
            </button>
          ) : (
            <div className="w-5" />
          )}
        </header>

        {/* Content area */}
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
