/**
 * Lead Qualification & Demo Generation Processor (Versão Atualizada)
 * 
 * Critérios de elegibilidade atualizados:
 - Completeness Score (0 a 65): nome(20) + categoria(10) + telefone(20) + endereço(10) + fonte(5)
 - Website NÃO conta para a completude, mas é um sinal de oportunidade separado
 - Elegibilidade para demonstração: completude >= 50 (pode ser sem website)
 - Dados incompletos (completeness < 50) ficam qualificados mas sem demonstração automática
 */

const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ifkqrtjhdnolkuucgbpb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funções de normalização (cópia do src/lib/prospecting.ts)
function normalizeBusinessName(value) {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeWebsite(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return null;
  }
}

function normalizePhone(value, countryCode = 'BR') {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (countryCode.toUpperCase() === 'BR' && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }
  return digits;
}

// NEW: qualifyProsport with completeness score 0-65 and separate opportunity signals
function qualifyProspect(input) {
  const reasons = [];
  const missingFields = [];
  let completenessScore = 0; // 0 a 65

  const evidence = {
    businessName: input.businessName,
    category: input.category,
    websiteUrl: input.websiteUrl,
    phone: input.phone,
    email: input.email,
    address: input.address,
    description: input.description,
    sourceUrl: input.sourceUrl,
    countryCode: input.countryCode,
  };

  // Completude de dados: 0 a 65 pts
  // nome(20) + categoria(10) + telefone(20) + endereço(10) + fonte/url(5)
  const namePresent = Boolean(normalizeBusinessName(input.businessName));
  const categoryPresent = Boolean(input.category?.trim());
  const phoneValid = Boolean(normalizePhone(input.phone, input.countryCode || 'BR'));
  const addressPresent = Boolean(input.address?.trim());
  const sourceValid = Boolean(normalizeWebsite(input.sourceUrl));

  if (namePresent) { completenessScore += 20; reasons.push('+20: nome comercial identificado'); }
  else { missingFields.push('businessName'); reasons.push('0: nome comercial ausente; nome comercial identificado'); }

  if (categoryPresent) { completenessScore += 10; reasons.push('+10: categoria identificada'); }
  else { missingFields.push('category'); reasons.push('0: categoria ausente; categoria identificada'); }

  if (phoneValid) { completenessScore += 20; reasons.push('+20: telefone em formato válido'); }
  else { missingFields.push('phone'); reasons.push('0: telefone ausente; telefone em formato válido'); }

  if (addressPresent) { completenessScore += 10; reasons.push('+10: endereço disponível'); }
  else { missingFields.push('address'); reasons.push('0: endereço ausente; endereço disponível'); }

  if (sourceValid) { completenessScore += 5; reasons.push('+5: origem pública registrada'); }
  else { missingFields.push('sourceUrl'); reasons.push('0: origem pública registrada'); }

  // Sinais de oportunidade comercial (SEPARADOS da completude)
  const websiteIdentified = Boolean(input.websiteUrl && /^https?:\/\//i.test(input.websiteUrl));
  const websiteAccessible = false; // será preenchido pela inspeção Playwright se houver website
  const hasRating = Boolean(input.evidence?.rating !== undefined && input.evidence?.rating !== null);
  const hasReviews = Boolean(input.evidence?.reviews !== undefined && input.evidence?.reviews !== null);

  // State de inspeção do website
  let inspectionState;
  if (!input.websiteUrl) {
    inspectionState = 'no_website';
  } else if (!/^https?:\/\//i.test(input.websiteUrl)) {
    inspectionState = 'inconclusive';
  } else {
    inspectionState = 'website_identified';
  }

  // Elegibilidade para demonstração: completude >= 50
  const isEligibleForDemo = completenessScore >= 50;

  let nextAction;
  if (completenessScore >= 80) {
    nextAction = 'solicitar demonstração';
  } else if (completenessScore >= 50) {
    nextAction = 'completar dados e solicitar demonstração';
  } else if (completenessScore > 0) {
    nextAction = 'qualificar dados e reavaliar';
  } else {
    nextAction = 'coletar dados mínimos antes de qualificar';
  }

  const collectedAt = new Date().toISOString();

  return {
    score: completenessScore, // 0 a 65 — usado para elegibilidade
    completenessScore,
    opportunitySignals: {
      websiteIdentified,
      websiteAccessible,
      hasRating,
      hasReviews,
    },
    isEligibleForDemo,
    inspectionState,
    nextAction,
    collectedAt,
    reasons,
    missingFields,
  };
}

// Main processor
async function main() {
  console.log('=== Lead Qualification & Demo Generation Processor ===');
  console.log('');

  // 1. Fetch all prospecting_candidates that need qualification
  // Filter: no qualification score, or status discovered/collected
  const { data: allCandidates, error: fetchError } = await supabase
    .from('prospecting_candidates')
    .select(`
      id, business_name, category, website_url, normalized_website, 
      qualification_score, status, source_url, raw_evidence, 
      phone, email, address, description, city, region, country_code,
      dedupe_key, created_at
    `)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Erro ao buscar candidatos:', fetchError);
    process.exit(1);
  }

  // Re-process ALL candidates with new qualification logic (0-65 completeness score)
  // This ensures consistency across the board, even candidates already scored
  // will be re-evaluated under the new criteria
  const candidates = allCandidates || [];
  if (!candidates || candidates.length === 0) {
    console.log('Nenhum candidato encontrado para qualificação.');
    process.exit(0);
  }
  console.log(`Encontrados ${candidates.length} candidatos para processamento (re-avaliação com nova lógica de completude 0-65).`);

  if (!candidates || candidates.length === 0) {
    console.log('Nenhum candidato encontrado para qualificação.');
    process.exit(0);
  }

  console.log(`Encontrados ${candidates.length} candidatos para processamento.`);
  console.log('');

  // 2. Process each candidate
  for (const candidate of candidates) {
    const id = candidate.id;
    console.log(`--- Processando ${id}: ${candidate.business_name} ---`);

    // Always re-qualify with new logic, regardless of existing score
    // This ensures consistency with updated completeness 0-65 criteria
    const hasExistingScore = candidate.qualification_score !== null && candidate.qualification_score > 0;
    if (hasExistingScore) {
      console.log('Score existente detectado (' + candidate.qualification_score + '), re-avaliando com nova lógica...');
    }

    // Apply new qualification logic
    const qualification = qualifyProspect({
      businessName: candidate.business_name,
      category: candidate.category,
      websiteUrl: candidate.website_url,
      phone: candidate.phone,
      email: candidate.email,
      address: candidate.address,
      description: candidate.description,
      sourceUrl: candidate.source_url,
      countryCode: candidate.country_code || 'BR',
    });

    console.log('Score (completude 0-65): ' + qualification.completenessScore);
    const reasonsStr = qualification.reasons ? qualification.reasons.join('; ') : 'nenhum motivo';
    console.log('Elegivel para demonstracao (completeness >= 50): ' + qualification.isEligibleForDemo);
    console.log('Razoes: ' + reasonsStr);
    const missingStr = qualification.missingFields ? qualification.missingFields.join(', ') : 'nenhum campo';
    console.log('Fields missing: ' + missingStr);

    // Update the candidate in the database
    await supabase
      .from('prospecting_candidates')
      .update({ 
        qualification_score: qualification.completenessScore,
        qualification_reasons: qualification.reasons,
        missing_fields: qualification.missingFields,
        inspection_state: qualification.inspectionState,
        status: 'qualified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.log('Qualificacao atualizada: status=qualified, score=' + qualification.completenessScore);

    // If eligible for demo, promote to site_project and generate demo
    if (qualification.isEligibleForDemo && qualification.completenessScore >= 50) {
      console.log('Score >= 50, promovendo para demonstracao...');

      // Template selection based on category
      const catLower = (candidate.category || '').toLowerCase();
      let templateKey;
      if (/cabeleireiro|estetica|spa|beauty/i.test(catLower)) {
        templateKey = 'minimal-studio';
      } else if (/barbearia|barbeiro/i.test(catLower)) {
        templateKey = 'ouro-classico';
      } else {
        templateKey = 'ouro-classico';
      }

      // Try to find existing site_project for this prospect
      const { data: existingProject } = await supabase
        .from('site_projects')
        .select('id, name, status, template_version_id')
        .or(`prospect_id.eq.${id},establishment_id.is.null`)
        .maybeSingle();

      if (existingProject) {
        console.log('Projeto ja existe: ' + existingProject.id);
        // Update if needed
        if (existingProject.status !== 'demo_pending' && existingProject.status !== 'demo_ready') {
          await supabase
            .from('site_projects')
            .update({ 
              status: 'demo_ready',
              template_version_id: templateKey,
            })
            .eq('id', existingProject.id);
          console.log('Projeto atualizado para demo_ready');
        }
      } else {
        // Create new site_project (simplified - would need full setup)
        console.log('Nao e possivel criar projeto automaticamente sem templates configurados no Supabase.');
        console.log('Isso requer configuração de site_templates e site_project_versions.');
      }

      console.log('Candidate ' + id + ' elegivel para demonstracao (completude: ' + qualification.completenessScore + ')');
    } else if (qualification.completenessScore < 50) {
      console.log('Score ' + qualification.completenessScore + ' < 50, candidate elegivel mas sem demonstracao automatica.');
      console.log('Awaiting data capture improvement for: ' + qualification.missingFields.join(', '));
    }

    console.log('');
  }

  console.log('=== Processo Concluido ===');
  console.log('Candidates processados: ' + candidates.length);
  console.log('Nenhum dado novo foi inventado; apenas os campos persistidos foram reavaliados.');
  console.log('Para candidatos com completeness < 50: nova coleta de dados necessaria para elegibilidade.');
  console.log('Para candidatos com completeness >= 50: demostracao pode ser gerada com dados verificados.');
}

main().catch(err => {
  console.error('Erro fatal no processador:', err);
  process.exit(1);
});