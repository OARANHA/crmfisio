import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  asClinicalInstrumentAnswerMap,
  CLINICAL_INSTRUMENT_PROCESSORS,
  getClinicalInstrumentProcessor,
  type ClinicalInstrumentProcessorDefinition,
} from '../_shared/clinical-instrument-engine.ts';

// Historical Nexus invitations remain intentionally limited to the public tools
// they shipped with. New neutral patient delivery does NOT use this allowlist;
// it is governed by the versioned DB delivery registry and shared engine registry.
const LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS = new Set(['phq9', 'gad7']);

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

type ProcessedResult = {
  engineSource: 'nexus';
  moduleKey: string;
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  requiredCapability: string;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: string;
  interpretation: string;
  soapText: string;
  evidenceSnapshot: unknown[];
};

function calculateInvite(invite: ClaimedInvite, definition: ClinicalInstrumentProcessorDefinition): {
  processedResult: ProcessedResult;
  redFlags: unknown[];
} {
  if (invite.scale_key !== definition.toolKey || invite.rule_version !== definition.ruleVersion) {
    throw new Error('Instrumento/versão não suportados por este handler');
  }
  const payload = invite.response_snapshot ?? {};
  if (payload.scaleKey !== definition.toolKey || payload.ruleVersion !== definition.ruleVersion) {
    throw new Error('Snapshot não corresponde ao convite reservado');
  }

  const answers = asClinicalInstrumentAnswerMap(payload, definition.toolKey.toUpperCase());
  const calculated = definition.calculate(answers);
  return {
    processedResult: {
      engineSource: 'nexus',
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
    },
    redFlags: calculated.redFlags ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const processorSecret = Deno.env.get('NEXUS_SELF_ASSESSMENT_PROCESSOR_SECRET');
  if (!supabaseUrl || !serviceRole || !processorSecret) {
    return json({ error: 'Processor de instrumentos não configurado no servidor' }, 503);
  }
  if (req.headers.get('x-processor-secret') !== processorSecret) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body?.limit) || 20, 100));
  const requestedScale = typeof body?.scaleKey === 'string' ? body.scaleKey.trim() : null;
  const legacyProcessors = CLINICAL_INSTRUMENT_PROCESSORS.filter((item) =>
    LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS.has(item.toolKey),
  );
  const selectedLegacyProcessors = requestedScale
    ? legacyProcessors.filter((item) => item.toolKey === requestedScale)
    : legacyProcessors;

  const results: Array<{
    inviteId: string;
    scaleKey: string;
    authority: 'nexus' | 'clinical_instrument';
    status: 'processed' | 'failed';
    resultId?: string;
    administrationId?: string;
    error?: string;
  }> = [];
  let claimed = 0;

  // Legacy Nexus invitations retain the exact Nexus lifecycle and result writer.
  for (const definition of selectedLegacyProcessors) {
    const { data, error } = await admin.rpc('claim_nexus_self_assessment_invites', {
      p_scale_key: definition.toolKey,
      p_rule_version: definition.ruleVersion,
      p_limit: limit,
    });
    if (error) {
      console.error('[nexus-self-assessment-processor] legacy claim:', definition.toolKey, error);
      return json({ error: `Não foi possível reservar submissões ${definition.toolKey}` }, 500);
    }

    const rows = (data ?? []) as ClaimedInvite[];
    claimed += rows.length;
    for (const invite of rows) {
      try {
        const { processedResult, redFlags } = calculateInvite(invite, definition);
        const { data: resultId, error: processError } = await admin.rpc('complete_nexus_self_assessment_processing', {
          p_invite_id: invite.invite_id,
          p_result: processedResult,
          p_red_flags: redFlags,
        });
        if (processError || !resultId) throw processError ?? new Error('Resultado Nexus não retornado');
        results.push({
          inviteId: invite.invite_id,
          scaleKey: definition.toolKey,
          authority: 'nexus',
          status: 'processed',
          resultId: String(resultId),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Falha desconhecida';
        console.error('[nexus-self-assessment-processor] legacy process:', invite.invite_id, reason);
        await admin.rpc('release_nexus_self_assessment_claim', { p_invite_id: invite.invite_id, p_error: reason });
        results.push({ inviteId: invite.invite_id, scaleKey: invite.scale_key, authority: 'nexus', status: 'failed', error: reason.slice(0, 300) });
      }
    }
  }

  // Neutral patient delivery is registry-driven. No PHQ/GAD hardcoded allowlist is
  // consulted here: the invitation could only be created through the DB delivery
  // contract, and the shared engine must still know the exact frozen version.
  if (!requestedScale || getClinicalInstrumentProcessor(requestedScale)) {
    const { data, error } = await admin.rpc('claim_clinical_instrument_patient_invites', { p_scale_key: requestedScale, p_limit: limit });
    if (error) {
      console.error('[nexus-self-assessment-processor] clinical claim:', error);
      return json({ error: 'Não foi possível reservar instrumentos enviados ao paciente' }, 500);
    }

    const rows = (data ?? []) as ClaimedInvite[];
    claimed += rows.length;
    for (const invite of rows) {
      try {
        const definition = getClinicalInstrumentProcessor(invite.scale_key);
        if (!definition) throw new Error('Instrumento clínico não suportado pela engine compartilhada');
        const { processedResult, redFlags } = calculateInvite(invite, definition);
        const { data: administrationId, error: processError } = await admin.rpc('complete_clinical_instrument_patient_self_processing', {
          p_invite_id: invite.invite_id,
          p_result: processedResult,
          p_safety_signals: redFlags,
        });
        if (processError || !administrationId) throw processError ?? new Error('Administração clínica não retornada');
        results.push({
          inviteId: invite.invite_id,
          scaleKey: invite.scale_key,
          authority: 'clinical_instrument',
          status: 'processed',
          administrationId: String(administrationId),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Falha desconhecida';
        console.error('[nexus-self-assessment-processor] clinical process:', invite.invite_id, reason);
        await admin.rpc('release_clinical_instrument_patient_claim', { p_invite_id: invite.invite_id, p_error: reason });
        results.push({ inviteId: invite.invite_id, scaleKey: invite.scale_key, authority: 'clinical_instrument', status: 'failed', error: reason.slice(0, 300) });
      }
    }
  }

  return json({
    claimed,
    processed: results.filter((item) => item.status === 'processed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    legacyNexusScales: legacyProcessors.map((item) => ({ scaleKey: item.toolKey, ruleVersion: item.ruleVersion })),
    results,
  });
});
