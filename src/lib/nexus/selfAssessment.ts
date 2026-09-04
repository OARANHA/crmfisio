import { supabase } from '../supabaseClient';

const db = supabase as any;

export type SelfAssessmentInvite = {
  inviteId: string;
  token: string;
  expiresAt: string;
};

export type ResolvedSelfAssessment = {
  inviteId: string;
  scaleKey: string;
  ruleVersion: string;
  expiresAt: string;
  status: string;
};

export async function createSelfAssessmentInvite(input: {
  patientId: string;
  scaleKey: string;
  ruleVersion: string;
  appointmentId?: string | null;
  expiresHours?: number;
}): Promise<SelfAssessmentInvite> {
  const { data, error } = await db.rpc('create_nexus_self_assessment_invite', {
    p_patient_id: input.patientId,
    p_scale_key: input.scaleKey,
    p_rule_version: input.ruleVersion,
    p_appointment_id: input.appointmentId ?? null,
    p_expires_hours: input.expiresHours ?? 48,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Não foi possível criar o convite de autoaplicação.');
  return { inviteId: row.invite_id, token: row.token, expiresAt: row.expires_at };
}

export async function resolveSelfAssessment(token: string): Promise<ResolvedSelfAssessment | null> {
  const { data, error } = await db.rpc('resolve_nexus_self_assessment', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { inviteId: row.invite_id, scaleKey: row.scale_key, ruleVersion: row.rule_version, expiresAt: row.expires_at, status: row.status };
}

export async function submitSelfAssessment(token: string, payload: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db.rpc('submit_nexus_self_assessment', { p_token: token, p_response: payload });
  if (error) throw error;
  return data === true;
}
