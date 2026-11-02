/**
 * Sistema de Validação, Sanitização e Hidratação de Templates de Mensagens
 * para Abordagem Comercial e Envio de Demonstrações aos Leads.
 *
 * Garante que variáveis obrigatórias (nome do cliente, serviço, link da proposta, etc.)
 * estejam válidas e preenchidas, aplicando fallbacks inteligentes para que nenhuma
 * mensagem seja enviada com placeholders vazios ou tags brutas.
 */

export interface MessageTemplateVariableConfig {
  key: string;
  label: string;
  required: boolean;
  fallback: string;
  description: string;
  validator?: (value: unknown) => boolean;
  sanitizer?: (value: unknown, fallback: string) => string;
}

export interface OutreachMessageTemplate {
  id: string;
  name: string;
  category: 'proposta_inicial' | 'diagnostico_digital' | 'agendamento_online' | 'follow_up';
  description: string;
  textTemplate: string;
  metaTemplateName?: string;
  metaLanguageCode?: string;
  variables: MessageTemplateVariableConfig[];
}

// Sanitizadores auxiliares
function sanitizeText(value: unknown, fallback: string, maxLen = 150): string {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean.slice(0, maxLen) : fallback;
}

function sanitizePhone(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits.length >= 8 ? digits : fallback;
}

function sanitizeUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const raw = value.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.toString();
  } catch {
    return fallback;
  }
}

/** Catálogo oficial de templates de abordagem comercial */
export const OUTREACH_TEMPLATES: Record<string, OutreachMessageTemplate> = {
  PROPOSTA_5_MODELOS: {
    id: 'PROPOSTA_5_MODELOS',
    name: 'Proposta Completa · 5 Modelos Visuais',
    category: 'proposta_inicial',
    description: 'Apresenta a demonstração interativa já personalizada com os 5 modelos de design.',
    textTemplate:
      'Olá! Encontrei o perfil público de *{{cliente_nome}}* no Google Maps{{reputacao_sufixo}} e preparei uma demonstração de site com cinco opções visuais para o seu negócio de {{servico_destaque}}. Você pode explorar os modelos e ver como a apresentação do estabelecimento pode ficar:\n\n🔗 {{link_proposta}}\n\nSe fizer sentido, posso conversar sobre os próximos passos.',
    metaTemplateName: 'proposta_5_modelos_v1',
    metaLanguageCode: 'pt_BR',
    variables: [
      {
        key: 'cliente_nome',
        label: 'Nome do Cliente / Salão',
        required: true,
        fallback: 'seu estabelecimento',
        description: 'Nome fantasia ou comercial do estabelecimento.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 80),
      },
      {
        key: 'servico_destaque',
        label: 'Serviço em Destaque',
        required: true,
        fallback: 'beleza, estética e barbearia',
        description: 'Especialidade principal do estabelecimento.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 60),
      },
      {
        key: 'link_proposta',
        label: 'Link da Demonstração / Proposta',
        required: true,
        fallback: '',
        description: 'URL pública da demonstração interativa.',
        sanitizer: (val, fb) => sanitizeUrl(val, fb),
      },
      {
        key: 'reputacao_sufixo',
        label: 'Destaque de Reputação Maps',
        required: false,
        fallback: '',
        description: 'Ex: " (nota 4.9 ⭐ com 128 avaliações)" ou vazio se ausente.',
        sanitizer: (val) => (typeof val === 'string' && val.trim() ? ` (${val.trim()})` : ''),
      },
    ],
  },

  DIAGNOSTICO_DIGITAL_SEM_SITE: {
    id: 'DIAGNOSTICO_DIGITAL_SEM_SITE',
    name: 'Diagnóstico Digital · Oportunidade Sem Site',
    category: 'diagnostico_digital',
    description: 'Focado em leads que não possuem site e dependem apenas de WhatsApp/direct.',
    textTemplate:
      'Olá, equipe do *{{cliente_nome}}*! Encontrei o perfil público do estabelecimento e preparei uma proposta visual de site para apresentar melhor os serviços de {{servico_destaque}}.\n\nA demonstração com cinco opções de layout está aqui:\n\n👉 {{link_proposta}}\n\nSe fizer sentido, posso explicar como personalizar e publicar a página.',
    metaTemplateName: 'diagnostico_sem_site_v1',
    metaLanguageCode: 'pt_BR',
    variables: [
      {
        key: 'cliente_nome',
        label: 'Nome do Estabelecimento',
        required: true,
        fallback: 'seu espaço',
        description: 'Nome do salão ou clínica.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 80),
      },
      {
        key: 'cidade',
        label: 'Cidade / Região',
        required: false,
        fallback: 'sua região',
        description: 'Cidade de atuação do negócio.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 50),
      },
      {
        key: 'servico_destaque',
        label: 'Nicho ou Categoria',
        required: true,
        fallback: 'atendimentos de beleza e autocuidado',
        description: 'Categoria dos serviços prestados.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 60),
      },
      {
        key: 'link_proposta',
        label: 'Link da Demonstração',
        required: true,
        fallback: '',
        description: 'URL da proposta interativa.',
        sanitizer: (val, fb) => sanitizeUrl(val, fb),
      },
    ],
  },

  AGENDAMENTO_24H: {
    id: 'AGENDAMENTO_24H',
    name: 'Agendamento 24h & Sem Comissões',
    category: 'agendamento_online',
    description: 'Focado no ganho financeiro de não pagar comissões e liberar secretária.',
    textTemplate:
      'Olá! Quanto tempo sua equipe perde respondendo orçamentos no direct? No *{{cliente_nome}}*, seus clientes poderiam agendar horários de {{servico_destaque}} 24 horas por dia sem taxas de aplicativo.\n\nVeja como ficaria seu site completo funcionando com agendamento integrado:\n\n✨ {{link_proposta}}\n\nPodemos ativar o domínio do seu salão hoje mesmo?',
    metaTemplateName: 'agendamento_24h_v1',
    metaLanguageCode: 'pt_BR',
    variables: [
      {
        key: 'cliente_nome',
        label: 'Nome do Cliente',
        required: true,
        fallback: 'seu salão',
        description: 'Nome fantasia do estabelecimento.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 80),
      },
      {
        key: 'servico_destaque',
        label: 'Serviço / Procedimento',
        required: true,
        fallback: 'cortes, barba e tratamentos',
        description: 'Serviços oferecidos.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 60),
      },
      {
        key: 'link_proposta',
        label: 'Link da Proposta',
        required: true,
        fallback: '',
        description: 'URL de demonstração.',
        sanitizer: (val, fb) => sanitizeUrl(val, fb),
      },
    ],
  },

  FOLLOW_UP_FEEDBACK: {
    id: 'FOLLOW_UP_FEEDBACK',
    name: 'Follow-Up · Escolha do Modelo',
    category: 'follow_up',
    description: 'Mensagem de acompanhamento após envio da demonstração.',
    textTemplate:
      'Olá! Conseguiu dar uma olhada na demonstração que preparei para o *{{cliente_nome}}*? ({{link_proposta}})\n\nQual dos 5 modelos visuais melhor reflete a identidade dos seus serviços de {{servico_destaque}}? Posso tirar dúvidas sobre a ativação.',
    metaTemplateName: 'follow_up_demo_v1',
    metaLanguageCode: 'pt_BR',
    variables: [
      {
        key: 'cliente_nome',
        label: 'Nome do Cliente',
        required: true,
        fallback: 'seu estabelecimento',
        description: 'Nome do cliente.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 80),
      },
      {
        key: 'link_proposta',
        label: 'Link da Proposta',
        required: true,
        fallback: '',
        description: 'Link da proposta.',
        sanitizer: (val, fb) => sanitizeUrl(val, fb),
      },
      {
        key: 'servico_destaque',
        label: 'Serviço',
        required: true,
        fallback: 'beleza e barbearia',
        description: 'Categoria do serviço.',
        sanitizer: (val, fb) => sanitizeText(val, fb, 60),
      },
    ],
  },
};

