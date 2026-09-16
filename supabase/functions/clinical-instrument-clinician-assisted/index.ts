import { createClient } from 'npm:@supabase/supabase-js@2';
import { getClinicalInstrumentProcessor } from '../_shared/clinical-instrument-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeRpcStatus(message: string): { status: number; error: string } {
  if (message.includes('clinical_instrument_administration_not_authorized')
      || message.includes('clinical_instrument_administration_encounter_invalid')) {
    return { status: 403, error: 'Você não pode aplicar este instrumento neste atendimento.' };
  }
  if (message.includes('clinical_instrument_administration_idempotency_conflict')) {
    return { status: 409, error: 'A solicitação já foi usada com conteúdo diferente.' };
  }
  if (message.includes('clinical_instrument_administration_unknown_instrument')
      || message.includes('clinical_instrument_administration_engine_contract_mismatch')
      || message.includes('clinical_instrument_administration_invalid_')) {
    return { status: 400, error: 'Não foi possível validar esta aplicação clínica.' };
  }
  return { status: 500, error: 'Não foi possível registrar o instrumento clínico.' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return json({ error: 'Serviço clínico não configurado' }, 503);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: 'Sessão ausente' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId.trim() : '';
  const instrumentKey = typeof body?.instrumentKey === 'string' ? body.instrumentKey.trim().toLowerCase() : '';
  const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
  const answers = body?.answers;

  if (!UUID_RE.test(appointmentId) || !UUID_RE.test(requestId)) {
    return json({ error: 'Atendimento ou chave de solicitação inválida' }, 400);
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return json({ error: 'Respostas inválidas' }, 400);
  }

  const definition = getClinicalInstrumentProcessor(instrumentKey);
  if (!definition) return json({ error: 'Instrumento não suportado' }, 400);

  let calculated;
  try {
    calculated = definition.calculate(answers as Record<string, number>);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Respostas inválidas';
    console.warn('[clinical-instrument-clinician-assisted] invalid answers:', definition.toolKey, reason);
    return json({ error: 'Respostas incompletas ou fora da faixa permitida' }, 400);
  }

  // Persist only the validated canonical questions. Extra browser keys are never
  // allowed to become part of the clinical snapshot merely because the scorer
  // ignored them.
  const canonicalAnswers = calculated.canonicalAnswers ?? Object.fromEntries(
    calculated.answersArray.map((value, index) => [`q${index + 1}`, value]),
  );

  const resultContract = {
    engineSource: 'nexus',
    engineModuleKey: definition.moduleKey,
    engineToolKey: definition.toolKey,
    engineRuleKey: definition.ruleKey,
    engineRuleVersion: definition.ruleVersion,
    outputSnapshot: {
      recommendations: calculated.recommendations,
      answersArray: calculated.answersArray,
      clinicianAssisted: true,
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

  const { data, error } = await admin.rpc('record_clinician_assisted_clinical_instrument', {
    p_actor_user_id: authData.user.id,
    p_appointment_id: appointmentId,
    p_instrument_key: definition.toolKey,
    p_request_id: requestId,
    p_answers: canonicalAnswers,
    p_result: resultContract,
    p_safety_signals: calculated.redFlags ?? [],
  });

  if (error) {
    console.error('[clinical-instrument-clinician-assisted] persist:', {
      actor: authData.user.id,
      appointmentId,
      instrumentKey: definition.toolKey,
      code: error.code,
      message: error.message,
    });
    const safe = safeRpcStatus(error.message ?? '');
    return json({ error: safe.error }, safe.status);
  }

  return json({ administration: data });
});
