import type { MedicationPrescriptionPayload } from './clinicalPrescription';

export const PRESCRIPTION_RENDER_LAYOUT_V2 = 'clinical-document/prescription-v2' as const;

export type PrescriptionPrintPreset = 'classic' | 'institutional' | 'compact';
export type PrescriptionPrintAccent = 'monochrome' | 'navy' | 'emerald';
export type PrescriptionMedicationStyle = 'numbered' | 'cards';

export type PrescriptionRenderDefinition = {
  layout: typeof PRESCRIPTION_RENDER_LAYOUT_V2;
  preset: PrescriptionPrintPreset;
  accent: PrescriptionPrintAccent;
  title: string;
  medicationStyle: PrescriptionMedicationStyle;
  showClinicAddress: boolean;
  showClinicPhone: boolean;
  showPatientBirthDate: boolean;
  showSpecialty: boolean;
};

export type PrescriptionRenderContext = {
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
    councilType?: string | null;
    councilState?: string | null;
    registration?: string | null;
    specialty?: string | null;
  };
  issuedAt?: string | null;
  documentIdentifier?: string | null;
};

export type PrescriptionRenderInput = {
  payload: MedicationPrescriptionPayload;
  context: PrescriptionRenderContext;
  renderDefinition?: unknown;
  mode: 'draft' | 'issued' | 'admin-preview';
  autoPrint?: boolean;
};

export const DEFAULT_PRESCRIPTION_RENDER_DEFINITION: PrescriptionRenderDefinition = {
  layout: PRESCRIPTION_RENDER_LAYOUT_V2,
  preset: 'institutional',
  accent: 'navy',
  title: 'Receita médica',
  medicationStyle: 'cards',
  showClinicAddress: true,
  showClinicPhone: true,
  showPatientBirthDate: true,
  showSpecialty: true,
};

export const PRESCRIPTION_PRESET_OPTIONS: Array<{ value: PrescriptionPrintPreset; label: string; description: string }> = [
  { value: 'classic', label: 'Clássico', description: 'Documento sóbrio, com hierarquia tradicional e alta compatibilidade de impressão.' },
  { value: 'institutional', label: 'Institucional', description: 'Cabeçalho destacado da clínica e blocos bem definidos para leitura rápida.' },
  { value: 'compact', label: 'Compacto', description: 'Menos espaço vertical para prescrições objetivas e listas maiores.' },
];

export const PRESCRIPTION_ACCENT_OPTIONS: Array<{ value: PrescriptionPrintAccent; label: string }> = [
  { value: 'monochrome', label: 'Preto e branco' },
  { value: 'navy', label: 'Azul institucional' },
  { value: 'emerald', label: 'Verde clínico' },
];

