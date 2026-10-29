-- Idempotência: impede versões duplicadas para o mesmo (site_project_id, template_version_id)
-- Garante que o Worker nunca gere duas versões do mesmo template para um mesmo projeto de demo.
create unique index if not exists site_project_versions_site_project_template_unique
  on public.site_project_versions (site_project_id, template_version_id);
