import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-processor-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

type Severity = 'low' | 'moderate' | 'high' | 'severe';
type Evidence = { evidenceKey: string; title: string; source: string; year?: number; version: string };
type RedFlag = { flagCode: string; severity: 'warning' | 'critical'; title: string; message: string; requiredAction?: string };
type Calculated = {
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: Severity;
  interpretation: string;
  recommendations: string[];
  answersArray: number[];
  soapText: string;
  redFlags?: RedFlag[];
};
type ProcessorDefinition = {
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  moduleKey: string;
  requiredCapability: string;
  evidence: Evidence[];
  calculate: (answers: Record<string, number>) => Calculated;
};
type ClaimedInvite = {
  invite_id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  scale_key: string;
  rule_version: string;
  response_snapshot: Record<string, unknown>;
};

function asAnswerMap(payload: Record<string, unknown>, label: string): Record<string, number> {
  const answers = payload.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error(`${label} sem answers válidos`);
  }
  return answers as Record<string, number>;
}

function requireIntegerRange(answers: Record<string, number>, ids: string[], min: number, max: number, label: string): number[] {
  const values = ids.map((id) => answers[id]);
  if (values.some((value) => !Number.isInteger(value) || value < min || value > max)) {
    throw new Error(`${label} incompleto ou com resposta fora da faixa ${min}-${max}`);
  }
  return values;
}

const CLINICIAN_REVIEW_NOTICE = 'Instrumento de rastreio: o escore não estabelece diagnóstico nem conduta isoladamente. Interpretar no contexto da entrevista, funcionalidade, comorbidades, riscos, preferências e julgamento clínico.';

const PHQ9_RULE_VERSION = 'nexus-2026-09-03';
const PHQ9: ProcessorDefinition = {
  toolKey: 'phq9',
  ruleKey: 'nexus.phq9',
  ruleVersion: PHQ9_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'phq9-kroenke-2001', title: 'The PHQ-9: validity of a brief depression severity measure', source: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.', year: 2001, version: PHQ9_RULE_VERSION },
    { evidenceKey: 'phq9-brazil-validation', title: 'Validação brasileira do PHQ-9', source: 'Osório FL et al. (2009); Santos IS et al. (2013).', version: PHQ9_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1','q2','q3','q4','q5','q6','q7','q8','q9'], 0, 3, 'PHQ-9');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    let classification = '';
    let severity: Severity = 'low';
    let interpretation = '';
    const recommendations: string[] = [CLINICIAN_REVIEW_NOTICE];

    if (totalScore <= 4) {
      classification = 'Faixa mínima de sintomas depressivos';
      interpretation = 'Escore PHQ-9 entre 0 e 4. O resultado deve ser contextualizado clinicamente e não exclui sofrimento, risco ou outra condição.';
      recommendations.push('Revisar sintomas, funcionalidade e contexto clínico conforme a necessidade do atendimento.');
    } else if (totalScore <= 9) {
      classification = 'Faixa leve de sintomas depressivos';
      interpretation = 'Escore PHQ-9 entre 5 e 9, compatível com carga sintomática leve no instrumento.';
      recommendations.push('Correlacionar o escore com duração, impacto funcional, contexto psicossocial e evolução longitudinal.');
    } else if (totalScore <= 14) {
      classification = 'Faixa moderada de sintomas depressivos';
      severity = 'moderate';
      interpretation = 'Escore PHQ-9 entre 10 e 14, acima do ponto de corte frequentemente utilizado para investigação clínica adicional.';
      recommendations.push('Realizar avaliação clínica diagnóstica e discutir opções de cuidado apropriadas ao caso, sem inferir conduta apenas pelo escore.');
    } else if (totalScore <= 19) {
      classification = 'Faixa moderadamente grave de sintomas depressivos';
      severity = 'high';
      interpretation = 'Escore PHQ-9 entre 15 e 19, indicando carga sintomática elevada no instrumento.';
      recommendations.push('Priorizar revisão clínica abrangente, impacto funcional, riscos, comorbidades e plano de acompanhamento individualizado.');
    } else {
      classification = 'Faixa grave de sintomas depressivos';
      severity = 'severe';
      interpretation = 'Escore PHQ-9 entre 20 e 27, indicando carga sintomática muito elevada no instrumento.';
      recommendations.push('Priorizar avaliação clínica abrangente e definição de plano assistencial individualizado, considerando riscos e necessidade de maior suporte conforme julgamento profissional.');
    }

    const redFlags: RedFlag[] = [];
    if (answers.q9 > 0) {
      recommendations.unshift('⚠️ ALERTA: resposta positiva no item 9. Realizar avaliação clínica de segurança e risco de suicídio/autolesão conforme protocolo assistencial vigente; o PHQ-9 isoladamente não estratifica esse risco.');
      redFlags.push({
        flagCode: 'phq9.item9.positive',
        severity: 'critical',
        title: 'PHQ-9 item 9 positivo',
        message: 'Resposta positiva para pensamentos de morte ou autolesão no PHQ-9.',
        requiredAction: 'Realizar avaliação clínica de segurança e risco conforme protocolo assistencial vigente e registrar a conduta adotada.',
      });
    }

    return {
      totalScore,
      maxScore: 27,
      classification,
      severity,
      interpretation,
      recommendations,
      answersArray: values,
      soapText: `PHQ-9: ${totalScore}/27 pts (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Kroenke et al., 2001 (Validação BR: Osório, 2009)`,
      redFlags,
    };
  },
};

