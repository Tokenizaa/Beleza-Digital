import { supabase } from '../lib/supabase';
import type { Establishment, MediaItem, ProductItem, ServiceItem } from '../types';

type Row = Record<string, unknown>;

function client() {
  if (!supabase) throw new Error('Supabase não está configurado neste ambiente.');
  return supabase;
}

function fail(error: { message?: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function mapService(row: Row): ServiceItem {
  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    price: typeof row.price === 'number' ? row.price : row.price == null ? null : Number(row.price),
    priceRange: typeof row.price_range === 'string' ? row.price_range : undefined,
    durationMinutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
    category: String(row.category || 'Geral'),
    imageUrl: typeof row.image_url === 'string' ? row.image_url : undefined,
    featured: Boolean(row.featured),
  };
}

function mapProduct(row: Row): ProductItem {
  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    price: Number(row.price || 0),
    mainImage: String(row.main_image || ''),
    additionalImages: Array.isArray(row.additional_images) ? row.additional_images.filter((item): item is string => typeof item === 'string') : [],
    available: Boolean(row.available),
    category: String(row.category || 'Geral'),
    featured: Boolean(row.featured),
  };
}

function mapMedia(row: Row): MediaItem {
  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id),
    type: row.type === 'video' ? 'video' : 'image',
    title: String(row.title || ''),
    url: String(row.url || ''),
    thumbnailUrl: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : undefined,
    isReelVertical: Boolean(row.is_reel_vertical),
    category: String(row.category || 'Outros') as MediaItem['category'],
    dateAdded: String(row.date_added || row.created_at || new Date().toISOString()),
    featured: Boolean(row.featured),
  };
}

