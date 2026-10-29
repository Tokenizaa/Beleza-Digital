interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}
type Context = { request: Request; env: Env };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function api(env: Env, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('content-type', 'application/json');
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(8000) });
}

async function validateDemoToken(env: Env, token: string): Promise<{ ok: true; link: any; prospect: any; siteProject: any; selectedVersion: any } | { ok: false; error: string; status: number }> {
  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  // Find demo link
  const linkResponse = await api(env, `site_demo_public_links?token_hash=eq.${tokenHash}&status=in.(active,selected)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,site_project_id,status,expires_at,selected_version_id&limit=1`);
  if (!linkResponse.ok) return { ok: false, error: 'Falha ao consultar link de demonstração.', status: 503 };
  const links = await linkResponse.json() as Array<any>;
  if (!links.length) return { ok: false, error: 'Link de demonstração não encontrado ou expirado.', status: 404 };
  const link = links[0];

  // Get site project and prospect
  const projectResponse = await api(env, `site_projects?id=eq.${encodeURIComponent(link.site_project_id)}&select=id,prospect_id,establishment_id,template_version_id,generated_content,design_overrides,status&limit=1`);
  if (!projectResponse.ok) return { ok: false, error: 'Falha ao consultar projeto de demonstração.', status: 503 };
  const projects = await projectResponse.json() as Array<any>;
  if (!projects.length) return { ok: false, error: 'Projeto de demonstração não encontrado.', status: 404 };
  const siteProject = projects[0];

  if (!siteProject.prospect_id) return { ok: false, error: 'Demonstração não vinculada a um prospect.', status: 400 };

  const prospectResponse = await api(env, `prospects?id=eq.${encodeURIComponent(siteProject.prospect_id)}&select=id,business_name,normalized_phone,normalized_website,email,dedupe_key,converted_establishment_id,qualification_score,qualification_reasons,source_captured_at&limit=1`);
  if (!prospectResponse.ok) return { ok: false, error: 'Falha ao consultar prospect.', status: 503 };
  const prospects = await prospectResponse.json() as Array<any>;
  if (!prospects.length) return { ok: false, error: 'Prospect não encontrado.', status: 404 };
  const prospect = prospects[0];

  // Get selected version if any
  let selectedVersion = null;
  if (link.selected_version_id) {
    const versionResponse = await api(env, `site_project_versions?id=eq.${encodeURIComponent(link.selected_version_id)}&site_project_id=eq.${encodeURIComponent(link.site_project_id)}&select=id,version,template_version_id,generated_content,design_overrides,selected_by_prospect,selection_source&limit=1`);
    if (versionResponse.ok) {
      const versions = await versionResponse.json() as Array<any>;
      if (versions.length) selectedVersion = versions[0];
    }
  }

  return { ok: true, link, prospect, siteProject, selectedVersion };
}

export async function onRequestPost({ request, env }: Context) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_PUBLISHABLE_KEY) {
    return json({ error: 'Integração de onboarding não configurada no servidor.' }, 503);
  }

  let body: { demoToken?: string; selectedVersionId?: string };
  try { body = await request.json() as { demoToken?: string; selectedVersionId?: string }; }
  catch { return json({ error: 'Corpo JSON inválido.' }, 400); }

  if (!body.demoToken || !/^[A-Za-z0-9_-]{40,100}$/.test(body.demoToken)) {
    return json({ error: 'Token de demonstração inválido.' }, 400);
  }

  // Validate demo token and get context
  const demoValidation = await validateDemoToken(env, body.demoToken);
  if (!demoValidation.ok) {
    return json({ error: demoValidation.error }, demoValidation.status);
  }

  const { prospect, siteProject, selectedVersion, link } = demoValidation;

  // Check if prospect already converted
  if (prospect.converted_establishment_id) {
    // Check establishment billing status
    const estResponse = await api(env, `establishments?id=eq.${encodeURIComponent(prospect.converted_establishment_id)}&select=id,name,slug,status,billing_status&limit=1`);
    if (!estResponse.ok) return json({ error: 'Falha ao consultar estabelecimento.' }, 503);
    const establishments = await estResponse.json() as Array<any>;
    if (!establishments.length) return json({ error: 'Estabelecimento convertido não encontrado.' }, 404 );
    const establishment = establishments[0];

    return json({
      nextStep: establishment.billing_status === 'active' ? 'dashboard' : 'checkout',
      establishmentId: establishment.id,
      prospectId: prospect.id,
      establishmentName: establishment.name,
      establishmentSlug: establishment.slug,
      billingStatus: establishment.billing_status,
      message: establishment.billing_status === 'active'
        ? 'Este lead já foi convertido. O estabelecimento está ativo.'
        : 'Este lead já foi convertido. O pagamento está pendente.',
    }, 200);
  }

  // A contratação só prossegue com a versão já selecionada e persistida no
  // link da demonstração (site_demo_public_links.selected_version_id). Um ID de
  // versão enviado pelo cliente não pode substituir nem divergir da escolha
  // persistida; isso evita contratação de versão de outro projeto ou de uma
  // prévia aberta que não foi confirmada.
  const persistedVersionId = link.selected_version_id ?? null;
  if (body.selectedVersionId !== undefined && body.selectedVersionId !== null && body.selectedVersionId !== persistedVersionId) {
    return json({
      error: 'A versão informada diverge da escolha registrada no link da demonstração.',
      status: 'conflict',
      expectedVersionId: persistedVersionId,
    }, 409);
  }

  if (!persistedVersionId) {
    return json({
      error: 'Nenhuma versão de modelo foi selecionada para esta demonstração.',
      status: 'selection_required',
      siteProjectId: siteProject.id,
    }, 409);
  }

  // Confirma que a versão persistida pertence ao projeto da demonstração
  // (defesa em profundidade: a RPC select_public_demo_version já impõe isso,
  // mas o endpoint de contratação não deve confiar cegamente no navegador).
  const versionMembership = await api(env, `site_project_versions?id=eq.${encodeURIComponent(persistedVersionId)}&select=id,site_project_id,template_version_id&limit=1`);
  if (!versionMembership.ok) {
    return json({ error: 'Falha ao validar a versão selecionada.' }, 503);
  }
  const membershipRows = await versionMembership.json() as Array<{ id: string; site_project_id: string; template_version_id: string }>;
  if (!membershipRows.length || membershipRows[0].site_project_id !== siteProject.id) {
    return json({ error: 'A versão selecionada não pertence ao projeto desta demonstração.' }, 409);
  }

  const versionId = persistedVersionId;

  return json({
    nextStep: 'signup',
    prospectId: prospect.id,
    prospectName: prospect.business_name,
    demoToken: body.demoToken,
    demoTokenHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.demoToken))), b => b.toString(16).padStart(2, '0')).join(''),
    selectedVersionId: versionId,
    siteProjectId: siteProject.id,
    templateVersionId: membershipRows.length ? membershipRows[0].template_version_id : null,
    message: 'Prossiga para o cadastro. O contexto da demonstração será preservado.',
  }, 200);
}

export async function onRequestGet() {
  return json({ error: 'Método não permitido. Use POST.' }, 405);
}