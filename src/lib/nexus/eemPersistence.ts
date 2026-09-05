import {
  createNexusRedFlag,
  createNexusResultDraft,
  finalizeNexusResult,
  type NexusClinicalResult,
} from '../nexusClinical';
import {
  eemRedFlags,
  generateEemNarrative,
  NEXUS_EEM_RULE_VERSION,
  type NexusEemState,
} from './eem';

export type PersistEemInput = {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  state: NexusEemState;
};

export async function persistEemResult(input: PersistEemInput): Promise<NexusClinicalResult> {
  const narrative = generateEemNarrative(input.state);
  const flags = eemRedFlags(input.state);

  const draft = await createNexusResultDraft({
    patientId: input.patientId,
    professionalId: input.professionalId,
    appointmentId: input.appointmentId ?? null,
    moduleKey: 'eem',
    toolKey: 'eem',
    ruleKey: 'nexus.eem',
    ruleVersion: NEXUS_EEM_RULE_VERSION,
    requiredCapability: 'nexus.eem',
    inputSnapshot: { structuredState: input.state },
    outputSnapshot: {
      narrative,
      soapTarget: 'objective',
      redFlagCodes: flags.map((flag) => flag.flagCode),
    },
    classification: flags.some((flag) => flag.severity === 'critical') ? 'EEM com alerta crítico' : flags.length ? 'EEM com achados que requerem atenção' : 'EEM registrado',
    severity: flags.some((flag) => flag.severity === 'critical') ? 'severe' : flags.length ? 'moderate' : 'low',
    interpretation: 'Exame do Estado Mental estruturado e narrativa determinística produzidos pelo Nexus.',
    soapText: narrative,
    evidenceSnapshot: [
      { evidenceKey: 'eem-dalgalarrondo', title: 'Psicopatologia e Semiologia dos Transtornos Mentais', source: 'Dalgalarrondo P.', version: NEXUS_EEM_RULE_VERSION },
      { evidenceKey: 'eem-kaplan-sadock', title: 'Kaplan & Sadock’s Synopsis of Psychiatry', source: 'Kaplan & Sadock.', version: NEXUS_EEM_RULE_VERSION },
    ],
  });

  for (const flag of flags) {
    await createNexusRedFlag({
      patientId: input.patientId,
      resultId: draft.id,
      flagCode: flag.flagCode,
      severity: flag.severity,
      title: flag.title,
      message: flag.message,
      requiredAction: flag.requiredAction ?? null,
    });
  }

  return finalizeNexusResult(draft.id);
}
