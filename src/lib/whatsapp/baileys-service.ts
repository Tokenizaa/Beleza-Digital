import { supabase } from '../supabase';

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WhatsAppMessage {
  id: string;
  leadId: string;
  sender: 'lead' | 'agent' | 'bot';
  senderName: string;
  text: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  actionType?: 'demo_link' | 'plan_offer';
  actionPayload?: Record<string, string | number>;
}

export interface WhatsAppConversation {
  leadId: string;
  businessName: string;
  phone: string;
  category: string;
  city: string;
  stage: 'novo' | 'contatado' | 'respondeu' | 'reuniao' | 'fechado';
  commercialScore: number;
  cadastralScore: number;
  opportunityLevel: 'alta' | 'media' | 'baixa';
  demoToken?: string;
  recommendedTemplate: string;
  botEnabled: boolean;
  unreadCount: number;
  lastMessageText: string;
  lastMessageTime: string;
  avatarUrl?: string;
}

export interface BaileysDeviceSession {
  status: WhatsAppConnectionStatus;
  phoneNumber?: string | null;
  pushName?: string | null;
  qrDataUrl?: string | null;
  qrAvailable?: boolean;
  lastError?: string | null;
  connectedAt?: string | null;
}

const API_URL = String(import.meta.env.VITE_WHATSAPP_SERVICE_URL || '').replace(/\/$/, '');
const EMPTY_SESSION: BaileysDeviceSession = {
  status: 'disconnected', phoneNumber: null, qrDataUrl: null,
  lastError: API_URL ? null : 'Serviço Baileys não configurado. Defina VITE_WHATSAPP_SERVICE_URL no build do frontend.'
};

class BaileysWhatsAppService {
  private session: BaileysDeviceSession = { ...EMPTY_SESSION };
  private conversations: WhatsAppConversation[] = [];
  private messages: Record<string, WhatsAppMessage[]> = {};
  private listeners = new Set<() => void>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor() {
    if (typeof window !== 'undefined') this.startPolling();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!API_URL) throw new Error('Serviço Baileys não configurado. Defina VITE_WHATSAPP_SERVICE_URL.');
    const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } };
    if (!session?.access_token) throw new Error('Sessão administrativa expirada. Entre novamente.');
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...init.headers
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha no serviço WhatsApp (${response.status})`);
    return payload as T;
  }

  private emit() { this.listeners.forEach(listener => listener()); }

  private startPolling() {
    if (this.pollHandle) return;
    void this.refresh();
    this.pollHandle = setInterval(() => void this.refresh(), 4000);
  }

  private async refresh() {
    if (this.polling || !API_URL) return;
    this.polling = true;
    try {
      const [state, conversationResult] = await Promise.all([
        this.request<BaileysDeviceSession>('/api/whatsapp/state'),
        this.request<{ conversations: WhatsAppConversation[] }>('/api/whatsapp/conversations')
      ]);
      this.session = state;
      this.conversations = conversationResult.conversations || [];
      const messageResults = await Promise.all(this.conversations.map(async conversation => {
        const result = await this.request<{ messages: WhatsAppMessage[] }>(
          `/api/whatsapp/conversations/${encodeURIComponent(conversation.leadId)}/messages`
        );
        return [conversation.leadId, result.messages || []] as const;
      }));
      this.messages = Object.fromEntries(messageResults);
    } catch (error) {
      this.session = {
        ...this.session,
        lastError: error instanceof Error ? error.message : 'Não foi possível consultar o serviço Baileys'
      };
      if (!API_URL) this.session.status = 'disconnected';
    } finally {
      this.polling = false;
      this.emit();
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    this.startPolling();
    return () => this.listeners.delete(listener);
  }

  getSession() { return this.session; }
  getConversations() { return this.conversations; }
  getMessages(leadId: string) { return this.messages[leadId] || []; }

  async connect() {
    try {
      this.session = { ...this.session, status: 'connecting', lastError: null };
      this.emit();
      this.session = await this.request<BaileysDeviceSession>('/api/whatsapp/connect', { method: 'POST' });
    } catch (error) {
      this.session = { ...this.session, status: 'disconnected', lastError: error instanceof Error ? error.message : 'Falha ao conectar' };
    }
    this.emit();
    void this.refresh();
  }

  async disconnect() {
    try {
      this.session = await this.request<BaileysDeviceSession>('/api/whatsapp/disconnect', { method: 'POST' });
    } catch (error) {
      this.session.lastError = error instanceof Error ? error.message : 'Falha ao desconectar';
    }
    this.emit();
  }

  async sendMessage(leadId: string, text: string, _sender: 'agent' | 'bot' = 'agent') {
    try {
      await this.request('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ leadId, text })
      });
      await this.refresh();
    } catch (error) {
      this.session.lastError = error instanceof Error ? error.message : 'Falha ao enviar mensagem';
      this.emit();
    }
  }

  async sendDemoLink(leadId: string, templateId = 'ouro-classico') {
    const conversation = this.conversations.find(item => item.leadId === leadId);
    if (!conversation) return;
    const token = conversation.demoToken || `demo-${leadId}`;
    const demoUrl = `${window.location.origin}/demo/${token}`;
    await this.sendMessage(leadId, `Olá, ${conversation.businessName}! Preparei uma demonstração do BelezaDigital para você: ${demoUrl} (modelo: ${templateId}).`);
  }

  async registerLeadFromScraper(lead: {
    id: string; businessName: string; phone?: string; category?: string; city?: string;
    commercialScore?: number; cadastralScore?: number; demoToken?: string; recommendedTemplate?: string;
  }): Promise<string> {
    const phone = String(lead.phone || '').replace(/\D/g, '');
    if (!phone) throw new Error('Este lead não possui telefone/WhatsApp válido.');
    const result = await this.request<{ conversation: WhatsAppConversation }>('/api/whatsapp/conversations', {
      method: 'POST',
      body: JSON.stringify({
        leadId: lead.id, businessName: lead.businessName, phone,
        category: lead.category, city: lead.city,
        commercialScore: lead.commercialScore, cadastralScore: lead.cadastralScore,
        demoToken: lead.demoToken, recommendedTemplate: lead.recommendedTemplate
      })
    });
    await this.refresh();
    return result.conversation.leadId;
  }

  async markAsRead(leadId: string) {
    try {
      await this.request(`/api/whatsapp/conversations/${encodeURIComponent(leadId)}/read`, { method: 'PATCH' });
      const conversation = this.conversations.find(item => item.leadId === leadId);
      if (conversation) conversation.unreadCount = 0;
      this.emit();
    } catch { /* refresh exibirá o erro de conexão, sem alterar mensagens locais */ }
  }

  async updateLeadStage(leadId: string, stage: WhatsAppConversation['stage']) {
    try {
      await this.request(`/api/whatsapp/conversations/${encodeURIComponent(leadId)}/stage`, {
        method: 'PATCH', body: JSON.stringify({ stage })
      });
      await this.refresh();
    } catch (error) {
      this.session.lastError = error instanceof Error ? error.message : 'Falha ao atualizar etapa';
      this.emit();
    }
  }

  async toggleBot(leadId: string, enabled?: boolean) {
    const conversation = this.conversations.find(item => item.leadId === leadId);
    if (!conversation) return;
    try {
      await this.request(`/api/whatsapp/conversations/${encodeURIComponent(leadId)}/bot`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ?? !conversation.botEnabled })
      });
      await this.refresh();
    } catch (error) {
      this.session.lastError = error instanceof Error ? error.message : 'Falha ao atualizar o bot';
      this.emit();
    }
  }
}

export const baileysService = new BaileysWhatsAppService();
