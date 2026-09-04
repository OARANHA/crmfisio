import { supabase } from '../supabaseClient';

const db = supabase as any;

export type ResolvedSelfAssessment = {
  inviteId: string;
  scaleKey: string;
  ruleVersion: string;
  expiresAt: string;
  status: string;
};

export async function resolveSelfAssessment(token: string): Promise<ResolvedSelfAssessment | null> {
  const { data, error } = await db.rpc('resolve_nexus_self_assessment', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    inviteId: row.invite_id,
    scaleKey: row.scale_key,
    ruleVersion: row.rule_version,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export async function submitSelfAssessment(token: string, payload: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await db.rpc('submit_nexus_self_assessment', {
    p_token: token,
    p_response: payload,
  });
  if (error) throw error;
  return data === true;
}
