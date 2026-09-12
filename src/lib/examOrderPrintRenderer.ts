import type { ExamOrderPayload } from './clinicalExamOrder';

export const EXAM_ORDER_RENDER_LAYOUT_V1 = 'clinical-document/exam-order-v1' as const;

export type ExamOrderRenderDefinition = {
  layout: typeof EXAM_ORDER_RENDER_LAYOUT_V1;
  title: string;
  showClinicAddress: boolean;
  showClinicPhone: boolean;
  showPatientBirthDate: boolean;
  showSpecialty: boolean;
};

export type ExamOrderRenderContext = {
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

export type ExamOrderRenderInput = {
  payload: ExamOrderPayload;
  context: ExamOrderRenderContext;
  renderDefinition?: unknown;
  renderedSnapshot?: string | null;
  mode: 'draft' | 'issued';
  autoPrint?: boolean;
};

export const DEFAULT_EXAM_ORDER_RENDER_DEFINITION: ExamOrderRenderDefinition = {
  layout: EXAM_ORDER_RENDER_LAYOUT_V1,
  title: 'Pedido de exames',
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

export function normalizeExamOrderRenderDefinition(value: unknown): ExamOrderRenderDefinition | null {
  if (!isObject(value) || value.layout !== EXAM_ORDER_RENDER_LAYOUT_V1) return null;
  if (Object.keys(value).some((key) => !RENDER_DEFINITION_KEYS.has(key))) return null;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 80) return null;
  if (typeof value.show_clinic_address !== 'boolean'
    || typeof value.show_clinic_phone !== 'boolean'
    || typeof value.show_patient_birth_date !== 'boolean'
    || typeof value.show_specialty !== 'boolean') return null;
  return {
    layout: EXAM_ORDER_RENDER_LAYOUT_V1,
    title: value.title.trim(),
    showClinicAddress: value.show_clinic_address,
    showClinicPhone: value.show_clinic_phone,
    showPatientBirthDate: value.show_patient_birth_date,
    showSpecialty: value.show_specialty,
  };
}

export function serializeExamOrderRenderDefinition(value: ExamOrderRenderDefinition): Record<string, unknown> {
  return {
    layout: EXAM_ORDER_RENDER_LAYOUT_V1,
    title: value.title.trim().slice(0, 80) || DEFAULT_EXAM_ORDER_RENDER_DEFINITION.title,
    show_clinic_address: value.showClinicAddress,
    show_clinic_phone: value.showClinicPhone,
    show_patient_birth_date: value.showPatientBirthDate,
    show_specialty: value.showSpecialty,
  };
}

export function buildExamOrderDocumentHtml(input: ExamOrderRenderInput): string {
  const config = normalizeExamOrderRenderDefinition(input.renderDefinition);
  if (!config) return buildLegacyExamOrderHtml(input);

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
  const priority = priorityLabel(payload.priority);
  const items = payload.items
    .map((item, index) => {
      const name = item.examName.trim();
      if (!name) return '';
      const meta = [item.category.trim(), item.code.trim() ? `Código: ${item.code.trim()}` : ''].filter(Boolean).join(' · ');
      const urgent = item.urgent ? '<span class="urgent">Urgente</span>' : '';
      const instructions = item.instructions.trim() ? `<div class="instructions"><strong>Instruções:</strong> ${nl2br(item.instructions.trim())}</div>` : '';
      return `<li><span class="item-number">${index + 1}</span><div class="item-body"><div class="item-head"><strong>${escapeHtml(name)}</strong>${urgent}</div>${meta ? `<div class="item-meta">${escapeHtml(meta)}</div>` : ''}${instructions}</div></li>`;
    }).filter(Boolean).join('');
  const clinicalIndication = payload.clinicalIndication.trim()
    ? `<section class="text-section"><div class="section-label">Indicação clínica</div><p>${nl2br(payload.clinicalIndication.trim())}</p></section>` : '';
  const impression = payload.impression.trim()
    ? `<section class="text-section"><div class="section-label">Hipótese / impressão clínica</div><p>${nl2br(payload.impression.trim())}</p></section>` : '';
  const observations = payload.observations.trim()
    ? `<section class="text-section"><div class="section-label">Observações</div><p>${nl2br(payload.observations.trim())}</p></section>` : '';
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>` : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(context.documentIdentifier || config.title)}</title>
<style>
:root{--navy:#153d6f;--navy-soft:#edf4fb;--ink:#111827;--muted:#667085;--line:#d9dee7;--surface:#f4f6f8;--paper:#fff;--danger:#b42318}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--surface);color:var(--ink);font-family:Inter,Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:var(--paper);padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#b45309}.clinic{text-align:center;padding:0 0 18px;border-bottom:2px solid var(--navy)}.clinic-name{font-size:20px;font-weight:850;color:var(--navy)}.clinic-details{margin-top:5px;font-size:10px;line-height:1.45;color:var(--muted)}.professional{margin-top:22px;padding:12px 14px;border-left:3px solid var(--navy);background:var(--navy-soft)}.professional-name{font-size:12px;font-weight:800}.professional-meta{margin-top:3px;font-size:9.5px;color:var(--muted)}.document-title{text-align:center;margin:30px 0 24px;font-size:20px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--navy)}.patient{display:grid;grid-template-columns:1fr auto;gap:8px 20px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;font-size:11px}.issued-date{text-align:right;color:var(--muted)}.priority{margin-top:14px;text-align:right;font-size:10px;font-weight:800;color:var(--navy)}.section{margin-top:25px}.section-label{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}.exam-list{list-style:none;margin:10px 0 0;padding:0}.exam-list li{display:grid;grid-template-columns:24px 1fr;gap:10px;padding:12px 0;border-bottom:1px solid #edf0f4;font-size:11.5px;line-height:1.5}.item-number{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:var(--navy-soft);color:var(--navy);font-size:10px;font-weight:850}.item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.item-meta{margin-top:3px;font-size:9.5px;color:var(--muted)}.urgent{font-size:8.5px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:var(--danger)}.instructions{margin-top:6px;font-size:10.3px;color:#344054}.text-section{margin-top:22px;padding-top:13px;border-top:1px solid var(--line)}.text-section p{margin:7px 0 0;font-size:10.8px;line-height:1.6}.signature{margin:64px auto 0;max-width:360px;text-align:center}.signature-line{border-top:1px solid var(--ink);padding-top:8px}.signature-name{font-size:11px;font-weight:800}.signature-meta{margin-top:3px;font-size:9px;color:var(--muted)}.signature-label{margin-top:7px;font-size:8.5px;color:var(--muted)}.footer{margin-top:36px;padding-top:10px;border-top:1px dashed var(--line);font-size:8.5px;color:#8a94a6;text-align:center;overflow-wrap:anywhere}
@media(max-width:640px){body{padding:8px}.sheet{min-height:760px;padding:26px 20px}.patient{grid-template-columns:1fr}.issued-date{text-align:left}}
@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}.patient,.professional,.exam-list li,.signature{break-inside:avoid}}
</style></head><body>
<main class="sheet" data-exam-order-renderer="v1">${status}
<header class="clinic"><div class="clinic-name">${escapeHtml(context.clinic.name || 'Clínica')}</div>${clinicDetails ? `<div class="clinic-details">${escapeHtml(clinicDetails)}</div>` : ''}</header>
<section class="professional"><div class="professional-name">${escapeHtml(context.issuer.name || 'Profissional solicitante')}</div>${professionalMeta ? `<div class="professional-meta">${professionalMeta}</div>` : ''}</section>
<h1 class="document-title">${escapeHtml(config.title)}</h1>
<section class="patient"><div><strong>Paciente:</strong> ${escapeHtml(context.patient.name || 'Paciente')}</div>${issuedAt ? `<div class="issued-date"><strong>Data:</strong> ${escapeHtml(issuedAt)}</div>` : '<div></div>'}${birthDate ? `<div><strong>Nascimento:</strong> ${escapeHtml(birthDate)}</div>` : '<div></div>'}</section>
<div class="priority">Prioridade: ${escapeHtml(priority)}</div>
<section class="section"><div class="section-label">Exames solicitados</div><ol class="exam-list">${items || '<li><span class="item-number">—</span><div>Nenhum exame preenchido.</div></li>'}</ol></section>
${clinicalIndication}${impression}${observations}
<section class="signature"><div class="signature-line"><div class="signature-name">${escapeHtml(context.issuer.name || 'Profissional solicitante')}</div>${credential ? `<div class="signature-meta">${escapeHtml(credential)}</div>` : ''}<div class="signature-label">Assinatura do profissional solicitante</div></div></section>
${context.documentIdentifier ? `<footer class="footer">${escapeHtml(context.documentIdentifier)}</footer>` : ''}
</main>${autoPrintScript}</body></html>`;
}

export function buildExamOrderRenderContextFromSnapshot(
  contextSnapshot: Record<string, unknown> | null,
  fallbackPatientName: string,
  documentIdentifier?: string | null,
): ExamOrderRenderContext {
  const patient = objectAt(contextSnapshot, 'patient');
  const clinic = objectAt(contextSnapshot, 'clinic');
  const issuer = objectAt(contextSnapshot, 'issuer');
  return {
    patient: { name: asString(patient.name) || fallbackPatientName || 'Paciente', birthDate: asString(patient.birth_date) || null },
    clinic: { name: asString(clinic.name) || 'Clínica', address: asString(clinic.address) || null, phone: asString(clinic.phone) || null },
    issuer: {
      name: asString(issuer.name) || 'Profissional solicitante',
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

function buildLegacyExamOrderHtml(input: ExamOrderRenderInput): string {
  const title = 'Pedido de exames';
  const content = input.mode === 'issued' && (input.renderedSnapshot || '').trim()
    ? (input.renderedSnapshot || '').trim()
    : buildSafeLegacyText(input.payload, input.context);
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.context.documentIdentifier || title)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f4f6f8;color:#111827;font-family:Arial,Helvetica,sans-serif}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:white;padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309}.legacy-title{text-align:center;margin:0 0 24px;font-size:18px}.snapshot{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.65}.footer{margin-top:32px;padding-top:10px;border-top:1px dashed #d9dee7;font-size:8.5px;color:#8a94a6;text-align:center}@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}}</style></head><body><main class="sheet" data-exam-order-renderer="legacy">${status}<h1 class="legacy-title">${escapeHtml(title)}</h1><div class="snapshot">${nl2br(content)}</div>${input.context.documentIdentifier ? `<footer class="footer">${escapeHtml(input.context.documentIdentifier)}</footer>` : ''}</main>${autoPrintScript}</body></html>`;
}

function buildSafeLegacyText(payload: ExamOrderPayload, context: ExamOrderRenderContext): string {
  const lines = ['PEDIDO DE EXAMES', `Paciente: ${context.patient.name || 'Paciente'}`, `Prioridade: ${priorityLabel(payload.priority)}`, ''];
  payload.items.forEach((item, index) => {
    if (!item.examName.trim()) return;
    lines.push(`${index + 1}. ${item.examName.trim()}${item.urgent ? ' — URGENTE' : ''}`);
    if (item.category.trim() || item.code.trim()) lines.push(`   ${[item.category.trim(), item.code.trim()].filter(Boolean).join(' · ')}`);
    if (item.instructions.trim()) lines.push(`   Instruções: ${item.instructions.trim()}`);
  });
  if (payload.clinicalIndication.trim()) lines.push('', 'Indicação clínica:', payload.clinicalIndication.trim());
  if (payload.impression.trim()) lines.push('', 'Hipótese / impressão clínica:', payload.impression.trim());
  if (payload.observations.trim()) lines.push('', 'Observações:', payload.observations.trim());
  return lines.join('\n');
}

function priorityLabel(value: ExamOrderPayload['priority']): string {
  if (value === 'urgent') return 'Urgente';
  if (value === 'high') return 'Alta';
  return 'Rotina';
}

function formatCredential(issuer: ExamOrderRenderContext['issuer']): string {
  const council = asString(issuer.councilType).toUpperCase();
  const state = asString(issuer.councilState).toUpperCase();
  const registration = asString(issuer.registration);
  if (!registration) return '';
  return `${council ? `${council}${state ? `-${state}` : ''} ` : ''}${registration}`.trim();
}

function humanizeProfessionalType(value: string | null | undefined): string {
  const normalized = asString(value).toLowerCase();
  if (['medico', 'médico', 'medica', 'médica', 'physician', 'doctor'].includes(normalized)) return 'Médico(a)';
  if (['fisioterapeuta', 'fisio', 'physiotherapist'].includes(normalized)) return 'Fisioterapeuta';
  return asString(value);
}

function objectAt(value: Record<string, unknown> | null, key: string): Record<string, unknown> {
  if (!value) return {};
  const nested = value[key];
  return isObject(nested) ? nested : {};
}

function formatDateOnly(value: string | null | undefined): string {
  const raw = asString(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function formatDateTime(value: string | null | undefined): string {
  const raw = asString(value);
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('pt-BR');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}