const ACCENTS: Record<PrescriptionPrintAccent, { primary: string; soft: string; ink: string }> = {
  monochrome: { primary: '#111827', soft: '#f3f4f6', ink: '#111827' },
  navy: { primary: '#153d6f', soft: '#edf4fb', ink: '#153d6f' },
  emerald: { primary: '#087a5b', soft: '#ecf8f3', ink: '#075f49' },
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const asBoolean = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;

export function normalizePrescriptionRenderDefinition(value: unknown): PrescriptionRenderDefinition {
  const source = isObject(value) ? value : {};
  if (source.layout !== PRESCRIPTION_RENDER_LAYOUT_V2) return { ...DEFAULT_PRESCRIPTION_RENDER_DEFINITION, preset: 'classic', accent: 'monochrome', medicationStyle: 'numbered' };

  const preset = source.preset === 'classic' || source.preset === 'compact' || source.preset === 'institutional'
    ? source.preset
    : DEFAULT_PRESCRIPTION_RENDER_DEFINITION.preset;
  const accent = source.accent === 'monochrome' || source.accent === 'navy' || source.accent === 'emerald'
    ? source.accent
    : DEFAULT_PRESCRIPTION_RENDER_DEFINITION.accent;
  const medicationStyle = source.medication_style === 'numbered' || source.medication_style === 'cards'
    ? source.medication_style
    : DEFAULT_PRESCRIPTION_RENDER_DEFINITION.medicationStyle;
  const title = asString(source.title).slice(0, 80) || DEFAULT_PRESCRIPTION_RENDER_DEFINITION.title;

  return {
    layout: PRESCRIPTION_RENDER_LAYOUT_V2,
    preset,
    accent,
    title,
    medicationStyle,
    showClinicAddress: asBoolean(source.show_clinic_address, DEFAULT_PRESCRIPTION_RENDER_DEFINITION.showClinicAddress),
    showClinicPhone: asBoolean(source.show_clinic_phone, DEFAULT_PRESCRIPTION_RENDER_DEFINITION.showClinicPhone),
    showPatientBirthDate: asBoolean(source.show_patient_birth_date, DEFAULT_PRESCRIPTION_RENDER_DEFINITION.showPatientBirthDate),
    showSpecialty: asBoolean(source.show_specialty, DEFAULT_PRESCRIPTION_RENDER_DEFINITION.showSpecialty),
  };
}

export function serializePrescriptionRenderDefinition(value: PrescriptionRenderDefinition): Record<string, unknown> {
  return {
    layout: PRESCRIPTION_RENDER_LAYOUT_V2,
    preset: value.preset,
    accent: value.accent,
    title: value.title.trim().slice(0, 80) || DEFAULT_PRESCRIPTION_RENDER_DEFINITION.title,
    medication_style: value.medicationStyle,
    show_clinic_address: value.showClinicAddress,
    show_clinic_phone: value.showClinicPhone,
    show_patient_birth_date: value.showPatientBirthDate,
    show_specialty: value.showSpecialty,
  };
}

export function prescriptionRenderDefinitionLabel(value: unknown): string {
  const config = normalizePrescriptionRenderDefinition(value);
  return PRESCRIPTION_PRESET_OPTIONS.find((option) => option.value === config.preset)?.label ?? 'Clássico';
}

export function buildPrescriptionDocumentHtml(input: PrescriptionRenderInput): string {
  const config = normalizePrescriptionRenderDefinition(input.renderDefinition);
  const accent = ACCENTS[config.accent];
  const compact = config.preset === 'compact';
  const institutional = config.preset === 'institutional';
  const context = input.context;
  const patientBirthDate = config.showPatientBirthDate ? formatDateOnly(context.patient.birthDate) : '';
  const clinicDetails = [
    config.showClinicAddress ? context.clinic.address?.trim() : '',
    config.showClinicPhone ? context.clinic.phone?.trim() : '',
  ].filter(Boolean).join(' · ');
  const credential = formatCredential(context.issuer);
  const issuedAt = formatDateTime(context.issuedAt);
  const statusLabel = input.mode === 'issued' ? '' : 'Pré-visualização · sem validade';
  const specialty = config.showSpecialty ? (context.issuer.specialty?.trim() || '') : '';

  const medicationItems = input.payload.items
    .filter((item) => item.medicationName.trim() || item.dose.trim() || item.route.trim() || item.frequency.trim() || item.duration.trim() || item.instructions.trim())
    .map((item, index) => {
      const name = escapeHtml(item.medicationName.trim() || 'Medicamento não identificado');
      const summary = [item.dose, item.route, item.frequency, item.duration].map((part) => part.trim()).filter(Boolean).join(' · ');
      const instructions = item.instructions.trim();
      if (config.medicationStyle === 'cards') {
        return `<li class="med-card"><div class="med-name">${index + 1}. ${name}</div>${summary ? `<div class="med-summary">${escapeHtml(summary)}</div>` : ''}${instructions ? `<div class="med-instructions">${nl2br(instructions)}</div>` : ''}</li>`;
      }
      return `<li class="med-line"><div class="med-name">${index + 1}. ${name}</div>${summary ? `<div class="med-summary">${escapeHtml(summary)}</div>` : ''}${instructions ? `<div class="med-instructions">${nl2br(instructions)}</div>` : ''}</li>`;
    }).join('');

  const observations = input.payload.observations.trim()
    ? `<section class="observations"><div class="section-label">Observações</div><p>${nl2br(input.payload.observations.trim())}</p></section>`
    : '';

  const professionalMeta = [credential, specialty].filter(Boolean).map(escapeHtml).join(' · ');
  const clinicHeader = institutional
    ? `<header class="clinic-header institutional"><div class="clinic-name">${escapeHtml(context.clinic.name || 'Clínica')}</div>${clinicDetails ? `<div class="clinic-details">${escapeHtml(clinicDetails)}</div>` : ''}</header>`
    : `<header class="clinic-header"><div class="clinic-name">${escapeHtml(context.clinic.name || 'Clínica')}</div>${clinicDetails ? `<div class="clinic-details">${escapeHtml(clinicDetails)}</div>` : ''}</header>`;

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
:root{--accent:${accent.primary};--accent-soft:${accent.soft};--accent-ink:${accent.ink};--ink:#111827;--muted:#667085;--line:#d9dee7;--paper:#fff;--surface:#f6f8fb}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--surface);color:var(--ink);font-family:Inter,Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:18px}.sheet{width:min(100%,794px);min-height:1090px;margin:0 auto;background:var(--paper);padding:${compact ? '34px 42px' : '46px 52px'};border:1px solid #e5e7eb}
.status{margin:0 0 14px;text-align:right;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309}
.clinic-header{text-align:center;padding-bottom:${compact ? '12px' : '18px'};border-bottom:2px solid var(--ink)}.clinic-header.institutional{margin:${compact ? '-34px -42px 20px' : '-46px -52px 26px'};padding:${compact ? '18px 26px' : '22px 32px'};border:0;background:var(--accent);color:white}.clinic-name{font-size:${compact ? '16px' : '20px'};font-weight:800;letter-spacing:.01em}.clinic-details{margin-top:5px;font-size:10px;line-height:1.45;opacity:.88}
.professional{margin-top:${compact ? '16px' : '22px'};padding:${compact ? '10px 12px' : '12px 14px'};border-left:3px solid var(--accent);background:var(--accent-soft)}.professional-name{font-size:12px;font-weight:800}.professional-meta{margin-top:3px;font-size:9.5px;color:var(--muted)}
.document-title{text-align:center;margin:${compact ? '20px 0 16px' : '30px 0 24px'};font-size:${compact ? '17px' : '20px'};font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-ink)}
.patient{display:grid;grid-template-columns:1fr auto;gap:8px 20px;padding:${compact ? '10px 12px' : '14px 16px'};border:1px solid var(--line);border-radius:8px;font-size:11px}.patient strong{font-weight:800}.issued-date{text-align:right;color:var(--muted)}
.section-label{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink)}.medications{margin-top:${compact ? '18px' : '26px'}}.med-list{list-style:none;padding:0;margin:10px 0 0}.med-card{padding:${compact ? '9px 10px' : '12px 14px'};border:1px solid var(--line);border-radius:7px;margin-bottom:9px}.med-line{padding:${compact ? '8px 0' : '11px 0'};border-bottom:1px solid #edf0f4}.med-name{font-size:${compact ? '11.5px' : '12.5px'};font-weight:800}.med-summary{margin-top:3px;font-size:10.5px;color:var(--muted)}.med-instructions{margin-top:4px;font-size:10.5px;line-height:1.45}
.observations{margin-top:${compact ? '18px' : '26px'};padding-top:12px;border-top:1px solid var(--line)}.observations p{margin:7px 0 0;font-size:10.5px;line-height:1.55}
.signature{margin:${compact ? '34px auto 0' : '52px auto 0'};max-width:330px;text-align:center}.signature-line{border-top:1px solid var(--ink);padding-top:8px}.signature-name{font-size:11px;font-weight:800}.signature-meta{margin-top:3px;font-size:9px;color:var(--muted)}
.footer{margin-top:${compact ? '24px' : '36px'};padding-top:10px;border-top:1px dashed var(--line);font-size:8.5px;color:#8a94a6;text-align:center;overflow-wrap:anywhere}
@media(max-width:640px){body{padding:8px}.sheet{min-height:760px;padding:24px 20px}.clinic-header.institutional{margin:-24px -20px 20px}.patient{grid-template-columns:1fr}.issued-date{text-align:left}}
@media print{@page{size:A4;margin:10mm}html,body{background:white}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.status{display:none}.clinic-header.institutional{margin:0 0 24px;padding:20px 28px}.med-card,.patient,.professional{break-inside:avoid}.footer{break-inside:avoid}}
</style>
</head>
<body>
<main class="sheet" data-prescription-renderer="v2" data-prescription-preset="${config.preset}">
${statusLabel ? `<div class="status">${escapeHtml(statusLabel)}</div>` : ''}
${clinicHeader}
<section class="professional"><div class="professional-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${professionalMeta ? `<div class="professional-meta">${professionalMeta}</div>` : ''}</section>
<h1 class="document-title">${escapeHtml(config.title)}</h1>
<section class="patient"><div><strong>Paciente:</strong> ${escapeHtml(context.patient.name || 'Paciente')}</div>${issuedAt ? `<div class="issued-date"><strong>Data:</strong> ${escapeHtml(issuedAt)}</div>` : '<div></div>'}${patientBirthDate ? `<div><strong>Nascimento:</strong> ${escapeHtml(patientBirthDate)}</div>` : '<div></div>'}</section>
<section class="medications"><div class="section-label">Medicamentos</div><ol class="med-list">${medicationItems || '<li class="med-line"><div class="med-summary">Nenhum medicamento adicionado.</div></li>'}</ol></section>
${observations}
<section class="signature"><div class="signature-line"><div class="signature-name">${escapeHtml(context.issuer.name || 'Profissional responsável')}</div>${credential ? `<div class="signature-meta">${escapeHtml(credential)}</div>` : ''}</div></section>
${context.documentIdentifier ? `<footer class="footer">${escapeHtml(context.documentIdentifier)}</footer>` : ''}
</main>
${autoPrintScript}
</body>
</html>`;
}

export function buildPrescriptionRenderContextFromSnapshot(
  contextSnapshot: Record<string, unknown> | null,
  fallbackPatientName: string,
  documentIdentifier?: string | null,
): PrescriptionRenderContext {
  const patient = objectAt(contextSnapshot, 'patient');
  const clinic = objectAt(contextSnapshot, 'clinic');
  const issuer = objectAt(contextSnapshot, 'issuer');
  return {
    patient: {
      name: stringAt(patient, 'name') || fallbackPatientName,
      birthDate: stringAt(patient, 'birth_date') || null,
    },
    clinic: {
      name: stringAt(clinic, 'name') || 'Clínica',
      address: stringAt(clinic, 'address') || null,
      phone: stringAt(clinic, 'phone') || null,
    },
    issuer: {
      name: stringAt(issuer, 'name') || 'Profissional responsável',
      councilType: stringAt(issuer, 'council_type') || null,
      councilState: stringAt(issuer, 'council_state') || null,
      registration: stringAt(issuer, 'registro') || null,
      specialty: stringAt(issuer, 'specialty') || null,
    },
    issuedAt: stringAt(contextSnapshot, 'issued_at') || null,
    documentIdentifier: documentIdentifier || null,
  };
}

function objectAt(source: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = source?.[key];
  return isObject(value) ? value : null;
}

function stringAt(source: Record<string, unknown> | null, key: string): string {
  return asString(source?.[key]);
}

function formatCredential(issuer: PrescriptionRenderContext['issuer']): string {
  const councilType = issuer.councilType?.trim().toUpperCase() || '';
  const councilState = issuer.councilState?.trim().toUpperCase() || '';
  const registration = issuer.registration?.trim() || '';
  if (!councilType && !councilState && !registration) return '';
  const council = [councilType, councilState].filter(Boolean).join('-');
  return [council, registration].filter(Boolean).join(' ');
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateOnly(value);
  return date.toLocaleDateString('pt-BR');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}