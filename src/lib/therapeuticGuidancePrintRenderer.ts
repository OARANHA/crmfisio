import type { TherapeuticGuidancePayload } from './clinicalTherapeuticGuidance';

export const THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1 = 'clinical-document/therapeutic-guidance-v1' as const;

export type TherapeuticGuidanceRenderDefinition = {
  layout: typeof THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1;
  title: string;
  showClinicAddress: boolean;
  showClinicPhone: boolean;
  showPatientBirthDate: boolean;
  showSpecialty: boolean;
};

export type TherapeuticGuidanceRenderContext = {
  patient: {
    name: string;
    birthDate?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
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

export type TherapeuticGuidanceRenderInput = {
  payload: TherapeuticGuidancePayload;
  context: TherapeuticGuidanceRenderContext;
  renderDefinition?: unknown;
  renderedSnapshot?: string | null;
  mode: 'draft' | 'issued';
  autoPrint?: boolean;
};

export const DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION: TherapeuticGuidanceRenderDefinition = {
  layout: THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1,
  title: 'Orientações terapêuticas',
  showClinicAddress: true,
  showClinicPhone: true,
  showPatientBirthDate: true,
  showSpecialty: true,
};

const RENDER_DEFINITION_KEYS = new Set([
  'layout',
  'title',
  'show_clinic_address',
  'show_clinic_phone',
  'show_patient_birth_date',
  'show_specialty',
]);

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function normalizeTherapeuticGuidanceRenderDefinition(value: unknown): TherapeuticGuidanceRenderDefinition | null {
  if (!isObject(value) || value.layout !== THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1) return null;
  if (Object.keys(value).some((key) => !RENDER_DEFINITION_KEYS.has(key))) return null;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 80) return null;
  if (typeof value.show_clinic_address !== 'boolean'
    || typeof value.show_clinic_phone !== 'boolean'
    || typeof value.show_patient_birth_date !== 'boolean'
    || typeof value.show_specialty !== 'boolean') return null;

  return {
    layout: THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1,
    title: value.title.trim(),
    showClinicAddress: value.show_clinic_address,
    showClinicPhone: value.show_clinic_phone,
    showPatientBirthDate: value.show_patient_birth_date,
    showSpecialty: value.show_specialty,
  };
}

export function serializeTherapeuticGuidanceRenderDefinition(value: TherapeuticGuidanceRenderDefinition): Record<string, unknown> {
  return {
    layout: THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1,
    title: value.title.trim().slice(0, 80) || DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION.title,
    show_clinic_address: value.showClinicAddress,
    show_clinic_phone: value.showClinicPhone,
    show_patient_birth_date: value.showPatientBirthDate,
    show_specialty: value.showSpecialty,
  };
}

export function buildTherapeuticGuidanceDocumentHtml(input: TherapeuticGuidanceRenderInput): string {
  const config = normalizeTherapeuticGuidanceRenderDefinition(input.renderDefinition);
  if (!config) return buildLegacyTherapeuticGuidanceHtml(input);

  const context = input.context;
  const clinicDetails = [
    config.showClinicAddress ? context.clinic.address?.trim() : '',
    config.showClinicPhone ? context.clinic.phone?.trim() : '',
  ].filter(Boolean).join(' · ');
  const birthDate = config.showPatientBirthDate ? formatDateOnly(context.patient.birthDate) : '';
  const issuedAt = formatDateTime(context.issuedAt);
  const credential = formatCredential(context.issuer);
  const specialty = config.showSpecialty ? asString(context.issuer.specialty) : '';
  const professionalMeta = [humanizeProfessionalType(context.issuer.professionalType), credential, specialty]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const guidanceItems = input.payload.items
    .map((item) => item.guidance.trim())
    .filter(Boolean)
    .map((guidance, index) => `<li><span class="item-number">${index + 1}</span><div>${nl2br(guidance)}</div></li>`)
    .join('');
  const instructions = input.payload.patientInstructions.trim()
    ? `<section class="text-section"><div class="section-label">Instruções ao paciente</div><p>${nl2br(input.payload.patientInstructions.trim())}</p></section>`
    : '';
  const observations = input.payload.observations.trim()
    ? `<section class="text-section observations"><div class="section-label">Observações</div><p>${nl2br(input.payload.observations.trim())}</p></section>`
    : '';
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(context.documentIdentifier || config.title)}</title>
<style>
:root{--navy:#153d6f;--navy-soft:#edf4fb;--ink:#111827;--muted:#667085;--line:#d9dee7;--surface:#f4f6f8;--paper:#fff}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--surface);color:var(--ink);font-family:Inter,Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:var(--paper);padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#b45309}.clinic{text-align:center;padding:0 0 18px;border-bottom:2px solid var(--navy)}.clinic-name{font-size:20px;font-weight:850;color:var(--navy)}.clinic-details{margin-top:5px;font-size:10px;line-height:1.45;color:var(--muted)}.professional{margin-top:22px;padding:12px 14px;border-left:3px solid var(--navy);background:var(--navy-soft)}.professional-name{font-size:12px;font-weight:800}.professional-meta{margin-top:3px;font-size:9.5px;color:var(--muted)}.document-title{text-align:center;margin:30px 0 24px;font-size:20px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--navy)}.patient{display:grid;grid-template-columns:1fr auto;gap:8px 20px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;font-size:11px}.issued-date{text-align:right;color:var(--muted)}.section{margin-top:27px}.section-label{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}.guidance-list{list-style:none;margin:10px 0 0;padding:0}.guidance-list li{display:grid;grid-template-columns:24px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid #edf0f4;font-size:11.5px;line-height:1.58}.item-number{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:var(--navy-soft);color:var(--navy);font-size:10px;font-weight:850}.text-section{margin-top:24px;padding-top:14px;border-top:1px solid var(--line)}.text-section p{margin:7px 0 0;font-size:10.8px;line-height:1.6}.signature{margin:52px auto 0;max-width:340px;text-align:center}.signature-line{border-top:1px solid var(--ink);padding-top:8px}.signature-name{font-size:11px;font-weight:800}.signature-meta{margin-top:3px;font-size:9px;color:var(--muted)}.footer{margin-top:36px;padding-top:10px;border-top:1px dashed var(--line);font-size:8.5px;color:#8a94a6;text-align:center;overflow-wrap:anywhere}
@media(max-width:640px){body{padding:8px}.sheet{min-height:760px;padding:26px 20px}.patient{grid-template-columns:1fr}.issued-date{text-align:left}}
@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}.patient,.professional,.guidance-list li,.signature{break-inside:avoid}}
</style>
</head>
<body>
<main class="sheet" data-therapeutic-guidance-renderer="v1">
${status}
<header class="clinic"><div class="clinic-name">${escapeHtml(context.clinic.name || 'Clínica')}</div>${clinicDetails ? `<div class="clinic-details">${escapeHtml(clinicDetails)}</div>` : ''}</header>
<section class="professional"><div class="professional-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${professionalMeta ? `<div class="professional-meta">${professionalMeta}</div>` : ''}</section>
<h1 class="document-title">${escapeHtml(config.title)}</h1>
<section class="patient"><div><strong>Paciente:</strong> ${escapeHtml(context.patient.name || 'Paciente')}</div>${issuedAt ? `<div class="issued-date"><strong>Data:</strong> ${escapeHtml(issuedAt)}</div>` : '<div></div>'}${birthDate ? `<div><strong>Nascimento:</strong> ${escapeHtml(birthDate)}</div>` : '<div></div>'}</section>
<section class="section"><div class="section-label">Orientações</div><ol class="guidance-list">${guidanceItems || '<li><span class="item-number">—</span><div>Nenhuma orientação preenchida.</div></li>'}</ol></section>
${instructions}
${observations}
<section class="signature"><div class="signature-line"><div class="signature-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${credential ? `<div class="signature-meta">${escapeHtml(credential)}</div>` : ''}</div></section>
${context.documentIdentifier ? `<footer class="footer">${escapeHtml(context.documentIdentifier)}</footer>` : ''}
</main>
${autoPrintScript}
</body>
</html>`;
}

export function buildTherapeuticGuidanceRenderContextFromSnapshot(
  contextSnapshot: Record<string, unknown> | null,
  fallbackPatientName: string,
  documentIdentifier?: string | null,
): TherapeuticGuidanceRenderContext {
  const patient = objectAt(contextSnapshot, 'patient');
  const clinic = objectAt(contextSnapshot, 'clinic');
  const issuer = objectAt(contextSnapshot, 'issuer');
  return {
    patient: {
      name: asString(patient.name) || fallbackPatientName || 'Paciente',
      birthDate: asString(patient.birth_date) || null,
    },
    clinic: {
      name: asString(clinic.name) || 'Clínica',
      address: asString(clinic.address) || null,
      phone: asString(clinic.phone) || null,
    },
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

function buildLegacyTherapeuticGuidanceHtml(input: TherapeuticGuidanceRenderInput): string {
  const title = 'Orientação terapêutica';
  const content = input.mode === 'issued' && (input.renderedSnapshot || '').trim()
    ? (input.renderedSnapshot || '').trim()
    : buildSafeLegacyText(input.payload, input.context);
  const status = input.mode === 'draft' ? '<div class="status">Pré-visualização · sem validade</div>' : '';
  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){window.setTimeout(function(){window.print();},60);});<\/script>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.context.documentIdentifier || title)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#f4f6f8;color:#111827;font-family:Arial,Helvetica,sans-serif}body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:white;padding:46px 52px;border:1px solid #e5e7eb}.status{text-align:right;margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309}.legacy-title{text-align:center;margin:0 0 24px;font-size:18px}.snapshot{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.65}.footer{margin-top:32px;padding-top:10px;border-top:1px dashed #d9dee7;font-size:8.5px;color:#8a94a6;text-align:center}@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}}</style></head><body><main class="sheet" data-therapeutic-guidance-renderer="legacy">${status}<h1 class="legacy-title">${escapeHtml(title)}</h1><div class="snapshot">${nl2br(content)}</div>${input.context.documentIdentifier ? `<footer class="footer">${escapeHtml(input.context.documentIdentifier)}</footer>` : ''}</main>${autoPrintScript}</body></html>`;
}

function buildSafeLegacyText(payload: TherapeuticGuidancePayload, context: TherapeuticGuidanceRenderContext): string {
  const lines = [
    'ORIENTAÇÃO TERAPÊUTICA',
    `Paciente: ${context.patient.name || 'Paciente'}`,
    '',
    ...payload.items.map((item, index) => `${index + 1}. ${item.guidance.trim()}`).filter((line) => !line.endsWith('. ')),
  ];
  if (payload.patientInstructions.trim()) lines.push('', 'Instruções ao paciente:', payload.patientInstructions.trim());
  if (payload.observations.trim()) lines.push('', 'Observações:', payload.observations.trim());
  return lines.join('\n');
}

function formatCredential(issuer: TherapeuticGuidanceRenderContext['issuer']): string {
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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}
