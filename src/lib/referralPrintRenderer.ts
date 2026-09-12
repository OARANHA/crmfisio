import type { ReferralPayload, ReferralRecipient } from './clinicalReferral';

export const REFERRAL_RENDER_LAYOUT_V1 = 'clinical-document/referral-v1' as const;

export type ReferralRenderDefinition = {
  layout: typeof REFERRAL_RENDER_LAYOUT_V1;
  title: string;
  showClinicAddress: boolean;
  showClinicPhone: boolean;
  showPatientBirthDate: boolean;
  showSpecialty: boolean;
};

export type ReferralRenderContext = {
  patient: { name: string; birthDate?: string | null };
  clinic: { name: string; address?: string | null; phone?: string | null };
  issuer: {
    name: string;
    professionalType?: string | null;
    councilType?: string | null;
    councilState?: string | null;
    registration?: string | null;
    specialty?: string | null;
  };
  issuedAt?: string | null;
  documentIdentifier?: string | null;
};

export type ReferralRenderInput = {
  payload: ReferralPayload;
  context: ReferralRenderContext;
  renderDefinition?: unknown;
  renderedSnapshot?: string | null;
  mode: 'draft' | 'issued';
  autoPrint?: boolean;
};

export const DEFAULT_REFERRAL_RENDER_DEFINITION: ReferralRenderDefinition = {
  layout: REFERRAL_RENDER_LAYOUT_V1,
  title: 'Encaminhamento clínico',
  showClinicAddress: true,
  showClinicPhone: true,
  showPatientBirthDate: true,
  showSpecialty: true,
};

const RENDER_DEFINITION_KEYS = new Set([
  'layout', 'title', 'show_clinic_address', 'show_clinic_phone', 'show_patient_birth_date', 'show_specialty',
]);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function normalizeReferralRenderDefinition(value: unknown): ReferralRenderDefinition | null {
  if (!isObject(value) || value.layout !== REFERRAL_RENDER_LAYOUT_V1) return null;
  if (Object.keys(value).some((key) => !RENDER_DEFINITION_KEYS.has(key))) return null;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 80) return null;
  if (typeof value.show_clinic_address !== 'boolean'
    || typeof value.show_clinic_phone !== 'boolean'
    || typeof value.show_patient_birth_date !== 'boolean'
    || typeof value.show_specialty !== 'boolean') return null;
  return {
    layout: REFERRAL_RENDER_LAYOUT_V1,
    title: value.title.trim(),
    showClinicAddress: value.show_clinic_address,
    showClinicPhone: value.show_clinic_phone,
    showPatientBirthDate: value.show_patient_birth_date,
    showSpecialty: value.show_specialty,
  };
}

export function serializeReferralRenderDefinition(value: ReferralRenderDefinition): Record<string, unknown> {
  return {
    layout: REFERRAL_RENDER_LAYOUT_V1,
    title: value.title.trim().slice(0, 80) || DEFAULT_REFERRAL_RENDER_DEFINITION.title,
    show_clinic_address: value.showClinicAddress,
    show_clinic_phone: value.showClinicPhone,
    show_patient_birth_date: value.showPatientBirthDate,
    show_specialty: value.showSpecialty,
  };
}

