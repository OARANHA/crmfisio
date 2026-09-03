import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { Btn, Card, CardHead, Field, Input, Textarea } from '../lib/ui';
import { isClinicManager } from '../lib/permissions';
import type {
  AssessmentComponentType,
  AssessmentTemplate,
  AssessmentTemplateSchema,
  AssessmentTemplateVersion,
} from '../lib/assessmentEngine';
import {
  createClinicAssessmentTemplate,
  createNextAssessmentTemplateVersion,
  duplicateStandardAssessmentTemplate,
  listAssessmentTemplateVersions,
  listAssessmentTemplatesForAdmin,
  publishAssessmentTemplateVersion,
  saveAssessmentTemplateDraftVersion,
  setClinicAssessmentTemplateArchived,
  updateClinicAssessmentTemplateMeta,
} from '../lib/assessmentTemplates';

const COMPONENT_TYPES: { value: AssessmentComponentType; label: string }[] = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'integer', label: 'Número inteiro' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'scale', label: 'Escala' },
  { value: 'single_choice', label: 'Escolha única' },
  { value: 'multiple_choice', label: 'Múltipla escolha' },
  { value: 'yes_no', label: 'Sim / Não' },
  { value: 'date', label: 'Data' },
  { value: 'body_map', label: 'Mapa corporal' },
  { value: 'attachment', label: 'Anexo' },
  { value: 'info', label: 'Texto informativo' },
];

const emptySchema = (): AssessmentTemplateSchema => ({
  sections: [{ key: 'secao_1', title: 'Seção 1', components: [] }],
});

