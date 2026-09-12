import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentClinicIdentity, type ClinicIdentity } from '../lib/clinicConfiguration';
import {
  clonePrescriptionTemplateToClinic,
  createClinicPrescriptionTemplate,
  listPrescriptionTemplatesForManagement,
  prescriptionTemplateSpecialty,
  updateClinicPrescriptionTemplate,
  type PrescriptionTemplateAdmin,
} from '../lib/clinicalDocumentTemplates';
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

  const openEditor = (template: PrescriptionTemplateAdmin) => {
    setCreatingNew(false);
    setEditor(template);
    setName(template.name);
    setDescription(template.description);
    setSpecialty(prescriptionTemplateSpecialty(template));
  };

  const openCreate = () => {
    if (busy) return;
    setEditor(null);
    setCreatingNew(true);
    setName('');
    setDescription('');
    setSpecialty('geral');
  };

  const closeEditor = () => {
    if (busy) return;
    setEditor(null);
    setCreatingNew(false);
    setName('');
    setDescription('');
    setSpecialty('geral');
  };

  const save = async () => {
    if (busy || !name.trim() || (!creatingNew && !editor)) return;
    setBusy(true);
    try {
      if (creatingNew) {
        await createClinicPrescriptionTemplate({ name, description, specialty });
        await load();
        closeEditorAfterMutation();
        toast('Modelo da clínica criado e disponibilizado para novas prescrições elegíveis.');
        return;
      }

      if (!editor) return;
      await updateClinicPrescriptionTemplate({
        templateId: editor.id,
        name,
        description,
        specialty,
        status: editor.status,
      });
      await load();
      closeEditorAfterMutation();
      toast('Modelo da clínica atualizado.');
    } catch (error) {
      console.error('[MedicsPro] salvar modelo de prescrição:', error);
      toast(creatingNew ? 'Não foi possível criar o modelo de prescrição.' : 'Não foi possível atualizar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const closeEditorAfterMutation = () => {
    setEditor(null);
    setCreatingNew(false);
    setName('');
    setDescription('');
    setSpecialty('geral');
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
      if (editor?.id === template.id) closeEditorAfterMutation();
      toast(archive ? 'Modelo arquivado.' : 'Modelo reativado.');
    } catch (error) {
      console.error('[MedicsPro] status do modelo de prescrição:', error);
      toast('Não foi possível alterar o status do modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const editorPreview = useMemo<PrescriptionTemplateAdmin>(() => ({
    id: editor?.id ?? 'draft-preview',
    ownerType: 'clinic',
    clinicId: clinic.id || null,
    name: name.trim() || 'Novo modelo de prescrição',
    description,
    relevanceMetadata: { specialty },
    status: editor?.status ?? 'active',
    currentVersionId: editor?.currentVersionId ?? null,
    currentVersion: editor?.currentVersion ?? 1,
    definition: editor?.definition ?? { kind: 'medication_prescription', fields: ['items', 'observations'] },
    renderDefinition: editor?.renderDefinition ?? { layout: 'clinical-document/plain-text-v1' },
    variablesContract: editor?.variablesContract ?? [],
    publishedAt: editor?.publishedAt ?? null,
    readOnly: false,
    createdAt: editor?.createdAt ?? '',
    updatedAt: editor?.updatedAt ?? '',
  }), [clinic.id, description, editor, name, specialty]);

  if (!canManage) return null;
  if (loading) return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Carregando modelos de prescrição…</div>;

  return (
    <>
      <div className="space-y-5" data-prescription-template-admin="v1">
        <header className="border-b border-line/70 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Documentos clínicos</p>
          <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-[23px] font-bold tracking-tight">Modelos de prescrição</h2>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Administre modelos da clínica sem alterar a autoridade clínica de quem prescreve. Modelos MedicsPro são somente leitura; uma cópia pode ser criada para a clínica.</p>
            </div>
            <Btn onClick={openCreate} disabled={busy}>+ Novo modelo</Btn>
          </div>
        </header>

        <TemplateCollection
          title="Modelos MedicsPro"
          subtitle="Padrões da plataforma · somente leitura"
          templates={standards}
          empty="Nenhum modelo padrão disponível."
          busy={busy}
          onPreview={setPreview}
          onDuplicate={(template) => void duplicate(template)}
        />

        <TemplateCollection
          title="Modelos da clínica"
          subtitle="Cópias e modelos próprios deste tenant"
          templates={clinicTemplates}
          empty="A clínica ainda não criou modelos próprios."
          busy={busy}
          onPreview={setPreview}
          onEdit={openEditor}
          onArchive={(template) => void toggleArchived(template)}
        />

        <div className="rounded-[16px] border border-aqua/25 bg-aqua/[0.04] px-4 py-3 text-[11.5px] leading-relaxed text-fog">
          <strong className="text-paper">Segurança:</strong> administrar um modelo não permite emitir receita. A emissão continua exigindo identidade médica, CRM válido, capability clínica e Encounter próprio ativo. Especialidade aqui serve somente para relevância e organização.
        </div>
      </div>

      {(editor || creatingNew) && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label={creatingNew ? 'Criar modelo de prescrição' : 'Editar modelo de prescrição'}>
          <div className="w-full max-w-3xl overflow-hidden rounded-[22px] border border-line bg-panel shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Modelo da clínica</p>
                <h3 className="mt-1 font-display text-[19px] font-semibold text-paper">{creatingNew ? 'Criar modelo' : 'Editar identificação e relevância'}</h3>
                {creatingNew && <p className="mt-1 text-[10.5px] text-fog">Nada é criado no servidor até você confirmar em “Criar modelo”.</p>}
              </div>
              <button type="button" onClick={closeEditor} className="text-[12px] text-fog hover:text-paper">Fechar</button>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <Field label="Nome do modelo"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Receita clínica padrão" /></Field>
                <Field label="Descrição">
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full resize-y rounded-xl border border-line bg-deep px-3 py-2.5 text-[12px] text-paper outline-none focus:border-aqua/60" placeholder="Quando este modelo é útil para a clínica?" />
                </Field>
                <Field label="Especialidade / relevância">
                  <Select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
                    {SPECIALTIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </Field>
                <div className="rounded-xl border border-line/70 bg-deep/45 px-3.5 py-3 text-[10.5px] leading-relaxed text-fog">Nesta versão, o admin configura identidade e relevância do modelo. A estrutura clínica e o renderer permanecem fechados e versionados; não há editor HTML/CSS livre.</div>
              </div>
              <TemplatePreview template={editorPreview} clinic={clinic} compact />
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <Btn variant="subtle" onClick={closeEditor} disabled={busy}>Cancelar</Btn>
              <Btn onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? 'Salvando…' : creatingNew ? 'Criar modelo' : 'Salvar modelo'}</Btn>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Visualização do modelo de prescrição">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[22px] border border-line bg-panel shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Visualização</p><h3 className="mt-1 font-display text-[19px] font-semibold">{preview.name}</h3></div>
              <button type="button" onClick={() => setPreview(null)} className="text-[12px] text-fog hover:text-paper">Fechar</button>
            </div>
            <div className="p-5"><TemplatePreview template={preview} clinic={clinic} /></div>
          </div>
        </div>
      )}
    </>
  );
}