export function buildReferralDocumentHtml(input: ReferralRenderInput): string {
  const config = normalizeReferralRenderDefinition(input.renderDefinition);
  if (!config) return buildLegacyReferralHtml(input);

  const { context, payload } = input;
  const clinicDetails = [
    config.showClinicAddress ? context.clinic.address?.trim() : '',
    config.showClinicPhone ? context.clinic.phone?.trim() : '',
  ].filter(Boolean).join(' · ');
  const birthDate = config.showPatientBirthDate ? formatDateOnly(context.patient.birthDate) : '';
  const issuedAt = formatDateTime(context.issuedAt);
  const credential = formatCredential(context.issuer);
  const specialty = config.showSpecialty ? asString(context.issuer.specialty) : '';
  const professionalMeta = [humanizeProfessionalType(context.issuer.professionalType), credential, specialty]
    .filter(Boolean).map(escapeHtml).join(' · ');
  const destination = recipientHeadline(payload.recipient);
  const destinationMeta = recipientMeta(payload.recipient);
  const contact = payload.recipient.contact.trim();
  const priority = priorityLabel(payload.priority);
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>` : '';

  const clinicalSummary = payload.clinicalSummary.trim()
    ? section('Resumo clínico relevante', payload.clinicalSummary) : '';
  const requestedAction = payload.requestedAction.trim()
    ? section('Avaliação / ação solicitada', payload.requestedAction) : '';
  const observations = payload.observations.trim()
    ? section('Observações', payload.observations) : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(context.documentIdentifier || config.title)}</title>
<style>
:root{--navy:#153d6f;--navy-soft:#edf4fb;--ink:#111827;--muted:#667085;--line:#d9dee7;--surface:#f4f6f8;--paper:#fff;--amber:#b45309}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--surface);color:var(--ink);font-family:Inter,Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:var(--paper);padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)}.clinic{text-align:center;padding:0 0 18px;border-bottom:2px solid var(--navy)}.clinic-name{font-size:20px;font-weight:850;color:var(--navy)}.clinic-details{margin-top:5px;font-size:10px;line-height:1.45;color:var(--muted)}.professional{margin-top:22px;padding:12px 14px;border-left:3px solid var(--navy);background:var(--navy-soft)}.professional-name{font-size:12px;font-weight:800}.professional-meta{margin-top:3px;font-size:9.5px;color:var(--muted)}.document-title{text-align:center;margin:30px 0 24px;font-size:20px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--navy)}.patient{display:grid;grid-template-columns:1fr auto;gap:8px 20px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;font-size:11px}.issued-date{text-align:right;color:var(--muted)}.priority{margin-top:14px;text-align:right;font-size:10px;font-weight:800;color:var(--navy)}.destination{margin-top:24px;padding:15px 16px;border:1px solid var(--line);border-left:4px solid var(--navy);border-radius:8px}.section-label{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}.destination-name{margin-top:8px;font-size:12px;font-weight:800}.destination-meta,.destination-contact{margin-top:4px;font-size:10px;line-height:1.5;color:var(--muted)}.text-section{margin-top:22px;padding-top:13px;border-top:1px solid var(--line)}.text-section p{margin:7px 0 0;font-size:10.8px;line-height:1.65}.reason{margin-top:24px;padding:15px 16px;background:#fafbfc;border:1px solid var(--line);border-radius:8px}.reason p{margin:7px 0 0;font-size:11px;line-height:1.65}.signature{margin:64px auto 0;max-width:360px;text-align:center}.signature-line{border-top:1px solid var(--ink);padding-top:8px}.signature-name{font-size:11px;font-weight:800}.signature-meta{margin-top:3px;font-size:9px;color:var(--muted)}.signature-label{margin-top:7px;font-size:8.5px;color:var(--muted)}.footer{margin-top:36px;padding-top:10px;border-top:1px dashed var(--line);font-size:8.5px;color:#8a94a6;text-align:center;overflow-wrap:anywhere}
@media(max-width:640px){body{padding:8px}.sheet{min-height:760px;padding:26px 20px}.patient{grid-template-columns:1fr}.issued-date{text-align:left}}
@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}.patient,.professional,.destination,.signature{break-inside:avoid}}
</style></head><body>
<main class="sheet" data-referral-renderer="v1">${status}
<header class="clinic"><div class="clinic-name">${escapeHtml(context.clinic.name || 'Clínica')}</div>${clinicDetails ? `<div class="clinic-details">${escapeHtml(clinicDetails)}</div>` : ''}</header>
<section class="professional"><div class="professional-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${professionalMeta ? `<div class="professional-meta">${professionalMeta}</div>` : ''}</section>
<h1 class="document-title">${escapeHtml(config.title)}</h1>
<section class="patient"><div><strong>Paciente:</strong> ${escapeHtml(context.patient.name || 'Paciente')}</div>${issuedAt ? `<div class="issued-date"><strong>Data:</strong> ${escapeHtml(issuedAt)}</div>` : '<div></div>'}${birthDate ? `<div><strong>Nascimento:</strong> ${escapeHtml(birthDate)}</div>` : '<div></div>'}</section>
<div class="priority">Prioridade: ${escapeHtml(priority)}</div>
<section class="destination"><div class="section-label">Destino</div><div class="destination-name">${escapeHtml(destination || 'Destino não informado')}</div>${destinationMeta ? `<div class="destination-meta">${escapeHtml(destinationMeta)}</div>` : ''}${contact ? `<div class="destination-contact"><strong>Contato:</strong> ${escapeHtml(contact)}</div>` : ''}</section>
<section class="reason"><div class="section-label">Motivo do encaminhamento</div><p>${payload.reason.trim() ? nl2br(payload.reason.trim()) : 'Motivo ainda não informado.'}</p></section>
${clinicalSummary}${requestedAction}${observations}
<section class="signature"><div class="signature-line"><div class="signature-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${credential ? `<div class="signature-meta">${escapeHtml(credential)}</div>` : ''}<div class="signature-label">Assinatura do profissional responsável pelo encaminhamento</div></div></section>
${context.documentIdentifier ? `<footer class="footer">${escapeHtml(context.documentIdentifier)}</footer>` : ''}
</main>${autoPrintScript}</body></html>`;
}

