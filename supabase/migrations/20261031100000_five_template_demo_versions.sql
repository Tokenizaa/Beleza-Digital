-- Permit one version per template for each generation task.
begin;
DROP INDEX IF EXISTS public.site_project_versions_generation_task_unique;
CREATE UNIQUE INDEX IF NOT EXISTS site_project_versions_generation_template_unique ON public.site_project_versions (generation_task_id, template_version_id) WHERE generation_task_id IS NOT NULL;
commit;