export interface HydrateTemplateResult {
  isValid: boolean;
  templateId: string;
  templateName: string;
  renderedMessage: string;
  hydratedVariables: Record<string, string>;
  appliedFallbacks: Array<{ key: string; original: unknown; fallbackUsed: string }>;
  warnings: string[];
  metaComponents?: Array<{
    type: 'body';
    parameters: Array<{ type: 'text'; text: string }>;
  }>;
}

/**
 * Valida a existência do template, higieniza cada variável necessária
 * e hidrata a mensagem substituindo tags `{{variavel}}`.
 *
 * Se uma variável obrigatória estiver vazia ou nula, aplica o fallback inteligente
 * e documenta a alteração em `appliedFallbacks`.
 */
export function validateAndHydrateMessageTemplate(
  templateId: string,
  rawVariables: Record<string, unknown>
): HydrateTemplateResult {
  const template = OUTREACH_TEMPLATES[templateId] || OUTREACH_TEMPLATES.PROPOSTA_5_MODELOS;
  const appliedFallbacks: Array<{ key: string; original: unknown; fallbackUsed: string }> = [];
  const warnings: string[] = [];
  const hydratedVariables: Record<string, string> = {};

  if (!OUTREACH_TEMPLATES[templateId]) {
    warnings.push(`Template "${templateId}" não localizado no catálogo; utilizando "${template.id}".`);
  }

  // Processa cada variável definida para o template
  for (const varConfig of template.variables) {
    const rawVal = rawVariables[varConfig.key];
    const hasValue = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';

    if (!hasValue) {
      if (varConfig.required) {
        appliedFallbacks.push({
          key: varConfig.key,
          original: rawVal,
          fallbackUsed: varConfig.fallback,
        });
      }
      hydratedVariables[varConfig.key] = varConfig.fallback;
    } else {
      const sanitized = varConfig.sanitizer
        ? varConfig.sanitizer(rawVal, varConfig.fallback)
        : String(rawVal).trim();
      hydratedVariables[varConfig.key] = sanitized;
    }
  }

  // Renderiza a mensagem substituindo {{key}}
  let renderedMessage = template.textTemplate;
  for (const [key, value] of Object.entries(hydratedVariables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    renderedMessage = renderedMessage.replace(regex, value);
  }

  // Formata componentes para o WhatsApp Graph API (se necessário)
  const metaParameters = template.variables.map((v) => ({
    type: 'text' as const,
    text: hydratedVariables[v.key] || v.fallback,
  }));

  return {
    isValid: true,
    templateId: template.id,
    templateName: template.name,
    renderedMessage,
    hydratedVariables,
    appliedFallbacks,
    warnings,
    metaComponents: [
      {
        type: 'body',
        parameters: metaParameters,
      },
    ],
  };
}

/**
 * Cria a URL do WhatsApp Web / click-to-chat já validada e codificada
 */
export function createValidatedWhatsAppUrl(
  phone: string,
  templateId: string,
  variables: Record<string, unknown>
): { url: string; validation: HydrateTemplateResult } {
  const validation = validateAndHydrateMessageTemplate(templateId, variables);
  const cleanPhone = sanitizePhone(phone, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(validation.renderedMessage)}`;
  return { url, validation };
}
