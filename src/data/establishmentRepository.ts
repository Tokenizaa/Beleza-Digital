import { supabase } from '../lib/supabase';
import { normalizePhone, hashPhoneSync } from '../lib/phone-utils';
import type {
  Establishment,
  MediaItem,
  ProductItem,
  ServiceItem,
  Appointment,
  ClientItem,
  ClientHistory,
  ProfileProvenance,
  ProfileFieldProvenance,
} from '../types';

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
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
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
    additionalImages: Array.isArray(row.additional_images)
      ? row.additional_images.filter((item): item is string => typeof item === 'string')
      : [],
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

function mapAppointment(row: Row): Appointment {
  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id),
    clientName: String(row.client_name || ''),
    clientPhone: String(row.client_phone || ''),
    serviceId: String(row.service_id || ''),
    serviceName: String(row.service_name || ''),
    servicePrice: row.service_price == null ? null : Number(row.service_price),
    serviceDuration: row.service_duration_minutes == null ? null : Number(row.service_duration_minutes),
    date: String(row.appointment_date || '').slice(0, 10),
    time: String(row.appointment_time || '').slice(0, 5),
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    status: (row.status || 'pendente') as Appointment['status'],
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapClient(row: Row): ClientItem {
  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    normalizedPhone: String(row.normalized_phone || ''),
    phoneHash: String(row.phone_hash || ''),
    email: typeof row.email === 'string' ? row.email : undefined,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    totalVisits: Number(row.total_visits || 0),
    lastVisitAt: typeof row.last_visit_at === 'string' ? row.last_visit_at : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export const establishmentRepository = {
  // =========================================================================
  // 1. PERFIL, PROVENIÊNCIA E REIMPORTAÇÃO (FASES 1 & 2)
  // =========================================================================

  async getProfile(establishmentId: string): Promise<Establishment> {
    const { data, error } = await client()
      .from('establishments')
      .select('id,slug,name,status,logo_url,primary_color,secondary_color,contact,brand_settings,created_at,updated_at')
      .eq('id', establishmentId)
      .single();
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

  /**
   * Obtém a proveniência completa do perfil: dados importados da coleta original,
   * campos com edição manual (overrides) e o perfil atualmente em vigor.
   */
  async getProfileProvenance(establishmentId: string): Promise<ProfileProvenance> {
    const { data: row, error } = await client()
      .from('establishments')
      .select('id,contact,brand_settings')
      .eq('id', establishmentId)
      .single();
    fail(error, 'Não foi possível ler proveniência do perfil.');

    const brand = asRecord(row?.brand_settings);
    const importedProfile = asRecord(brand.imported_profile);
    const manualOverridesRaw = asRecord(brand.manual_overrides);
    const manualOverrides: Record<string, ProfileFieldProvenance> = {};

    for (const [key, val] of Object.entries(manualOverridesRaw)) {
      if (val && typeof val === 'object') {
        const item = val as Record<string, unknown>;
        manualOverrides[key] = {
          value: item.value,
          source: 'manual',
          updatedAt: String(item.updated_at || new Date().toISOString()),
        };
      }
    }

    const effectiveProfile = await this.getProfile(establishmentId);

    return {
      establishmentId,
      importedProfile,
      manualOverrides,
      effectiveProfile,
      lastImportedAt: typeof brand.last_imported_at === 'string' ? brand.last_imported_at : undefined,
    };
  },

  /**
   * Atualiza o perfil. Quando source = 'manual', registra cada campo atualizado
   * em `brand_settings.manual_overrides`, protegendo-o contra sobrescritas em reimportações.
   */
  async updateProfile(
    establishmentId: string,
    updates: Partial<Establishment>,
    source: 'manual' | 'import' = 'manual'
  ): Promise<Establishment> {
    const current = await this.getProfile(establishmentId);
    const { data: existing, error: readError } = await client()
      .from('establishments')
      .select('contact,brand_settings')
      .eq('id', establishmentId)
      .single();
    fail(readError, 'Não foi possível carregar os dados atuais do perfil.');

    const contact = asRecord(existing?.contact);
    const brand = asRecord(existing?.brand_settings);
    const manualOverrides = asRecord(brand.manual_overrides);
    const nowIso = new Date().toISOString();

    // Rastreia overrides manuais caso a atualização venha do usuário
    if (source === 'manual') {
      for (const key of Object.keys(updates) as Array<keyof Establishment>) {
        if (updates[key] !== undefined) {
          manualOverrides[key] = {
            value: updates[key],
            updated_at: nowIso,
            source: 'manual',
          };
        }
      }
    }

    const next = { ...current, ...updates };

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
      ...(updates.latitude !== undefined ? { latitude: next.latitude } : {}),
      ...(updates.longitude !== undefined ? { longitude: next.longitude } : {}),
      ...(updates.instagramHandle !== undefined ? { instagram_handle: next.instagramHandle } : {}),
      ...(updates.instagramUrl !== undefined ? { instagram_url: next.instagramUrl } : {}),
      ...(updates.instagramBio !== undefined ? { instagram_bio: next.instagramBio } : {}),
      ...(updates.openingHoursNote !== undefined ? { opening_hours_note: next.openingHoursNote } : {}),
    };

    const brandPatch: Row = {
      ...brand,
      manual_overrides: manualOverrides,
      ...(updates.tagline !== undefined ? { tagline: next.tagline } : {}),
      ...(updates.description !== undefined ? { description: next.description } : {}),
      ...(updates.showInstagramGallery !== undefined ? { show_instagram_gallery: next.showInstagramGallery } : {}),
      ...(updates.allowOnlineBooking !== undefined ? { allow_online_booking: next.allowOnlineBooking } : {}),
      ...(updates.slotIntervalMinutes !== undefined ? { slot_interval_minutes: next.slotIntervalMinutes } : {}),
    };

    const payload: Row = {
      contact: contactPatch,
      brand_settings: brandPatch,
      updated_at: nowIso,
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
    if (updates.primaryColor !== undefined) payload.primary_color = updates.primaryColor;
    if (updates.secondaryColor !== undefined) payload.secondary_color = updates.secondaryColor;

    const { error } = await client().from('establishments').update(payload).eq('id', establishmentId);
    fail(error, 'Não foi possível salvar o perfil do estabelecimento.');
    return this.getProfile(establishmentId);
  },

  /**
   * Reimportação de dados coletados (Fase 2):
   * - Atualiza a camada de origem (brand_settings.imported_profile).
   * - Preserva intactos os campos que possuem override manual registrado pelo usuário.
   * - Atualiza campos que nunca foram editados manualmente.
   * - Retorna a lista detalhada de campos preservados e atualizados.
   */
  async reimportProfile(
    establishmentId: string,
    incoming: Partial<Establishment>
  ): Promise<{ profile: Establishment; preservedFields: string[]; updatedFields: string[] }> {
    const { data: existing, error } = await client()
      .from('establishments')
      .select('contact,brand_settings')
      .eq('id', establishmentId)
      .single();
    fail(error, 'Não foi possível carregar o estabelecimento para reimportação.');

    const brand = asRecord(existing?.brand_settings);
    const existingImported = asRecord(brand.imported_profile);
    const manualOverrides = asRecord(brand.manual_overrides);

    const preservedFields: string[] = [];
    const updatedFields: string[] = [];
    const fieldsToApply: Partial<Establishment> = {};

    const keys = Object.keys(incoming) as Array<keyof Establishment>;
    for (const key of keys) {
      if (incoming[key] === undefined) continue;

      if (manualOverrides[key]) {
        // Usuário editou manualmente: preserva valor manual sem sobrescrever
        preservedFields.push(key);
      } else {
        // Sem override: atualiza com o novo valor coletado
        fieldsToApply[key] = incoming[key] as never;
        updatedFields.push(key);
      }
    }

    const nowIso = new Date().toISOString();
    const updatedImportedProfile = { ...existingImported, ...incoming };

    // Atualiza marca com a nova origem e salva os campos permitidos
    const nextBrandPatch: Row = {
      ...brand,
      imported_profile: updatedImportedProfile,
      last_imported_at: nowIso,
    };

    await client().from('establishments').update({ brand_settings: nextBrandPatch }).eq('id', establishmentId);

    const updatedProfile = await this.updateProfile(establishmentId, fieldsToApply, 'import');

    return {
      profile: updatedProfile,
      preservedFields,
      updatedFields,
    };
  },

  // =========================================================================
  // 2. CATÁLOGO: SERVIÇOS, PRODUTOS E MÍDIA (FASES 1 & 4)
  // =========================================================================

  async listServices(establishmentId: string): Promise<ServiceItem[]> {
    const { data, error } = await client()
      .from('establishment_services')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('sort_order')
      .order('created_at', { ascending: false });
    fail(error, 'Não foi possível carregar os serviços.');
    return (data || []).map((row) => mapService(row as unknown as Row));
  },

  async saveService(establishmentId: string, item: ServiceItem): Promise<ServiceItem> {
    const payload: Row = {
      establishment_id: establishmentId,
      name: item.name,
      description: item.description,
      price: item.price ?? null,
      price_range: item.priceRange ?? null,
      duration_minutes: item.durationMinutes ?? null,
      category: item.category,
      image_url: item.imageUrl ?? null,
      featured: item.featured,
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_services').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar o serviço.');
    return mapService(data as unknown as Row);
  },

  async deleteService(establishmentId: string, id: string): Promise<void> {
    const { error } = await client()
      .from('establishment_services')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível excluir o serviço.');
  },

  async listProducts(establishmentId: string): Promise<ProductItem[]> {
    const { data, error } = await client()
      .from('establishment_products')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('sort_order')
      .order('created_at');
    fail(error, 'Não foi possível carregar os produtos.');
    return (data || []).map((row) => mapProduct(row as unknown as Row));
  },

  async saveProduct(establishmentId: string, item: ProductItem): Promise<ProductItem> {
    const payload: Row = {
      establishment_id: establishmentId,
      name: item.name,
      description: item.description,
      price: item.price,
      main_image: item.mainImage,
      additional_images: item.additionalImages || [],
      available: item.available,
      category: item.category,
      featured: item.featured,
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_products').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar o produto.');
    return mapProduct(data as unknown as Row);
  },

  async deleteProduct(establishmentId: string, id: string): Promise<void> {
    const { error } = await client()
      .from('establishment_products')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível excluir o produto.');
  },

  async listMedia(establishmentId: string): Promise<MediaItem[]> {
    const { data, error } = await client()
      .from('establishment_media')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('sort_order')
      .order('date_added', { ascending: false });
    fail(error, 'Não foi possível carregar a galeria.');
    return (data || []).map((row) => mapMedia(row as unknown as Row));
  },

  async saveMedia(establishmentId: string, item: MediaItem): Promise<MediaItem> {
    const payload: Row = {
      establishment_id: establishmentId,
      type: item.type,
      title: item.title,
      url: item.url,
      thumbnail_url: item.thumbnailUrl ?? null,
      is_reel_vertical: item.isReelVertical ?? false,
      category: item.category,
      date_added: item.dateAdded,
      featured: item.featured,
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;
    const { data, error } = await client().from('establishment_media').upsert(payload).select('*').single();
    fail(error, 'Não foi possível salvar a mídia.');
    return mapMedia(data as unknown as Row);
  },

  async deleteMedia(establishmentId: string, id: string): Promise<void> {
    const { error } = await client()
      .from('establishment_media')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível excluir a mídia.');
  },

  // =========================================================================
  // 3. AGENDAMENTOS E GESTÃO DE HORÁRIOS (FASES 3 & 4)
  // =========================================================================

  async listAppointments(establishmentId: string): Promise<Appointment[]> {
    const { data, error } = await client()
      .from('establishment_appointments')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });
    fail(error, 'Não foi possível carregar agendamentos.');
    return (data || []).map((row) => mapAppointment(row as unknown as Row));
  },

  async saveAppointment(establishmentId: string, item: Appointment): Promise<Appointment> {
    const payload: Row = {
      establishment_id: establishmentId,
      client_name: item.clientName.trim(),
      client_phone: item.clientPhone.trim(),
      service_id: item.serviceId,
      service_name: item.serviceName,
      service_price: item.servicePrice ?? null,
      service_duration_minutes: item.serviceDuration ?? null,
      appointment_date: item.date,
      appointment_time: item.time,
      notes: item.notes?.trim() || null,
      status: item.status || 'pendente',
      updated_at: new Date().toISOString(),
    };
    if (isUuid(item.id)) payload.id = item.id;

    const { data, error } = await client()
      .from('establishment_appointments')
      .upsert(payload)
      .select('*')
      .single();
    fail(error, 'Não foi possível salvar agendamento.');

    // Atualiza ou cadastra cliente automaticamente
    try {
      await this.saveClient(establishmentId, {
        name: item.clientName,
        phone: item.clientPhone,
      });
    } catch {
      // Falha secundária não impede retorno do agendamento
    }

    return mapAppointment(data as unknown as Row);
  },

  async updateAppointmentStatus(
    establishmentId: string,
    id: string,
    status: 'pendente' | 'confirmado' | 'cancelado' | 'concluido'
  ): Promise<void> {
    const { error } = await client()
      .from('establishment_appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível atualizar status do agendamento.');
  },

  async deleteAppointment(establishmentId: string, id: string): Promise<void> {
    const { error } = await client()
      .from('establishment_appointments')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível remover agendamento.');
  },

  /**
   * Verifica se o horário está disponível no backend/banco.
   * Retorna true se livre; false se já houver reserva ativa ('pendente' ou 'confirmado').
   */
  async checkSlotAvailability(establishmentId: string, date: string, time: string): Promise<boolean> {
    const { data, error } = await client()
      .from('establishment_appointments')
      .select('id, status')
      .eq('establishment_id', establishmentId)
      .eq('appointment_date', date)
      .eq('appointment_time', time)
      .in('status', ['pendente', 'confirmado']);
    if (error) throw error;
    return (data || []).length === 0;
  },

  // =========================================================================
  // 4. CLIENTES E HISTÓRICO DE PROCEDIMENTOS (FASE 3)
  // =========================================================================

  async listClients(establishmentId: string, search?: string): Promise<ClientItem[]> {
    let query = client()
      .from('establishment_clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term}`);
    }

    const { data, error } = await query;
    fail(error, 'Não foi possível carregar a lista de clientes.');
    return (data || []).map((row) => mapClient(row as unknown as Row));
  },

  async getClientByPhone(establishmentId: string, phone: string): Promise<ClientItem | null> {
    const phoneHash = hashPhoneSync(phone);
    if (!phoneHash) return null;

    const { data, error } = await client()
      .from('establishment_clients')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('phone_hash', phoneHash)
      .maybeSingle();
    if (error) throw error;
    return data ? mapClient(data as unknown as Row) : null;
  },

  /**
   * Cadastra ou atualiza cliente com deduplicação criptográfica SHA-256 por telefone.
   * Garante que múltiplos registros com mesmo telefone no mesmo salão sejam unificados.
   */
  async saveClient(
    establishmentId: string,
    clientData: {
      id?: string;
      name: string;
      phone: string;
      email?: string;
      notes?: string;
    }
  ): Promise<ClientItem> {
    const normalized = normalizePhone(clientData.phone);
    if (!normalized) {
      throw new Error('Telefone inválido para normalização e deduplicação do cliente.');
    }
    const phoneHash = hashPhoneSync(clientData.phone);
    if (!phoneHash) {
      throw new Error('Falha ao gerar hash seguro do telefone do cliente.');
    }

    // Busca cliente existente pelo hash no tenant
    const existing = await this.getClientByPhone(establishmentId, clientData.phone);

    const nowIso = new Date().toISOString();
    const payload: Row = {
      establishment_id: establishmentId,
      name: clientData.name.trim(),
      phone: clientData.phone.trim(),
      normalized_phone: normalized,
      phone_hash: phoneHash,
      email: clientData.email?.trim() || null,
      notes: clientData.notes?.trim() || null,
      updated_at: nowIso,
    };

    if (existing) {
      // Atualiza cliente existente mantendo o ID
      payload.id = existing.id;
    } else if (clientData.id && isUuid(clientData.id)) {
      payload.id = clientData.id;
    }

    const { data, error } = await client()
      .from('establishment_clients')
      .upsert(payload)
      .select('*')
      .single();
    fail(error, 'Não foi possível salvar os dados do cliente.');
    return mapClient(data as unknown as Row);
  },

  /**
   * Recupera o histórico completo de procedimentos e visitas do cliente no estabelecimento.
   */
  async getClientHistory(establishmentId: string, phoneOrId: string): Promise<ClientHistory> {
    let clientRow: ClientItem | null = null;
    if (isUuid(phoneOrId)) {
      const { data, error } = await client()
        .from('establishment_clients')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('id', phoneOrId)
        .maybeSingle();
      if (!error && data) clientRow = mapClient(data as unknown as Row);
    }

    if (!clientRow) {
      clientRow = await this.getClientByPhone(establishmentId, phoneOrId);
    }

    if (!clientRow) {
      throw new Error('Cliente não encontrado neste estabelecimento.');
    }

    // Busca agendamentos associados pelo telefone ou nome
    const normalized = clientRow.normalizedPhone;
    const { data: apptRows, error: apptError } = await client()
      .from('establishment_appointments')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    fail(apptError, 'Não foi possível carregar o histórico de agendamentos.');

    const appointments = (apptRows || [])
      .map((row) => mapAppointment(row as unknown as Row))
      .filter((appt) => {
        const apptNorm = normalizePhone(appt.clientPhone);
        return apptNorm === normalized || appt.clientPhone === clientRow?.phone;
      });

    return {
      client: clientRow,
      appointments,
    };
  },

  async deleteClient(establishmentId: string, id: string): Promise<void> {
    const { error } = await client()
      .from('establishment_clients')
      .delete()
      .eq('establishment_id', establishmentId)
      .eq('id', id);
    fail(error, 'Não foi possível remover cliente.');
  },
};