function TemplateCollection({
  title,
  subtitle,
  templates,
  empty,
  busy,
  onPreview,
  onDuplicate,
  onEdit,
  onArchive,
}: {
  title: string;
  subtitle: string;
  templates: PrescriptionTemplateAdmin[];
  empty: string;
  busy: boolean;
  onPreview: (template: PrescriptionTemplateAdmin) => void;
  onDuplicate?: (template: PrescriptionTemplateAdmin) => void;
  onEdit?: (template: PrescriptionTemplateAdmin) => void;
  onArchive?: (template: PrescriptionTemplateAdmin) => void;
}) {
  return (
    <Card>
      <CardHead title={title} sub={subtitle} />
      {templates.length === 0 ? <p className="px-5 py-6 text-[12px] text-fog">{empty}</p> : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className={`rounded-[16px] border p-4 ${template.status === 'archived' ? 'border-line/55 bg-deep/25 opacity-75' : 'border-line bg-deep/45'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate font-display text-[14px] font-semibold text-paper">{template.name}</h3><p className="mt-1 line-clamp-2 min-h-8 text-[10.5px] leading-relaxed text-fog">{template.description || 'Sem descrição.'}</p></div>
                <Chip className={template.ownerType === 'platform' ? 'border-aqua/30 text-aqua' : 'border-mint/30 text-mint'}>{template.ownerType === 'platform' ? 'MedicsPro' : 'Clínica'}</Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[9.5px] text-fog"><span className="rounded-full border border-line px-2 py-1">{specialtyLabel(prescriptionTemplateSpecialty(template))}</span><span className="rounded-full border border-line px-2 py-1">v{template.currentVersion ?? '—'}</span>{template.status === 'archived' && <span className="rounded-full border border-amber/30 px-2 py-1 text-amber">Arquivado</span>}</div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-3">
                <Btn variant="ghost" onClick={() => onPreview(template)}>Visualizar</Btn>
                {onDuplicate && <Btn variant="subtle" disabled={busy} onClick={() => onDuplicate(template)}>Duplicar</Btn>}
                {onEdit && <Btn variant="subtle" disabled={busy || template.status === 'archived'} onClick={() => onEdit(template)}>Editar</Btn>}
                {onArchive && <Btn variant="ghost" disabled={busy} onClick={() => onArchive(template)}>{template.status === 'archived' ? 'Reativar' : 'Arquivar'}</Btn>}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function TemplatePreview({ template, clinic, compact = false }: { template: PrescriptionTemplateAdmin; clinic: ClinicIdentity; compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[16px] border border-line/70 bg-deep/40 ${compact ? '' : 'mx-auto max-w-[720px]'}`}>
      <div className="border-b border-line/60 px-3 py-2 text-[9.5px] uppercase tracking-[0.1em] text-fog">Prévia estrutural · {template.name}</div>
      <article className={`bg-white text-slate-900 ${compact ? 'min-h-[360px] p-5' : 'min-h-[620px] p-8 sm:p-10'}`}>
        <header className="border-b-2 border-slate-900 pb-4"><h4 className="text-[18px] font-bold">Prescrição medicamentosa</h4><p className="mt-1 text-[10px] text-slate-500">{clinic.name || 'Clínica'} · modelo v{template.currentVersion ?? 1}</p></header>
        <div className="mt-5 text-[11px] leading-6"><p><strong>Paciente:</strong> Paciente de exemplo</p><p><strong>Profissional:</strong> Dra. Médica Exemplo · CRM-RS 00000</p></div>
        <ol className="mt-6 space-y-4 text-[11px] leading-relaxed"><li><strong>1. Medicamento de exemplo 50 mg</strong><br /><span className="text-slate-600">1 comprimido · via oral · 1x/dia · 30 dias</span><br /><span>Tomar após o café da manhã.</span></li></ol>
        <section className="mt-6 border-t border-slate-200 pt-4"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Observações</p><p className="mt-2 text-[10.5px]">Exemplo de orientação complementar.</p></section>
        {!compact && <footer className="mt-10 border-t border-dashed border-slate-300 pt-4 text-center text-[9.5px] text-slate-400">Visualização administrativa · sem dados reais de paciente</footer>}
      </article>
    </div>
  );
}

function specialtyLabel(value: string): string {
  return SPECIALTIES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, ' ');
}
