import { useEffect, useState } from "react";
import { Check, Clock3, ExternalLink, LoaderCircle, ShieldAlert, ArrowRight, CreditCard, Sparkles, CheckCircle2 } from "lucide-react";
import { SharedSitePreview, type ShareableSitePreview } from "./SharedSitePreview";
import type { ServiceItem, ProductItem, MediaItem, MediaCategory } from "../types";

type DemoVersion = {
  id: string;
  version: number;
  generated_content: Record<string, unknown> | null;
  design_overrides: Record<string, unknown> | null;
  template_version_id: string;
  selected_by_prospect: boolean;
  template?: {
    id: string;
    config?: { layout?: string; sections?: string[]; theme?: { primary?: string; secondary?: string; surface?: string } };
    site_templates?: { slug?: string; name?: string; category?: string; preview_image_url?: string | null } | null;
  } | null;
};
type DemoData = { status: string; expiresAt: string; selectedVersionId: string | null; versions: DemoVersion[] };

const TEMPLATE_ID_BY_SLUG: Record<string, string> = {
  "ouro-classico": "ouro-classico",
  "preto-esmeralda": "preto-esmeralda",
  "minimal-studio": "minimal-studio",
  "safira-executivo": "safira-executivo",
  "rubi-lounge": "rubi-lounge",
  "modelo-inicial": "ouro-classico",
  minimal: "minimal-studio",
  bold: "preto-esmeralda",
  editorial: "rubi-lounge",
};
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function contentText(version: DemoVersion | null | undefined, keys: string[]) {
  const content = version?.generated_content ?? {};
  for (const key of keys) {
    const value = text(content[key]);
    if (value) return value;
  }
  return "";
}

