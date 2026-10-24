import React, { useState } from 'react';
import {
  AdminTab,
  ServiceItem,
  ProductItem,
  MediaItem,
  MediaCategory,
  InstagramEmbedItem,
} from '../types';
import { useStore } from '../data/store';
import { MonthCalendar } from '../components/MonthCalendar';
import { InstagramEmbedModal } from '../components/InstagramEmbedModal';
import {
  LayoutDashboard,
  Scissors,
  ShoppingBag,
  Images,
  Video,
  Calendar,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Star,
  Check,
  X,
  Lock,
  LogOut,
  Sparkles,
  Phone,
  Instagram,
  MapPin,
  Upload,
  RefreshCw,
  Clock,
  Eye,
  AlertTriangle,
  MessageCircle,
  Search,
  CalendarCheck,
  CheckCircle2,
  CalendarDays,
  Filter,
  ExternalLink,
  Play,
  ShieldCheck,
} from 'lucide-react';

export interface AdminPageProps {
  onNavigateToSuperAdmin?: () => void;
  onBackToApp?: () => void;
  initialTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  embeddedInUnifiedAdmin?: boolean;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  onNavigateToSuperAdmin,
  onBackToApp,
  initialTab = 'dashboard',
  onTabChange,
  embeddedInUnifiedAdmin = false,
}) => {
  const {
    establishment,
    company,
    services,
    products,
    media,
    appointments,
    instagramEmbeds,
    session,
    store,
  } = useStore();

  // Authentication State: valid if local session belongs to this establishment OR if super admin OR embedded
  const isAuthorized =
    Boolean(embeddedInUnifiedAdmin) ||
    (session?.role === 'establishment_admin' && session?.establishmentId === establishment.id) ||
    session?.role === 'super_admin';

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(isAuthorized));
  const [pinError, setPinError] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  React.useEffect(() => {
    if (embeddedInUnifiedAdmin) {
      setIsAuthenticated(true);
    }
  }, [embeddedInUnifiedAdmin]);

  // Modals & Edit States
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTypeToAdd, setMediaTypeToAdd] = useState<'image' | 'video'>('image');

  const [editingInstagram, setEditingInstagram] = useState<InstagramEmbedItem | null>(null);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [previewInstagramId, setPreviewInstagramId] = useState<string | null>(null);

  // Appointment Administration States
  const [isBlockSlotModalOpen, setIsBlockSlotModalOpen] = useState(false);
  const [blockSlotModalDate, setBlockSlotModalDate] = useState<string | undefined>(undefined);
  const [adminAppointmentView, setAdminAppointmentView] = useState<'lista' | 'calendario'>('lista');
  const [adminSelectedDate, setAdminSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [appointmentSearch, setAppointmentSearch] = useState<string>('');
  const [appointmentFilter, setAppointmentFilter] = useState<
    'todos' | 'pendente' | 'confirmado' | 'concluido' | 'cancelado'
  >('todos');

  // Notification Toast
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = () => {
    store.logout();
    setIsAuthenticated(false);
  };

  // Helper for image upload to base64
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onComplete: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onComplete(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // If not logged in, show PIN screen scoped to current establishment
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 overflow-hidden shadow-inner">
            {establishment.logoUrl ? (
              <img src={establishment.logoUrl} alt={establishment.name} className="w-full h-full object-cover" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold font-display text-neutral-100">
              Acesso Administrativo
            </h2>
            <p className="text-xs text-amber-400 font-semibold mt-1">
              {establishment.name}
            </p>
            <p className="text-[11px] text-neutral-400">
              {establishment.cityState}
            </p>
          </div>

          <button
            onClick={() => {
              const res = store.loginLocalAdmin('', establishment.id);
              if (res.success) {
                setIsAuthenticated(true);
                setPinError(false);
                showNotification(`Bem-vindo ao painel de ${establishment.name}!`);
              } else {
                setPinError(true);
              }
            }}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Entrar no Painel do Estabelecimento
          </button>

          <div className="pt-4 border-t border-neutral-800 flex flex-col gap-2.5">
            {onNavigateToSuperAdmin && (
              <button
                type="button"
                onClick={onNavigateToSuperAdmin}
                className="w-full py-2.5 rounded-xl border border-neutral-700 bg-neutral-950/80 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Painel do Administrador Geral (Super Admin)</span>
              </button>
            )}

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                ← Voltar para o site do estabelecimento
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Super Admin Impersonation Notice */}
      {session?.impersonatedBySuperAdmin && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 block">
                MODO SUPER ADMIN ATIVO — Inspeção Privilegiada
              </span>
              <span className="text-[11px] text-neutral-300">
                Você está visualizando e gerenciando o estabelecimento: <strong>{establishment.name}</strong>. Todas as ações são auditadas.
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              store.superAdminExitEstablishment();
              if (onNavigateToSuperAdmin) {
                onNavigateToSuperAdmin();
              }
            }}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            Sair e Voltar ao Painel Master
          </button>
        </div>
      )}
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-24 right-5 z-50 bg-amber-500 text-neutral-950 px-4 py-3 rounded-xl font-semibold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 font-display">
            Gestão Comercial • {establishment.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-neutral-100 mt-0.5">
            Painel do Administrador Local
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            ID: <span className="font-mono text-neutral-300">{establishment.id}</span> (/{establishment.slug}) • {establishment.cityState}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
              <span>Ver Site</span>
            </button>
          )}

          {onNavigateToSuperAdmin && (
            <button
              onClick={onNavigateToSuperAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Painel Master</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 border border-neutral-800 text-xs font-medium text-neutral-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </div>

      {/* Admin Menu Tabs */}
      {!embeddedInUnifiedAdmin && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-neutral-800/80">
          {(() => {
            const pendingCount = appointments.filter((a) => a.status === 'pendente').length;
            return [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'servicos', label: 'Serviços', icon: Scissors },
              { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
              { id: 'galeria', label: 'Galeria', icon: Images },
              { id: 'videos', label: 'Vídeos', icon: Video },
              {
                id: 'agendamentos',
                label: 'Agendamentos',
                icon: Calendar,
                badge: pendingCount > 0 ? `${pendingCount} novo(s)` : undefined,
              },
              {
                id: 'instagram',
                label: 'Instagram Embeds',
                icon: Instagram,
                badge: `${instagramEmbeds.length}`,
              },
              { id: 'configuracoes', label: 'Configurações', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as AdminTab);
                    if (onTabChange) onTabChange(tab.id as AdminTab);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-neutral-950 text-amber-300'
                          : 'bg-amber-500 text-neutral-950'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs text-neutral-400 font-medium">
                Total de Serviços
              </span>
              <div className="text-3xl font-bold font-display text-amber-400">
                {services.length}
              </div>
              <span className="text-[11px] text-neutral-400 block">
                {services.filter((s) => s.featured).length} em destaque na Home
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs text-neutral-400 font-medium">
                Produtos no Catálogo
              </span>
              <div className="text-3xl font-bold font-display text-emerald-400">
                {products.length}
              </div>
              <span className="text-[11px] text-neutral-400 block">
                {products.filter((p) => p.available).length} disponíveis
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs text-neutral-400 font-medium">
                Mídias da Galeria
              </span>
              <div className="text-3xl font-bold font-display text-pink-400">
                {media.length}
              </div>
              <span className="text-[11px] text-neutral-400 block">
                {media.filter((m) => m.type === 'image').length} fotos / {media.filter((m) => m.type === 'video').length} vídeos
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs text-neutral-400 font-medium">
                Instagram Embeds
              </span>
              <div className="text-3xl font-bold font-display text-purple-400">
                {instagramEmbeds.length}
              </div>
              <span className="text-[11px] text-neutral-400 block">
                {company.instagramHandle}
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs text-neutral-400 font-medium">
                Canal de Atendimento
              </span>
              <div className="text-sm font-bold text-neutral-200 truncate mt-1">
                {company.whatsapp}
              </div>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3 h-3" /> Conectado e ativo
              </span>
            </div>
          </div>

          {/* Quick shortcuts */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-neutral-100">
              Ações Rápidas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => {
                  setEditingService(null);
                  setIsServiceModalOpen(true);
                }}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-left transition-all group cursor-pointer"
              >
                <Scissors className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-semibold text-neutral-100">
                  + Adicionar Serviço
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Corte, extensão de cílios ou unhas
                </p>
              </button>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 text-left transition-all group cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-semibold text-neutral-100">
                  + Adicionar Produto
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Cadastrar cosmético ou pomada
                </p>
              </button>

              <button
                onClick={() => {
                  setEditingMedia(null);
                  setMediaTypeToAdd('image');
                  setIsMediaModalOpen(true);
                }}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-pink-500/40 text-left transition-all group cursor-pointer"
              >
                <Images className="w-5 h-5 text-pink-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-semibold text-neutral-100">
                  + Foto ou Vídeo
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Publicar na galeria própria
                </p>
              </button>

              <button
                onClick={() => {
                  setEditingInstagram(null);
                  setIsInstagramModalOpen(true);
                }}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/40 text-left transition-all group cursor-pointer"
              >
                <Instagram className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-semibold text-neutral-100">
                  + Embedar Instagram
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Colar link de post ou reel
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVIÇOS */}
      {activeTab === 'servicos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-neutral-100">
              Gerenciar Serviços ({services.length})
            </h3>
            <button
              onClick={() => {
                setEditingService(null);
                setIsServiceModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Serviço</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between space-y-4"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-950 shrink-0">
                    <img
                      src={
                        service.imageUrl ||
                        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=300&q=80'
                      }
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {service.category}
                      </span>
                      {service.featured && (
                        <span className="text-[10px] font-semibold text-amber-300 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-300" /> Destaque
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-neutral-100 leading-tight">
                      {service.name}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {service.description}
                    </p>
                    <div className="text-xs text-neutral-300 font-semibold pt-1">
                      {typeof service.price === 'number'
                        ? `R$ ${service.price.toFixed(2).replace('.', ',')}`
                        : 'Preço sob consulta'}
                      {service.durationMinutes ? ` • ${service.durationMinutes}m` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                  <button
                    onClick={() => {
                      store.toggleFeaturedService(service.id);
                      showNotification('Status de destaque atualizado.');
                    }}
                    className={`text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                      service.featured
                        ? 'text-amber-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>{service.featured ? 'Destacado' : 'Destacar'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingService(service);
                        setIsServiceModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Deseja remover o serviço "${service.name}"?`)) {
                          store.deleteService(service.id);
                          showNotification('Serviço removido.');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PRODUTOS */}
      {activeTab === 'produtos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-neutral-100">
              Gerenciar Produtos ({products.length})
            </h3>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Produto</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between space-y-4"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-950 shrink-0">
                    <img
                      src={product.mainImage}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {product.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          product.available ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {product.available ? 'Em Estoque' : 'Indisponível'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-100 leading-tight">
                      {product.name}
                    </h4>
                    <p className="text-xs font-bold text-amber-400 pt-0.5 font-display">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                  <button
                    onClick={() => {
                      store.toggleFeaturedProduct(product.id);
                      showNotification('Destaque de produto atualizado.');
                    }}
                    className={`text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                      product.featured
                        ? 'text-amber-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>{product.featured ? 'Destacado' : 'Destacar'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingProduct(product);
                        setIsProductModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Deseja remover o produto "${product.name}"?`)) {
                          store.deleteProduct(product.id);
                          showNotification('Produto removido.');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: GALERIA DE FOTOS */}
      {activeTab === 'galeria' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-neutral-100">
              Fotos da Galeria ({media.filter((m) => m.type === 'image').length})
            </h3>
            <button
              onClick={() => {
                setEditingMedia(null);
                setMediaTypeToAdd('image');
                setIsMediaModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Foto</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {media
              .filter((m) => m.type === 'image')
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden group relative flex flex-col justify-between"
                >
                  <div className="aspect-square bg-neutral-950 relative">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-semibold bg-neutral-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 border-t border-neutral-800 flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-neutral-200 truncate pr-2">
                      {item.title}
                    </h5>
                    <button
                      onClick={() => {
                        if (confirm(`Remover foto "${item.title}"?`)) {
                          store.deleteMedia(item.id);
                          showNotification('Foto removida da galeria.');
                        }
                      }}
                      className="p-1 rounded bg-rose-950/50 hover:bg-rose-900 text-rose-300 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 5: VÍDEOS & REELS */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-display text-neutral-100">
              Vídeos & Reels Verticais ({media.filter((m) => m.type === 'video').length})
            </h3>
            <button
              onClick={() => {
                setEditingMedia(null);
                setMediaTypeToAdd('video');
                setIsMediaModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Vídeo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {media
              .filter((m) => m.type === 'video')
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-video bg-neutral-950 relative flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-10 h-10 text-neutral-600" />
                    )}
                    <span className="absolute top-2 left-2 text-[10px] font-semibold bg-neutral-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                      {item.category}
                    </span>
                    {item.isReelVertical && (
                      <span className="absolute top-2 right-2 text-[10px] font-semibold bg-rose-950/80 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20">
                        Reel Vertical (9:16)
                      </span>
                    )}
                  </div>

                  <div className="p-3 border-t border-neutral-800 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-neutral-200">
                        {item.title}
                      </h5>
                      <span className="text-[10px] text-neutral-400 truncate block max-w-xs">
                        {item.url}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Remover vídeo "${item.title}"?`)) {
                          store.deleteMedia(item.id);
                          showNotification('Vídeo removido.');
                        }
                      }}
                      className="p-1.5 rounded bg-rose-950/50 hover:bg-rose-900 text-rose-300 transition-colors shrink-0 cursor-pointer ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 6: AGENDAMENTOS & CALENDÁRIO COM AVANÇO DE MESES */}
      {activeTab === 'agendamentos' && (
        <div className="space-y-6">
          {/* Header da aba */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-display">
                  Gestão de Agenda & Anti-Conflito
                </span>
                {appointments.filter((a) => a.status === 'pendente').length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-neutral-950 animate-pulse">
                    {appointments.filter((a) => a.status === 'pendente').length} pendente(s) via WhatsApp
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold font-display text-neutral-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Agendamentos & Reservas ({appointments.length})</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Ao marcar um pedido como <strong className="text-emerald-400">Confirmado</strong>, a data e horário ficam visivelmente bloqueados como <strong className="text-rose-400">Reservado</strong> no site público para evitar duplicidade de horários.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Seletor de Modo: Lista vs Calendário Mensal */}
              <div className="inline-flex p-1 rounded-xl bg-neutral-900 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setAdminAppointmentView('lista')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    adminAppointmentView === 'lista'
                      ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Lista de Pedidos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminAppointmentView('calendario')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    adminAppointmentView === 'calendario'
                      ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Calendário Mensal</span>
                </button>
              </div>

              {/* Botão Criar Agendamento / Bloquear Horário */}
              <button
                type="button"
                onClick={() => {
                  setBlockSlotModalDate(adminSelectedDate);
                  setIsBlockSlotModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Criar Agendamento</span>
              </button>
            </div>
          </div>

          {/* MODO 1: LISTA DE PEDIDOS COM FILTROS */}
          {adminAppointmentView === 'lista' && (
            <div className="space-y-5">
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Filtros de Status */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'todos', label: 'Todos', count: appointments.length },
                    {
                      id: 'pendente',
                      label: 'Pendentes (WhatsApp)',
                      count: appointments.filter((a) => a.status === 'pendente').length,
                    },
                    {
                      id: 'confirmado',
                      label: 'Confirmados',
                      count: appointments.filter((a) => a.status === 'confirmado').length,
                    },
                    {
                      id: 'concluido',
                      label: 'Concluídos',
                      count: appointments.filter((a) => a.status === 'concluido').length,
                    },
                    {
                      id: 'cancelado',
                      label: 'Cancelados',
                      count: appointments.filter((a) => a.status === 'cancelado').length,
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAppointmentFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        appointmentFilter === f.id
                          ? 'bg-neutral-100 text-neutral-950 font-bold'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          appointmentFilter === f.id
                            ? 'bg-neutral-950 text-white'
                            : f.id === 'pendente' && f.count > 0
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Busca */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={appointmentSearch}
                    onChange={(e) => setAppointmentSearch(e.target.value)}
                    placeholder="Buscar por cliente ou serviço..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Lista Filtrada */}
              {(() => {
                const filtered = appointments
                  .filter((a) => {
                    if (appointmentFilter !== 'todos' && a.status !== appointmentFilter) {
                      return false;
                    }
                    if (appointmentSearch.trim()) {
                      const q = appointmentSearch.toLowerCase();
                      const matchName = a.clientName.toLowerCase().includes(q);
                      const matchService = a.serviceName.toLowerCase().includes(q);
                      const matchDate = a.date.includes(q);
                      const matchPhone = a.clientPhone.includes(q);
                      return matchName || matchService || matchDate || matchPhone;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    // Pendentes primeiro, depois por data
                    if (a.status === 'pendente' && b.status !== 'pendente') return -1;
                    if (a.status !== 'pendente' && b.status === 'pendente') return 1;
                    return a.date.localeCompare(b.date);
                  });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center space-y-3">
                      <Calendar className="w-12 h-12 text-neutral-600 mx-auto" />
                      <h4 className="text-base font-bold text-neutral-200">
                        Nenhum agendamento encontrado
                      </h4>
                      <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                        {appointmentSearch
                          ? 'Nenhum agendamento corresponde ao termo pesquisado.'
                          : 'As solicitações feitas no site aparecerão automaticamente aqui. Você também pode cadastrar um agendamento manual no botão acima.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((appt) => {
                      const cleanClientPhone = appt.clientPhone.replace(/\D/g, '');
                      const clientPhoneFormatted = cleanClientPhone.startsWith('55')
                        ? cleanClientPhone
                        : `55${cleanClientPhone}`;

                      const [year, month, day] = appt.date.split('-');
                      const formattedDate = `${day}/${month}/${year}`;

                      // Link para responder e confirmar com o cliente no WhatsApp
                      const clientConfirmationWa = `https://wa.me/${clientPhoneFormatted}?text=${encodeURIComponent(
                        `Olá ${appt.clientName}! Aqui é do estabelecimento.\n\nInformamos que o seu agendamento de *${appt.serviceName}* no dia *${formattedDate}* às *${appt.time}* está ✅ CONFIRMADO!\n\nEndereço: ${company.address}, ${company.cityState}.\nEstamos aguardando você!`
                      )}`;

                      const isPending = appt.status === 'pendente';
                      const isConfirmed = appt.status === 'confirmado';

                      return (
                        <div
                          key={appt.id}
                          className={`bg-neutral-900 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all ${
                            isPending
                              ? 'border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20'
                              : isConfirmed
                              ? 'border-emerald-500/30'
                              : 'border-neutral-800'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Status Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    isConfirmed
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : appt.status === 'concluido'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : appt.status === 'cancelado'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  }`}
                                >
                                  {isPending ? 'PENDENTE • VIA WHATSAPP' : isConfirmed ? 'CONFIRMADO (BLOQUEADO)' : appt.status.toUpperCase()}
                                </span>
                              </div>

                              <span className="text-xs text-neutral-300 font-mono font-semibold bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                                📅 {formattedDate} às {appt.time}
                              </span>
                            </div>

                            {/* Informações do Cliente */}
                            <div>
                              <h4 className="text-base font-bold text-neutral-100 font-display">
                                {appt.clientName}
                              </h4>
                              <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{appt.clientPhone}</span>
                              </p>
                            </div>

                            {/* Detalhes do Serviço */}
                            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-400">Procedimento:</span>
                                <span className="font-semibold text-neutral-100">
                                  {appt.serviceName}
                                </span>
                              </div>
                              {appt.serviceDuration && (
                                <div className="flex items-center justify-between text-neutral-400">
                                  <span>Duração estimada:</span>
                                  <span>{appt.serviceDuration} min</span>
                                </div>
                              )}
                              {typeof appt.servicePrice === 'number' && (
                                <div className="flex items-center justify-between text-neutral-400">
                                  <span>Valor estimado:</span>
                                  <span className="text-amber-400 font-bold">
                                    R$ {appt.servicePrice.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              )}
                              {appt.notes && (
                                <div className="pt-1.5 border-t border-neutral-800 text-neutral-300 italic">
                                  "{appt.notes}"
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ações e Controles */}
                          <div className="space-y-2 border-t border-neutral-800 pt-3">
                            {/* Botão de Destaque: Se estiver pendente, botão rápido de confirmação */}
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => {
                                  store.updateAppointmentStatus(appt.id, 'confirmado');
                                  showNotification(
                                    `Data ${formattedDate} às ${appt.time} CONFIRMADA e BLOQUEADA no site para evitar conflito!`
                                  );
                                }}
                                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>✓ Marcar como Confirmado (Bloquear no Site)</span>
                              </button>
                            )}

                            <div className="flex items-center justify-between gap-2">
                              {/* Seletor de Status Geral */}
                              <select
                                value={appt.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as any;
                                  store.updateAppointmentStatus(appt.id, newStatus);
                                  if (newStatus === 'confirmado') {
                                    showNotification(
                                      `Horário ${appt.time} (${formattedDate}) CONFIRMADO e BLOQUEADO no site para evitar conflito!`
                                    );
                                  } else if (newStatus === 'cancelado') {
                                    showNotification(
                                      `Agendamento cancelado. Horário ${appt.time} liberado na agenda pública.`
                                    );
                                  } else {
                                    showNotification('Status do agendamento atualizado.');
                                  }
                                }}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                              >
                                <option value="pendente">Status: Pendente</option>
                                <option value="confirmado">Status: Confirmado (Bloqueia)</option>
                                <option value="concluido">Status: Concluído</option>
                                <option value="cancelado">Status: Cancelado (Libera)</option>
                              </select>

                              {/* Botão Excluir */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Deseja excluir o agendamento de ${appt.clientName}?`)) {
                                    store.deleteAppointment(appt.id);
                                    showNotification('Agendamento excluído.');
                                  }
                                }}
                                className="p-2 rounded-lg bg-neutral-800 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Excluir agendamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Botão de WhatsApp com o Cliente */}
                            <a
                              href={clientConfirmationWa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs shadow-xs transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                              <span>Responder / Confirmar no WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODO 2: CALENDÁRIO MENSAL COM AVANÇO DE MESES */}
          {adminAppointmentView === 'calendario' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Calendário com avanço de meses à esquerda (5 colunas) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-neutral-200 font-display flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>Navegação Mensal</span>
                    </h4>
                    <span className="text-xs text-amber-400 font-bold">
                      {adminSelectedDate.split('-').reverse().join('/')}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Clique nas setas para <strong>avançar pelos próximos meses</strong> ou retroceder. Clique em qualquer dia para ver a lista de atendimentos e horários livres.
                  </p>

                  <MonthCalendar
                    selectedDate={adminSelectedDate}
                    onSelectDate={(newDate) => setAdminSelectedDate(newDate)}
                    appointments={appointments}
                    allowPastMonths={true}
                  />
                </div>
              </div>

              {/* Detalhes do Dia Selecionado à direita (6 colunas) */}
              <div className="lg:col-span-6 space-y-4">
                {(() => {
                  const dayAppointments = appointments.filter(
                    (a) => a.date === adminSelectedDate
                  );
                  const dayConfirmed = dayAppointments.filter(
                    (a) => a.status === 'confirmado'
                  );
                  const dayPending = dayAppointments.filter(
                    (a) => a.status === 'pendente'
                  );

                  const [year, month, day] = adminSelectedDate.split('-');
                  const formattedDate = `${day}/${month}/${year}`;

                  return (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                        <div>
                          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold font-display">
                            Programação do Dia
                          </span>
                          <h4 className="text-lg font-bold text-neutral-100 font-display mt-0.5">
                            {formattedDate}
                          </h4>
                          <span className="text-xs text-neutral-400">
                            {dayAppointments.length} agendamento(s) • {dayConfirmed.length} confirmado(s)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setBlockSlotModalDate(adminSelectedDate);
                            setIsBlockSlotModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Agendar neste Dia</span>
                        </button>
                      </div>

                      {/* Lista de Atendimentos do Dia */}
                      {dayAppointments.length === 0 ? (
                        <div className="p-8 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                          <h5 className="text-sm font-semibold text-neutral-300">
                            Nenhum agendamento para este dia
                          </h5>
                          <p className="text-xs text-neutral-500">
                            Todos os horários estão livres para os clientes reservarem no site.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dayAppointments.map((appt) => (
                            <div
                              key={appt.id}
                              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                appt.status === 'confirmado'
                                  ? 'bg-neutral-950 border-emerald-500/30'
                                  : appt.status === 'pendente'
                                  ? 'bg-amber-500/5 border-amber-500/40'
                                  : 'bg-neutral-950 border-neutral-800'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                                    ⏰ {appt.time}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      appt.status === 'confirmado'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : appt.status === 'pendente'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-neutral-800 text-neutral-400'
                                    }`}
                                  >
                                    {appt.status}
                                  </span>
                                </div>
                                <h6 className="text-sm font-bold text-neutral-100">
                                  {appt.clientName}
                                </h6>
                                <p className="text-xs text-neutral-400">
                                  {appt.serviceName} • {appt.clientPhone}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {appt.status === 'pendente' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      store.updateAppointmentStatus(appt.id, 'confirmado');
                                      showNotification(
                                        `Horário ${appt.time} confirmado e bloqueado no site!`
                                      );
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                                  >
                                    Confirmar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Excluir este agendamento?')) {
                                      store.deleteAppointment(appt.id);
                                      showNotification('Agendamento excluído.');
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: INSTAGRAM EMBEDS & REELS */}
      {activeTab === 'instagram' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <Instagram className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold font-display text-neutral-100">
                  Gerenciar Instagram Embeds ({instagramEmbeds.length})
                </h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Adicione publicações do Instagram do estabelecimento para exibir no site.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingInstagram(null);
                setIsInstagramModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Embedar Novo Post / Reel</span>
            </button>
          </div>

          {/* Quick info about company's Instagram account */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full p-[2px] bg-amber-500 shrink-0">
                <img
                  src="/logo.jpg"
                  alt="avatar"
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                  <span>{company.instagramHandle}</span>
                  <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20 font-bold">
                    Oficial
                  </span>
                </h4>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {company.instagramBio || 'Descreva o seu estabelecimento e os serviços oferecidos.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={company.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-semibold transition-colors"
              >
                <span>Abrir Instagram</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setActiveTab('configuracoes')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configurar Perfil</span>
              </button>
            </div>
          </div>

          {/* Grid of Instagram Embeds */}
          {instagramEmbeds.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center space-y-3">
              <Instagram className="w-12 h-12 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-neutral-200">
                Nenhum post do Instagram embedado ainda
              </h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Clique no botão acima para colar o link de um post ou reel do Instagram e integrá-lo ao site.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instagramEmbeds.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between group hover:border-amber-400/40 transition-all shadow-md"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="p-3 bg-neutral-950 flex items-center justify-between border-b border-neutral-800 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Instagram className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <code className="text-[11px] text-amber-400 truncate font-mono">
                          {item.shortcode}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.featured && (
                          <span className="text-[9px] uppercase font-bold text-amber-300 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/30">
                            Destaque
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                          {item.type === 'reel' ? 'Reel' : 'Post'}
                        </span>
                      </div>
                    </div>

                    {/* Imagem de Capa */}
                    <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                      <img
                        src={
                          item.previewImageUrl ||
                          'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80'
                        }
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {item.type === 'reel' && (
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-neutral-950/80 text-white">
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="p-4 space-y-2">
                      <h4 className="text-sm font-bold text-neutral-100 group-hover:text-amber-200 transition-colors">
                        {item.title}
                      </h4>
                      {item.caption && (
                        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                          {item.caption}
                        </p>
                      )}
                      <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-400">
                        <span>❤️ {item.likesCount || '500+'} curtidas</span>
                        <span>💬 {item.commentsCount || '30'} coments</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="p-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver post</span>
                    </a>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewInstagramId(
                            previewInstagramId === item.id ? null : item.id
                          )
                        }
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          previewInstagramId === item.id
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        }`}
                        title="Testar Iframe oficial do Instagram"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingInstagram(item);
                          setIsInstagramModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                        title="Editar post embedado"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover o post "${item.title}" dos embeds do site?`)) {
                            store.deleteInstagramEmbed(item.id);
                            showNotification('Post removido dos embeds.');
                          }
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Excluir post embedado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Iframe Preview se ativado pelo admin */}
                  {previewInstagramId === item.id && (
                    <div className="p-3 bg-neutral-950 border-t border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="font-semibold text-amber-300">
                          Preview do Iframe Oficial ({store.parseInstagramUrl(item.url).shortcode}):
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewInstagramId(null)}
                          className="hover:text-white transition-colors cursor-pointer"
                        >
                          Fechar ✕
                        </button>
                      </div>
                      <div className="w-full h-[520px] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                        <iframe
                          src={store.parseInstagramUrl(item.url).embedUrl}
                          title={item.title}
                          className="w-full h-full border-0"
                          frameBorder="0"
                          scrolling="no"
                          allowTransparency={true}
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: CONFIGURAÇÕES */}
      {activeTab === 'configuracoes' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold font-display text-neutral-100">
              Dados do Estabelecimento
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Número de WhatsApp Oficial (para links e botões)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Exibição formatada:</span>
                    <input
                      type="text"
                      value={company.whatsapp}
                      onChange={(e) => store.updateCompany({ whatsapp: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Apenas dígitos (com DDI 55 e DDD):</span>
                    <input
                      type="text"
                      value={company.whatsappClean}
                      onChange={(e) => store.updateCompany({ whatsappClean: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Instagram Oficial
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Arroba (@):</span>
                    <input
                      type="text"
                      value={company.instagramHandle}
                      onChange={(e) => store.updateCompany({ instagramHandle: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Link completo:</span>
                    <input
                      type="text"
                      value={company.instagramUrl}
                      onChange={(e) => store.updateCompany({ instagramUrl: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Seguidores exibidos:</span>
                    <input
                      type="text"
                      value={company.instagramFollowers || ''}
                      onChange={(e) => store.updateCompany({ instagramFollowers: e.target.value })}
                      placeholder="Ex: 4.8k"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Bio / Descrição do Instagram:</span>
                    <input
                      type="text"
                      value={company.instagramBio || ''}
                      onChange={(e) => store.updateCompany({ instagramBio: e.target.value })}
                      placeholder="Ex: Barbearia, salão de beleza ou espaço de estética..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Logo Oficial da Marca (Navbar, PWA e Redes)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-950 border border-amber-500/40 shrink-0">
                    <img
                      src={company.logoUrl || '/logo.jpg'}
                      alt={company.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <input
                    type="text"
                    value={company.logoUrl || '/logo.jpg'}
                    onChange={(e) => store.updateCompany({ logoUrl: e.target.value })}
                    placeholder="/logo.jpg"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Endereço do Estabelecimento
                </label>
                <input
                  type="text"
                  value={company.address}
                  onChange={(e) => store.updateCompany({ address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Cidade / Estado
                </label>
                <input
                  type="text"
                  value={company.cityState}
                  onChange={(e) => store.updateCompany({ cityState: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Aviso de Horários / Agendamentos
                </label>
                <input
                  type="text"
                  value={company.openingHoursNote || ''}
                  onChange={(e) => store.updateCompany({ openingHoursNote: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-neutral-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Autenticação do Administrador
                </label>
                <span className="text-xs text-neutral-500">
                  Gerenciado exclusivamente pelo Supabase Auth — nenhum PIN local é armazenado.
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-neutral-800">
              <span className="text-xs text-neutral-400">
                As alterações são salvas automaticamente.
              </span>
              <button
                onClick={() => {
                  if (confirm('Deseja restaurar os dados de demonstração padrão?')) {
                    store.resetAllData();
                    showNotification('Dados restaurados com sucesso.');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-rose-300 text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restaurar dados padrão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO / EDITAR SERVIÇO */}
      {isServiceModalOpen && (
        <ServiceFormModal
          service={editingService}
          onClose={() => setIsServiceModalOpen(false)}
          onSave={(data) => {
            if (editingService) {
              store.updateService(editingService.id, data);
              showNotification('Serviço atualizado.');
            } else {
              store.addService(data);
              showNotification('Novo serviço cadastrado.');
            }
            setIsServiceModalOpen(false);
          }}
        />
      )}

      {/* MODAL: NOVO / EDITAR PRODUTO */}
      {isProductModalOpen && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setIsProductModalOpen(false)}
          onSave={(data) => {
            if (editingProduct) {
              store.updateProduct(editingProduct.id, data);
              showNotification('Produto atualizado.');
            } else {
              store.addProduct(data);
              showNotification('Novo produto cadastrado.');
            }
            setIsProductModalOpen(false);
          }}
        />
      )}

      {/* MODAL: NOVA MÍDIA (FOTO OU VÍDEO) */}
      {isMediaModalOpen && (
        <MediaFormModal
          initialType={mediaTypeToAdd}
          onClose={() => setIsMediaModalOpen(false)}
          onSave={(data) => {
            store.addMedia(data);
            showNotification('Mídia adicionada à galeria.');
            setIsMediaModalOpen(false);
          }}
        />
      )}

      {/* MODAL: CRIAR AGENDAMENTO / BLOQUEAR HORÁRIO */}
      {isBlockSlotModalOpen && (
        <BlockSlotModal
          initialDate={blockSlotModalDate || adminSelectedDate}
          onClose={() => {
            setIsBlockSlotModalOpen(false);
            setBlockSlotModalDate(undefined);
          }}
          onSave={(data) => {
            const finalStatus = data.status || 'confirmado';
            store.addAppointment({
              ...data,
              status: finalStatus,
            });
            const [y, m, d] = data.date.split('-');
            const formatted = `${d}/${m}/${y}`;
            if (finalStatus === 'confirmado') {
              showNotification(
                `Horário das ${data.time} (${formatted}) BLOQUEADO e CONFIRMADO no site para evitar conflito!`
              );
            } else {
              showNotification(
                `Agendamento para ${data.time} (${formatted}) salvo como Pendente.`
              );
            }
            setIsBlockSlotModalOpen(false);
            setBlockSlotModalDate(undefined);
          }}
        />
      )}

      {/* MODAL: EMBEDAR POST OU REEL DO INSTAGRAM */}
      {isInstagramModalOpen && (
        <InstagramEmbedModal
          embedItem={editingInstagram}
          onClose={() => {
            setIsInstagramModalOpen(false);
            setEditingInstagram(null);
          }}
          onSave={(data) => {
            if (editingInstagram) {
              store.updateInstagramEmbed(editingInstagram.id, data);
              showNotification('Post do Instagram atualizado.');
            } else {
              store.addInstagramEmbed(data);
              showNotification('Novo post embedado com sucesso!');
            }
            setIsInstagramModalOpen(false);
            setEditingInstagram(null);
          }}
        />
      )}
    </div>
  );
};

// ----------------- SUB-MODAIS DE CADASTRO -----------------

// 1. Modal Serviço
interface ServiceFormModalProps {
  service: ServiceItem | null;
  onClose: () => void;
  onSave: (data: Omit<ServiceItem, 'id'>) => void;
}

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  service,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(service?.name || '');
  const [category, setCategory] = useState(service?.category || 'Barbearia');
  const [description, setDescription] = useState(service?.description || '');
  const [priceStr, setPriceStr] = useState(
    service?.price !== null && service?.price !== undefined
      ? String(service.price)
      : ''
  );
  const [durationStr, setDurationStr] = useState(
    service?.durationMinutes ? String(service.durationMinutes) : '45'
  );
  const [imageUrl, setImageUrl] = useState(
    service?.imageUrl ||
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80'
  );
  const [featured, setFeatured] = useState(service?.featured ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: priceStr ? parseFloat(priceStr) : null,
      durationMinutes: durationStr ? parseInt(durationStr, 10) : null,
      imageUrl: imageUrl.trim(),
      featured,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-lg font-bold font-display text-neutral-100">
            {service ? 'Editar Serviço' : 'Novo Serviço'}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Nome do Serviço *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Extensão de Cílios Volume Brasileiro"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              >
                <option value="Barbearia">Barbearia</option>
                <option value="Cílios">Cílios</option>
                <option value="Sobrancelhas">Sobrancelhas</option>
                <option value="Cabelos">Cabelos</option>
                <option value="Unhas">Unhas</option>
                <option value="Tranças">Tranças</option>
                <option value="Estética Facial">Estética Facial</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Duração estimada (minutos)
              </label>
              <input
                type="number"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="Ex: 45"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Preço (R$) (Opcional - deixe vazio se for sob consulta)
            </label>
            <input
              type="number"
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="Ex: 50.00 ou vazio"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Descrição
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhes ou benefícios do procedimento..."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Imagem do Serviço
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Cole a URL ou envie um arquivo abaixo"
                className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer text-xs font-medium border border-neutral-700 transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Escolher foto do aparelho</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setImageUrl(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {imageUrl && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="srv-featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 bg-neutral-950 border-neutral-700 focus:ring-0"
            />
            <label htmlFor="srv-featured" className="text-neutral-300 text-xs">
              Exibir este serviço na seção de destaques da Página Inicial
            </label>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
            >
              Salvar Serviço
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Modal Produto
interface ProductFormModalProps {
  product: ProductItem | null;
  onClose: () => void;
  onSave: (data: Omit<ProductItem, 'id'>) => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || 'Barbearia');
  const [description, setDescription] = useState(product?.description || '');
  const [priceStr, setPriceStr] = useState(
    product?.price !== undefined ? String(product.price) : '35.00'
  );
  const [mainImage, setMainImage] = useState(
    product?.mainImage ||
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'
  );
  const [additionalImgsStr, setAdditionalImgsStr] = useState(
    product?.additionalImages?.join('\n') || ''
  );
  const [available, setAvailable] = useState(product?.available ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const extraImgs = additionalImgsStr
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: parseFloat(priceStr) || 0,
      mainImage: mainImage.trim(),
      additionalImages: extraImgs,
      available,
      featured,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-lg font-bold font-display text-neutral-100">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Nome do Produto *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pomada Modeladora — Demonstração"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none"
              >
                <option value="Barbearia">Barbearia</option>
                <option value="Estética">Estética</option>
                <option value="Cabelos">Cabelos</option>
                <option value="Acessórios">Acessórios</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Preço de Venda (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="Ex: 35.00"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Descrição do Produto
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Benefícios, modo de uso, composição..."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Imagem Principal do Produto
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={mainImage}
                onChange={(e) => setMainImage(e.target.value)}
                placeholder="Cole a URL ou selecione uma foto"
                className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer text-xs font-medium border border-neutral-700 transition-colors">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Escolher foto do aparelho</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setMainImage(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {mainImage && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                  <img src={mainImage} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Imagens Adicionais (uma URL por linha)
            </label>
            <textarea
              rows={2}
              value={additionalImgsStr}
              onChange={(e) => setAdditionalImgsStr(e.target.value)}
              placeholder="https://...&#10;https://..."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-emerald-400 focus:outline-none font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prod-available"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-neutral-950 border-neutral-700 focus:ring-0"
              />
              <label htmlFor="prod-available" className="text-neutral-300 text-xs">
                Em estoque (disponível para venda)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prod-featured"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-neutral-950 border-neutral-700 focus:ring-0"
              />
              <label htmlFor="prod-featured" className="text-neutral-300 text-xs">
                Destaque na Home
              </label>
            </div>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              Salvar Produto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Modal Mídia (Foto ou Vídeo)
interface MediaFormModalProps {
  initialType: 'image' | 'video';
  onClose: () => void;
  onSave: (data: Omit<MediaItem, 'id' | 'dateAdded'>) => void;
}

const MediaFormModal: React.FC<MediaFormModalProps> = ({
  initialType,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<'image' | 'video'>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MediaCategory>('Barbearia');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isReelVertical, setIsReelVertical] = useState(type === 'video');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    onSave({
      type,
      title: title.trim(),
      category,
      url: url.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      isReelVertical: type === 'video' ? isReelVertical : false,
      featured: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-lg font-bold font-display text-neutral-100">
            Adicionar {type === 'video' ? 'Vídeo / Reel' : 'Foto'} à Galeria
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setType('image');
                setIsReelVertical(false);
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                type === 'image'
                  ? 'bg-amber-500 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
              }`}
            >
              Foto
            </button>
            <button
              type="button"
              onClick={() => {
                setType('video');
                setIsReelVertical(true);
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                type === 'video'
                  ? 'bg-amber-500 text-neutral-950'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
              }`}
            >
              Vídeo / Reel
            </button>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Título / Descrição Curta *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Corte Degradê Navalhado e Barba Alinhada"
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Categoria da Galeria *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            >
              <option value="Barbearia">Barbearia</option>
              <option value="Cílios">Cílios</option>
              <option value="Sobrancelhas">Sobrancelhas</option>
              <option value="Cabelos">Cabelos</option>
              <option value="Unhas">Unhas</option>
              <option value="Tranças">Tranças</option>
              <option value="Produtos">Produtos</option>
              <option value="Ambiente">Ambiente</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Arquivo ou URL da Mídia ({type === 'video' ? 'Vídeo MP4/WebM' : 'Foto JPG/PNG/WebP'}) *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole a URL ou envie um arquivo abaixo"
                className="flex-1 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer text-xs font-medium border border-neutral-700 transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Enviar {type === 'video' ? 'vídeo' : 'foto'} do aparelho</span>
                <input
                  type="file"
                  accept={type === 'video' ? 'video/mp4,video/webm' : 'image/*'}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          setUrl(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {url && type === 'image' && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          {type === 'video' && (
            <>
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  URL da Imagem de Capa (Thumbnail do Vídeo)
                </label>
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://... (opcional)"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vid-vertical"
                  checked={isReelVertical}
                  onChange={(e) => setIsReelVertical(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-neutral-950 border-neutral-700 focus:ring-0"
                />
                <label htmlFor="vid-vertical" className="text-neutral-300 text-xs">
                  Vídeo Vertical / Formato Reel (9:16)
                </label>
              </div>
            </>
          )}

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
            >
              Salvar Mídia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Modal Bloquear / Agendar Horário na Agenda (Admin)
interface BlockSlotModalProps {
  initialDate?: string;
  onClose: () => void;
  onSave: (data: {
    clientName: string;
    clientPhone: string;
    serviceId: string;
    serviceName: string;
    date: string;
    time: string;
    notes?: string;
    status?: 'pendente' | 'confirmado';
  }) => void;
}

const BlockSlotModal: React.FC<BlockSlotModalProps> = ({
  initialDate,
  onClose,
  onSave,
}) => {
  const { services } = useStore();
  const todayIso = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialDate || todayIso);
  const [time, setTime] = useState('14:00');
  const [serviceChoice, setServiceChoice] = useState<string>(
    services[0]?.name || 'Corte de Cabelo Masculino & Barba'
  );
  const [isCustomService, setIsCustomService] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [clientName, setClientName] = useState('Cliente Presencial');
  const [clientPhone, setClientPhone] = useState('(92) 98618-7766');
  const [notes, setNotes] = useState('Agendamento registrado pelo administrador.');
  const [status, setStatus] = useState<'confirmado' | 'pendente'>('confirmado');

  const timeslots = [
    '09:00',
    '09:45',
    '10:30',
    '11:15',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '18:45',
    '19:30',
  ];

  const effectiveServiceName = isCustomService
    ? customServiceName.trim() || 'Procedimento Personalizado'
    : serviceChoice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !effectiveServiceName.trim()) return;

    onSave({
      clientName: clientName.trim() || 'Cliente Presencial',
      clientPhone: clientPhone.trim() || 'Sem telefone',
      serviceId: isCustomService ? 'custom' : 'registered',
      serviceName: effectiveServiceName,
      date,
      time,
      notes: notes.trim() || undefined,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-lg font-bold font-display text-neutral-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Novo Agendamento / Bloqueio</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Defina a data, horário e status para salvar na agenda.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Data do Atendimento *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Horário *
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              >
                {timeslots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Serviço / Procedimento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-neutral-300 font-semibold">
                Procedimento / Motivo *
              </label>
              <button
                type="button"
                onClick={() => setIsCustomService(!isCustomService)}
                className="text-amber-400 hover:underline text-[11px]"
              >
                {isCustomService ? 'Escolher da lista' : 'Digitar personalizado'}
              </button>
            </div>

            {isCustomService ? (
              <input
                type="text"
                required
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="Ex: Intervalo de Almoço, Reunião, Atendimento VIP..."
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <select
                value={serviceChoice}
                onChange={(e) => setServiceChoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.name}>
                    {srv.name}
                  </option>
                ))}
                <option value="Atendimento Presencial / Balcão">
                  Atendimento Presencial / Balcão
                </option>
                <option value="Bloqueio de Horário">Bloqueio de Horário</option>
              </select>
            )}
          </div>

          {/* Dados do Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Nome do Cliente / Identificação
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Telefone / WhatsApp (opcional)
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="(92) 99999-9999"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Status Inicial */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-1.5">
              Status Inicial do Agendamento *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('confirmado')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  status === 'confirmado'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/30'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmado</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Bloqueia no site público
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('pendente')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  status === 'pendente'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-1 ring-amber-500/30'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5 text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendente</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Aguardando confirmação
                </div>
              </button>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              Observações
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do pedido, preferências..."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-100 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                status === 'confirmado'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
              }`}
            >
              {status === 'confirmado'
                ? 'Confirmar & Bloquear no Site'
                : 'Salvar como Pendente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
