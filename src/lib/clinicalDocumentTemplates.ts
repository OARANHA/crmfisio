import { supabase } from './supabaseClient';
import {
  DEFAULT_PRESCRIPTION_RENDER_DEFINITION,
  normalizePrescriptionRenderDefinition,
  serializePrescriptionRenderDefinition,
  type PrescriptionRenderDefinition,
} from './prescriptionPrintRenderer';

export type PrescriptionTemplateOwner = 'platform' | 'clinic';
export type PrescriptionTemplateStatus = 'active' | 'archived';

export type PrescriptionTemplateAdmin = {
  id: string;
  ownerType: PrescriptionTemplateOwner;
  clinicId: string | null;
  name: string;
  description: string;
  relevanceMetadata: Record<string, unknown>;
  status: PrescriptionTemplateStatus;
  currentVersionId: string | null;
  currentVersion: number | null;
  definition: Record<string, unknown> | null;
  renderDefinition: Record<string, unknown> | null;
  variablesContract: unknown[];
  publishedAt: string | null;
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

type TemplateManagementRow = {
  template_id: string;
  owner_type: PrescriptionTemplateOwner;
  clinic_id: string | null;
  document_type: string;
  name: string;
  description: string;
  relevance_metadata: unknown;
  status: string;
  current_version_id: string | null;
  current_version: number | null;
  definition: unknown;
  render_definition: unknown;
  variables_contract: unknown;
  published_at: string | null;
  read_only: boolean;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;

const DEFAULT_DEFINITION = {
  kind: 'medication_prescription',
  fields: ['items', 'observations'],
};

const DEFAULT_VARIABLES_CONTRACT = [
  'patient.name',
  'patient.birth_date',
  'clinic.name',
  'clinic.address',
  'clinic.phone',
  'issuer.name',
  'issuer.professional_type',
  'issuer.specialty',
  'issuer.council_type',
  'issuer.council_state',
  'issuer.registro',
  'appointment.id',
  'issued_at',
];

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export function normalizePrescriptionTemplateAdminRow(row: TemplateManagementRow): PrescriptionTemplateAdmin {
  return {
    id: row.template_id,
    ownerType: row.owner_type,
    clinicId: row.clinic_id,
    name: row.name,
    description: row.description ?? '',
    relevanceMetadata: asObject(row.relevance_metadata),
    status: row.status === 'archived' ? 'archived' : 'active',
    currentVersionId: row.current_version_id,
    currentVersion: row.current_version,
    definition: Object.keys(asObject(row.definition)).length ? asObject(row.definition) : null,
    renderDefinition: Object.keys(asObject(row.render_definition)).length ? asObject(row.render_definition) : null,
    variablesContract: Array.isArray(row.variables_contract) ? row.variables_contract : [],
    publishedAt: row.published_at,
    readOnly: row.read_only === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function prescriptionTemplateSpecialty(template: Pick<PrescriptionTemplateAdmin, 'relevanceMetadata'>): string {
  const value = template.relevanceMetadata.specialty;
  return typeof value === 'string' && value.trim() ? value.trim() : 'geral';
}

export function prescriptionTemplateRenderDefinition(
  template: Pick<PrescriptionTemplateAdmin, 'renderDefinition'>,
): PrescriptionRenderDefinition {
  return normalizePrescriptionRenderDefinition(template.renderDefinition);
}

export async function listPrescriptionTemplatesForManagement(): Promise<PrescriptionTemplateAdmin[]> {
  const { data, error } = await db.rpc('list_clinical_document_templates_for_management', {
    p_document_type: 'medication_prescription',
  });
  if (error) throw error;
  return ((data ?? []) as TemplateManagementRow[]).map(normalizePrescriptionTemplateAdminRow);
}

export async function createClinicPrescriptionTemplate(input: {
  name: string;
  description?: string;
  specialty?: string;
  renderDefinition?: PrescriptionRenderDefinition;
}): Promise<string> {
  const renderDefinition = input.renderDefinition ?? DEFAULT_PRESCRIPTION_RENDER_DEFINITION;
  const { data, error } = await db.rpc('create_clinic_clinical_document_template', {
    p_name: input.name.trim(),
    p_description: input.description?.trim() ?? '',
    p_relevance_metadata: { specialty: input.specialty?.trim() || 'geral' },
    p_definition: DEFAULT_DEFINITION,
    p_render_definition: serializePrescriptionRenderDefinition(renderDefinition),
    p_variables_contract: DEFAULT_VARIABLES_CONTRACT,
  });
  if (error || !data?.id) throw error ?? new Error('Modelo criado sem confirmação do servidor.');
  return String(data.id);
}

export async function clonePrescriptionTemplateToClinic(
  templateId: string,
  name?: string,
): Promise<string> {
  const { data, error } = await db.rpc('clone_clinical_document_template_to_clinic', {
    p_source_template_id: templateId,
    p_name: name?.trim() || null,
    p_description: null,
  });
  if (error || !data?.id) throw error ?? new Error('Modelo duplicado sem confirmação do servidor.');
  return String(data.id);
}

export async function saveClinicPrescriptionTemplatePresentation(input: {
  templateId: string;
  name: string;
  description?: string;
  specialty?: string;
  renderDefinition: PrescriptionRenderDefinition;
}): Promise<void> {
  const { error } = await db.rpc('save_clinic_prescription_template_presentation', {
    p_template_id: input.templateId,
    p_name: input.name.trim(),
    p_description: input.description?.trim() ?? '',
    p_relevance_metadata: { specialty: input.specialty?.trim() || 'geral' },
    p_render_definition: serializePrescriptionRenderDefinition(input.renderDefinition),
  });
  if (error) throw error;
}

export async function updateClinicPrescriptionTemplate(input: {
  templateId: string;
  name: string;
  description?: string;
  specialty?: string;
  status?: PrescriptionTemplateStatus;
}): Promise<void> {
  const { error } = await db.rpc('update_clinic_clinical_document_template_metadata', {
    p_template_id: input.templateId,
    p_name: input.name.trim(),
    p_description: input.description?.trim() ?? '',
    p_relevance_metadata: { specialty: input.specialty?.trim() || 'geral' },
    p_status: input.status ?? 'active',
  });
  if (error) throw error;
}