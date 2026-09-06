import { supabase } from '../supabaseClient';
import { getNexusResultById, type NexusClinicalResult } from '../nexusClinical';
import {
  eemRedFlags,
  generateEemNarrative,
  NEXUS_EEM_RULE_VERSION,
  type NexusEemState,
} from './eem';

export type PersistEemInput = {
  patientId: string;
  appointmentId?: string | null;
  state: NexusEemState;
};

export async function persistEemResult(input: PersistEemInput): Promise<NexusClinicalResult> {
  const narrative = generateEemNarrative(input.state);
  const flags = eemRedFlags(input.state);
  const classification = flags.some((flag) => flag.severity === 'critical')
    ? 'EEM com alerta crítico'
    : flags.length
      ? 'EEM com achados que requerem atenção'
      : 'EEM registrado';
  const severity = flags.some((flag) => flag.severity === 'critical')
    ? 'severe'
    : flags.length
      ? 'moderate'
      : 'low';

  const { data: resultId, error } = await (supabase as any).rpc('finalize_nexus_eem_result', {
    p_patient_id: input.patientId,
    p_appointment_id: input.appointmentId ?? null,
    p_rule_version: NEXUS_EEM_RULE_VERSION,
    p_input_snapshot: { structuredState: input.state },
    p_output_snapshot: {
      narrative,
      soapTarget: 'objective',
      redFlagCodes: flags.map((flag) => flag.flagCode),
    },
    p_classification: classification,
    p_severity: severity,
    p_interpretation: 'Exame do Estado Mental estruturado e narrativa determinística produzidos pelo Nexus.',
    p_soap_text: narrative,
    p_evidence_snapshot: [
      { evidenceKey: 'eem-dalgalarrondo', title: 'Psicopatologia e Semiologia dos Transtornos Mentais', source: 'Dalgalarrondo P.', version: NEXUS_EEM_RULE_VERSION },
      { evidenceKey: 'eem-kaplan-sadock', title: 'Kaplan & Sadock’s Synopsis of Psychiatry', source: 'Kaplan & Sadock.', version: NEXUS_EEM_RULE_VERSION },
    ],
    p_red_flags: flags.map((flag) => ({
      flagCode: flag.flagCode,
      severity: flag.severity,
      title: flag.title,
      message: flag.message,
      requiredAction: flag.requiredAction ?? null,
    })),
  });

  if (error || !resultId) throw error ?? new Error('Não foi possível finalizar o EEM Nexus.');
  return getNexusResultById(String(resultId));
}
