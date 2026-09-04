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

const PHQ9_RULE_VERSION = 'nexus-2026-09-03';
const PHQ9_RULE_KEY = 'nexus.phq9';
const PHQ9_TOOL_KEY = 'phq9';
const PHQ9_REQUIRED_CAPABILITY = 'nexus.scales';

const PHQ9_EVIDENCE = [
  {
    evidenceKey: 'phq9-kroenke-2001',
    title: 'The PHQ-9: validity of a brief depression severity measure',
    source: 'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.',
    year: 2001,
    version: PHQ9_RULE_VERSION,
  },
  {
    evidenceKey: 'phq9-brazil-validation',
    title: 'Validação brasileira do PHQ-9',
    source: 'Osório FL et al. (2009); Santos IS et al. (2013).',
    version: PHQ9_RULE_VERSION,
  },
];

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

function asAnswerMap(payload: Record<string, unknown>): Record<string, number> {
  const answers = payload.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('PHQ-9 sem answers válidos');
  }
  return answers as Record<string, number>;
}

function calculatePhq9(answers: Record<string, number>) {
  const ids = ['q1','q2','q3','q4','q5','q6','q7','q8','q9'];
  const values = ids.map((id) => answers[id]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    throw new Error('PHQ-9 incompleto ou com resposta fora da faixa 0-3');
  }

  const totalScore = values.reduce((sum, value) => sum + value, 0);
  let classification = '';
  let severity: 'low' | 'moderate' | 'high' | 'severe' = 'low';
  let interpretation = '';
  const recommendations: string[] = [];

  if (totalScore <= 4) {
    classification = 'Sintomas depressivos mínimos ou ausentes';
    severity = 'low';
    interpretation = 'Escore baixo (0-4 pts), sem indicação de intervenção farmacológica para depressão.';
    recommendations.push('Acompanhamento longitudinal de rotina na APS', 'Orientações gerais de estilo de vida e higiene do sono');
  } else if (totalScore <= 9) {
    classification = 'Depressão leve';
    severity = 'low';
    interpretation = 'Sintomas leves (5-9 pts). Avaliar contexto psicossocial e impacto funcional.';
    recommendations.push('Psicoeducação e suporte na APS', 'Ativação comportamental e atividade física orientada', 'Reavaliação em 4 a 8 semanas');
  } else if (totalScore <= 14) {
    classification = 'Depressão moderada';
    severity = 'moderate';
    interpretation = 'Sintomas moderados (10-14 pts, corte ≥ 10 atingido) com comprometimento das atividades diárias.';
    recommendations.push('Considerar psicoterapia (TCC/interpessoal) e/ou farmacoterapia (ISRS de 1ª linha)', 'Pactuar plano de acompanhamento em APS');
  } else if (totalScore <= 19) {
    classification = 'Depressão moderadamente grave';
    severity = 'high';
    interpretation = 'Sintomas significativos (15-19 pts) exigindo intervenção clínica e medicamentosa estruturada.';
    recommendations.push('Iniciar tratamento medicamentoso com ISRS', 'Pactuar retorno em 2 semanas', 'Avaliar suporte familiar e rede de apoio social');
  } else {
    classification = 'Depressão grave';
    severity = 'severe';
    interpretation = 'Sintomas graves (20-27 pts) com alto risco de prejuízo funcional e sofrimento psíquico severo.';
    recommendations.push('Iniciar farmacoterapia combinada/otimizada', 'Investigar ativamente ideação e planejamento suicida', 'Considerar discussão de caso em Apoio Matricial / Psiquiatria');
  }

  const hasSuicideRiskFlag = answers.q9 > 0;
  if (hasSuicideRiskFlag) {
    recommendations.unshift('⚠️ ALERTA: Resposta positiva na pergunta 9 (ideação suicida/autolesão). Aplicar imediatamente o protocolo C-SSRS e pactuar Plano de Segurança.');
  }

  return {
    totalScore,
    maxScore: 27,
    classification,
    severity,
    interpretation,
    recommendations,
    answersArray: values,
    soapText: `PHQ-9: ${totalScore}/27 pts (${classification}) | Respostas: [${values.join(', ')}] | Fonte: Kroenke et al., 2001 (Validação BR: Osório, 2009)`,
    hasSuicideRiskFlag,
  };
}

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

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));

  const { data, error } = await admin.rpc('claim_nexus_self_assessment_invites', {
    p_scale_key: PHQ9_TOOL_KEY,
    p_rule_version: PHQ9_RULE_VERSION,
    p_limit: limit,
  });

  if (error) {
    console.error('[nexus-self-assessment-processor] claim:', error);
    return json({ error: 'Não foi possível reservar submissões Nexus' }, 500);
  }

  const rows = (data ?? []) as ClaimedInvite[];
  const results: Array<{ inviteId: string; status: 'processed' | 'failed'; resultId?: string; error?: string }> = [];

  for (const invite of rows) {
    try {
      if (invite.scale_key !== PHQ9_TOOL_KEY || invite.rule_version !== PHQ9_RULE_VERSION) {
        throw new Error('Instrumento/versão não suportados por este processor');
      }

      const payload = invite.response_snapshot ?? {};
      if (payload.scaleKey !== PHQ9_TOOL_KEY || payload.ruleVersion !== PHQ9_RULE_VERSION) {
        throw new Error('Snapshot não corresponde ao convite reservado');
      }

      const answers = asAnswerMap(payload);
      const calculated = calculatePhq9(answers);

      const redFlags = calculated.hasSuicideRiskFlag
        ? [{
            flagCode: 'phq9.item9.positive',
            severity: 'critical',
            title: 'PHQ-9 item 9 positivo',
            message: 'Resposta positiva para pensamentos de morte ou autolesão no PHQ-9.',
            requiredAction: 'Aplicar C-SSRS e realizar avaliação clínica de risco imediatamente.',
          }]
        : [];

      const processedResult = {
        moduleKey: 'scales',
        toolKey: PHQ9_TOOL_KEY,
        ruleKey: PHQ9_RULE_KEY,
        ruleVersion: PHQ9_RULE_VERSION,
        requiredCapability: PHQ9_REQUIRED_CAPABILITY,
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
        },
        totalScore: calculated.totalScore,
        maxScore: calculated.maxScore,
        classification: calculated.classification,
        severity: calculated.severity,
        interpretation: calculated.interpretation,
        soapText: calculated.soapText,
        evidenceSnapshot: PHQ9_EVIDENCE,
      };

      const { data: resultId, error: processError } = await admin.rpc('complete_nexus_self_assessment_processing', {
        p_invite_id: invite.invite_id,
        p_result: processedResult,
        p_red_flags: redFlags,
      });
      if (processError || !resultId) throw processError ?? new Error('Resultado Nexus não retornado');

      results.push({ inviteId: invite.invite_id, status: 'processed', resultId: String(resultId) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha desconhecida';
      console.error('[nexus-self-assessment-processor] process:', invite.invite_id, reason);
      await admin.rpc('release_nexus_self_assessment_claim', {
        p_invite_id: invite.invite_id,
        p_error: reason,
      });
      results.push({ inviteId: invite.invite_id, status: 'failed', error: reason.slice(0, 300) });
    }
  }

  return json({
    claimed: rows.length,
    processed: results.filter((item) => item.status === 'processed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  });
});
