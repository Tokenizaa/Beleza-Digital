export type MediaCategory =
  | 'Cílios'
  | 'Sobrancelhas'
  | 'Cabelos'
  | 'Unhas'
  | 'Barbearia'
  | 'Tranças'
  | 'Produtos'
  | 'Ambiente'
  | 'Outros';

export type EstablishmentStatus = 'active' | 'inactive' | 'suspended';

export type EstablishmentTheme =
  | 'amber'     // Padrão Yeshua (Dourado/Âmbar luxo)
  | 'emerald'   // Verde Esmeralda
  | 'sapphire'  // Azul Safira
  | 'ruby'      // Vermelho Nobre
  | 'slate';    // Prata / Minimalista

export interface Establishment {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  status: EstablishmentStatus;
  isDefault?: boolean;

  // Identidade Visual
  logoUrl?: string;
  coverUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  theme?: EstablishmentTheme;

  // Contato e Localização
  whatsapp: string;
  whatsappClean: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  cityState: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;

  // Instagram e Redes
  instagramHandle?: string;
  instagramUrl?: string;
  instagramBio?: string;
  instagramFollowers?: string;
  instagramPostsCount?: string;
  showInstagramGallery?: boolean;

  // Configurações e Acesso Local (sem PIN de autenticação — uso exclusivo do mecanismo oficial do Supabase)
  adminName?: string;
  adminEmail?: string;
  openingHoursNote?: string;
  allowOnlineBooking?: boolean;
  slotIntervalMinutes?: number;

  createdAt: string;
  updatedAt?: string;
}

// Compatibilidade retroativa com código existente
export type CompanyInfo = Establishment;

export interface InstagramEmbedItem {
  id: string;
  establishmentId?: string;
  url: string;
  shortcode: string;
  title: string;
  caption?: string;
  type: 'post' | 'reel';
  previewImageUrl?: string;
  likesCount?: string;
  commentsCount?: string;
  date?: string;
  featured?: boolean;
}

export interface ServiceItem {
  id: string;
  establishmentId?: string;
  name: string;
  description: string;
  price?: number | null;
  priceRange?: string;
  durationMinutes?: number | null;
  category: string;
  imageUrl?: string;
  featured: boolean;
}

export interface ProductItem {
  id: string;
  establishmentId?: string;
  name: string;
  description: string;
  price: number;
  mainImage: string;
  additionalImages?: string[];
  available: boolean;
  category: string;
  featured: boolean;
}

export interface MediaItem {
  id: string;
  establishmentId?: string;
  type: 'image' | 'video';
  title: string;
  url: string;
  thumbnailUrl?: string;
  isReelVertical?: boolean;
  category: MediaCategory;
  dateAdded: string;
  featured: boolean;
}

export interface Appointment {
  id: string;
  establishmentId?: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  servicePrice?: number | null;
  serviceDuration?: number | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
  status: 'pendente' | 'confirmado' | 'cancelado' | 'concluido';
  createdAt: string;
}

// Autenticação e Perfis
export type UserRole = 'super_admin' | 'establishment_admin' | 'client';

export interface AuthSession {
  role: UserRole;
  establishmentId?: string;
  establishmentName?: string;
  userName?: string;
  token: string;
  impersonatedBySuperAdmin?: boolean;
  createdAt: number;
}

// Log de Auditoria para Ações Privilegiadas
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actorRole: UserRole;
  actorName: string;
  targetEstablishmentId?: string;
  targetEstablishmentName?: string;
  details: string;
  severity?: 'info' | 'warning' | 'security';
}

// Configuração Geral da Plataforma White Label (sem Chave Mestre — autenticação via Supabase)
export interface PlatformConfig {
  platformName: string;
  supportEmail: string;
  supportWhatsapp: string;
}

export type PageView =
  | 'home'
  | 'servicos'
  | 'agendamento'
  | 'produtos'
  | 'produto-detalhe'
  | 'galeria'
  | 'contato'
  | 'admin'
  | 'super-admin';

export type AdminTab =
  | 'dashboard'
  | 'servicos'
  | 'produtos'
  | 'galeria'
  | 'videos'
  | 'agendamentos'
  | 'instagram'
  | 'configuracoes';

export type SuperAdminTab =
  | 'overview'
  | 'leads'
  | 'establishments'
  | 'new-establishment'
  | 'clients'
  | 'administrators'
  | 'audit-logs'
  | 'settings';
