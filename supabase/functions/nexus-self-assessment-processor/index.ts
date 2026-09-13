import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  asClinicalInstrumentAnswerMap,
  CLINICAL_INSTRUMENT_PROCESSORS,
} from '../_shared/clinical-instrument-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-processor-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

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
  const processors = requestedScale
    ? CLINICAL_INSTRUMENT_PROCESSORS.filter((item) => item.toolKey === requestedScale)
    : CLINICAL_INSTRUMENT_PROCESSORS;
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

        const answers = asClinicalInstrumentAnswerMap(payload, definition.toolKey.toUpperCase());
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
    supportedScales: CLINICAL_INSTRUMENT_PROCESSORS.map((item) => ({ scaleKey: item.toolKey, ruleVersion: item.ruleVersion })),
    results,
  });
});
