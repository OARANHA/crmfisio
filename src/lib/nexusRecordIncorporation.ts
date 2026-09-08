import { supabase } from './supabaseClient';

export type NexusRecordRedFlag = {
  flagCode: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  requiredAction: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

export type NexusRecordIncorporation = {
  id: string;
  patientId: string;
  professionalId: string;
  nexusResultId: string;
  appointmentId: string | null;
  moduleKey: string;
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  requiredCapability: string;
  clinicalSummary: string;
  soapText: string | null;
  totalScore: number | null;
  maxScore: number | null;
  classification: string | null;
  severity: string | null;
  redFlags: NexusRecordRedFlag[];
  sourceFinalizedAt: string;
  sourceReviewedAt: string;
  sourceSignedAt: string;
  incorporatedAt: string;
};

const db = supabase as any;

const mapIncorporation = (row: any): NexusRecordIncorporation => ({
  id: row.id,
  patientId: row.patient_id,
  professionalId: row.professional_id,
  nexusResultId: row.nexus_result_id,
  appointmentId: row.appointment_id ?? null,
  moduleKey: row.module_key,
  toolKey: row.tool_key,
  ruleKey: row.rule_key,
  ruleVersion: row.rule_version,
  requiredCapability: row.required_capability,
  clinicalSummary: row.clinical_summary,
  soapText: row.soap_text ?? null,
  totalScore: row.total_score == null ? null : Number(row.total_score),
  maxScore: row.max_score == null ? null : Number(row.max_score),
  classification: row.classification ?? null,
  severity: row.severity ?? null,
  redFlags: Array.isArray(row.red_flags_snapshot) ? row.red_flags_snapshot : [],
  sourceFinalizedAt: row.source_finalized_at,
  sourceReviewedAt: row.source_reviewed_at,
  sourceSignedAt: row.source_signed_at,
  incorporatedAt: row.incorporated_at,
});

export async function incorporateNexusResultIntoClinicalRecord(resultId: string): Promise<string> {
  const { data, error } = await db.rpc('incorporate_nexus_result_into_clinical_record', {
    p_result_id: resultId,
  });
  if (error || !data) throw error ?? new Error('Não foi possível incorporar o resultado Nexus ao prontuário.');
  return String(data);
}

export async function listPatientNexusRecordIncorporations(patientId: string): Promise<NexusRecordIncorporation[]> {
  const { data, error } = await db
    .from('clinical_record_nexus_incorporations')
    .select('*')
    .eq('patient_id', patientId)
    .order('incorporated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapIncorporation);
}
