import { supabase } from './supabaseClient';

export type NexusSeverity = 'low' | 'moderate' | 'high' | 'severe';
export type NexusRedFlagSeverity = 'warning' | 'critical';
export type NexusResultStatus = 'draft' | 'finalized';

export type NexusEvidenceSnapshot = {
  evidenceKey?: string;
  title: string;
  source: string;
  year?: number | string;
  version?: string;
  url?: string;
};

export type NexusClinicalResult = {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  appointmentId: string | null;
  moduleKey: string;
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  requiredCapability: string;
  status: NexusResultStatus;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  totalScore: number | null;
  maxScore: number | null;
  classification: string | null;
  severity: NexusSeverity | null;
  interpretation: string | null;
  soapText: string | null;
  evidenceSnapshot: NexusEvidenceSnapshot[];
  startedAt: string;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NexusRedFlag = {
  id: string;
  clinicId: string;
  patientId: string;
  resultId: string;
  flagCode: string;
  severity: NexusRedFlagSeverity;
  title: string;
  message: string;
  requiredAction: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
};

export type NexusResultDraftInput = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  moduleKey: string;
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  requiredCapability: string;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  totalScore?: number | null;
  maxScore?: number | null;
  classification?: string | null;
  severity?: NexusSeverity | null;
  interpretation?: string | null;
  soapText?: string | null;
  evidenceSnapshot?: NexusEvidenceSnapshot[];
};

export type NexusResultDraftPatch = Partial<Pick<
  NexusResultDraftInput,
  | 'inputSnapshot'
  | 'outputSnapshot'
  | 'totalScore'
  | 'maxScore'
  | 'classification'
  | 'severity'
  | 'interpretation'
  | 'soapText'
  | 'evidenceSnapshot'
>>;

export type NexusRedFlagInput = {
  patientId: string;
  resultId: string;
  flagCode: string;
  severity: NexusRedFlagSeverity;
  title: string;
  message: string;
  requiredAction?: string | null;
};

const db = supabase as any;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asEvidence = (value: unknown): NexusEvidenceSnapshot[] =>
  Array.isArray(value) ? value as NexusEvidenceSnapshot[] : [];

const mapResult = (row: any): NexusClinicalResult => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  professionalId: row.professional_id,
  appointmentId: row.appointment_id ?? null,
  moduleKey: row.module_key,
  toolKey: row.tool_key,
  ruleKey: row.rule_key,
  ruleVersion: row.rule_version,
  requiredCapability: row.required_capability,
  status: row.status,
  inputSnapshot: asRecord(row.input_snapshot),
  outputSnapshot: asRecord(row.output_snapshot),
  totalScore: row.total_score == null ? null : Number(row.total_score),
  maxScore: row.max_score == null ? null : Number(row.max_score),
  classification: row.classification ?? null,
  severity: row.severity ?? null,
  interpretation: row.interpretation ?? null,
  soapText: row.soap_text ?? null,
  evidenceSnapshot: asEvidence(row.evidence_snapshot),
  startedAt: row.started_at,
  finalizedAt: row.finalized_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRedFlag = (row: any): NexusRedFlag => ({
  id: row.id,
  clinicId: row.clinic_id,
  patientId: row.patient_id,
  resultId: row.result_id,
  flagCode: row.flag_code,
  severity: row.severity,
  title: row.title,
  message: row.message,
  requiredAction: row.required_action ?? null,
  acknowledgedAt: row.acknowledged_at ?? null,
  acknowledgedBy: row.acknowledged_by ?? null,
  createdAt: row.created_at,
});

export async function hasProfessionalCapability(capability: string): Promise<boolean> {
  const { data, error } = await db.rpc('has_professional_capability', {
    p_capability: capability,
  });
  if (error) throw error;
  return data === true;
}

export async function createNexusResultDraft(
  input: NexusResultDraftInput,
): Promise<NexusClinicalResult> {
  const { data, error } = await db
    .from('nexus_clinical_results')
    .insert({
      patient_id: input.patientId,
      professional_id: input.professionalId,
      appointment_id: input.appointmentId ?? null,
      module_key: input.moduleKey,
      tool_key: input.toolKey,
      rule_key: input.ruleKey,
      rule_version: input.ruleVersion,
      required_capability: input.requiredCapability,
      status: 'draft',
      input_snapshot: input.inputSnapshot,
      output_snapshot: input.outputSnapshot ?? {},
      total_score: input.totalScore ?? null,
      max_score: input.maxScore ?? null,
      classification: input.classification ?? null,
      severity: input.severity ?? null,
      interpretation: input.interpretation ?? null,
      soap_text: input.soapText ?? null,
      evidence_snapshot: input.evidenceSnapshot ?? [],
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível criar o resultado Nexus.');
  return mapResult(data);
}

export async function saveNexusResultDraft(
  resultId: string,
  patch: NexusResultDraftPatch,
): Promise<NexusClinicalResult> {
  const updates: Record<string, unknown> = {};
  if (patch.inputSnapshot !== undefined) updates.input_snapshot = patch.inputSnapshot;
  if (patch.outputSnapshot !== undefined) updates.output_snapshot = patch.outputSnapshot;
  if (patch.totalScore !== undefined) updates.total_score = patch.totalScore;
  if (patch.maxScore !== undefined) updates.max_score = patch.maxScore;
  if (patch.classification !== undefined) updates.classification = patch.classification;
  if (patch.severity !== undefined) updates.severity = patch.severity;
  if (patch.interpretation !== undefined) updates.interpretation = patch.interpretation;
  if (patch.soapText !== undefined) updates.soap_text = patch.soapText;
  if (patch.evidenceSnapshot !== undefined) updates.evidence_snapshot = patch.evidenceSnapshot;

  const { data, error } = await db
    .from('nexus_clinical_results')
    .update(updates)
    .eq('id', resultId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível salvar o resultado Nexus.');
  return mapResult(data);
}

export async function createNexusRedFlag(input: NexusRedFlagInput): Promise<NexusRedFlag> {
  const { data, error } = await db
    .from('nexus_red_flags')
    .insert({
      patient_id: input.patientId,
      result_id: input.resultId,
      flag_code: input.flagCode,
      severity: input.severity,
      title: input.title,
      message: input.message,
      required_action: input.requiredAction ?? null,
    })
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível registrar a red flag Nexus.');
  return mapRedFlag(data);
}

export async function finalizeNexusResult(resultId: string): Promise<NexusClinicalResult> {
  const { data, error } = await db
    .from('nexus_clinical_results')
    .update({ status: 'finalized', finalized_at: new Date().toISOString() })
    .eq('id', resultId)
    .eq('status', 'draft')
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível finalizar o resultado Nexus.');
  return mapResult(data);
}

export async function acknowledgeNexusRedFlag(
  redFlagId: string,
  professionalId: string,
): Promise<NexusRedFlag> {
  const { data, error } = await db
    .from('nexus_red_flags')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: professionalId,
    })
    .eq('id', redFlagId)
    .is('acknowledged_at', null)
    .select('*')
    .single();

  if (error || !data) throw error ?? new Error('Não foi possível reconhecer a red flag Nexus.');
  return mapRedFlag(data);
}

export async function listPatientNexusResults(patientId: string): Promise<NexusClinicalResult[]> {
  const { data, error } = await db
    .from('nexus_clinical_results')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'finalized')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapResult);
}

export async function listPatientOpenNexusRedFlags(patientId: string): Promise<NexusRedFlag[]> {
  const { data, error } = await db
    .from('nexus_red_flags')
    .select('*')
    .eq('patient_id', patientId)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRedFlag);
}