const GAD7_RULE_VERSION = 'nexus-2026-09-03';
const GAD7: ProcessorDefinition = {
  toolKey: 'gad7',
  ruleKey: 'nexus.gad7',
  ruleVersion: GAD7_RULE_VERSION,
  moduleKey: 'scales',
  requiredCapability: 'nexus.scales',
  evidence: [
    { evidenceKey: 'gad7-spitzer-2006', title: 'A brief measure for assessing generalized anxiety disorder', source: 'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-7.', year: 2006, version: GAD7_RULE_VERSION },
    { evidenceKey: 'gad7-brazil-validation', title: 'Validação brasileira do GAD-7', source: 'Moreno AL et al. Trends Psychiatry Psychother. 2016.', year: 2016, version: GAD7_RULE_VERSION },
  ],
  calculate: (answers) => {
    const values = requireIntegerRange(answers, ['q1','q2','q3','q4','q5','q6','q7'], 0, 3, 'GAD-7');
    const totalScore = values.reduce((sum, value) => sum + value, 0);
    let classification = '';
    let severity: Severity = 'low';
    let interpretation = '';
    const recommendations: string[] = [CLINICIAN_REVIEW_NOTICE];

    if (totalScore <= 4) {
      classification = 'Faixa mínima de sintomas ansiosos';
      interpretation = 'Escore GAD-7 entre 0 e 4. O resultado deve ser contextualizado clinicamente e não exclui sofrimento ou outra condição.';
      recommendations.push('Revisar sintomas, funcionalidade e contexto clínico conforme a necessidade do atendimento.');
    } else if (totalScore <= 9) {
      classification = 'Faixa leve de sintomas ansiosos';
      interpretation = 'Escore GAD-7 entre 5 e 9, compatível com carga sintomática leve no instrumento.';
      recommendations.push('Correlacionar o escore com duração, gatilhos, impacto funcional, comorbidades e evolução longitudinal.');
    } else if (totalScore <= 14) {
      classification = 'Faixa moderada de sintomas ansiosos';
      severity = 'moderate';
      interpretation = 'Escore GAD-7 entre 10 e 14, acima do ponto de corte frequentemente utilizado para investigação clínica adicional.';
      recommendations.push('Realizar avaliação clínica diagnóstica e discutir opções de cuidado apropriadas ao caso, sem inferir conduta apenas pelo escore.');
    } else {
      classification = 'Faixa grave de sintomas ansiosos';
      severity = 'severe';
      interpretation = 'Escore GAD-7 entre 15 e 21, indicando carga sintomática elevada no instrumento.';
      recommendations.push('Priorizar revisão clínica abrangente, impacto funcional, diagnósticos diferenciais, comorbidades e plano de acompanhamento individualizado.');
    }

    return {
      totalScore,
      maxScore: 21,
      classification,
      severity,
      interpretation,
      recommendations,
      answersArray: values,
      soapText: `GAD-7: ${totalScore}/21 pts (${classification}) | Respostas: [${values.join(', ')}] | Instrumento de rastreio; interpretar clinicamente | Fonte: Spitzer et al., 2006 (Validação BR: Moreno, 2016)`,
      redFlags: [],
    };
  },
};