export function buildReferralRenderContextFromSnapshot(
  contextSnapshot: Record<string, unknown> | null,
  fallbackPatientName: string,
  documentIdentifier?: string | null,
): ReferralRenderContext {
  const patient = objectAt(contextSnapshot, 'patient');
  const clinic = objectAt(contextSnapshot, 'clinic');
  const issuer = objectAt(contextSnapshot, 'issuer');
  return {
    patient: { name: asString(patient.name) || fallbackPatientName || 'Paciente', birthDate: asString(patient.birth_date) || null },
    clinic: { name: asString(clinic.name) || 'Clínica', address: asString(clinic.address) || null, phone: asString(clinic.phone) || null },
    issuer: {
      name: asString(issuer.name) || 'Profissional responsável',
      professionalType: asString(issuer.professional_type) || null,
      councilType: asString(issuer.council_type) || null,
      councilState: asString(issuer.council_state) || null,
      registration: asString(issuer.registro) || null,
      specialty: asString(issuer.specialty) || null,
    },
    issuedAt: asString(contextSnapshot?.issued_at) || null,
    documentIdentifier: documentIdentifier || null,
  };
}

function buildLegacyReferralHtml(input: ReferralRenderInput): string {
  const title = 'Encaminhamento clínico';
  const content = input.mode === 'issued' && (input.renderedSnapshot || '').trim()
    ? (input.renderedSnapshot || '').trim()
    : buildSafeLegacyText(input.payload, input.context);
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.context.documentIdentifier || title)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f4f6f8;color:#111827;font-family:Arial,Helvetica,sans-serif}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:white;padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309}.legacy-title{text-align:center;margin:0 0 24px;font-size:18px}.snapshot{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.65}.footer{margin-top:32px;padding-top:10px;border-top:1px dashed #d9dee7;font-size:8.5px;color:#8a94a6;text-align:center}@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}}</style></head><body><main class="sheet" data-referral-renderer="legacy">${status}<h1 class="legacy-title">${escapeHtml(title)}</h1><div class="snapshot">${nl2br(content)}</div>${input.context.documentIdentifier ? `<footer class="footer">${escapeHtml(input.context.documentIdentifier)}</footer>` : ''}</main>${autoPrintScript}</body></html>`;
}

function buildSafeLegacyText(payload: ReferralPayload, context: ReferralRenderContext): string {
  const lines = [
    'ENCAMINHAMENTO CLÍNICO',
    `Paciente: ${context.patient.name || 'Paciente'}`,
    `Destino: ${recipientHeadline(payload.recipient) || 'Destino não informado'}`,
    `Prioridade: ${priorityLabel(payload.priority)}`,
    '',
    `Motivo: ${payload.reason.trim() || 'Não informado'}`,
  ];
  if (payload.clinicalSummary.trim()) lines.push('', `Resumo clínico: ${payload.clinicalSummary.trim()}`);
  if (payload.requestedAction.trim()) lines.push('', `Avaliação / ação solicitada: ${payload.requestedAction.trim()}`);
  if (payload.observations.trim()) lines.push('', `Observações: ${payload.observations.trim()}`);
  return lines.join('\n');
}

function section(label: string, value: string): string {
  return `<section class="text-section"><div class="section-label">${escapeHtml(label)}</div><p>${nl2br(value.trim())}</p></section>`;
}

function recipientHeadline(recipient: ReferralRecipient): string {
  return [recipient.professionalName, recipient.specialty, recipient.service, recipient.facility]
    .map((value) => value.trim()).filter(Boolean).join(' · ');
}

function recipientMeta(recipient: ReferralRecipient): string {
  return [recipient.professionalType, recipient.specialty, recipient.service, recipient.facility]
    .map((value) => value.trim()).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ');
}

function priorityLabel(priority: ReferralPayload['priority']): string {
  if (priority === 'urgent') return 'Urgente';
  if (priority === 'high') return 'Prioridade alta';
  return 'Rotina';
}

function formatCredential(issuer: ReferralRenderContext['issuer']): string {
  const council = asString(issuer.councilType).toUpperCase();
  const state = asString(issuer.councilState).toUpperCase();
  const registration = asString(issuer.registration);
  if (!council && !registration) return '';
  const prefix = [council, state].filter(Boolean).join('-');
  return [prefix, registration].filter(Boolean).join(' ');
}

function humanizeProfessionalType(value: unknown): string {
  const normalized = asString(value).toLowerCase();
  const labels: Record<string, string> = {
    medico: 'Médico', 'médico': 'Médico', medica: 'Médica', 'médica': 'Médica',
    psicologo: 'Psicólogo', 'psicólogo': 'Psicólogo', psicologa: 'Psicóloga', 'psicóloga': 'Psicóloga',
    fisioterapeuta: 'Fisioterapeuta', nutricionista: 'Nutricionista', enfermeiro: 'Enfermeiro', enfermeira: 'Enfermeira',
  };
  return labels[normalized] || asString(value);
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function objectAt(value: Record<string, unknown> | null, key: string): Record<string, unknown> {
  const child = value?.[key];
  return isObject(child) ? child : {};
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}