export const establishmentRepository = {
  async getProfile(establishmentId: string): Promise<Establishment> {
    const { data, error } = await client().from('establishments')
      .select('id,slug,name,status,logo_url,primary_color,secondary_color,contact,brand_settings,created_at,updated_at')
      .eq('id', establishmentId).single();
    fail(error, 'Não foi possível carregar o perfil do estabelecimento.');
    const row = data as unknown as Row;
    const contact = asRecord(row.contact);
    const brand = asRecord(row.brand_settings);
    return {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      status: row.status === 'active' ? 'active' : 'inactive',
      logoUrl: typeof row.logo_url === 'string' ? row.logo_url : undefined,
      primaryColor: typeof row.primary_color === 'string' ? row.primary_color : undefined,
      secondaryColor: typeof row.secondary_color === 'string' ? row.secondary_color : undefined,
      tagline: typeof brand.tagline === 'string' ? brand.tagline : undefined,
      description: typeof brand.description === 'string' ? brand.description : undefined,
      whatsapp: String(contact.whatsapp || contact.phone || ''),
      whatsappClean: String(contact.whatsapp_clean || contact.whatsappClean || ''),
      phone: typeof contact.phone === 'string' ? contact.phone : undefined,
      email: typeof contact.email === 'string' ? contact.email : undefined,
      address: typeof contact.address === 'string' ? contact.address : undefined,
      city: typeof contact.city === 'string' ? contact.city : undefined,
      state: typeof contact.state === 'string' ? contact.state : undefined,
      cityState: String(contact.city_state || contact.cityState || ''),
      googleMapsUrl: typeof contact.google_maps_url === 'string' ? contact.google_maps_url : undefined,
      latitude: typeof contact.latitude === 'number' ? contact.latitude : undefined,
      longitude: typeof contact.longitude === 'number' ? contact.longitude : undefined,
      instagramHandle: typeof contact.instagram_handle === 'string' ? contact.instagram_handle : undefined,
      instagramUrl: typeof contact.instagram_url === 'string' ? contact.instagram_url : undefined,
      instagramBio: typeof contact.instagram_bio === 'string' ? contact.instagram_bio : undefined,
      showInstagramGallery: typeof brand.show_instagram_gallery === 'boolean' ? brand.show_instagram_gallery : undefined,
      openingHoursNote: typeof contact.opening_hours_note === 'string' ? contact.opening_hours_note : undefined,
      allowOnlineBooking: typeof brand.allow_online_booking === 'boolean' ? brand.allow_online_booking : undefined,
      slotIntervalMinutes: typeof brand.slot_interval_minutes === 'number' ? brand.slot_interval_minutes : undefined,
      adminName: typeof contact.owner_name === 'string' ? contact.owner_name : undefined,
      adminEmail: typeof contact.owner_email === 'string' ? contact.owner_email : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at || row.created_at),
    };
  },

  async updateProfile(establishmentId: string, updates: Partial<Establishment>): Promise<Establishment> {
    const current = await this.getProfile(establishmentId);
    const next = { ...current, ...updates };
    const { data: existing, error: readError } = await client().from('establishments')
      .select('contact,brand_settings').eq('id', establishmentId).single();
    fail(readError, 'Não foi possível carregar os dados atuais do perfil.');
    const contact = asRecord(existing?.contact);
    const brand = asRecord(existing?.brand_settings);
    const contactPatch: Row = {
      ...contact,
      ...(updates.whatsapp !== undefined ? { whatsapp: next.whatsapp } : {}),
      ...(updates.whatsappClean !== undefined ? { whatsapp_clean: next.whatsappClean } : {}),
      ...(updates.phone !== undefined ? { phone: next.phone } : {}),
      ...(updates.email !== undefined ? { email: next.email } : {}),
      ...(updates.address !== undefined ? { address: next.address } : {}),
      ...(updates.city !== undefined ? { city: next.city } : {}),
      ...(updates.state !== undefined ? { state: next.state } : {}),
      ...(updates.cityState !== undefined ? { city_state: next.cityState } : {}),
      ...(updates.googleMapsUrl !== undefined ? { google_maps_url: next.googleMapsUrl } : {}),
      ...(updates.instagramHandle !== undefined ? { instagram_handle: next.instagramHandle } : {}),
      ...(updates.instagramUrl !== undefined ? { instagram_url: next.instagramUrl } : {}),
      ...(updates.instagramBio !== undefined ? { instagram_bio: next.instagramBio } : {}),
      ...(updates.openingHoursNote !== undefined ? { opening_hours_note: next.openingHoursNote } : {}),
    };
    const brandPatch: Row = {
      ...brand,
      ...(updates.tagline !== undefined ? { tagline: next.tagline } : {}),
      ...(updates.description !== undefined ? { description: next.description } : {}),
      ...(updates.showInstagramGallery !== undefined ? { show_instagram_gallery: next.showInstagramGallery } : {}),
      ...(updates.allowOnlineBooking !== undefined ? { allow_online_booking: next.allowOnlineBooking } : {}),
      ...(updates.slotIntervalMinutes !== undefined ? { slot_interval_minutes: next.slotIntervalMinutes } : {}),
    };
    const payload: Row = { contact: contactPatch, brand_settings: brandPatch, updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
    if (updates.primaryColor !== undefined) payload.primary_color = updates.primaryColor;
    if (updates.secondaryColor !== undefined) payload.secondary_color = updates.secondaryColor;
    const { error } = await client().from('establishments').update(payload).eq('id', establishmentId);
    fail(error, 'Não foi possível salvar o perfil do estabelecimento.');
    return this.getProfile(establishmentId);
  },

  async listServices(establishmentId: string): Promise<ServiceItem[]> {
    const { data, error } = await client().from('establishment_services').select('*')
      .eq('establishment_id', establishmentId).order('sort_order').order('created_at');
    fail(error, 'Não foi possível carregar os serviços.');
    return (data || []).map((row) => mapService(row as unknown as Row));
  },

  async saveService(establishmentId: string, item: ServiceItem): Promise<ServiceItem> {
    const payload: Row = {
      establishment_id: establishmentId, name: item.name, description: item.description,
      price: item.price ?? null, price_range: item.priceRange ?? null,
      duration_minutes: item.durationMinutes ?? null, category: item.category,
      image_url: item.imageUrl ?? null, featured: item.featured, updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_services').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar o serviço.');
    return mapService(data as unknown as Row);
  },

  async deleteService(establishmentId: string, id: string): Promise<void> {
    const { error } = await client().from('establishment_services').delete()
      .eq('establishment_id', establishmentId).eq('id', id);
    fail(error, 'Não foi possível excluir o serviço.');
  },

  async listProducts(establishmentId: string): Promise<ProductItem[]> {
    const { data, error } = await client().from('establishment_products').select('*')
      .eq('establishment_id', establishmentId).order('sort_order').order('created_at');
    fail(error, 'Não foi possível carregar os produtos.');
    return (data || []).map((row) => mapProduct(row as unknown as Row));
  },

  async saveProduct(establishmentId: string, item: ProductItem): Promise<ProductItem> {
    const payload: Row = {
      establishment_id: establishmentId, name: item.name, description: item.description,
      price: item.price, main_image: item.mainImage, additional_images: item.additionalImages || [],
      available: item.available, category: item.category, featured: item.featured,
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_products').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar o produto.');
    return mapProduct(data as unknown as Row);
  },

  async deleteProduct(establishmentId: string, id: string): Promise<void> {
    const { error } = await client().from('establishment_products').delete()
      .eq('establishment_id', establishmentId).eq('id', id);
    fail(error, 'Não foi possível excluir o produto.');
  },

  async listMedia(establishmentId: string): Promise<MediaItem[]> {
    const { data, error } = await client().from('establishment_media').select('*')
      .eq('establishment_id', establishmentId).order('sort_order').order('date_added', { ascending: false });
    fail(error, 'Não foi possível carregar a galeria.');
    return (data || []).map((row) => mapMedia(row as unknown as Row));
  },

  async saveMedia(establishmentId: string, item: MediaItem): Promise<MediaItem> {
    const payload: Row = {
      establishment_id: establishmentId, type: item.type, title: item.title, url: item.url,
      thumbnail_url: item.thumbnailUrl ?? null, is_reel_vertical: item.isReelVertical ?? false,
      category: item.category, date_added: item.dateAdded, featured: item.featured,
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_media').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar a mídia.');
    return mapMedia(data as unknown as Row);
  },

  async deleteMedia(establishmentId: string, id: string): Promise<void> {
    const { error } = await client().from('establishment_media').delete()
      .eq('establishment_id', establishmentId).eq('id', id);
    fail(error, 'Não foi possível excluir a mídia.');
  },
};
