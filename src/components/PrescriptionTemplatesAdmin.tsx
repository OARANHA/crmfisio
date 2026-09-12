import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentClinicIdentity, type ClinicIdentity } from '../lib/clinicConfiguration';
import {
  clonePrescriptionTemplateToClinic,
  createClinicPrescriptionTemplate,
  listPrescriptionTemplatesForManagement,
  prescriptionTemplateRenderDefinition,
  prescriptionTemplateSpecialty,
  saveClinicPrescriptionTemplatePresentation,
  updateClinicPrescriptionTemplate,
  type PrescriptionTemplateAdmin,
} from '../lib/clinicalDocumentTemplates';
import {
  buildPrescriptionDocumentHtml,
  DEFAULT_PRESCRIPTION_RENDER_DEFINITION,
  PRESCRIPTION_ACCENT_OPTIONS,
  PRESCRIPTION_PRESET_OPTIONS,
  prescriptionRenderDefinitionLabel,
  type PrescriptionMedicationStyle,
  type PrescriptionPrintAccent,
  type PrescriptionPrintPreset,
  type PrescriptionRenderDefinition,
} from '../lib/prescriptionPrintRenderer';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { isClinicManager } from '../lib/permissions';
import { useToast } from '../lib/toastContext';
import { Btn, Card, CardHead, Chip, Field, Input, Select } from '../lib/ui';

const SPECIALTIES = [
  ['geral', 'Geral'],
  ['clinica_medica', 'Clínica médica'],
  ['cardiologia', 'Cardiologia'],
  ['pediatria', 'Pediatria'],
  ['dermatologia', 'Dermatologia'],
  ['psiquiatria', 'Psiquiatria'],
] as const;

const EMPTY_CLINIC: ClinicIdentity = {
  id: '',
  name: 'Clínica',
  cnpj: null,
  phone: null,
  email: null,
  address: null,
  timezone: 'UTC',
};

const SAMPLE_PAYLOAD = {
  items: [
    {
      medicationName: 'Dipirona 500 mg',
      dose: '1 comprimido',
      route: 'oral',
      frequency: 'a cada 8 horas',
      duration: '3 dias',
      instructions: 'Tomar após alimentação se houver dor.',
    },
    {
      medicationName: 'Amoxicilina 500 mg',
      dose: '1 cápsula',
      route: 'oral',
      frequency: 'a cada 8 horas',
      duration: '7 dias',
      instructions: '',
    },
  ],
  observations: 'Manter boa hidratação e seguir as orientações do profissional.',
};