const PROCESSORS: ProcessorDefinition[] = [PHQ9, GAD7];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const processorSecret = Deno.env.get('NEXUS_SELF_ASSESSMENT_PROCESSOR_SECRET');

  if (!supabaseUrl || !serviceRole || !processorSecret) {
    return json({ error: 'Processor Nexus não configurado no servidor' }, 503);
  }
  if (req.headers.get('x-processor-secret') !== processorSecret) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));
  const requestedScale = typeof body?.scaleKey === 'string' ? body.scaleKey.trim() : null;
  const processors = requestedScale ? PROCESSORS.filter((item) => item.toolKey === requestedScale) : PROCESSORS;
  if (requestedScale && processors.length === 0) return json({ error: 'Instrumento não suportado pelo processor' }, 400);

  const results: Array<{ inviteId: string; scaleKey: string; status: 'processed' | 'failed'; resultId?: string; error?: string }> = [];
  let claimed = 0;

  for (const definition of processors) {
    const { data, error } = await admin.rpc('claim_nexus_self_assessment_invites', {
      p_scale_key: definition.toolKey,
      p_rule_version: definition.ruleVersion,
      p_limit: limit,
    });
    if (error) {
      console.error('[nexus-self-assessment-processor] claim:', definition.toolKey, error);
      return json({ error: `Não foi possível reservar submissões ${definition.toolKey}` }, 500);
    }

    const rows = (data ?? []) as ClaimedInvite[];
    claimed += rows.length;

    for (const invite of rows) {
      try {
        if (invite.scale_key !== definition.toolKey || invite.rule_version !== definition.ruleVersion) {
          throw new Error('Instrumento/versão não suportados por este handler');
        }
        const payload = invite.response_snapshot ?? {};
        if (payload.scaleKey !== definition.toolKey || payload.ruleVersion !== definition.ruleVersion) {
          throw new Error('Snapshot não corresponde ao convite reservado');
        }

        const answers = asAnswerMap(payload, definition.toolKey.toUpperCase());
        const calculated = definition.calculate(answers);
        const processedResult = {
          moduleKey: definition.moduleKey,
          toolKey: definition.toolKey,
          ruleKey: definition.ruleKey,
          ruleVersion: definition.ruleVersion,
          requiredCapability: definition.requiredCapability,
          inputSnapshot: {
            source: 'patient-self-assessment',
            inviteId: invite.invite_id,
            answers,
            selectedOptions: payload.selectedOptions,
          },
          outputSnapshot: {
            recommendations: calculated.recommendations,
            answersArray: calculated.answersArray,
            selfAssessment: true,
            guidanceMode: 'clinician-review',
          },
          totalScore: calculated.totalScore,
          maxScore: calculated.maxScore,
          classification: calculated.classification,
          severity: calculated.severity,
          interpretation: calculated.interpretation,
          soapText: calculated.soapText,
          evidenceSnapshot: definition.evidence,
        };

        const { data: resultId, error: processError } = await admin.rpc('complete_nexus_self_assessment_processing', {
          p_invite_id: invite.invite_id,
          p_result: processedResult,
          p_red_flags: calculated.redFlags ?? [],
        });
        if (processError || !resultId) throw processError ?? new Error('Resultado Nexus não retornado');
        results.push({ inviteId: invite.invite_id, scaleKey: definition.toolKey, status: 'processed', resultId: String(resultId) });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Falha desconhecida';
        console.error('[nexus-self-assessment-processor] process:', invite.invite_id, reason);
        await admin.rpc('release_nexus_self_assessment_claim', { p_invite_id: invite.invite_id, p_error: reason });
        results.push({ inviteId: invite.invite_id, scaleKey: definition.toolKey, status: 'failed', error: reason.slice(0, 300) });
      }
    }
  }

  return json({
    claimed,
    processed: results.filter((item) => item.status === 'processed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    supportedScales: PROCESSORS.map((item) => ({ scaleKey: item.toolKey, ruleVersion: item.ruleVersion })),
    results,
  });
});
