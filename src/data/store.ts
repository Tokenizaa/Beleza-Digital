import { useEffect, useState } from 'react';
import {
  Establishment,
  CompanyInfo,
  ServiceItem,
  ProductItem,
  MediaItem,
  Appointment,
  InstagramEmbedItem,
  AuthSession,
  AuditLogEntry,
  PlatformConfig,
  UserRole,
} from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  INITIAL_ESTABLISHMENT_YESHUA,
  INITIAL_ESTABLISHMENT_DEMO,
  INITIAL_ESTABLISHMENTS,
  INITIAL_PLATFORM_CONFIG,
  INITIAL_SERVICES,
  INITIAL_PRODUCTS,
  INITIAL_MEDIA,
  INITIAL_APPOINTMENTS,
  INITIAL_INSTAGRAM_EMBEDS,
} from './defaultData';

const STORAGE_KEYS = {
  // Multitenant Core
  ESTABLISHMENTS: 'wl_establishments_v2',
  CURRENT_TENANT_ID: 'wl_current_tenant_id_v2',
  SERVICES: 'wl_services_v2',
  PRODUCTS: 'wl_products_v2',
  MEDIA: 'wl_media_v2',
  APPOINTMENTS: 'wl_appointments_v2',
  INSTAGRAM_EMBEDS: 'wl_instagram_embeds_v2',
  AUDIT_LOGS: 'wl_audit_logs_v2',
  PLATFORM_CONFIG: 'wl_platform_config_v2',
  AUTH_SESSION: 'wl_auth_session_v2',

  // Legacy single-tenant keys for automatic non-destructive migration
  LEGACY_COMPANY: 'yeshua_company_info_v4',
  LEGACY_SERVICES: 'yeshua_services_v1',
  LEGACY_PRODUCTS: 'yeshua_products_v1',
  LEGACY_MEDIA: 'yeshua_media_v4',
  LEGACY_APPOINTMENTS: 'yeshua_appointments_v1',
  LEGACY_INSTAGRAM_EMBEDS: 'yeshua_instagram_embeds_v4',
};

