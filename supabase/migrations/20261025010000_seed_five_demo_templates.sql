-- Keep the five front-end demo templates available to the persisted site builder.
-- Legacy slugs remain untouched for previously generated public demos.
begin;

with templates(slug, name, category, description) as (
  values
    ('ouro-classico', 'Ouro & Âmbar Clássico', 'Barbearia premium', 'Identidade clássica e premium em tons de ouro e âmbar.'),
    ('preto-esmeralda', 'Preto Fosco & Esmeralda', 'Barbearia urbana', 'Visual urbano de alto contraste com acento esmeralda.'),
    ('minimal-studio', 'Minimal Studio & Platina', 'Salão e estética', 'Design limpo e arejado para salões e clínicas de estética.'),
    ('safira-executivo', 'Safira Real Executivo', 'Executivo premium', 'Visual executivo em azul profundo.'),
    ('rubi-lounge', 'Rubi & Vinho Lounge', 'Salão lounge', 'Visual editorial em tons bordô e rubi.')
)
insert into public.site_templates (slug, name, category, description, is_active)
select slug, name, category, description, true
from templates
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  is_active = true,
  updated_at = now();

with template_configs(slug, primary_color, secondary_color, surface_color, text_color) as (
  values
    ('ouro-classico', '#C8A96A', '#171717', '#0B0B0B', '#F5F1E8'),
    ('preto-esmeralda', '#10B981', '#111827', '#09090B', '#F5F5F5'),
    ('minimal-studio', '#B8A99A', '#F3F0EB', '#FFFFFF', '#1F2937'),
    ('safira-executivo', '#2563EB', '#0F172A', '#020617', '#F8FAFC'),
    ('rubi-lounge', '#9F1239', '#4C0519', '#1C0A10', '#FFF1F2')
)
insert into public.site_template_versions (template_id, version, is_published, config, created_at)
select
  t.id,
  1,
  true,
  jsonb_build_object(
    'layout', 'responsive_single_page',
    'sections', jsonb_build_array('hero', 'services', 'appointment_cta', 'gallery', 'contact'),
    'theme', jsonb_build_object(
      'primary', c.primary_color,
      'secondary', c.secondary_color,
      'surface', c.surface_color,
      'text', c.text_color
    )
  ),
  now()
from template_configs c
join public.site_templates t on t.slug = c.slug
on conflict (template_id, version) do update set
  is_published = excluded.is_published,
  config = excluded.config;

commit;
