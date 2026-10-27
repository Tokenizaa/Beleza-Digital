import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { leadId, plano, billingPeriod, paymentMode } = req.query;

  // Validations
  if (!leadId) {
    return res.status(400).json({ erro: "ID do lead não informado" });
  }

  if (!plano) {
    return res.status(400).json({ erro: "Plano não informado" });
  }

  const planoValido = String(plano) as 'A' | 'B' | 'C';
  if (planoValido !== 'A' && planoValido !== 'B' && planoValido !== 'C') {
    return res.status(400).json({ erro: "Plano inválido. Use A, B ou C." });
  }

  // Validar billingPeriod se fornecido
  let billingPeriodValido: 'one-time' | 'monthly' | 'quarterly' | 'yearly' | undefined;
  if (billingPeriod) {
    const bp = String(billingPeriod).toLowerCase() as 'one-time' | 'monthly' | 'quarterly' | 'yearly';
    if (bp === 'one-time' || bp === 'monthly' || bp === 'quarterly' || bp === 'yearly') {
      billingPeriodValido = bp;
    }
  }

  // Validar paymentMode se fornecido (aplicável para Planos A e B)
  let paymentModeValido: 'code-download' | 'specialist-assistance' | 'one-time' | undefined;
  if (paymentMode) {
    const pm = String(paymentMode).toLowerCase() as 'code-download' | 'specialist-assistance' | 'one-time';
    if (pm === 'code-download' || pm === 'specialist-assistance' || pm === 'one-time') {
      paymentModeValido = pm;
    }
  }

  try {
    // 1. Buscar o lead
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return res.status(500).json({ erro: "URL do Supabase não configurada" });
    }

    const supabase = require('@supabase/supabase-js')
      .createClient(supabaseUrl, supabaseKey);

    const { data: lead, error: leadError } = await supabase
      .from('prospecting_candidates')
      .select('*')
      .eq('id', String(leadId))
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ erro: "Lead não encontrado" });
    }

    const now = new Date();

    // 2. Registrar a escolha do cliente
    const updateData: any = {
      plano_comercial: planoValido,
      data_escolha_plano: now,
      escolhido_por: 'cliente',
    };

    // Adicionar billing_period se válido (principal para Plano C)
    if (billingPeriodValido) {
      updateData.billing_period = billingPeriodValido;
    }

    // Adicionar payment_mode se válido (principal para Planos A e B)
    if (paymentModeValido) {
      updateData.payment_mode = paymentModeValido;
    }

    const { error: updateError } = await supabase
      .from('prospecting_candidates')
      .update(updateData)
      .eq('id', String(leadId));

    if (updateError) {
      console.error('❌ Erro ao atualizar plano:', updateError);
      return res.status(500).json({ erro: "Erro ao salvar escolha do plano", detalhe: updateError.message });
    }

    // 3. Lógica por Plano (Automação Mínima)
    let acao: string;
    let mensagem: string;

    switch (planoValido) {
      case 'A':
        // Plano A: Cliente tem domínio/hospedagem
        if (paymentModeValido === 'code-download') {
          // Option 1: Apenas download do código fonte
          await supabase
            .from('prospecting_candidates')
            .update({ status: 'entrega_codigo_pendente' })
            .eq('id', String(leadId));

          acao = 'entrega_codigo_pendente';
          mensagem = `Plano A escolhido (Code-Download). Código gerado para download. Status atualizado: entrega_codigo_pendente. Cliente pagou uma única vez para baixar o código-fonte e implantar em seu domínio.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        } else if (paymentModeValido === 'specialist-assistance') {
          // Option 2: Assistência especializada contínua
          await supabase
            .from('prospecting_candidates')
            .update({ status: 'assistencia_pendente' })
            .eq('id', String(leadId));

          acao = 'assistencia_pendente';
          mensagem = `Plano A escolhido (Specialist Assistance). Assistência especializada contratada. Status atualizado: assistencia_pendente. Cliente pagará recorrente por suporte especializado.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        } else {
          // Default: one-time (padrão)
          await supabase
            .from('prospecting_candidates')
            .update({ status: 'entrega_codigo_pendente' })
            .eq('id', String(leadId));

          acao = 'entrega_codigo_pendente';
          mensagem = `Plano A escolhido. Código gerado para download. Status atualizado: entrega_codigo_pendente. Cliente decidiu entregar código para implantar em seu domínio.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        }

      case 'B':
        // Plano B: Cliente quer controle / orientação
        if (paymentModeValido === 'code-download') {
          // Option 1: Apenas download da orientação/guia
          await supabase
            .from('prospecting_candidates')
            .update({ hospedagem_preferida: 'hostinger', status: 'orientacao_codigo_pendente' })
            .eq('id', String(leadId));

          acao = 'orientacao_codigo_pendente';
          mensagem = `Plano B escolhido (Code-Download). Orientação Hostinger salva. Status atualizado: orientacao_codigo_pendente. Cliente pagou uma única vez para receber o guia de configuração.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        } else if (paymentModeValido === 'specialist-assistance') {
          // Option 2: Assistência especializada contínua
          await supabase
            .from('prospecting_candidates')
            .update({ hospedagem_preferida: 'hostinger', status: 'assistencia_pendente' })
            .eq('id', String(leadId));

          acao = 'assistencia_pendente';
          mensagem = `Plano B escolhido (Specialist Assistance). Assistência Hostinger contratada. Status atualizado: assistencia_pendente. Cliente pagará recorrente por suporte especializado na configuração do Hostinger.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        } else {
          // Default: one-time
          await supabase
            .from('prospecting_candidates')
            .update({ hospedagem_preferida: 'hostinger', status: 'orientacao_hospedagem' })
            .eq('id', String(leadId));

          acao = 'orientacao_hospedagem';
          mensagem = `Plano B escolhido. Preferência de hospedagem Hostinger salva. Sistema fornecerá orientação de configuração. Cliente decidiu contratar hospedagem externa.`;

          return res.json({
            sucesso: true,
            mensagem,
            acao,
            plano: planoValido,
            paymentMode: paymentModeValido,
            billingPeriod: billingPeriodValido,
            escolhidoPor: 'cliente',
          });
        }

      case 'C':
        // Plano C: Hospedagem gerenciada pela plataforma
        const nomeLead = String(lead.business_name || 'lead').replace(/\s+/g, '-').toLowerCase() || 'lead';
        const dominio = `${nomeLead}.seublabelsite.com`;

        await supabase
          .from('prospecting_candidates')
          .update({
            dominio_plataforma: dominio,
            status: 'cliente_ativo',
          })
          .eq('id', String(leadId));

        // Tentar enviar email de boas-vindas (se houver email disponível)
        if (lead.email) {
          try {
            console.log(`📧 Email de boas-vindas seria enviado para ${lead.email} para o domínio ${dominio}`);
            // await enviarEmailBoasVindas(lead.email, dominio);
          } catch (emailError) {
            console.warn('⚠️ Falha ao preparar email de boas-vindas:', emailError);
          }
        }

        acao = 'publicacao_plataforma';
        mensagem = `Plano C escolhido. Site publicado no domínio ${dominio}. Status atualizado: cliente_ativo. Email de boas-vindas processado. Cliente escolheu hospedagem gerenciada pela plataforma.`;

        return res.json({
          sucesso: true,
          mensagem,
          acao,
          dominio,
          plano: planoValido,
          paymentMode: paymentModeValido,
          billingPeriod: billingPeriodValido,
          escolhidoPor: 'cliente',
        });
    }

    return res.status(500).json({ erro: "Plano não tratado" });

  } catch (error) {
    console.error('❌ Erro inesperado na rota definir-plano:', error);
    return res.status(500).json({ erro: "Erro interno do servidor", detalhe: error.message });
  }
}