function contentArray(version: DemoVersion | null | undefined, keys: string[]): unknown[] {
  const content = version?.generated_content ?? {};
  for (const key of keys) {
    if (Array.isArray(content[key]) && (content[key] as unknown[]).length > 0) {
      return content[key] as unknown[];
    }
  }
  return [];
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function firstText(value: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const found = text(value[key]);
    if (found) return found;
  }
  return "";
}
function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
const SAMPLE_SERVICES: ServiceItem[] = [
  { id: "sample-service-1", name: "Corte e finalização", description: "Corte personalizado com acabamento profissional.", price: 75, durationMinutes: 60, category: "Cabelo", featured: true },
  { id: "sample-service-2", name: "Escova modelada", description: "Modelagem e finalização para valorizar o seu estilo.", price: 65, durationMinutes: 50, category: "Cabelo", featured: true },
  { id: "sample-service-3", name: "Hidratação capilar", description: "Tratamento para devolver maciez, brilho e movimento aos fios.", price: 95, durationMinutes: 60, category: "Tratamentos", featured: false },
  { id: "sample-service-4", name: "Design de sobrancelhas", description: "Design personalizado respeitando o formato do rosto.", price: 45, durationMinutes: 30, category: "Estética", featured: false },
  { id: "sample-service-5", name: "Manicure", description: "Cuidados com as unhas e acabamento tradicional.", price: 40, durationMinutes: 45, category: "Unhas", featured: false },
  { id: "sample-service-6", name: "Maquiagem social", description: "Produção para eventos e ocasiões especiais.", price: 150, durationMinutes: 90, category: "Maquiagem", featured: false },
];
const SAMPLE_PRODUCTS: ProductItem[] = [
  { id: "sample-product-1", name: "Óleo nutritivo", description: "Finalizador ilustrativo para cuidado diário.", price: 49.9, mainImage: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80", additionalImages: [], available: true, category: "Cuidados", featured: true },
  { id: "sample-product-2", name: "Máscara de tratamento", description: "Produto demonstrativo para rotina de hidratação.", price: 69.9, mainImage: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80", additionalImages: [], available: true, category: "Tratamentos", featured: true },
  { id: "sample-product-3", name: "Sérum de beleza", description: "Exemplo de produto para apresentação da vitrine.", price: 59.9, mainImage: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80", additionalImages: [], available: true, category: "Cuidados", featured: false },
  { id: "sample-product-4", name: "Kit essencial", description: "Composição ilustrativa para demonstrar a área de produtos.", price: 89.9, mainImage: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=800&q=80", additionalImages: [], available: true, category: "Kits", featured: false },
];
const SAMPLE_GALLERY_URLS = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1000&q=80",
];
function demoServices(version: DemoVersion | null): ServiceItem[] {
  const mapped = contentArray(version, ["services", "services_attributes"]).map((entry, index) => {
    const item = asRecord(entry);
    return {
      id: firstText(item, ["id"]) || "demo-service-" + index,
      name: firstText(item, ["name", "service_name", "title"]),
      description: firstText(item, ["description", "desc"]),
      price: numberOrNull(item.price),
      durationMinutes: numberOrNull(item.durationMinutes ?? item.duration ?? item.duration_minutes),
      category: firstText(item, ["category", "type"]) || "Serviços",
      featured: Boolean(item.featured),
    };
  }).filter((item) => item.name);
  return mapped.length ? mapped : SAMPLE_SERVICES;
}
function demoProducts(version: DemoVersion | null): ProductItem[] {
  const mapped = contentArray(version, ["products", "featured_products"]).map((entry, index) => {
    const item = asRecord(entry);
    const mainImage = firstText(item, ["mainImage", "main_image", "imageUrl", "image_url", "image"]);
    return {
      id: firstText(item, ["id"]) || "demo-product-" + index,
      name: firstText(item, ["name", "title", "product_name"]),
      description: firstText(item, ["description", "desc"]),
      price: numberOrNull(item.price) ?? 0,
      mainImage,
      additionalImages: Array.isArray(item.additionalImages) ? item.additionalImages.filter((image): image is string => typeof image === "string") : [],
      available: item.available !== false,
      category: firstText(item, ["category", "type"]) || "Produtos",
      featured: Boolean(item.featured),
    };
  }).filter((item) => item.name && item.mainImage);
  return mapped.length ? mapped : SAMPLE_PRODUCTS;
}
function demoMedia(version: DemoVersion | null): MediaItem[] {
  const source = contentArray(version, ["media", "media_items", "portfolio"]);
  const photos = contentArray(version, ["photos"]).map((url) => ({ url, type: "image" }));
  const videos = contentArray(version, ["videos"]).map((url) => ({ url, type: "video" }));
  const entries = [...source, ...photos, ...videos];
  const categories: MediaCategory[] = ["Cílios", "Sobrancelhas", "Cabelos", "Unhas", "Barbearia", "Tranças", "Produtos", "Ambiente", "Outros"];
  const mapped = entries.map((entry, index) => {
    const item = asRecord(entry);
    const url = firstText(item, ["url", "imageUrl", "image_url", "src", "videoUrl", "video_url"]);
    const rawCategory = firstText(item, ["category", "type"]);
    return {
      id: firstText(item, ["id"]) || "demo-media-" + index,
      title: firstText(item, ["title", "name", "service_name"]) || "Trabalho " + (index + 1),
      type: item.type === "video" || Boolean(item.videoUrl || item.video_url) ? "video" as const : "image" as const,
      url,
      thumbnailUrl: firstText(item, ["thumbnailUrl", "thumbnail_url", "imageUrl", "image_url"]) || undefined,
      isReelVertical: Boolean(item.isReelVertical ?? item.is_reel_vertical),
      category: categories.includes(rawCategory as MediaCategory) ? rawCategory as MediaCategory : "Outros",
      dateAdded: firstText(item, ["dateAdded", "date_added", "created_at"]) || new Date().toISOString(),
      featured: Boolean(item.featured),
    };
  }).filter((item) => item.url);
  const unique = mapped.filter((item, index) => mapped.findIndex((candidate) => candidate.url === item.url) === index);
  if (unique.length) return unique;
  return SAMPLE_GALLERY_URLS.map((url, index) => ({ id: "sample-gallery-" + index, title: "Trabalho demonstrativo " + (index + 1), type: "image" as const, url, thumbnailUrl: url, isReelVertical: false, category: "Outros" as MediaCategory, dateAdded: new Date().toISOString(), featured: index < 3 }));
}
export function PublicDemoSelectionPage({ token }: { token: string }) {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [contractStarting, setContractStarting] = useState(false);
  const [contractError, setContractError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/demos/${encodeURIComponent(token)}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as demonstrações.");
        return body as DemoData;
      })
      .then((body) => {
        if (!active) return;
        if (!body.versions || body.versions.length === 0) {
          setError("Esta demonstração ainda não possui versões geradas a partir dos dados coletados.");
          return;
        }
        setData(body);
        setSelected(body.selectedVersionId);
        const sortedByVersion = (body.versions ?? []).slice().sort((a, b) => b.version - a.version);
        setActivePreviewId(body.selectedVersionId ?? sortedByVersion[0]?.id ?? body.versions[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar esta demonstração. Tente novamente mais tarde.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function chooseVersion(versionId: string) {
    setSaving(versionId);
    setError("");
    setSuccess(false);
    try {
      const response = await fetch(`/api/demos/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar a escolha.");
      setSelected(versionId);
      setActivePreviewId(versionId);
      setSuccess(true);
      setData((current) => current ? {
        ...current, status: "selected", selectedVersionId: versionId,
        versions: current.versions.map((version) => ({ ...version, selected_by_prospect: version.id === versionId })),
      } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao registrar a escolha.");
    } finally { setSaving(null); }
  }

  async function startContract() {
    // A contratação sempre usa a escolha persistida, nunca apenas a prévia aberta.
    const versionId = selected || data?.selectedVersionId;
    if (!versionId) {
      setContractError("Selecione uma versão antes de contratar.");
      return;
    }
    if (activePreviewId !== versionId) {
      setContractError("A prévia aberta não é a versão selecionada. Selecione este modelo antes de continuar.");
      return;
    }
    setContractStarting(true);
    setContractError("");
    try {
      const response = await fetch(`/api/onboarding/start-contract`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ demoToken: token, selectedVersionId: versionId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível iniciar a contratação.");

      if (body.nextStep === 'signup') {
        // Redirect to signup page with demo context in URL params
        const params = new URLSearchParams({
          mode: 'signup',
          demoToken: body.demoToken,
          versionId: body.selectedVersionId || '',
        });
        window.location.href = `/plataforma/acesso?${params.toString()}`;
      } else if (body.nextStep === 'checkout') {
        // Redirect to plan selection (will be implemented)
        const params = new URLSearchParams({
          establishment_id: body.establishmentId,
          prospect_id: body.prospectId,
        });
        window.location.href = `/plataforma/acesso?mode=plan_selection&${params.toString()}`;
      } else if (body.nextStep === 'dashboard') {
        // Already active, redirect to salon dashboard
        window.location.href = `/admin?establishment=${body.establishmentSlug}`;
      }
    } catch (reason) {
      setContractError(reason instanceof Error ? reason.message : "Falha ao iniciar a contratação.");
    } finally { setContractStarting(false); }
  }

  if (loading) return <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-6"><LoaderCircle className="animate-spin" /><span className="sr-only">Carregando demonstrações</span></main>;

  if (!data) return <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-6"><div className="max-w-lg text-center"><ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-400" /><h1 className="text-xl font-semibold">Demonstração indisponível</h1><p className="mt-3 text-sm text-neutral-400">{error || "Não existem versões reais disponíveis para este link."}</p></div></main>;

  const effectiveData: DemoData = data;
  const expires = effectiveData?.expiresAt ? new Date(effectiveData.expiresAt).toLocaleDateString("pt-BR") : "";
  const sortedVersions = (effectiveData?.versions ?? []).slice().sort((a, b) => b.version - a.version);
  const activeVersion = effectiveData?.versions?.find((version) => version.id === activePreviewId) ?? sortedVersions[0] ?? null;
  const activeContent = activeVersion?.generated_content ?? {};
  const templateSlug = activeVersion?.template?.site_templates?.slug ?? "ouro-classico";
  const contact = asRecord(activeContent.contact);
  const businessName = contentText(activeVersion, ["businessName", "business_name", "title", "name", "brandName"]) || "Estabelecimento";
  const category = contentText(activeVersion, ["category", "business_category", "segment"]);
  const phone = contentText(activeVersion, ["phone", "normalized_phone", "phone_number"]) || firstText(contact, ["phone"]);
  const address = [
    contentText(activeVersion, ["address", "formatted_address"]) || firstText(contact, ["address"]),
    contentText(activeVersion, ["city", "locality"]) || firstText(contact, ["city"]),
    contentText(activeVersion, ["region", "state", "province"]) || firstText(contact, ["region"]),
  ].filter(Boolean).join(" · ");
  const preview: ShareableSitePreview | null = activeVersion ? {
    version: 1,
    businessName,
    category,
    description: contentText(activeVersion, ["description", "about", "subtitle", "summary"]),
    phone,
    email: contentText(activeVersion, ["email", "email_address"]) || firstText(contact, ["email"]),
    address,
    websiteUrl: contentText(activeVersion, ["website", "website_url", "url"]),
    instagramHandle: contentText(activeVersion, ["instagramHandle", "instagram_handle"]),
    instagramUrl: contentText(activeVersion, ["instagramUrl", "instagram_url"]),
    googleMapsUrl: text(activeContent.googleMapsUrl) || text(activeContent.sourceUrl),
    latitude: numberOrNull(activeContent.latitude),
    longitude: numberOrNull(activeContent.longitude),
    templateId: TEMPLATE_ID_BY_SLUG[templateSlug] ?? "ouro-classico",
    templateName: activeVersion.template?.site_templates?.name || "Modelo inicial",
    projectVersion: activeVersion.version,
    generatedAt: text(activeContent.generatedAt) || new Date().toISOString(),
    isSampleContent: !contentArray(activeVersion, ["services", "services_attributes"]).length || !contentArray(activeVersion, ["products", "featured_products"]).length || !contentArray(activeVersion, ["media", "media_items", "portfolio", "photos", "videos"]).length || !contentText(activeVersion, ["instagramUrl", "instagram_url"]),
    status: contentText(activeVersion, ["status", "estado", "status_operacional"]),
    note: contentText(activeVersion, ["note", "observacao", "avaliacao_geral"]) || (numberOrNull(activeContent.rating) !== null ? String(numberOrNull(activeContent.rating)) + "/5 no Google Maps" : ""),
    ["quantidade-de-avaliacoes"]: contentText(activeVersion, ["quantidade_de_avaliacoes", "reviews_count", "qtd_avaliacoes"]) || (numberOrNull(activeContent.reviewCount) !== null ? String(numberOrNull(activeContent.reviewCount)) : ""),
    ["faixa-de-preco"]: contentText(activeVersion, ["faixa_de_preco", "price_range", "faixa_preco"]) || text(activeContent.priceRange),
    horario: contentText(activeVersion, ["horario", "horario_funcionamento", "horario_atendimento"]) || text(activeContent.openingHours),
    services: demoServices(activeVersion),
    products: demoProducts(activeVersion),
    media: demoMedia(activeVersion),
  } : null;
  const hasSelection = selected !== null || data?.selectedVersionId !== null;
  const versionToContract = selected || data?.selectedVersionId || null;
  const previewMatchesSelection = Boolean(versionToContract && activeVersion?.id === versionToContract);

  return <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
    <header className="border-b border-neutral-800 px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-400">Demonstração personalizada</p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{businessName}</h1>
          <p className="mt-0.5 text-sm text-neutral-400">{category} · {address}</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-neutral-400 sm:flex"><Clock3 className="h-4 w-4" /> Disponível até {expires}</div>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12 flex-1">
      {/* Commercial pitch section */}
      <div className="mb-8 p-6 rounded-2xl border border-purple-500/20 bg-purple-950/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-purple-600/30 flex items-center justify-center"><Sparkles className="h-5 w-5 text-purple-400" /></div>
          <div>
            <h2 className="text-lg font-semibold text-white">Pronto para colocar seu negócio online?</h2>
            <p className="text-sm text-neutral-400">Esta demonstração foi preparada especialmente para {businessName}. Escolha o modelo ideal e inicie sua presença digital profissional hoje mesmo.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-neutral-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Site responsivo e otimizado para mobile</div>
          <div className="flex items-center gap-2 text-neutral-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Agendamento online integrado</div>
          <div className="flex items-center gap-2 text-neutral-300"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> WhatsApp Business configurado</div>
        </div>
      </div>

      {success && <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200"><Check className="h-5 w-5" /> Sua escolha foi registrada. A equipe poderá continuar com a versão selecionada.</div>}
      {error && <div role="alert" className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
      {contractError && <div role="alert" className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{contractError}</div>}

      {!data?.versions?.length ? <div className="mt-8 rounded-2xl border border-neutral-800 p-8 text-center text-neutral-400">Ainda não há versões disponíveis nesta demonstração.</div> :
        <>
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3">Versões disponíveis</h3>
            <div className="flex flex-wrap gap-2" aria-label="Versões disponíveis">
              {data.versions.map((version) => <button key={version.id} type="button" onClick={() => setActivePreviewId(version.id)} aria-pressed={activeVersion?.id === version.id} className={`rounded-lg border px-4 py-2 text-sm transition ${activeVersion?.id === version.id ? "border-emerald-600 bg-emerald-950/40 text-emerald-200" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"}`}>
                {version.template?.site_templates?.name || "Modelo"} · v{version.version}{(selected === version.id || version.selected_by_prospect) ? " · Selecionada" : ""}
              </button>)}
            </div>
          </div>
          {preview && <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-800 bg-white">
            <SharedSitePreview preview={preview} />
            <div className="border-t border-neutral-200 p-4 sm:p-6 space-y-3">
              <button disabled={saving !== null || selected === activeVersion?.id} onClick={() => activeVersion && void chooseVersion(activeVersion.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
                {saving === activeVersion?.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : selected === activeVersion?.id ? <Check className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {saving === activeVersion?.id ? "Registrando escolha..." : selected === activeVersion?.id ? "Esta versão já foi selecionada" : "Selecionar esta versão"}
              </button>
              {/* Contratar button */}
              <button
                disabled={contractStarting || !versionToContract || !previewMatchesSelection || saving !== null}
                onClick={startContract}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {contractStarting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {contractStarting ? "Iniciando contratação..." : !versionToContract ? "Selecione um modelo para continuar" : !previewMatchesSelection ? "Selecione este modelo para contratar" : "Contratar versão selecionada"}
              </button>
            </div>
          </div>}
        </> }
    </section>
    <footer className="border-t border-neutral-800 px-5 py-6 text-center text-xs text-neutral-600">Link privado da demonstração · não compartilhe publicamente</footer>
  </main>;
}
