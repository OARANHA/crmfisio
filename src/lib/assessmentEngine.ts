import { supabase } from './supabaseClient';

export type AssessmentTemplateOwner = 'platform' | 'clinic';
export type AssessmentTemplateStatus = 'draft' | 'active' | 'archived';
export type ClinicalAssessmentStatus = 'draft' | 'finalized';
export type BodyView = 'front' | 'back' | 'left' | 'right';
export type BodyLaterality = 'left' | 'right' | 'midline' | 'bilateral';

export type AssessmentComponentType =
  | 'heading'
  | 'short_text'
  | 'long_text'
  | 'integer'
  | 'decimal'
  | 'scale'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'date'
  | 'body_map'
  | 'attachment'
  | 'info';

export type AssessmentComponent = {
  key: string;
  type: AssessmentComponentType;
  label: string;
  required?: boolean;
  helpText?: string;
  config?: Record<string, unknown>;
};

export type AssessmentSection = {
  key: string;
  title: string;
  description?: string;
  components: AssessmentComponent[];
};

export type AssessmentTemplateSchema = {
  sections: AssessmentSection[];
};

export type AssessmentTemplate = {
  id: string;
  clinicId: string | null;
  ownerType: AssessmentTemplateOwner;
  name: string;
  description: string | null;
  specialty: string | null;
  status: AssessmentTemplateStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  schema: AssessmentTemplateSchema;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
};

export type ClinicalAssessment = {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  appointmentId: string | null;
  templateId: string;
  templateVersionId: string;
  status: ClinicalAssessmentStatus;
  answers: Record<string, unknown>;
  startedAt: string;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentBodyPoint = {
  id: string;
  clinicId: string;
  assessmentId: string;
  componentKey: string;
  view: BodyView;
  x: number;
  y: number;
  region: string | null;
  laterality: BodyLaterality | null;
  intensity: number | null;
  symptom: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewBodyPoint = Omit<
  AssessmentBodyPoint,
  'id' | 'clinicId' | 'createdAt' | 'updatedAt'
>;

export function clampNormalizedCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function isAssessmentTemplateSchema(value: unknown): value is AssessmentTemplateSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return false;

  return sections.every((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return false;
    const rawSection = section as Record<string, unknown>;
    if (typeof rawSection.key !== 'string' || typeof rawSection.title !== 'string') return false;
    if (!Array.isArray(rawSection.components)) return false;

    const keys = new Set<string>();
    return rawSection.components.every((component) => {
      if (!component || typeof component !== 'object' || Array.isArray(component)) return false;
      const raw = component as Record<string, unknown>;
      if (typeof raw.key !== 'string' || !raw.key.trim()) return false;
      if (keys.has(raw.key)) return false;
      keys.add(raw.key);
      if (typeof raw.label !== 'string') return false;
      return [
        'heading', 'short_text', 'long_text', 'integer', 'decimal', 'scale',
        'single_choice', 'multiple_choice', 'yes_no', 'date', 'body_map',
        'attachment', 'info',
      ].includes(String(raw.type));
    });
  });
}

const mapTemplate = (row: any): AssessmentTemplate => ({
  id: row.id,
  clinicId: row.clinic_id,
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

const mapAssessment = (row: any): ClinicalAssessment => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  professionalId: row.professional_id,
  appointmentId: row.appointment_id ?? null,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  status: row.status,
  answers: row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers) ? row.answers : {},
  startedAt: row.started_at,
  finalizedAt: row.finalized_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBodyPoint = (row: any): AssessmentBodyPoint => ({
  id: row.id,
  clinicId: row.clinic_id,
  assessmentId: row.assessment_id,
  componentKey: row.component_key,
  view: row.view,
  x: Number(row.x),
  y: Number(row.y),
  region: row.region ?? null,
  laterality: row.laterality ?? null,
  intensity: row.intensity ?? null,
  symptom: row.symptom ?? null,
  note: row.note ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listAvailableAssessmentTemplates(): Promise<AssessmentTemplate[]> {
  const { data, error } = await supabase
    .from('assessment_templates')
    .select('*')
    .neq('status', 'archived')
    .order('owner_type', { ascending: false })
    .order('name');

  if (error) throw error;
  return (data ?? []).map(mapTemplate);
}

export async function listPublishedTemplateVersions(templateId: string): Promise<AssessmentTemplateVersion[]> {
  const { data, error } = await supabase
    .from('assessment_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .not('published_at', 'is', null)
    .order('version', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapVersion);
}

export async function createClinicalAssessmentDraft(input: {
  patientId: string;
  professionalId: string;
  templateId: string;
  templateVersionId: string;
  appointmentId?: string | null;
  answers?: Record<string, unknown>;
}): Promise<ClinicalAssessment> {
  const { data, error } = await supabase
    .from('clinical_assessments')
    .insert({
      patient_id: input.patientId,
      professional_id: input.professionalId,
      appointment_id: input.appointmentId ?? null,
      template_id: input.templateId,
      template_version_id: input.templateVersionId,
      status: 'draft',
      answers: input.answers ?? {},
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível criar o rascunho da avaliação.');
  return mapAssessment(data);
}

export async function saveClinicalAssessmentDraft(
  assessmentId: string,
  answers: Record<string, unknown>,
): Promise<ClinicalAssessment> {
  const { data, error } = await supabase
    .from('clinical_assessments')
    .update({ answers })
    .eq('id', assessmentId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível salvar o rascunho da avaliação.');
  return mapAssessment(data);
}

export async function finalizeClinicalAssessment(assessmentId: string): Promise<ClinicalAssessment> {
  const { data, error } = await supabase
    .from('clinical_assessments')
    .update({ status: 'finalized', finalized_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível finalizar a avaliação.');
  return mapAssessment(data);
}

export async function listPatientClinicalAssessments(patientId: string): Promise<ClinicalAssessment[]> {
  const { data, error } = await supabase
    .from('clinical_assessments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapAssessment);
}

export async function listAssessmentBodyPoints(assessmentId: string): Promise<AssessmentBodyPoint[]> {
  const { data, error } = await supabase
    .from('assessment_body_points')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('created_at');

  if (error) throw error;
  return (data ?? []).map(mapBodyPoint);
}

export async function addAssessmentBodyPoint(input: NewBodyPoint): Promise<AssessmentBodyPoint> {
  const { data, error } = await supabase
    .from('assessment_body_points')
    .insert({
      assessment_id: input.assessmentId,
      component_key: input.componentKey,
      view: input.view,
      x: clampNormalizedCoordinate(input.x),
      y: clampNormalizedCoordinate(input.y),
      region: input.region,
      laterality: input.laterality,
      intensity: input.intensity,
      symptom: input.symptom,
      note: input.note,
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível registrar o ponto corporal.');
  return mapBodyPoint(data);
}

export async function removeAssessmentBodyPoint(pointId: string): Promise<void> {
  const { error } = await supabase.from('assessment_body_points').delete().eq('id', pointId);
  if (error) throw error;
}
