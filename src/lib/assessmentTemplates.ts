import { supabase } from './supabaseClient';
import {
  isAssessmentTemplateSchema,
  type AssessmentTemplate,
  type AssessmentTemplateSchema,
  type AssessmentTemplateVersion,
} from './assessmentEngine';

const mapTemplate = (row: any): AssessmentTemplate => ({
  id: row.id,
  clinicId: row.clinic_id ?? null,
  ownerType: row.owner_type,
  name: row.name,
  description: row.description ?? null,
  specialty: row.specialty ?? null,
  status: row.status,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapVersion = (row: any): AssessmentTemplateVersion => ({
  id: row.id,
  templateId: row.template_id,
  version: row.version,
  schema: isAssessmentTemplateSchema(row.schema) ? row.schema : { sections: [] },
  publishedAt: row.published_at ?? null,
  publishedBy: row.published_by ?? null,
  createdAt: row.created_at,
});

export async function listAssessmentTemplatesForAdmin(): Promise<AssessmentTemplate[]> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*')
    .order('owner_type')
    .order('name');

  if (error) throw error;
  return (data ?? []).map(mapTemplate);
}

export async function listAssessmentTemplateVersions(templateId: string): Promise<AssessmentTemplateVersion[]> {
  const { data, error } = await supabase
    .from('assessment_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapVersion);
}

export async function createClinicAssessmentTemplate(input: {
  name: string;
  description?: string;
  specialty?: string;
  schema?: AssessmentTemplateSchema;
}): Promise<string> {
  const schema = input.schema ?? { sections: [] };
  if (!isAssessmentTemplateSchema(schema)) throw new Error('Estrutura do modelo inválida.');

  const { data, error } = await supabase.rpc('create_clinic_assessment_template', {
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_specialty: input.specialty?.trim() || null,
    p_schema: schema,
  });

  if (error) throw error;
  if (!data) throw new Error('Não foi possível criar o modelo.');
  return String(data);
}

export async function duplicateStandardAssessmentTemplate(templateId: string, name?: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_standard_assessment_template', {
    p_source_template_id: templateId,
    p_name: name?.trim() || null,
  });

  if (error) throw error;
  if (!data) throw new Error('Não foi possível duplicar o modelo padrão.');
  return String(data);
}

export async function createNextAssessmentTemplateVersion(templateId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_next_assessment_template_version', {
    p_template_id: templateId,
  });

  if (error) throw error;
  if (!data) throw new Error('Não foi possível criar uma nova versão.');
  return String(data);
}

export async function saveAssessmentTemplateDraftVersion(
  versionId: string,
  schema: AssessmentTemplateSchema,
): Promise<void> {
  if (!isAssessmentTemplateSchema(schema)) throw new Error('Estrutura do modelo inválida.');

  const { error } = await supabase
    .from('assessment_template_versions')
    .update({ schema })
    .eq('id', versionId)
    .is('published_at', null);

  if (error) throw error;
}

export async function updateClinicAssessmentTemplateMeta(
  templateId: string,
  input: { name: string; description?: string; specialty?: string },
): Promise<void> {
  const { error } = await supabase
    .from('assessment_templates')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      specialty: input.specialty?.trim() || null,
    })
    .eq('id', templateId)
    .eq('owner_type', 'clinic');

  if (error) throw error;
}

export async function publishAssessmentTemplateVersion(templateId: string, versionId: string): Promise<void> {
  const { error } = await supabase.rpc('publish_assessment_template_version', {
    p_template_id: templateId,
    p_version_id: versionId,
  });
  if (error) throw error;
}

export async function setClinicAssessmentTemplateArchived(templateId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('assessment_templates')
    .update({ status: archived ? 'archived' : 'draft' })
    .eq('id', templateId)
    .eq('owner_type', 'clinic');

  if (error) throw error;
}
