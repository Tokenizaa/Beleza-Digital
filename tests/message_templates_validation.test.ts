import {
  OUTREACH_TEMPLATES,
  validateAndHydrateMessageTemplate,
  createValidatedWhatsAppUrl,
} from '../src/lib/message-templates';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${label}`);
    failed++;
  }
}

console.log('====================================================');
console.log('SUÍTE DE TESTES — VALIDAÇÃO DE TEMPLATES DE MENSAGEM');
console.log('====================================================\n');

// 1. Validação de existência de templates
{
  assert(Boolean(OUTREACH_TEMPLATES.PROPOSTA_5_MODELOS), 'Template PROPOSTA_5_MODELOS existe no catálogo');
  assert(Boolean(OUTREACH_TEMPLATES.DIAGNOSTICO_DIGITAL_SEM_SITE), 'Template DIAGNOSTICO_DIGITAL_SEM_SITE existe no catálogo');
  assert(Boolean(OUTREACH_TEMPLATES.AGENDAMENTO_24H), 'Template AGENDAMENTO_24H existe no catálogo');
  assert(Boolean(OUTREACH_TEMPLATES.FOLLOW_UP_FEEDBACK), 'Template FOLLOW_UP_FEEDBACK existe no catálogo');
}

// 2. Hidratação com variáveis completas
{
  const result = validateAndHydrateMessageTemplate('PROPOSTA_5_MODELOS', {
    cliente_nome: 'Barbearia Navalha de Ouro',
    servico_destaque: 'cortes masculinos e barboterapia',
    link_proposta: 'https://belezadigital.com.br/demo/demo-123',
    reputacao_sufixo: 'nota 4.9 ⭐ com 150 avaliações no Maps',
  });

  assert(result.isValid === true, 'Validação é bem sucedida para template completo');
  assert(result.appliedFallbacks.length === 0, 'Nenhum fallback acionado quando variáveis estão presentes');
  assert(result.renderedMessage.includes('Barbearia Navalha de Ouro'), 'Renderiza nome do cliente corretamente');
  assert(result.renderedMessage.includes('cortes masculinos e barboterapia'), 'Renderiza serviço corretamente');
  assert(result.renderedMessage.includes('https://belezadigital.com.br/demo/demo-123'), 'Renderiza link da proposta corretamente');
  assert(!result.renderedMessage.includes('{{'), 'Não deixa tags brutas na mensagem final');
}

// 3. Acionamento de Fallbacks Inteligentes quando variáveis estão vazias
{
  const result = validateAndHydrateMessageTemplate('PROPOSTA_5_MODELOS', {
    cliente_nome: '', // Vazio!
    servico_destaque: null, // Nulo!
    link_proposta: undefined, // Indefinido!
  });

  assert(result.isValid === true, 'Mantém validade aplicando fallbacks elegantes');
  assert(result.appliedFallbacks.length === 3, 'Identifica as 3 variáveis obrigatórias faltantes');
  assert(result.renderedMessage.includes('seu estabelecimento'), 'Aplica fallback inteligente para nome do cliente');
  assert(result.renderedMessage.includes('beleza, estética e barbearia'), 'Aplica fallback inteligente para serviço');
  assert(!result.renderedMessage.includes('https://belezadigital.com.br/demo'), 'Não inventa URL pública quando ainda não existe demonstração publicada');
  assert(!result.renderedMessage.includes('{{') && !result.renderedMessage.includes('undefined'), 'Garante ausência de {{tags}} ou texto undefined');
}

// 4. Fallback quando template inexistente é solicitado
{
  const result = validateAndHydrateMessageTemplate('TEMPLATE_INEXISTENTE_XYZ', {
    cliente_nome: 'Studio VIP',
    servico_destaque: 'Design de Sobrancelhas',
    link_proposta: 'https://belezadigital.com.br/demo/vip',
  });

  assert(result.isValid === true, 'Não quebra com template inexistente');
  assert(result.templateId === 'PROPOSTA_5_MODELOS', 'Recai com segurança para o template oficial padrão');
  assert(result.warnings.length > 0, 'Registra warning explicativo');
}

// 5. Geração de URL do WhatsApp formatada e segura
{
  const { url, validation } = createValidatedWhatsAppUrl(
    '(51) 99345-6789',
    'AGENDAMENTO_24H',
    {
      cliente_nome: 'Salão Glamour',
      servico_destaque: 'coloração e mechas',
      link_proposta: 'https://belezadigital.com.br/demo/glamour',
    }
  );

  assert(url.startsWith('https://wa.me/5551993456789?text='), 'Formata telefone no padrão internacional sem caracteres não numéricos');
  assert(url.includes(encodeURIComponent('Salão Glamour')), 'Codifica mensagem URL com segurança');
  assert(validation.appliedFallbacks.length === 0, 'Validação confirmada na geração da URL');
}

console.log('\n====================================================');
console.log(`RESULTADO VALIDAÇÃO DE TEMPLATES: ${passed} PASSOU / ${failed} FALHOU`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