// Listeners for multi-component reactivity
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in store listener', e);
    }
  });
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch (err) {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Erro ao salvar no localStorage para ${key}`, err);
  }
}

// -------------------------------------------------------------
// IN-MEMORY MULTITENANT STATE WITH AUTOMATIC MIGRATION
// -------------------------------------------------------------

function normalizeLegacyTemplate(establishment: Establishment): Establishment {
  if (establishment.id === 'est-yeshua' && establishment.name === 'Barbearia & Estética Yeshua') {
    return {
      ...INITIAL_ESTABLISHMENT_YESHUA,
      id: establishment.id,
      isDefault: true,
      createdAt: establishment.createdAt,
      updatedAt: establishment.updatedAt,
    };
  }
  if (establishment.id === 'est-imperio' && establishment.name === 'Império Club & Barbearia') {
    return {
      ...INITIAL_ESTABLISHMENT_DEMO,
      id: establishment.id,
      isDefault: false,
      createdAt: establishment.createdAt,
      updatedAt: establishment.updatedAt,
    };
  }
  return establishment;
}

// 1. Establishments Repository
let allEstablishments: Establishment[] = (() => {
  const storedEstablishments = loadFromStorage<Establishment[]>(
    STORAGE_KEYS.ESTABLISHMENTS,
    []
  );
  const loaded = storedEstablishments.map(normalizeLegacyTemplate);
  if (loaded.some((establishment, index) => establishment !== storedEstablishments[index])) {
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, loaded);
  }

  if (loaded.length === 0) {
    // Check for legacy single-establishment data to migrate
    const legacyCompany = loadFromStorage<Partial<Establishment> | null>(
      STORAGE_KEYS.LEGACY_COMPANY,
      null
    );

    const yeshuaTenant: Establishment = normalizeLegacyTemplate({
      ...INITIAL_ESTABLISHMENT_YESHUA,
      ...(legacyCompany ? legacyCompany : {}),
      id: 'est-yeshua',
      slug: 'modelo-inicial',
      isDefault: true,
      logoUrl: legacyCompany?.logoUrl || INITIAL_ESTABLISHMENT_YESHUA.logoUrl,
    });

    const initialList: Establishment[] = [yeshuaTenant, INITIAL_ESTABLISHMENT_DEMO];
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, initialList);
    return initialList;
  }

  // Ensure the neutral default tenant is always present and active
  const hasYeshua = loaded.some((e) => e.id === 'est-yeshua' || e.slug === 'yeshua');
  if (!hasYeshua) {
    const updated = [INITIAL_ESTABLISHMENT_YESHUA, ...loaded];
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, updated);
    return updated;
  }

  return loaded;
})();

// 2. Active Tenant Selector
function detectInitialTenant(): string {
  // Check URL search params (e.g. ?tenant=imperio or ?estabelecimento=yeshua)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant') || params.get('estabelecimento') || params.get('e');
    if (tenantParam) {
      const match = allEstablishments.find(
        (e) => e.slug.toLowerCase() === tenantParam.toLowerCase() || e.id === tenantParam
      );
      if (match) return match.id;
    }
  }

  // Check saved choice in localStorage
  const savedId = loadFromStorage<string>(STORAGE_KEYS.CURRENT_TENANT_ID, 'est-yeshua');
  if (allEstablishments.some((e) => e.id === savedId)) {
    return savedId;
  }

  return 'est-yeshua';
}

let activeTenantId: string = detectInitialTenant();

// 3. Operational Data (Services, Products, Media, Appointments, Instagram Embeds)
let allServices: ServiceItem[] = (() => {
  const stored = loadFromStorage<ServiceItem[]>(STORAGE_KEYS.SERVICES, []);
  const loaded = stored.map((item) => item.name.includes('Império') ? { ...item, name: item.name.replace(/Império/g, 'Demonstração') } : item);
  if (loaded.some((item, index) => item !== stored[index])) saveToStorage(STORAGE_KEYS.SERVICES, loaded);
  if (loaded.length === 0) {
    // Check legacy services
    const legacy = loadFromStorage<ServiceItem[]>(STORAGE_KEYS.LEGACY_SERVICES, []);
    const initial = legacy.length > 0
      ? legacy.map((s) => ({ ...s, establishmentId: 'est-yeshua' }))
      : INITIAL_SERVICES;
    saveToStorage(STORAGE_KEYS.SERVICES, initial);
    return initial;
  }
  return loaded;
})();

let allProducts: ProductItem[] = (() => {
  const stored = loadFromStorage<ProductItem[]>(STORAGE_KEYS.PRODUCTS, []);
  const loaded = stored.map((item) => item.name.includes('Yeshua') || item.name.includes('Império') ? { ...item, name: item.name.replace(/Yeshua/g, 'Demonstração').replace(/Império/g, 'Demonstração') } : item);
  if (loaded.some((item, index) => item !== stored[index])) saveToStorage(STORAGE_KEYS.PRODUCTS, loaded);
  if (loaded.length === 0) {
    const legacy = loadFromStorage<ProductItem[]>(STORAGE_KEYS.LEGACY_PRODUCTS, []);
    const initial = legacy.length > 0
      ? legacy.map((p) => ({ ...p, establishmentId: 'est-yeshua' }))
      : INITIAL_PRODUCTS;
    saveToStorage(STORAGE_KEYS.PRODUCTS, initial);
    return initial;
  }
  return loaded;
})();

let allMedia: MediaItem[] = (() => {
  const stored = loadFromStorage<MediaItem[]>(STORAGE_KEYS.MEDIA, []);
  const loaded = stored.map((item) => ({
    ...item,
    title: item.title.replace(/Yeshua|Império/g, 'Demonstração'),
    url: item.url.includes('/images/yeshua_') ? 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80' : item.url,
    thumbnailUrl: item.thumbnailUrl?.includes('/images/yeshua_') ? 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=600&q=80' : item.thumbnailUrl,
  }));
  if (loaded.some((item, index) => JSON.stringify(item) !== JSON.stringify(stored[index]))) saveToStorage(STORAGE_KEYS.MEDIA, loaded);
  if (loaded.length === 0) {
    const legacy = loadFromStorage<MediaItem[]>(STORAGE_KEYS.LEGACY_MEDIA, []);
    const initial = legacy.length > 0
      ? legacy.map((m) => ({ ...m, establishmentId: 'est-yeshua' }))
      : INITIAL_MEDIA;
    saveToStorage(STORAGE_KEYS.MEDIA, initial);
    return initial;
  }
  return loaded;
})();

let allAppointments: Appointment[] = (() => {
  const loaded = loadFromStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  if (loaded.length === 0) {
    const legacy = loadFromStorage<Appointment[]>(STORAGE_KEYS.LEGACY_APPOINTMENTS, []);
    const initial = legacy.length > 0
      ? legacy.map((a) => ({ ...a, establishmentId: 'est-yeshua' }))
      : INITIAL_APPOINTMENTS;
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, initial);
    return initial;
  }
  return loaded;
})();

let allInstagramEmbeds: InstagramEmbedItem[] = (() => {
  const loaded = loadFromStorage<InstagramEmbedItem[]>(STORAGE_KEYS.INSTAGRAM_EMBEDS, []);
  const filtered = loaded.filter((item) => !/barbearia_estetica_yeshua|imperiobarberclub/i.test(item.url || ''));
  if (filtered.length !== loaded.length) saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, filtered);
  if (filtered.length === 0) {
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, INITIAL_INSTAGRAM_EMBEDS);
    return INITIAL_INSTAGRAM_EMBEDS;
  }
  return filtered;
})();

let auditLogs: AuditLogEntry[] = loadFromStorage<AuditLogEntry[]>(
  STORAGE_KEYS.AUDIT_LOGS,
  [
    {
      id: 'log-init',
      timestamp: new Date().toISOString(),
      action: 'PLATFORM_INITIALIZATION',
      actorRole: 'super_admin',
      actorName: 'Sistema White Label',
      details: 'Plataforma multiestabelecimento inicializada com dados neutros de demonstração.',
      severity: 'info',
    },
  ]
);

let platformConfig: PlatformConfig = loadFromStorage<PlatformConfig>(
  STORAGE_KEYS.PLATFORM_CONFIG,
  INITIAL_PLATFORM_CONFIG
);

// Migration non-destrutiva: a marca da plataforma é independente dos estabelecimentos.
if (platformConfig.platformName === 'Yeshua White Label Network') {
  platformConfig = { ...platformConfig, platformName: INITIAL_PLATFORM_CONFIG.platformName };
  saveToStorage(STORAGE_KEYS.PLATFORM_CONFIG, platformConfig);
}

// Session State
let currentSession: AuthSession | null = (() => {
  try {
    const sessionStr = sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (!sessionStr) return null;
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
})();

// -------------------------------------------------------------
// STORE ENGINE API
// -------------------------------------------------------------

export const store = {
  // --- Multitenant Establishment Management ---

  /** Verifica se a sessão atual tem permissão para gravar. */
  requireWriteAuth(): { ok: true } | { ok: false; message: string } {
    if (!currentSession) {
      return { ok: false, message: 'Sessão não autenticada.' };
    }
    if (currentSession.role !== 'super_admin' && currentSession.role !== 'establishment_admin') {
      return { ok: false, message: 'Permissão insuficiente para esta operação.' };
    }
    return { ok: true };
  },

  /** Verifica se a sessão atual pode acessar o establishment especificado (isolamento multi-tenant). */
  requireTenantAccess(targetEstablishmentId?: string): { ok: true } | { ok: false; message: string } {
    const tenantId = targetEstablishmentId || activeTenantId;
    if (!currentSession) {
      return { ok: false, message: 'Sessão não autenticada.' };
    }
    if (currentSession.role === 'super_admin') {
      return { ok: true };
    }
    if (currentSession.role === 'establishment_admin' && currentSession.establishmentId === tenantId) {
      return { ok: true };
    }
    return { ok: false, message: 'Acesso negado a dados de outro estabelecimento.' };
  },

  getAllEstablishments(): Establishment[] {
    return allEstablishments;
  },

  getActiveEstablishments(): Establishment[] {
    return allEstablishments.filter((e) => e.status === 'active');
  },

  getCurrentEstablishmentId(): string {
    return activeTenantId;
  },

  getCurrentEstablishment(): Establishment {
    const current = allEstablishments.find((e) => e.id === activeTenantId);
    if (current) return current;
    // Fallback to the neutral default establishment
    const yeshua = allEstablishments.find((e) => e.id === 'est-yeshua') || INITIAL_ESTABLISHMENT_YESHUA;
    return yeshua;
  },

  // Alias for backward compatibility
  getCompany(): CompanyInfo {
    return this.getCurrentEstablishment();
  },

  getEstablishmentById(id: string): Establishment | undefined {
    return allEstablishments.find((e) => e.id === id);
  },

  getEstablishmentBySlug(slug: string): Establishment | undefined {
    const cleanSlug = slug.toLowerCase().trim();
    return allEstablishments.find((e) => e.slug.toLowerCase() === cleanSlug);
  },

  selectEstablishment(idOrSlug: string): boolean {
    const target = allEstablishments.find(
      (e) => e.id === idOrSlug || e.slug.toLowerCase() === idOrSlug.toLowerCase()
    );
    if (!target) return false;

    activeTenantId = target.id;
    saveToStorage(STORAGE_KEYS.CURRENT_TENANT_ID, activeTenantId);

    // Update URL param without full reload
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tenant', target.slug);
      window.history.pushState({}, '', url.toString());
    }

    notify();
    return true;
  },

  addEstablishment(data: Omit<Establishment, 'id' | 'createdAt'>): Establishment {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);

    // Generate clean slug
    const baseSlug = (data.slug || data.name)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const finalSlug = allEstablishments.some((e) => e.slug === baseSlug)
      ? `${baseSlug}-${Date.now().toString().slice(-4)}`
      : baseSlug;

    const newEst: Establishment = {
      ...data,
      id: `est-${Date.now()}`,
      slug: finalSlug,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allEstablishments = [...allEstablishments, newEst];
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, allEstablishments);

    this.addAuditLog({
      action: 'ESTABLISHMENT_CREATED',
      actorRole: currentSession?.role || 'super_admin',
      actorName: currentSession?.userName || 'Administrador Geral',
      targetEstablishmentId: newEst.id,
      targetEstablishmentName: newEst.name,
      details: `Novo estabelecimento cadastrado: ${newEst.name} (slug: ${newEst.slug})`,
      severity: 'info',
    });

    notify();
    return newEst;
  },

  updateEstablishment(id: string, updates: Partial<Establishment>): boolean {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(id);
    if (!access.ok) throw new Error(access.message);

    const index = allEstablishments.findIndex((e) => e.id === id);
    if (index === -1) return false;

    const current = allEstablishments[index];
    const updated: Establishment = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    allEstablishments = allEstablishments.map((e) => (e.id === id ? updated : e));
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, allEstablishments);

    this.addAuditLog({
      action: 'ESTABLISHMENT_UPDATED',
      actorRole: currentSession?.role || 'establishment_admin',
      actorName: currentSession?.userName || 'Administrador',
      targetEstablishmentId: updated.id,
      targetEstablishmentName: updated.name,
      details: `Dados do estabelecimento ${updated.name} atualizados`,
      severity: 'info',
    });

    notify();
    return true;
  },

  // Backward compatibility method
  updateCompany(newInfo: Partial<CompanyInfo>) {
    this.updateEstablishment(activeTenantId, newInfo);
  },

  toggleEstablishmentStatus(id: string): boolean {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(id);
    if (!access.ok) throw new Error(access.message);

    const est = allEstablishments.find((e) => e.id === id);
    if (!est) return false;

    // Protect the default template establishment from accidental deactivation
    const newStatus = est.status === 'active' ? 'inactive' : 'active';
    const updated = this.updateEstablishment(id, { status: newStatus });

    this.addAuditLog({
      action: 'ESTABLISHMENT_STATUS_TOGGLED',
      actorRole: currentSession?.role || 'super_admin',
      actorName: currentSession?.userName || 'Super Admin',
      targetEstablishmentId: est.id,
      targetEstablishmentName: est.name,
      details: `Status do estabelecimento alterado para ${newStatus}`,
      severity: newStatus === 'inactive' ? 'warning' : 'info',
    });

    return updated;
  },

  deleteEstablishment(id: string): boolean {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(id);
    if (!access.ok) throw new Error(access.message);

    const est = allEstablishments.find((e) => e.id === id);
    if (!est || est.isDefault) {
      console.warn('Não é permitido excluir o estabelecimento padrão da plataforma.');
      return false;
    }

    allEstablishments = allEstablishments.filter((e) => e.id !== id);
    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, allEstablishments);

    // Also purge child operational data to maintain database consistency
    allServices = allServices.filter((s) => s.establishmentId !== id);
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);

    allProducts = allProducts.filter((p) => p.establishmentId !== id);
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);

    allMedia = allMedia.filter((m) => m.establishmentId !== id);
    saveToStorage(STORAGE_KEYS.MEDIA, allMedia);

    allAppointments = allAppointments.filter((a) => a.establishmentId !== id);
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, allAppointments);

    allInstagramEmbeds = allInstagramEmbeds.filter((ig) => ig.establishmentId !== id);
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, allInstagramEmbeds);

    if (activeTenantId === id) {
      this.selectEstablishment('est-yeshua');
    }

    this.addAuditLog({
      action: 'ESTABLISHMENT_DELETED',
      actorRole: currentSession?.role || 'super_admin',
      actorName: currentSession?.userName || 'Super Admin',
      targetEstablishmentId: est.id,
      targetEstablishmentName: est.name,
      details: `Estabelecimento ${est.name} e todos os seus dados operacionais foram excluídos`,
      severity: 'security',
    });

    notify();
    return true;
  },

  // --- Strict Scoped Operational Data Getters ---

  getServices(targetEstablishmentId?: string): ServiceItem[] {
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) {
      console.warn(access.message);
      return [];
    }
    const tenantId = targetEstablishmentId || activeTenantId;
    return allServices.filter(
      (s) => (s.establishmentId || 'est-yeshua') === tenantId
    );
  },

  getProducts(targetEstablishmentId?: string): ProductItem[] {
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) {
      console.warn(access.message);
      return [];
    }
    const tenantId = targetEstablishmentId || activeTenantId;
    return allProducts.filter(
      (p) => (p.establishmentId || 'est-yeshua') === tenantId
    );
  },

  getMedia(targetEstablishmentId?: string): MediaItem[] {
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) {
      console.warn(access.message);
      return [];
    }
    const tenantId = targetEstablishmentId || activeTenantId;
    return allMedia.filter(
      (m) => (m.establishmentId || 'est-yeshua') === tenantId
    );
  },

  getAppointments(targetEstablishmentId?: string): Appointment[] {
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) {
      console.warn(access.message);
      return [];
    }
    const tenantId = targetEstablishmentId || activeTenantId;
    return allAppointments.filter(
      (a) => (a.establishmentId || 'est-yeshua') === tenantId
    );
  },

  getInstagramEmbeds(targetEstablishmentId?: string): InstagramEmbedItem[] {
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) {
      console.warn(access.message);
      return [];
    }
    const tenantId = targetEstablishmentId || activeTenantId;
    return allInstagramEmbeds.filter(
      (ig) => (ig.establishmentId || 'est-yeshua') === tenantId
    );
  },

  // --- Scoped Operational Data Mutators ---

  addService(service: Omit<ServiceItem, 'id'>, targetEstablishmentId?: string): ServiceItem {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) throw new Error(access.message);
    const tenantId = targetEstablishmentId || activeTenantId;
    const newService: ServiceItem = {
      ...service,
      id: `srv-${Date.now()}`,
      establishmentId: tenantId,
    };
    allServices = [newService, ...allServices];
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);
    notify();
    return newService;
  },

  updateService(id: string, updates: Partial<ServiceItem>) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allServices.find((s) => s.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allServices = allServices.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);
    notify();
  },

  deleteService(id: string) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allServices.find((s) => s.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allServices = allServices.filter((s) => s.id !== id);
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);
    notify();
  },

  toggleFeaturedService(id: string) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allServices.find((s) => s.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allServices = allServices.map((s) =>
      s.id === id ? { ...s, featured: !s.featured } : s
    );
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);
    notify();
  },

  addProduct(product: Omit<ProductItem, 'id'>, targetEstablishmentId?: string): ProductItem {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) throw new Error(access.message);
    const tenantId = targetEstablishmentId || activeTenantId;
    const newProduct: ProductItem = {
      ...product,
      id: `prod-${Date.now()}`,
      establishmentId: tenantId,
    };
    allProducts = [newProduct, ...allProducts];
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    notify();
    return newProduct;
  },

  updateProduct(id: string, updates: Partial<ProductItem>) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allProducts.find((p) => p.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allProducts = allProducts.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    notify();
  },

  deleteProduct(id: string) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allProducts.find((p) => p.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allProducts = allProducts.filter((p) => p.id !== id);
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    notify();
  },

  toggleFeaturedProduct(id: string) {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const item = allProducts.find((p) => p.id === id);
    if (!item) return;
    const tenantId = item.establishmentId || 'est-yeshua';
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    allProducts = allProducts.map((p) =>
      p.id === id ? { ...p, featured: !p.featured } : p
    );
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    notify();
  },

  addMedia(media: Omit<MediaItem, 'id' | 'dateAdded'>, targetEstablishmentId?: string): MediaItem {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) throw new Error(access.message);
    const tenantId = targetEstablishmentId || activeTenantId;
    const newMedia: MediaItem = {
      ...media,
      id: `med-${Date.now()}`,
      establishmentId: tenantId,
      dateAdded: new Date().toISOString().split('T')[0],
    };
    allMedia = [newMedia, ...allMedia];
    saveToStorage(STORAGE_KEYS.MEDIA, allMedia);
    notify();
    return newMedia;
  },

  updateMedia(id: string, updates: Partial<MediaItem>) {
    allMedia = allMedia.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    saveToStorage(STORAGE_KEYS.MEDIA, allMedia);
    notify();
  },

  deleteMedia(id: string) {
    allMedia = allMedia.filter((item) => item.id !== id);
    saveToStorage(STORAGE_KEYS.MEDIA, allMedia);
    notify();
  },

  addAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt'>,
    targetEstablishmentId?: string
  ): Appointment {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const tenantId = targetEstablishmentId || appointment.establishmentId || activeTenantId;
    const access = this.requireTenantAccess(tenantId);
    if (!access.ok) throw new Error(access.message);
    const newAppt: Appointment = {
      ...appointment,
      id: `apt-${Date.now()}`,
      establishmentId: tenantId,
      createdAt: new Date().toISOString(),
    };
    allAppointments = [newAppt, ...allAppointments];
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, allAppointments);
    notify();
    return newAppt;
  },

  updateAppointmentStatus(
    id: string,
    status: 'pendente' | 'confirmado' | 'cancelado' | 'concluido'
  ) {
    allAppointments = allAppointments.map((item) =>
      item.id === id ? { ...item, status } : item
    );
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, allAppointments);
    notify();
  },

  deleteAppointment(id: string) {
    allAppointments = allAppointments.filter((item) => item.id !== id);
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, allAppointments);
    notify();
  },

  // Conflict prevention helpers scoped to tenant
  isTimeSlotBooked(date: string, time: string, targetEstablishmentId?: string): boolean {
    const tenantId = targetEstablishmentId || activeTenantId;
    return allAppointments.some(
      (item) =>
        (item.establishmentId || 'est-yeshua') === tenantId &&
        item.date === date &&
        item.time === time &&
        item.status === 'confirmado'
    );
  },

  getConfirmedTimesForDate(date: string, targetEstablishmentId?: string): string[] {
    const tenantId = targetEstablishmentId || activeTenantId;
    return allAppointments
      .filter(
        (item) =>
          (item.establishmentId || 'est-yeshua') === tenantId &&
          item.date === date &&
          item.status === 'confirmado'
      )
      .map((item) => item.time);
  },

  // --- Instagram Embeds Scoped ---

  addInstagramEmbed(
    item: Omit<InstagramEmbedItem, 'id'>,
    targetEstablishmentId?: string
  ): InstagramEmbedItem {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    const access = this.requireTenantAccess(targetEstablishmentId);
    if (!access.ok) throw new Error(access.message);
    const tenantId = targetEstablishmentId || activeTenantId;
    const parsed = this.parseInstagramUrl(item.url);
    const newEmbed: InstagramEmbedItem = {
      ...item,
      id: `ig-${Date.now()}`,
      establishmentId: tenantId,
      shortcode: parsed.shortcode,
      type: item.type || parsed.type,
      likesCount: item.likesCount || '500+',
      commentsCount: item.commentsCount || '30+',
      date: item.date || new Date().toISOString().split('T')[0],
      featured: item.featured ?? true,
    };
    allInstagramEmbeds = [newEmbed, ...allInstagramEmbeds];
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, allInstagramEmbeds);
    notify();
    return newEmbed;
  },

  updateInstagramEmbed(id: string, updates: Partial<InstagramEmbedItem>) {
    allInstagramEmbeds = allInstagramEmbeds.map((item) => {
      if (item.id !== id) return item;
      const updatedUrl = updates.url || item.url;
      const parsed = updates.url ? this.parseInstagramUrl(updatedUrl) : null;
      return {
        ...item,
        ...updates,
        ...(parsed ? { shortcode: parsed.shortcode, type: updates.type || parsed.type } : {}),
      };
    });
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, allInstagramEmbeds);
    notify();
  },

  deleteInstagramEmbed(id: string) {
    allInstagramEmbeds = allInstagramEmbeds.filter((item) => item.id !== id);
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, allInstagramEmbeds);
    notify();
  },

  parseInstagramUrl(inputUrl: string): {
    shortcode: string;
    type: 'post' | 'reel';
    embedUrl: string;
    compactEmbedUrl: string;
    cleanUrl: string;
    isProfile: boolean;
    isPostOrReel: boolean;
  } {
    let clean = (inputUrl || '').trim();

    const permalinkMatch = clean.match(/data-instgrm-permalink=["']([^"']+)["']/i);
    if (permalinkMatch && permalinkMatch[1]) {
      clean = permalinkMatch[1];
    } else {
      const iframeSrcMatch = clean.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeSrcMatch && iframeSrcMatch[1]) {
        clean = iframeSrcMatch[1];
      }
    }

    const urlWithoutQuery = clean.split('?')[0].split('#')[0];

    const reelMatch = urlWithoutQuery.match(/(?:reel|reels)\/([A-Za-z0-9_-]+)/i);
    if (reelMatch && reelMatch[1]) {
      const code = reelMatch[1];
      return {
        shortcode: code,
        type: 'reel',
        embedUrl: `https://www.instagram.com/reel/${code}/embed/captioned/`,
        compactEmbedUrl: `https://www.instagram.com/reel/${code}/embed/`,
        cleanUrl: `https://www.instagram.com/reel/${code}/`,
        isProfile: false,
        isPostOrReel: true,
      };
    }

    const postMatch = urlWithoutQuery.match(/\/p\/([A-Za-z0-9_-]+)/i);
    if (postMatch && postMatch[1]) {
      const code = postMatch[1];
      return {
        shortcode: code,
        type: 'post',
        embedUrl: `https://www.instagram.com/p/${code}/embed/captioned/`,
        compactEmbedUrl: `https://www.instagram.com/p/${code}/embed/`,
        cleanUrl: `https://www.instagram.com/p/${code}/`,
        isProfile: false,
        isPostOrReel: true,
      };
    }

    const tvMatch = urlWithoutQuery.match(/\/tv\/([A-Za-z0-9_-]+)/i);
    if (tvMatch && tvMatch[1]) {
      const code = tvMatch[1];
      return {
        shortcode: code,
        type: 'reel',
        embedUrl: `https://www.instagram.com/reel/${code}/embed/captioned/`,
        compactEmbedUrl: `https://www.instagram.com/reel/${code}/embed/`,
        cleanUrl: `https://www.instagram.com/reel/${code}/`,
        isProfile: false,
        isPostOrReel: true,
      };
    }

    const profileMatch = clean.match(/(?:instagram\.com\/|@)([A-Za-z0-9_.-]+)/i);
    if (profileMatch && profileMatch[1]) {
      const username = profileMatch[1];
      const profileUrl = `https://www.instagram.com/${username}/`;
      return {
        shortcode: username,
        type: 'post',
        embedUrl: profileUrl,
        compactEmbedUrl: profileUrl,
        cleanUrl: profileUrl,
        isProfile: true,
        isPostOrReel: false,
      };
    }

    const codeMatch = clean.replace(/[^A-Za-z0-9_-]/g, '');
    if (codeMatch && codeMatch.length >= 6 && codeMatch.length <= 25) {
      const isReel = clean.toLowerCase().includes('reel');
      const type: 'post' | 'reel' = isReel ? 'reel' : 'post';
      const path = isReel ? 'reel' : 'p';
      return {
        shortcode: codeMatch,
        type,
        embedUrl: `https://www.instagram.com/${path}/${codeMatch}/embed/captioned/`,
        compactEmbedUrl: `https://www.instagram.com/${path}/${codeMatch}/embed/`,
        cleanUrl: `https://www.instagram.com/${path}/${codeMatch}/`,
        isProfile: false,
        isPostOrReel: true,
      };
    }

    const defaultProfile = '';
    return {
      shortcode: '',
      type: 'post',
      embedUrl: defaultProfile,
      compactEmbedUrl: defaultProfile,
      cleanUrl: defaultProfile,
      isProfile: true,
      isPostOrReel: false,
    };
  },

  // --- Dynamic WhatsApp URL Builders Scoped to Active Establishment ---

  buildWhatsAppUrl(customMessage: string, targetEstablishmentId?: string): string {
    const est = targetEstablishmentId
      ? this.getEstablishmentById(targetEstablishmentId) || this.getCurrentEstablishment()
      : this.getCurrentEstablishment();
    const cleanPhone = est.whatsappClean || '';
    const encoded = encodeURIComponent(customMessage);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  },

  buildScheduledAppointmentWhatsAppUrl(
    appointment: {
      clientName: string;
      clientPhone: string;
      serviceName: string;
      date: string;
      time: string;
      notes?: string;
    },
    targetEstablishmentId?: string
  ): string {
    const est = targetEstablishmentId
      ? this.getEstablishmentById(targetEstablishmentId) || this.getCurrentEstablishment()
      : this.getCurrentEstablishment();

    const [year, month, day] = appointment.date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    const text = [
      `💈 *SOLICITAÇÃO DE AGENDAMENTO — ${est.name.toUpperCase()}* 💈`,
      '',
      `👤 *Cliente:* ${appointment.clientName}`,
      `📱 *Telefone/WhatsApp:* ${appointment.clientPhone}`,
      `✂️ *Serviço Escolhido:* ${appointment.serviceName}`,
      `📅 *Data Desejada:* ${formattedDate}`,
      `⏰ *Horário Preferencial:* ${appointment.time}`,
      appointment.notes ? `💬 *Observações:* ${appointment.notes}` : '',
      '',
      `Olá equipe da ${est.name}! Vim pelo site e gostaria de confirmar este horário para meu atendimento. Aguardo confirmação!`,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    return this.buildWhatsAppUrl(text, targetEstablishmentId);
  },

  buildServiceAppointmentUrl(serviceName?: string, targetEstablishmentId?: string): string {
    const est = targetEstablishmentId
      ? this.getEstablishmentById(targetEstablishmentId) || this.getCurrentEstablishment()
      : this.getCurrentEstablishment();

    if (serviceName) {
      return this.buildWhatsAppUrl(
        `Olá! Vim pelo site da ${est.name} e gostaria de agendar o serviço de ${serviceName}.`,
        targetEstablishmentId
      );
    }
    return this.buildWhatsAppUrl(
      `Olá! Vim pelo site da ${est.name} e gostaria de agendar um horário.`,
      targetEstablishmentId
    );
  },

  buildProductInquiryUrl(productName: string, targetEstablishmentId?: string): string {
    const est = targetEstablishmentId
      ? this.getEstablishmentById(targetEstablishmentId) || this.getCurrentEstablishment()
      : this.getCurrentEstablishment();

    return this.buildWhatsAppUrl(
      `Olá! Vim pelo site da ${est.name} e gostaria de saber mais sobre o produto ${productName}.`,
      targetEstablishmentId
    );
  },

  // --- Authentication & Role Management ---

  getCurrentSession(): AuthSession | null {
    return currentSession;
  },

  loginLocalAdmin(_pin: string, requestedEstablishmentId?: string): { success: boolean; session?: AuthSession; message?: string } {
    const targetId = requestedEstablishmentId || activeTenantId;
    const est = allEstablishments.find((e) => e.id === targetId);

    if (!est) {
      return { success: false, message: 'Estabelecimento não encontrado.' };
    }

    if (est.status !== 'active') {
      return { success: false, message: 'Este estabelecimento está temporariamente inativo ou suspenso.' };
    }

    const session: AuthSession = {
      role: 'establishment_admin',
      establishmentId: est.id,
      establishmentName: est.name,
      userName: est.adminName || `Admin ${est.name}`,
      token: `token-est-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
    };

    currentSession = session;
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } catch {}

    this.addAuditLog({
      action: 'ESTABLISHMENT_ADMIN_SESSION',
      actorRole: 'establishment_admin',
      actorName: session.userName || 'Admin Local',
      targetEstablishmentId: est.id,
      targetEstablishmentName: est.name,
      details: 'Sessão de administrador de estabelecimento estabelecida',
      severity: 'info',
    });

    notify();
    return { success: true, session };
  },

  loginSuperAdmin(): { success: boolean; session?: AuthSession; message?: string } {
    const session: AuthSession = {
      role: 'super_admin',
      userName: 'Super Administrador Geral',
      token: `token-master-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
    };

    currentSession = session;
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    } catch {}

    this.addAuditLog({
      action: 'SUPER_ADMIN_SESSION',
      actorRole: 'super_admin',
      actorName: 'Super Admin',
      details: 'Sessão de administrador geral da plataforma estabelecida',
      severity: 'info',
    });

    notify();
    return { success: true, session };
  },

  login(
    role: UserRole,
    establishmentId?: string
  ): { success: boolean; session?: AuthSession; message?: string } {
    // Quando o Supabase estiver configurado, a autenticação deve fluir por ele.
    // Aqui apenas registramos a sessão na store e deixamos o componente chamador
    // conduzir o signIn do Supabase quando aplicável.
    if (role === 'super_admin') {
      return this.loginSuperAdmin();
    }
    if (role === 'establishment_admin') {
      return this.loginLocalAdmin('', establishmentId);
    }
    return { success: false, message: 'Papel de usuário não suportado para login administrativo.' };
  },

  logout(): void {
    if (currentSession) {
      this.addAuditLog({
        action: 'LOGOUT',
        actorRole: currentSession.role,
        actorName: currentSession.userName || 'Usuário',
        targetEstablishmentId: currentSession.establishmentId,
        details: 'Sessão administrativa finalizada',
        severity: 'info',
      });
    }

    currentSession = null;
    try {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    } catch {}
    // Encerra a sessão do Supabase quando configurada, evitando sessões órfãs.
    if (supabase) {
      void supabase.auth.signOut().catch((err) => {
        console.warn('Erro ao encerrar sessão Supabase no logout:', err);
      });
    }
    notify();
  },

  // Super Admin Impersonation: View/Operate local admin with explicit auditing
  superAdminEnterEstablishment(establishmentId: string): boolean {
    if (!currentSession || currentSession.role !== 'super_admin') {
      console.warn('Apenas o Super Administrador pode acessar a visão do estabelecimento.');
      return false;
    }

    const target = allEstablishments.find((e) => e.id === establishmentId);
    if (!target) return false;

    activeTenantId = target.id;
    saveToStorage(STORAGE_KEYS.CURRENT_TENANT_ID, activeTenantId);

    const impersonatedSession: AuthSession = {
      ...currentSession,
      establishmentId: target.id,
      establishmentName: target.name,
      impersonatedBySuperAdmin: true,
    };

    currentSession = impersonatedSession;
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(impersonatedSession));
    } catch {}

    this.addAuditLog({
      action: 'SUPER_ADMIN_IMPERSONATION_START',
      actorRole: 'super_admin',
      actorName: 'Super Admin',
      targetEstablishmentId: target.id,
      targetEstablishmentName: target.name,
      details: `Super Admin acessou o ambiente administrativo de: ${target.name}`,
      severity: 'warning',
    });

    notify();
    return true;
  },

  superAdminExitEstablishment(): void {
    if (!currentSession || currentSession.role !== 'super_admin') return;

    const previousEstName = currentSession.establishmentName;
    const restoredSession: AuthSession = {
      role: 'super_admin',
      userName: currentSession.userName,
      token: currentSession.token,
      createdAt: currentSession.createdAt,
    };

    currentSession = restoredSession;
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(restoredSession));
    } catch {}

    this.addAuditLog({
      action: 'SUPER_ADMIN_IMPERSONATION_END',
      actorRole: 'super_admin',
      actorName: 'Super Admin',
      details: `Super Admin encerrou a inspeção do estabelecimento ${previousEstName || ''}`,
      severity: 'info',
    });

    notify();
  },

  // --- Audit Logging API ---

  getAuditLogs(): AuditLogEntry[] {
    return auditLogs;
  },

  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    auditLogs = [newLog, ...auditLogs.slice(0, 99)]; // Keep latest 100 logs
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
  },

  clearAuditLogs(): void {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    if (currentSession?.role !== 'super_admin') throw new Error('Apenas super_admin pode limpar logs de auditoria.');
    auditLogs = [];
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
    notify();
  },

  // --- Platform Metrics API ---

  getPlatformMetrics() {
    return {
      totalEstablishments: allEstablishments.length,
      activeEstablishments: allEstablishments.filter((e) => e.status === 'active').length,
      inactiveEstablishments: allEstablishments.filter((e) => e.status !== 'active').length,
      totalServices: allServices.length,
      totalProducts: allProducts.length,
      totalMedia: allMedia.length,
      totalAppointments: allAppointments.length,
      confirmedAppointments: allAppointments.filter((a) => a.status === 'confirmado').length,
      pendingAppointments: allAppointments.filter((a) => a.status === 'pendente').length,
    };
  },

  getPlatformConfig(): PlatformConfig {
    return platformConfig;
  },

  updatePlatformConfig(updates: Partial<PlatformConfig>): void {
    const auth = this.requireWriteAuth();
    if (!auth.ok) throw new Error(auth.message);
    if (currentSession?.role !== 'super_admin') throw new Error('Apenas super_admin pode alterar configurações da plataforma.');
    platformConfig = { ...platformConfig, ...updates };
    saveToStorage(STORAGE_KEYS.PLATFORM_CONFIG, platformConfig);

    this.addAuditLog({
      action: 'PLATFORM_CONFIG_UPDATED',
      actorRole: 'super_admin',
      actorName: currentSession?.userName || 'Super Admin',
      details: 'Configurações globais da plataforma foram alteradas',
      severity: 'security',
    });

    notify();
  },

  // Reset demo / all data while protecting Yeshua tenant
  resetAllData() {
    allEstablishments = INITIAL_ESTABLISHMENTS;
    activeTenantId = 'est-yeshua';
    allServices = INITIAL_SERVICES;
    allProducts = INITIAL_PRODUCTS;
    allMedia = INITIAL_MEDIA;
    allAppointments = INITIAL_APPOINTMENTS;
    allInstagramEmbeds = INITIAL_INSTAGRAM_EMBEDS;
    platformConfig = INITIAL_PLATFORM_CONFIG;

    saveToStorage(STORAGE_KEYS.ESTABLISHMENTS, allEstablishments);
    saveToStorage(STORAGE_KEYS.CURRENT_TENANT_ID, activeTenantId);
    saveToStorage(STORAGE_KEYS.SERVICES, allServices);
    saveToStorage(STORAGE_KEYS.PRODUCTS, allProducts);
    saveToStorage(STORAGE_KEYS.MEDIA, allMedia);
    saveToStorage(STORAGE_KEYS.APPOINTMENTS, allAppointments);
    saveToStorage(STORAGE_KEYS.INSTAGRAM_EMBEDS, allInstagramEmbeds);
    saveToStorage(STORAGE_KEYS.PLATFORM_CONFIG, platformConfig);
    notify();
  },
};

// React Hook with full multitenant reactivity
export function useStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const currentEstablishment = store.getCurrentEstablishment();

  return {
    // Current Scoped Tenant Entities
    establishment: currentEstablishment,
    company: currentEstablishment, // backward compatibility
    services: store.getServices(),
    products: store.getProducts(),
    media: store.getMedia(),
    appointments: store.getAppointments(),
    instagramEmbeds: store.getInstagramEmbeds(),

    // Global Multitenant Entities
    allEstablishments: store.getAllEstablishments(),
    activeEstablishments: store.getActiveEstablishments(),
    session: store.getCurrentSession(),
    auditLogs: store.getAuditLogs(),
    platformMetrics: store.getPlatformMetrics(),
    platformConfig: store.getPlatformConfig(),

    // Contrato de autenticação unificado
    isAuthenticated: Boolean(currentSession),
    userRole: currentSession?.role ?? null,
    isSupabaseConfigured,
    login: store.login.bind(store),
    logout: store.logout.bind(store),

    store,
  };
}
