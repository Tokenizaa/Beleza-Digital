import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Bot, User, Check, CheckCheck, QrCode,
  Smartphone, Sparkles, ExternalLink, Flame, Award, Calendar,
  Layers, Search, RefreshCw, Sliders, Info, Phone, MapPin,
  Building2, X, Play, Zap, Clock, Radio, Wifi, WifiOff, Battery,
  ShieldCheck, Share2
} from 'lucide-react';
import {
  baileysService,
  WhatsAppConversation,
  WhatsAppMessage,
  BaileysDeviceSession
} from '../lib/whatsapp/baileys-service';
import { SITE_TEMPLATES, SiteVariationId } from '../types/templates';

interface CrmWhatsAppChatProps {
  initialLeadId?: string;
  onOpenPublicSite?: () => void;
}

export function CrmWhatsAppChat({ initialLeadId }: CrmWhatsAppChatProps) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [session, setSession] = useState<BaileysDeviceSession>(baileysService.getSession());
  const [activeLeadId, setActiveLeadId] = useState<string>(initialLeadId || '');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'high_commercial' | 'bot_active'>('all');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLeadDetails, setShowLeadDetails] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateData = () => {
      const nextConversations = [...baileysService.getConversations()];
      setConversations(nextConversations);
      setSession({ ...baileysService.getSession() });
      if (!activeLeadId && nextConversations[0]) setActiveLeadId(nextConversations[0].leadId);
      if (activeLeadId) {
        setMessages([...baileysService.getMessages(activeLeadId)]);
      }
    };

    updateData();
    const unsubscribe = baileysService.subscribe(updateData);
    return () => {
      unsubscribe();
    };
  }, [activeLeadId]);

  useEffect(() => {
    if (activeLeadId) {
      setMessages([...baileysService.getMessages(activeLeadId)]);
      baileysService.markAsRead(activeLeadId);
      scrollToBottom();
    }
  }, [activeLeadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeConversation = conversations.find((c) => c.leadId === activeLeadId) || conversations[0];

  const filteredConversations = conversations.filter((c) => {
    const matchesQuery =
      c.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.city.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;

    if (filterType === 'unread') return c.unreadCount > 0;
    if (filterType === 'high_commercial') return c.commercialScore >= 70;
    if (filterType === 'bot_active') return c.botEnabled;
    return true;
  });

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    baileysService.sendMessage(activeConversation.leadId, inputMessage.trim(), 'agent');
    setInputMessage('');
  };

  const handleSendMacro = (text: string) => {
    if (!activeConversation) return;
    baileysService.sendMessage(activeConversation.leadId, text, 'agent');
  };

  const handleSendDemo = () => {
    if (!activeConversation) return;
    baileysService.sendDemoLink(activeConversation.leadId, activeConversation.recommendedTemplate);
  };

  const getStageBadge = (stage: WhatsAppConversation['stage']) => {
    switch (stage) {
      case 'novo':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">Novo</span>;
      case 'contatado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">Contatado</span>;
      case 'respondeu':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Respondeu</span>;
      case 'reuniao':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">Reunião</span>;
      case 'fechado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/40">Fechado</span>;
      default:
        return null;
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100 overflow-hidden">
      <div className="h-14 border-b border-neutral-800 bg-neutral-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                  WhatsApp CRM — Baileys
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  session.status === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  session.status === 'qr_ready' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${session.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                  {session.status === 'connected' ? 'Conectado' : session.status === 'qr_ready' ? 'Aguardando QR' : session.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {session.phoneNumber || 'Nenhum aparelho pareado'} • {session.lastError || 'Conexão real via serviço Baileys'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowQrModal(true); if (session.status !== 'connected') void baileysService.connect(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Gerenciar Conexão / QR Code</span>
          </button>

          <button
            onClick={() => setShowLeadDetails(!showLeadDetails)}
            className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
              showLeadDetails
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-white'
            }`}
            title="Dossiê de Qualificação do Lead"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 md:w-96 border-r border-neutral-800 bg-neutral-900/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-neutral-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por salão, telefone ou cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 rounded-md shrink-0 transition font-medium ${
                  filterType === 'all'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Todas ({conversations.length})
              </button>
              <button
                onClick={() => setFilterType('unread')}
                className={`px-2 py-1 rounded-md shrink-0 transition font-medium ${
                  filterType === 'unread'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Não Lidas ({conversations.filter((c) => c.unreadCount > 0).length})
              </button>
              <button
                onClick={() => setFilterType('high_commercial')}
                className={`px-2 py-1 rounded-md shrink-0 transition font-medium ${
                  filterType === 'high_commercial'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Alta Oportunidade
              </button>
              <button
                onClick={() => setFilterType('bot_active')}
                className={`px-2 py-1 rounded-md shrink-0 transition font-medium ${
                  filterType === 'bot_active'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Bot Ativo
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                Nenhuma conversa encontrada com os filtros atuais.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.leadId === activeLeadId;
                return (
                  <button
                    key={conv.leadId}
                    onClick={() => setActiveLeadId(conv.leadId)}
                    className={`w-full p-3.5 text-left transition flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-800/90 border-l-4 border-amber-500'
                        : 'hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-amber-300 text-sm">
                        {conv.businessName.charAt(0)}
                      </div>
                      {conv.botEnabled && (
                        <div
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-purple-600 border border-neutral-900 flex items-center justify-center text-[9px] text-white"
                          title="Bot Baileys Ativo"
                        >
                          🤖
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-neutral-100 truncate">
                          {conv.businessName}
                        </span>
                        <span className="text-[10px] text-neutral-500 shrink-0">
                          {formatMessageTime(conv.lastMessageTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1.5">
                        {getStageBadge(conv.stage)}
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                          {conv.commercialScore} pts
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 truncate">
                        {conv.lastMessageText}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-neutral-950 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {activeConversation ? (
          <div className="flex-1 flex flex-col min-w-0 bg-neutral-950">
            <div className="h-16 border-b border-neutral-800 bg-neutral-900/60 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 shrink-0">
                  {activeConversation.businessName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white truncate">
                      {activeConversation.businessName}
                    </h2>
                    {getStageBadge(activeConversation.stage)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{activeConversation.phone}</span>
                    <span>•</span>
                    <span className="text-neutral-500">{activeConversation.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={activeConversation.stage}
                  onChange={(e) =>
                    baileysService.updateLeadStage(
                      activeConversation.leadId,
                      e.target.value as WhatsAppConversation['stage']
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="novo">Funil: Novo</option>
                  <option value="contatado">Funil: Contatado</option>
                  <option value="respondeu">Funil: Respondeu</option>
                  <option value="reuniao">Funil: Reunião Agendada</option>
                  <option value="fechado">Funil: Fechado / Assinante</option>
                </select>

                <a
                  href={`/demo/${activeConversation.demoToken || 'demo-poa-yeshua'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition"
                  title="Abrir página pública de escolha entre os 5 modelos"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ver Demo (5 Modelos)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <button
                  onClick={() => baileysService.toggleBot(activeConversation.leadId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    activeConversation.botEnabled
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-300 hover:bg-purple-600/30'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                  }`}
                  title={activeConversation.botEnabled ? 'Pausar Bot Baileys para este lead' : 'Ativar Bot Baileys para responder automaticamente'}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{activeConversation.botEnabled ? 'Bot Ativo' : 'Bot Pausado'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex justify-center">
                <div className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Conversa sincronizada via Baileys Multi-Device. Mensagens criptografadas de ponta a ponta.</span>
                </div>
              </div>

              {messages.map((msg) => {
                const isLead = msg.sender === 'lead';
                const isBot = msg.sender === 'bot';
                const isAgent = msg.sender === 'agent';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {isBot && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          <Bot className="w-3 h-3" />
                          Bot Baileys
                        </span>
                      )}
                      {isAgent && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          Especialista BelezaDigital
                        </span>
                      )}
                      {isLead && (
                        <span className="text-[10px] text-neutral-400 font-semibold">
                          {msg.senderName}
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-md text-xs leading-relaxed space-y-2 ${
                        isLead
                          ? 'bg-neutral-800 text-neutral-100 rounded-tl-xs border border-neutral-700/60'
                          : isBot
                          ? 'bg-purple-950/40 text-purple-100 rounded-tr-xs border border-purple-800/40'
                          : 'bg-emerald-950/40 text-emerald-100 rounded-tr-xs border border-emerald-800/50'
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>

                      {msg.actionType === 'demo_link' && msg.actionPayload && (
                        <div className="mt-2 rounded-xl border border-amber-500/40 bg-neutral-900/90 p-3 space-y-2 text-neutral-200">
                          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                            <Sparkles className="w-4 h-4" />
                            <span>Demonstração Interativa BelezaDigital</span>
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            Ambiente com os 5 modelos prontos para visualização móvel: Ouro Clássico, Preto Esmeralda, Minimal Studio, Safira Executivo e Rubi Lounge.
                          </p>
                          <a
                            href={String(msg.actionPayload.demoUrl || `/demo/${activeConversation.demoToken}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition"
                          >
                            <span>Abrir e Testar 5 Modelos</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      {msg.actionType === 'plan_offer' && msg.actionPayload && (
                        <div className="mt-2 rounded-xl border border-emerald-500/40 bg-neutral-900/90 p-3 space-y-2 text-neutral-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-400">Planos Sem Comissão</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              {msg.actionPayload.price || 'A partir de R$ 79/mês'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400">
                            Zero cobrança por corte ou agendamento. Pagamento instantâneo via PIX ou Cartão.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 text-[10px] text-neutral-400 pt-0.5">
                        <span>{formatMessageTime(msg.timestamp)}</span>
                        {!isLead && (
                          <span>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3 h-3 text-sky-400" />
                            ) : (
                              <Check className="w-3 h-3 text-neutral-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-2 bg-neutral-900/70 border-t border-neutral-800 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <span className="text-[11px] text-neutral-400 font-bold shrink-0 uppercase tracking-wider">
                Ações Rápidas:
              </span>

              <button
                onClick={handleSendDemo}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shrink-0 font-medium transition cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>🚀 Enviar Demo (5 Modelos)</span>
              </button>

              <button
                onClick={() =>
                  handleSendMacro(
                    `Olá! O BelezaDigital é uma plataforma completa que cria sites de alta conversão para salões e barbearias com agendamento online automático 24h, catálogo de serviços e confirmação via WhatsApp. Tudo sem cobrar comissão por cliente!`
                  )
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 shrink-0 font-medium transition cursor-pointer"
              >
                <span>💼 Benefícios</span>
              </button>

              <button
                onClick={() =>
                  handleSendMacro(
                    `Podemos agendar uma demonstração guiada de 15 minutos pelo Google Meet para eu te mostrar como a sua equipe pode gerenciar a agenda pelo celular sem perder clientes?`
                  )
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 shrink-0 font-medium transition cursor-pointer"
              >
                <span>📅 Propor Reunião</span>
              </button>
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                placeholder={`Mensagem para ${activeConversation.businessName}... (Pressione Enter para enviar)`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-hidden focus:border-amber-500"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
            Selecione uma conversa para iniciar o atendimento.
          </div>
        )}

        <div className="w-80 border-l border-neutral-800 bg-neutral-900/50 p-4 overflow-y-auto space-y-5 shrink-0">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Dossiê de Qualificação
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                Google Maps
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">
              {activeConversation?.businessName}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {activeConversation?.category}
            </p>
          </div>

          <div className="space-y-3 bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Oportunidade Comercial:</span>
                </span>
                <span className="font-bold text-neutral-200">
                  {activeConversation?.commercialScore}/100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                  style={{ width: `${activeConversation?.commercialScore || 0}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                {activeConversation?.commercialScore >= 70
                  ? '🎯 Alta probabilidade de fechamento: negócio com demanda comprovada e carência de site próprio.'
                  : '⚡ Média probabilidade: avaliar presença em redes sociais.'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  <span>Completude Cadastral:</span>
                </span>
                <span className="font-bold text-neutral-200">
                  {activeConversation?.cadastralScore}/100
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${activeConversation?.cadastralScore || 0}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3.5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Modelo Recomendado (1 dos 5):</span>
            </span>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-amber-300 capitalize">
                  {SITE_TEMPLATES[activeConversation?.recommendedTemplate as SiteVariationId]?.name || activeConversation?.recommendedTemplate}
                </h4>
                <p className="text-[11px] text-neutral-400">
                  {SITE_TEMPLATES[activeConversation?.recommendedTemplate as SiteVariationId]?.recommendedFor || 'Personalizado para o segmento'}
                </p>
              </div>
            </div>

            <a
              href={`/demo/${activeConversation?.demoToken || 'demo-poa-yeshua'}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
            >
              <span>Visualizar 5 Modelos</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-2.5 text-xs text-neutral-300 bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate">{activeConversation?.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate">{activeConversation?.city}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>Atendimento regular ativo</span>
            </div>
          </div>

          <div className="bg-purple-950/20 border border-purple-800/40 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>Bot Baileys</span>
              </span>
              <button
                onClick={() => baileysService.toggleBot(activeConversation!.leadId)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                  activeConversation?.botEnabled
                    ? 'bg-purple-500 text-white'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {activeConversation?.botEnabled ? 'ATIVO' : 'DESATIVADO'}
              </button>
            </div>
            <p className="text-[11px] text-purple-300/80 leading-relaxed">
              Responde automaticamente perguntas frequentes, apresenta vantagens do agendamento 24h e envia o link dos 5 modelos.
            </p>
          </div>
        </div>
      </div>

      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Conexão WhatsApp Web com Baileys
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Sincronize o aparelho do salão para disparos e recepção de mensagens
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Status da Sessão:</span>
                <span className={`font-bold ${session.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {session.status === 'connected' ? 'Conectado e autenticado' : session.status === 'qr_ready' ? 'Aguardando leitura do QR Code' : session.status === 'connecting' ? 'Conectando ao WhatsApp' : 'Desconectado'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Número Pareado:</span>
                <span className="font-mono text-neutral-200">{session.phoneNumber || '—'}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center space-y-3 text-neutral-950">
              {session.qrDataUrl ? (
                <img src={session.qrDataUrl} alt="QR Code real de pareamento do WhatsApp" className="w-48 h-48 object-contain" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-center text-xs text-neutral-600 px-4">
                  {session.status === 'connected' ? 'Aparelho já conectado.' : 'Aguardando o serviço Baileys gerar o QR Code real…'}
                </div>
              )}
              <p className="text-center text-xs text-neutral-700">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.</p>
              {session.lastError && <p className="text-center text-xs text-rose-700">{session.lastError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {session.status === 'connected' ? (
                <button onClick={() => void baileysService.disconnect()} className="px-4 py-2 rounded-xl border border-rose-500/40 text-rose-300 font-bold text-xs">Desconectar aparelho</button>
              ) : (
                <button onClick={() => void baileysService.connect()} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs">Gerar QR Code real</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