export function PrescriptionTemplatesAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const canManage = isClinicManager(user?.role);
  const [templates, setTemplates] = useState<PrescriptionTemplateAdmin[]>([]);
  const [clinic, setClinic] = useState<ClinicIdentity>(EMPTY_CLINIC);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<PrescriptionTemplateAdmin | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [preview, setPreview] = useState<PrescriptionTemplateAdmin | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('geral');
  const [renderDefinition, setRenderDefinition] = useState<PrescriptionRenderDefinition>({ ...DEFAULT_PRESCRIPTION_RENDER_DEFINITION });

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextTemplates, nextClinic] = await Promise.all([
        listPrescriptionTemplatesForManagement(),
        getCurrentClinicIdentity(),
      ]);
      setTemplates(nextTemplates);
      setClinic(nextClinic);
    } catch (error) {
      console.error('[MedicsPro] modelos de prescrição:', error);
      toast('Não foi possível carregar os modelos de prescrição.', 'warn');
    } finally {
      setLoading(false);
    }
  }, [canManage, toast]);

  useEffect(() => { void load(); }, [load]);

  const standards = useMemo(
    () => templates.filter((template) => template.ownerType === 'platform' && template.status === 'active'),
    [templates],
  );
  const clinicTemplates = useMemo(
    () => templates.filter((template) => template.ownerType === 'clinic'),
    [templates],
  );

  const resetEditor = () => {
    setEditor(null);
    setCreatingNew(false);
    setName('');
    setDescription('');
    setSpecialty('geral');
    setRenderDefinition({ ...DEFAULT_PRESCRIPTION_RENDER_DEFINITION });
  };

  const openEditor = (template: PrescriptionTemplateAdmin) => {
    setCreatingNew(false);
    setEditor(template);
    setName(template.name);
    setDescription(template.description);
    setSpecialty(prescriptionTemplateSpecialty(template));
    setRenderDefinition(prescriptionTemplateRenderDefinition(template));
  };

  const openCreate = () => {
    if (busy) return;
    setEditor(null);
    setCreatingNew(true);
    setName('');
    setDescription('');
    setSpecialty('geral');
    setRenderDefinition({ ...DEFAULT_PRESCRIPTION_RENDER_DEFINITION });
  };

  const closeEditor = () => {
    if (busy) return;
    resetEditor();
  };

  const save = async () => {
    if (busy || !name.trim() || (!creatingNew && !editor)) return;
    setBusy(true);
    try {
      if (creatingNew) {
        await createClinicPrescriptionTemplate({ name, description, specialty, renderDefinition });
        await load();
        resetEditor();
        toast('Modelo da clínica criado e disponibilizado para novas prescrições elegíveis.');
        return;
      }

      if (!editor) return;
      await saveClinicPrescriptionTemplatePresentation({
        templateId: editor.id,
        name,
        description,
        specialty,
        renderDefinition,
      });
      await load();
      resetEditor();
      toast('Modelo publicado. A nova apresentação vale apenas para novas prescrições.');
    } catch (error) {
      console.error('[MedicsPro] salvar modelo de prescrição:', error);
      toast(creatingNew ? 'Não foi possível criar o modelo de prescrição.' : 'Não foi possível publicar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (template: PrescriptionTemplateAdmin) => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await clonePrescriptionTemplateToClinic(template.id, `${template.name} — clínica`);
      const all = await listPrescriptionTemplatesForManagement();
      setTemplates(all);
      const created = all.find((item) => item.id === id);
      if (created) openEditor(created);
      toast('Modelo duplicado. A cópia pertence somente a esta clínica.');
    } catch (error) {
      console.error('[MedicsPro] duplicar modelo de prescrição:', error);
      toast('Não foi possível duplicar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const toggleArchived = async (template: PrescriptionTemplateAdmin) => {
    if (busy) return;
    const archive = template.status !== 'archived';
    if (archive && !window.confirm(`Arquivar “${template.name}”? Receitas já emitidas permanecerão intactas.`)) return;
    setBusy(true);
    try {
      await updateClinicPrescriptionTemplate({
        templateId: template.id,
        name: template.name,
        description: template.description,
        specialty: prescriptionTemplateSpecialty(template),
        status: archive ? 'archived' : 'active',
      });
      await load();
      if (editor?.id === template.id) resetEditor();
      toast(archive ? 'Modelo arquivado.' : 'Modelo reativado.');
    } catch (error) {
      console.error('[MedicsPro] status do modelo de prescrição:', error);
      toast('Não foi possível alterar o status do modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const previewHtml = useMemo(() => buildPrescriptionDocumentHtml({
    payload: SAMPLE_PAYLOAD,
    renderDefinition,
    mode: 'admin-preview',
    context: sampleContext(clinic, specialty),
  }), [clinic, renderDefinition, specialty]);

  if (!canManage) return null;
  if (loading) return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Carregando modelos de prescrição…</div>;

  return (
    <>
      <div className="space-y-5" data-prescription-template-admin="v2">
        <header className="border-b border-line/70 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Documentos clínicos</p>
          <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-[23px] font-bold tracking-tight">Modelos de prescrição</h2>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Configure a apresentação que o médico verá e imprimirá. Modelos MedicsPro são somente leitura; duplique um deles para adaptar à identidade da clínica.</p>
            </div>
            <Btn onClick={openCreate} disabled={busy}>+ Novo modelo</Btn>
          </div>
        </header>

        <TemplateCollection title="Modelos MedicsPro" subtitle="Padrões seguros da plataforma · somente leitura" templates={standards} empty="Nenhum modelo padrão disponível." busy={busy} onPreview={setPreview} onDuplicate={(template) => void duplicate(template)} />
        <TemplateCollection title="Modelos da clínica" subtitle="Modelos próprios e cópias publicadas pelo tenant" templates={clinicTemplates} empty="A clínica ainda não criou modelos próprios." busy={busy} onPreview={setPreview} onEdit={openEditor} onArchive={(template) => void toggleArchived(template)} />

        <div className="rounded-[16px] border border-aqua/25 bg-aqua/[0.04] px-4 py-3 text-[11.5px] leading-relaxed text-fog">
          <strong className="text-paper">Segurança:</strong> administrar um modelo não permite emitir receita. A emissão continua exigindo identidade médica, CRM válido, capability clínica e Encounter próprio ativo. Especialidade aqui serve somente para relevância e organização.
        </div>
      </div>

      {(editor || creatingNew) && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-ink/70" role="dialog" aria-modal="true" aria-label={creatingNew ? 'Criar modelo de prescrição' : 'Editar modelo de prescrição'}>
          <div className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden border-l border-line bg-panel shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Modelo da clínica</p>
                <h3 className="mt-1 font-display text-[20px] font-semibold text-paper">{creatingNew ? 'Criar modelo de prescrição' : 'Editar modelo de prescrição'}</h3>
                <p className="mt-1 text-[10.5px] text-fog">{creatingNew ? 'Nada é criado no servidor até você confirmar em “Criar modelo”.' : 'Salvar uma mudança visual publica uma nova versão; receitas já emitidas não são alteradas.'}</p>
              </div>
              <button type="button" onClick={closeEditor} className="min-h-10 rounded-lg px-3 text-[12px] text-fog hover:bg-deep hover:text-paper">Fechar</button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-auto xl:grid-cols-[minmax(430px,0.82fr)_minmax(480px,1.18fr)]">
              <div className="space-y-5 border-r border-line/70 p-5 sm:p-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome do modelo"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Receita Cardiológica" /></Field>
                  <Field label="Especialidade / relevância"><Select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>{SPECIALTIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
                </div>
                <Field label="Descrição"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full resize-y rounded-xl border border-line bg-deep px-3 py-2.5 text-[12px] text-paper outline-none focus:border-aqua/60" placeholder="Quando este modelo é útil para a clínica?" /></Field>

                <section className="rounded-2xl border border-line/70 bg-deep/30 p-4">
                  <div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Apresentação</p><h4 className="mt-1 text-[14px] font-semibold text-paper">Composição segura da receita</h4></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Título do documento"><Input value={renderDefinition.title} onChange={(event) => updateRender(setRenderDefinition, { title: event.target.value })} placeholder="Receita médica" /></Field>
                    <Field label="Layout"><Select value={renderDefinition.preset} onChange={(event) => updateRender(setRenderDefinition, { preset: event.target.value as PrescriptionPrintPreset })}>{PRESCRIPTION_PRESET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
                    <Field label="Identidade visual"><Select value={renderDefinition.accent} onChange={(event) => updateRender(setRenderDefinition, { accent: event.target.value as PrescriptionPrintAccent })}>{PRESCRIPTION_ACCENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
                    <Field label="Medicamentos"><Select value={renderDefinition.medicationStyle} onChange={(event) => updateRender(setRenderDefinition, { medicationStyle: event.target.value as PrescriptionMedicationStyle })}><option value="cards">Blocos</option><option value="numbered">Lista numerada</option></Select></Field>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Toggle label="Endereço da clínica" checked={renderDefinition.showClinicAddress} onChange={(value) => updateRender(setRenderDefinition, { showClinicAddress: value })} />
                    <Toggle label="Telefone da clínica" checked={renderDefinition.showClinicPhone} onChange={(value) => updateRender(setRenderDefinition, { showClinicPhone: value })} />
                    <Toggle label="Nascimento do paciente" checked={renderDefinition.showPatientBirthDate} onChange={(value) => updateRender(setRenderDefinition, { showPatientBirthDate: value })} />
                    <Toggle label="Especialidade do profissional" checked={renderDefinition.showSpecialty} onChange={(value) => updateRender(setRenderDefinition, { showSpecialty: value })} />
                  </div>
                </section>

                <div className="rounded-xl border border-line/70 bg-deep/45 px-3.5 py-3 text-[10.5px] leading-relaxed text-fog">
                  O editor usa blocos e presets versionados. <strong className="text-paper">Não há editor HTML/CSS livre.</strong> O conteúdo clínico continua estruturado; esta tela só define a apresentação segura do documento.
                </div>
              </div>

              <div className="min-h-[760px] bg-deep/30 p-4 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Visualização</p><p className="mt-0.5 text-[11px] text-paper">O mesmo renderer será usado na impressão de novas receitas.</p></div><Chip className="border-aqua/30 text-aqua">{PRESCRIPTION_PRESET_OPTIONS.find((option) => option.value === renderDefinition.preset)?.label}</Chip></div>
                <iframe title="Visualização administrativa da receita" srcDoc={previewHtml} sandbox="" className="h-[780px] w-full rounded-2xl border border-line bg-white" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
              <p className="text-[10.5px] text-fog">Preview com dados fictícios. Alterações visuais publicam uma nova versão imutável do modelo.</p>
              <div className="flex gap-2"><Btn variant="subtle" onClick={closeEditor} disabled={busy}>Cancelar</Btn><Btn onClick={() => void save()} disabled={busy || !name.trim() || !renderDefinition.title.trim()}>{busy ? 'Salvando…' : creatingNew ? 'Criar modelo' : 'Salvar e publicar'}</Btn></div>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Visualização do modelo de prescrição">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[22px] border border-line bg-panel shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Visualização</p><h3 className="mt-1 font-display text-[19px] font-semibold">{preview.name}</h3><p className="mt-1 text-[10.5px] text-fog">{prescriptionRenderDefinitionLabel(preview.renderDefinition)} · versão {preview.currentVersion ?? '—'}</p></div><button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-lg px-3 text-[12px] text-fog hover:bg-deep hover:text-paper">Fechar</button></div>
            <div className="max-h-[82vh] overflow-auto bg-deep/30 p-4 sm:p-6"><iframe title={`Visualização de ${preview.name}`} srcDoc={buildTemplatePreviewHtml(preview, clinic)} sandbox="" className="h-[780px] w-full rounded-2xl border border-line bg-white" /></div>
          </div>
        </div>
      )}
    </>
  );
}

function TemplateCollection({ title, subtitle, templates, empty, busy, onPreview, onDuplicate, onEdit, onArchive }: { title: string; subtitle: string; templates: PrescriptionTemplateAdmin[]; empty: string; busy: boolean; onPreview: (template: PrescriptionTemplateAdmin) => void; onDuplicate?: (template: PrescriptionTemplateAdmin) => void; onEdit?: (template: PrescriptionTemplateAdmin) => void; onArchive?: (template: PrescriptionTemplateAdmin) => void }) {
  return (
    <Card>
      <CardHead title={title} sub={subtitle} />
      {templates.length === 0 ? <p className="px-5 py-6 text-[12px] text-fog">{empty}</p> : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {templates.map((template) => (
            <article key={template.id} className={`rounded-[16px] border p-4 ${template.status === 'archived' ? 'border-line/55 bg-deep/25 opacity-75' : 'border-line bg-deep/45'}`}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-display text-[14px] font-semibold leading-tight text-paper">{template.name}</h3><p className="mt-1 line-clamp-2 min-h-8 text-[10.5px] leading-relaxed text-fog">{template.description || 'Sem descrição.'}</p></div><Chip className={template.ownerType === 'platform' ? 'border-aqua/30 text-aqua' : 'border-mint/30 text-mint'}>{template.ownerType === 'platform' ? 'MedicsPro' : 'Clínica'}</Chip></div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[9.5px] text-fog"><span className="rounded-full border border-line px-2 py-1">{specialtyLabel(prescriptionTemplateSpecialty(template))}</span><span className="rounded-full border border-line px-2 py-1">{prescriptionRenderDefinitionLabel(template.renderDefinition)}</span><span className="rounded-full border border-line px-2 py-1">v{template.currentVersion ?? '—'}</span>{template.status === 'archived' && <span className="rounded-full border border-amber/30 px-2 py-1 text-amber">Arquivado</span>}</div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-3"><Btn variant="ghost" onClick={() => onPreview(template)}>Visualizar</Btn>{onDuplicate && <Btn variant="subtle" disabled={busy} onClick={() => onDuplicate(template)}>Duplicar</Btn>}{onEdit && <Btn variant="subtle" disabled={busy || template.status === 'archived'} onClick={() => onEdit(template)}>Editar</Btn>}{onArchive && <Btn variant="ghost" disabled={busy} onClick={() => onArchive(template)}>{template.status === 'archived' ? 'Reativar' : 'Arquivar'}</Btn>}</div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line/70 bg-panel/50 px-3 py-2 text-[10.5px] font-semibold text-fog"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-current" /></label>;
}

function updateRender(setter: (value: PrescriptionRenderDefinition | ((current: PrescriptionRenderDefinition) => PrescriptionRenderDefinition)) => void, patch: Partial<PrescriptionRenderDefinition>) {
  setter((current) => ({ ...current, ...patch }));
}

function sampleContext(clinic: ClinicIdentity, specialty: string) {
  return {
    patient: { name: 'João da Silva', birthDate: '1985-03-15' },
    clinic: { name: clinic.name || 'Clínica Saúde Total', address: clinic.address || 'Av. Clínica, 1000', phone: clinic.phone || '(11) 3333-3333' },
    issuer: { name: 'Dra. Maria Santos', councilType: 'CRM', councilState: 'RS', registration: '123456', specialty: specialtyLabel(specialty) },
    issuedAt: '2026-09-12T12:00:00Z',
  };
}

function buildTemplatePreviewHtml(template: PrescriptionTemplateAdmin, clinic: ClinicIdentity): string {
  return buildPrescriptionDocumentHtml({ payload: SAMPLE_PAYLOAD, renderDefinition: template.renderDefinition, mode: 'admin-preview', context: sampleContext(clinic, prescriptionTemplateSpecialty(template)) });
}

function specialtyLabel(value: string): string {
  return SPECIALTIES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, ' ');
}