const slugKey = (value: string, fallback: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

export function AssessmentTemplatesAdmin() {
  const { user, toast } = useApp();
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AssessmentTemplate | null>(null);
  const [version, setVersion] = useState<AssessmentTemplateVersion | null>(null);
  const [schema, setSchema] = useState<AssessmentTemplateSchema>(emptySchema());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('fisioterapia');

  const canManage = isClinicManager(user?.role);

  const load = async () => {
    setLoading(true);
    try {
      setTemplates(await listAssessmentTemplatesForAdmin());
    } catch (error) {
      console.error('[MedicsPro] modelos de avaliação:', error);
      toast('Não foi possível carregar os modelos de avaliação.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [user?.id, canManage]);

  const standards = useMemo(
    () => templates.filter((template) => template.ownerType === 'platform' && template.status !== 'archived'),
    [templates],
  );
  const mine = useMemo(
    () => templates.filter((template) => template.ownerType === 'clinic'),
    [templates],
  );

  const resetEditor = () => {
    setEditing(null);
    setVersion(null);
    setSchema(emptySchema());
    setName('');
    setDescription('');
    setSpecialty('fisioterapia');
  };

  const openClinicTemplate = async (template: AssessmentTemplate) => {
    setBusy(true);
    try {
      const versions = await listAssessmentTemplateVersions(template.id);
      let draft = versions.find((item) => !item.publishedAt) ?? null;
      if (!draft) {
        const versionId = await createNextAssessmentTemplateVersion(template.id);
        draft = (await listAssessmentTemplateVersions(template.id)).find((item) => item.id === versionId) ?? null;
      }
      if (!draft) throw new Error('Não foi possível preparar a versão editável.');
      setEditing(template);
      setVersion(draft);
      setSchema(draft.schema.sections.length ? draft.schema : emptySchema());
      setName(template.name);
      setDescription(template.description ?? '');
      setSpecialty(template.specialty ?? 'fisioterapia');
    } catch (error) {
      console.error('[MedicsPro] abrir modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível abrir o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    setBusy(true);
    try {
      const id = await createClinicAssessmentTemplate({
        name: 'Nova avaliação',
        specialty: 'fisioterapia',
        schema: emptySchema(),
      });
      await load();
      const all = await listAssessmentTemplatesForAdmin();
      setTemplates(all);
      const created = all.find((item) => item.id === id);
      if (created) await openClinicTemplate(created);
      toast('Modelo criado. Estruture os campos e publique quando estiver pronto.');
    } catch (error) {
      console.error('[MedicsPro] criar modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível criar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const duplicateStandard = async (template: AssessmentTemplate) => {
    setBusy(true);
    try {
      const id = await duplicateStandardAssessmentTemplate(template.id, `${template.name} — minha versão`);
      const all = await listAssessmentTemplatesForAdmin();
      setTemplates(all);
      const created = all.find((item) => item.id === id);
      if (created) await openClinicTemplate(created);
      toast('Modelo padrão duplicado. A cópia agora pertence à sua clínica.');
    } catch (error) {
      console.error('[MedicsPro] duplicar modelo padrão:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível duplicar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!editing || !version || !name.trim()) return;
    if (schema.sections.length === 0 || schema.sections.every((section) => section.components.length === 0)) {
      toast('Adicione ao menos um campo antes de salvar o modelo.', 'warn');
      return;
    }
    setBusy(true);
    try {
      await updateClinicAssessmentTemplateMeta(editing.id, { name, description, specialty });
      await saveAssessmentTemplateDraftVersion(version.id, schema);
      await load();
      toast('Rascunho do modelo salvo.');
    } catch (error) {
      console.error('[MedicsPro] salvar modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!editing || !version) return;
    if (schema.sections.length === 0 || schema.sections.every((section) => section.components.length === 0)) {
      toast('Um modelo vazio não pode ser publicado.', 'warn');
      return;
    }
    setBusy(true);
    try {
      await updateClinicAssessmentTemplateMeta(editing.id, { name, description, specialty });
      await saveAssessmentTemplateDraftVersion(version.id, schema);
      await publishAssessmentTemplateVersion(editing.id, version.id);
      await load();
      resetEditor();
      toast('Modelo publicado. Ele já pode ser usado em novas avaliações.');
    } catch (error) {
      console.error('[MedicsPro] publicar modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível publicar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (template: AssessmentTemplate) => {
    const archived = template.status !== 'archived';
    if (archived && !window.confirm(`Arquivar “${template.name}”? O histórico clínico continuará preservado.`)) return;
    setBusy(true);
    try {
      await setClinicAssessmentTemplateArchived(template.id, archived);
      await load();
      if (editing?.id === template.id) resetEditor();
      toast(archived ? 'Modelo arquivado.' : 'Modelo restaurado como rascunho.');
    } catch (error) {
      console.error('[MedicsPro] arquivar modelo de avaliação:', error);
      toast('Não foi possível alterar o status do modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const addSection = () => {
    setSchema((current) => ({
      sections: [
        ...current.sections,
        { key: `secao_${current.sections.length + 1}`, title: `Seção ${current.sections.length + 1}`, components: [] },
      ],
    }));
  };

  const updateSectionTitle = (sectionIndex: number, title: string) => {
    setSchema((current) => ({
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, title, key: slugKey(title, section.key) }
        : section),
    }));
  };

  const removeSection = (sectionIndex: number) => {
    setSchema((current) => ({ sections: current.sections.filter((_, index) => index !== sectionIndex) }));
  };

  const addComponent = (sectionIndex: number) => {
    setSchema((current) => ({
      sections: current.sections.map((section, index) => {
        if (index !== sectionIndex) return section;
        const number = section.components.length + 1;
        return {
          ...section,
          components: [...section.components, { key: `campo_${sectionIndex + 1}_${number}`, type: 'long_text', label: `Campo ${number}` }],
        };
      }),
    }));
  };

  const patchComponent = (sectionIndex: number, componentIndex: number, patch: Record<string, unknown>) => {
    setSchema((current) => ({
      sections: current.sections.map((section, sIndex) => sIndex !== sectionIndex ? section : {
        ...section,
        components: section.components.map((component, cIndex) => cIndex !== componentIndex ? component : { ...component, ...patch }),
      }),
    }));
  };

  const removeComponent = (sectionIndex: number, componentIndex: number) => {
    setSchema((current) => ({
      sections: current.sections.map((section, sIndex) => sIndex !== sectionIndex ? section : {
        ...section,
        components: section.components.filter((_, cIndex) => cIndex !== componentIndex),
      }),
    }));
  };

  if (!canManage) return null;

  return (
    <Card>
      <CardHead title="Modelos de avaliações" sub="Avaliações padrão MedicsPro e modelos personalizados da clínica" />
      <div className="p-5 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="font-display font-semibold text-[14px]">Biblioteca clínica</p>
            <p className="text-[11px] text-fog mt-1">Use um modelo padrão ou crie uma versão própria sem perder o histórico das avaliações já realizadas.</p>
          </div>
          <Btn className="ml-auto" onClick={createNew} disabled={busy}>+ Nova avaliação</Btn>
        </div>

        {loading ? <div className="font-mono text-[11px] text-fog">Carregando modelos…</div> : (
          <div className="grid xl:grid-cols-2 gap-5">
            <TemplateGroup title="Avaliações padrão" subtitle="Curadas pelo MedicsPro; não podem ser alteradas pela clínica.">
              {standards.length === 0 ? <EmptyLine text="Nenhum modelo padrão disponível." /> : standards.map((template) => (
                <TemplateCard key={template.id} template={template} action="Usar como base" onAction={() => duplicateStandard(template)} busy={busy} />
              ))}
            </TemplateGroup>
            <TemplateGroup title="Minhas avaliações" subtitle="Modelos próprios, versionados e reutilizáveis.">
              {mine.length === 0 ? <EmptyLine text="Você ainda não criou modelos próprios." /> : mine.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  action={template.status === 'archived' ? 'Restaurar' : 'Editar nova versão'}
                  onAction={() => template.status === 'archived' ? archive(template) : openClinicTemplate(template)}
                  secondary={template.status === 'archived' ? undefined : { label: 'Arquivar', onClick: () => archive(template) }}
                  busy={busy}
                />
              ))}
            </TemplateGroup>
          </div>
        )}

        {editing && version && (
          <div className="border border-mint/30 bg-deep p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <p className="font-display text-[16px] font-semibold">Editor do modelo</p>
                <p className="font-mono text-[10px] text-mint mt-1">{editing.status === 'active' ? 'nova versão' : 'rascunho'} · v{version.version}</p>
              </div>
              <Btn className="ml-auto" variant="ghost" onClick={resetEditor}>Fechar</Btn>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Nome"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="Especialidade"><Input value={specialty} onChange={(event) => setSpecialty(event.target.value)} /></Field>
              <Field label="Descrição"><Input value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
            </div>

            <div className="space-y-3">
              {schema.sections.map((section, sectionIndex) => (
                <div key={`${section.key}-${sectionIndex}`} className="border border-line bg-panel p-4 space-y-3">
                  <div className="flex gap-2 items-end">
                    <Field label={`Seção ${sectionIndex + 1}`} className="flex-1">
                      <Input value={section.title} onChange={(event) => updateSectionTitle(sectionIndex, event.target.value)} />
                    </Field>
                    {schema.sections.length > 1 && <Btn variant="ghost" onClick={() => removeSection(sectionIndex)}>Remover seção</Btn>}
                  </div>

                  {section.components.map((component, componentIndex) => (
                    <div key={`${component.key}-${componentIndex}`} className="grid lg:grid-cols-[1.4fr_.9fr_auto_auto] gap-2 items-end border-t border-line/70 pt-3">
                      <Field label="Campo">
                        <Input
                          value={component.label}
                          onChange={(event) => patchComponent(sectionIndex, componentIndex, {
                            label: event.target.value,
                            key: slugKey(event.target.value, component.key),
                          })}
                        />
                      </Field>
                      <Field label="Tipo">
                        <select
                          className="w-full bg-deep border border-line px-3 py-2.5 text-[12px] text-paper outline-none focus:border-mint"
                          value={component.type}
                          onChange={(event) => patchComponent(sectionIndex, componentIndex, { type: event.target.value as AssessmentComponentType })}
                        >
                          {COMPONENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                      </Field>
                      <label className="flex items-center gap-2 text-[11px] text-fog pb-2.5">
                        <input type="checkbox" checked={Boolean(component.required)} onChange={(event) => patchComponent(sectionIndex, componentIndex, { required: event.target.checked })} />
                        obrigatório
                      </label>
                      <Btn variant="ghost" onClick={() => removeComponent(sectionIndex, componentIndex)}>Remover</Btn>
                    </div>
                  ))}

                  <Btn variant="ghost" onClick={() => addComponent(sectionIndex)}>+ Adicionar campo</Btn>
                </div>
              ))}
              <Btn variant="ghost" onClick={addSection}>+ Adicionar seção</Btn>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Btn onClick={saveDraft} disabled={busy || !name.trim()}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Btn>
              <Btn variant="ghost" onClick={publish} disabled={busy || !name.trim()}>Publicar versão</Btn>
              <p className="text-[10.5px] text-fog self-center sm:ml-2">Depois de publicada, esta versão fica imutável para preservar o prontuário.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TemplateGroup({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-display font-semibold text-[14px]">{title}</p>
      <p className="text-[10.5px] text-fog mt-1">{subtitle}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function TemplateCard({
  template,
  action,
  onAction,
  secondary,
  busy,
}: {
  template: AssessmentTemplate;
  action: string;
  onAction: () => void;
  secondary?: { label: string; onClick: () => void };
  busy: boolean;
}) {
  return (
    <div className="border border-line bg-deep p-3.5">
      <div className="flex flex-wrap gap-2 items-center">
        <p className="font-display font-semibold text-[13px]">{template.name}</p>
        <span className={`font-mono text-[9px] ${template.status === 'active' ? 'text-mint' : 'text-fog'}`}>{template.status}</span>
        {template.specialty && <span className="font-mono text-[9px] text-fog ml-auto">{template.specialty}</span>}
      </div>
      <p className="text-[11px] text-fog mt-2">{template.description || 'Sem descrição.'}</p>
      <div className="mt-3 flex gap-2">
        <Btn variant="ghost" onClick={onAction} disabled={busy}>{action}</Btn>
        {secondary && <Btn variant="ghost" onClick={secondary.onClick} disabled={busy}>{secondary.label}</Btn>}
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="border border-line bg-deep p-4 text-[11px] text-fog">{text}</div>;
}
