import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useToast } from '../lib/toastContext';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';
import { isClinicManager } from '../lib/permissions';
import { isCustomAssessmentAuthoringAllowed, loadCurrentClinicEntitlementState } from '../lib/clinicEntitlement';
import type {
  AssessmentComponent,
  AssessmentComponentType,
  AssessmentTemplate,
  AssessmentTemplateSchema,
  AssessmentTemplateVersion,
} from '../lib/assessmentEngine';
import { validateAssessmentTemplateSchemaForAuthoring } from '../lib/assessmentEngine';
import { assessmentEditorNeedsCloseConfirmation } from '../lib/assessmentTemplateEditorState';
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
  { value: 'single_choice', label: 'Múltipla escolha · 1 resposta' },
  { value: 'multiple_choice', label: 'Múltipla escolha · várias respostas' },
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

const componentOptions = (component: AssessmentComponent): string[] => (
  Array.isArray(component.config?.options)
    ? component.config.options.filter((item): item is string => typeof item === 'string')
    : []
);

const supportsOptions = (type: AssessmentComponentType) => type === 'single_choice' || type === 'multiple_choice';

export function AssessmentTemplatesAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AssessmentTemplate | null>(null);
  const [version, setVersion] = useState<AssessmentTemplateVersion | null>(null);
  const [schema, setSchema] = useState<AssessmentTemplateSchema>(emptySchema());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('fisioterapia');
  const [customAuthoringAllowed, setCustomAuthoringAllowed] = useState<boolean | null>(null);
  const [customAuthoringError, setCustomAuthoringError] = useState(false);
  const initialEditorState = useRef<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const mutationInFlight = useRef(false);

  const canManage = isClinicManager(user?.role);
  const canAuthorCustomAssessments = canManage && customAuthoringAllowed === true;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await listAssessmentTemplatesForAdmin());
    } catch (error) {
      console.error('[MedicsPro] modelos de avaliação:', error);
      toast('Não foi possível carregar os modelos de anamnese e avaliação.', 'warn');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user?.id || !canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [user?.id, canManage, load]);

  useEffect(() => {
    let active = true;
    setCustomAuthoringAllowed(null);
    setCustomAuthoringError(false);
    if (!user?.id || !canManage) return () => { active = false; };

    void loadCurrentClinicEntitlementState('assessments.custom')
      .then((state) => {
        if (active) setCustomAuthoringAllowed(isCustomAssessmentAuthoringAllowed(state));
      })
      .catch((error) => {
        console.error('[MedicsPro] entitlement de avaliações customizadas:', error);
        if (active) {
          setCustomAuthoringAllowed(false);
          setCustomAuthoringError(true);
        }
      });

    return () => { active = false; };
  }, [user?.id, canManage]);

  const standards = useMemo(
    () => templates.filter((template) => template.ownerType === 'platform' && template.status !== 'archived'),
    [templates],
  );
  const clinicTemplates = useMemo(
    () => templates.filter((template) => template.ownerType === 'clinic'),
    [templates],
  );

  const resetEditor = useCallback(() => {
    setEditing(null);
    setVersion(null);
    setSchema(emptySchema());
    setName('');
    setDescription('');
    setSpecialty('fisioterapia');
    initialEditorState.current = null;
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  const editorSnapshot = useCallback(() => JSON.stringify({ name, description, specialty, schema }), [name, description, specialty, schema]);
  const markEditorClean = useCallback(() => { initialEditorState.current = editorSnapshot(); }, [editorSnapshot]);
  const requestCloseEditor = useCallback(() => {
    if (busy || mutationInFlight.current) return;
    if (!assessmentEditorNeedsCloseConfirmation(initialEditorState.current, editorSnapshot(), busy)
      || window.confirm('Há alterações não salvas. Fechar o editor mesmo assim?')) resetEditor();
  }, [busy, editorSnapshot, resetEditor]);

  useEffect(() => {
    if (!editing) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestCloseEditor();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, requestCloseEditor]);

  useEffect(() => {
    if (!editing) return;
    closeButtonRef.current?.focus();
  }, [editing]);

  const openClinicTemplate = async (template: AssessmentTemplate, opener?: HTMLElement | null) => {
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
      openerRef.current = opener ?? document.activeElement as HTMLElement | null;
      initialEditorState.current = JSON.stringify({
        name: template.name,
        description: template.description ?? '',
        specialty: template.specialty ?? 'fisioterapia',
        schema: draft.schema.sections.length ? draft.schema : emptySchema(),
      });
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
        name: 'Nova anamnese ou avaliação',
        specialty: 'fisioterapia',
        schema: emptySchema(),
      });
      const all = await listAssessmentTemplatesForAdmin();
      setTemplates(all);
      const created = all.find((item) => item.id === id);
      if (created) await openClinicTemplate(created);
      toast('Modelo criado. Configure os campos e publique quando estiver pronto.');
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
      const id = await duplicateStandardAssessmentTemplate(template.id, `${template.name} — clínica`);
      const all = await listAssessmentTemplatesForAdmin();
      setTemplates(all);
      const created = all.find((item) => item.id === id);
      if (created) await openClinicTemplate(created);
      toast('Modelo padrão duplicado. A cópia agora pertence à clínica.');
    } catch (error) {
      console.error('[MedicsPro] duplicar modelo padrão:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível duplicar o modelo.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const validateBeforeSave = () => {
    if (schema.sections.length === 0 || schema.sections.every((section) => section.components.length === 0)) {
      toast('Adicione ao menos uma pergunta ou campo antes de salvar o modelo.', 'warn');
      return false;
    }
    const error = validateAssessmentTemplateSchemaForAuthoring(schema);
    if (error) {
      toast(error, 'warn');
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (mutationInFlight.current || !editing || !version || !name.trim() || !validateBeforeSave()) return;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      await updateClinicAssessmentTemplateMeta(editing.id, { name, description, specialty });
      await saveAssessmentTemplateDraftVersion(version.id, schema);
      await load();
      markEditorClean();
      toast('Rascunho do modelo salvo.');
    } catch (error) {
      console.error('[MedicsPro] salvar modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível salvar o modelo.', 'warn');
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  const publish = async () => {
    if (mutationInFlight.current || !editing || !version || !name.trim() || !validateBeforeSave()) return;
    mutationInFlight.current = true;
    setBusy(true);
    try {
      await updateClinicAssessmentTemplateMeta(editing.id, { name, description, specialty });
      await saveAssessmentTemplateDraftVersion(version.id, schema);
      await publishAssessmentTemplateVersion(editing.id, version.id);
      await load();
      resetEditor();
      toast('Modelo publicado. Profissionais autorizados já podem usá-lo em novas avaliações.');
    } catch (error) {
      console.error('[MedicsPro] publicar modelo de avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível publicar o modelo.', 'warn');
    } finally {
      mutationInFlight.current = false;
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
          components: [...section.components, { key: `campo_${sectionIndex + 1}_${number}`, type: 'long_text', label: `Pergunta ${number}` }],
        };
      }),
    }));
  };

  const patchComponent = (sectionIndex: number, componentIndex: number, patch: Partial<AssessmentComponent>) => {
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

  const setChoiceOptions = (sectionIndex: number, componentIndex: number, options: string[]) => {
    const component = schema.sections[sectionIndex]?.components[componentIndex];
    if (!component) return;
    patchComponent(sectionIndex, componentIndex, { config: { ...(component.config ?? {}), options } });
  };

  if (!canManage) return null;

  return (
    <>
      <Card>
        <CardHead
          title="Anamneses & Avaliações"
          sub="Biblioteca MedicsPro e modelos versionados da clínica"
          right={<Btn onClick={createNew} disabled={busy || !canAuthorCustomAssessments}>+ Criar modelo</Btn>}
        />
        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-line/70 bg-deep/45 px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-fog">Publique modelos uma vez e reutilize-os no atendimento. Modelos padrão podem ser adotados como base sem alterar a versão mantida pelo MedicsPro.</p>
          </div>

          {customAuthoringAllowed === null && !customAuthoringError && (
            <div className="rounded-xl border border-line bg-deep px-4 py-3 text-[11px] text-fog">Validando liberação para avaliações customizadas…</div>
          )}
          {customAuthoringAllowed === false && (
            <div className="rounded-xl border border-amber/35 bg-amber/5 px-4 py-3 text-[11px] leading-relaxed text-fog">
              <strong className="text-amber">Autoria personalizada indisponível.</strong>{' '}
              {customAuthoringError ? 'Não foi possível confirmar o entitlement; por segurança, as ações de autoria ficaram bloqueadas.' : 'O Platform Admin bloqueou avaliações customizadas para esta clínica.'} Modelos publicados continuam visíveis.
            </div>
          )}

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-line bg-deep/55" />)}
            </div>
          ) : (
            <div className="space-y-7">
              <TemplateGroup title="Biblioteca MedicsPro" subtitle="Modelos padrão curados pela plataforma. Use como base para criar uma versão da clínica.">
                {standards.length === 0 ? <EmptyLine text="Nenhum modelo padrão disponível." /> : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {standards.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        sourceLabel="MedicsPro"
                        action="Usar como base"
                        onAction={() => duplicateStandard(template)}
                        busy={busy || !canAuthorCustomAssessments}
                      />
                    ))}
                  </div>
                )}
              </TemplateGroup>

              <TemplateGroup title="Modelos da clínica" subtitle="Modelos próprios, versionados e reutilizáveis pelos profissionais autorizados.">
                {clinicTemplates.length === 0 ? <EmptyLine text="A clínica ainda não criou modelos próprios." /> : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {clinicTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        sourceLabel="Clínica"
                        action={template.status === 'archived' ? 'Restaurar' : 'Editar'}
                        onAction={(opener) => template.status === 'archived' ? archive(template) : openClinicTemplate(template, opener)}
                        secondary={template.status === 'archived' ? undefined : { label: 'Arquivar', onClick: () => archive(template) }}
                        busy={busy || !canAuthorCustomAssessments}
                      />
                    ))}
                  </div>
                )}
              </TemplateGroup>
            </div>
          )}
        </div>
      </Card>

      {editing && version && (
        <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Editor de anamnese e avaliação">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-[2px]"
            onClick={requestCloseEditor}
            aria-label="Fechar editor"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[860px] flex-col border-l border-line bg-panel shadow-2xl">
            <header className="flex shrink-0 items-start gap-4 border-b border-line/70 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="font-display text-[17px] font-semibold">{editing.status === 'active' ? 'Editar nova versão' : 'Configurar modelo'}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-fog">Defina perguntas, tipos de resposta e seções. A versão publicada permanece imutável no histórico clínico.</p>
                <p className="mt-1.5 font-mono text-[9.5px] text-mint">v{version.version} · {editing.status === 'active' ? 'nova versão' : 'rascunho'}</p>
              </div>
              <button
                type="button"
                onClick={requestCloseEditor}
                disabled={busy}
                ref={closeButtonRef}
                className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-lg text-fog transition hover:bg-raise hover:text-paper disabled:opacity-40"
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-6">
                <section className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2"><Field label="Nome do modelo"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Anamnese adulto completa" /></Field></div>
                  <Field label="Especialidade"><Input value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Ex.: fisioterapia" /></Field>
                  <Field label="Descrição"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Quando e para quem usar este modelo" /></Field>
                </section>

                <section className="space-y-4">
                  {schema.sections.map((section, sectionIndex) => (
                    <div key={`${section.key}-${sectionIndex}`} className="rounded-2xl border border-line bg-deep/35 p-4">
                      <div className="mb-4 flex items-end gap-2">
                        <div className="flex-1">
                          <Field label={`Seção ${sectionIndex + 1}`}>
                            <Input value={section.title} onChange={(event) => updateSectionTitle(sectionIndex, event.target.value)} />
                          </Field>
                        </div>
                        {schema.sections.length > 1 && <Btn variant="ghost" onClick={() => removeSection(sectionIndex)} disabled={busy}>Remover seção</Btn>}
                      </div>

                      <div className="space-y-3">
                        {section.components.length === 0 && (
                          <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[11px] text-fog">Esta seção ainda não possui perguntas.</div>
                        )}
                        {section.components.map((component, componentIndex) => {
                          const options = componentOptions(component);
                          return (
                            <div key={`${component.key}-${componentIndex}`} className="rounded-xl border border-line/80 bg-panel p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-mint/10 font-mono text-[10px] text-mint">{componentIndex + 1}</span>
                                <p className="text-[11px] font-semibold text-fog">Pergunta / campo</p>
                                <button
                                  type="button"
                                  onClick={() => removeComponent(sectionIndex, componentIndex)}
                                  disabled={busy}
                                  className="ml-auto rounded-lg px-2 py-1 text-[10px] font-semibold text-pulse transition hover:bg-pulse/10 disabled:opacity-40"
                                >
                                  Remover
                                </button>
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(190px,.8fr)]">
                                <Field label="Pergunta">
                                  <Input
                                    value={component.label}
                                    onChange={(event) => patchComponent(sectionIndex, componentIndex, {
                                      label: event.target.value,
                                      key: slugKey(event.target.value, component.key),
                                    })}
                                    placeholder="Digite a pergunta"
                                  />
                                </Field>
                                <Field label="Tipo de resposta">
                                  <select
                                    className="w-full min-h-11 rounded-xl border border-line/80 bg-deep px-3.5 py-2.5 text-[13px] text-paper outline-none transition-colors focus:border-mint/60"
                                    value={component.type}
                                    onChange={(event) => {
                                      const nextType = event.target.value as AssessmentComponentType;
                                      patchComponent(sectionIndex, componentIndex, {
                                        type: nextType,
                                        config: supportsOptions(nextType)
                                          ? { ...(component.config ?? {}), options: options.length ? options : ['Opção 1', 'Opção 2'] }
                                          : component.config,
                                      });
                                    }}
                                  >
                                    {COMPONENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                  </select>
                                </Field>
                              </div>

                              <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-fog">
                                <input type="checkbox" checked={Boolean(component.required)} onChange={(event) => patchComponent(sectionIndex, componentIndex, { required: event.target.checked })} />
                                resposta obrigatória
                              </label>

                              {supportsOptions(component.type) && (
                                <div className="mt-3 rounded-xl border border-line/70 bg-deep/45 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10.5px] font-semibold text-fog">Opções de resposta</p>
                                    <button
                                      type="button"
                                      className="text-[10.5px] font-semibold text-mint"
                                      onClick={() => setChoiceOptions(sectionIndex, componentIndex, [...options, `Opção ${options.length + 1}`])}
                                    >
                                      + Adicionar opção
                                    </button>
                                  </div>
                                  <div className="mt-2 space-y-2">
                                    {options.map((option, optionIndex) => (
                                      <div key={optionIndex} className="flex gap-2">
                                        <Input
                                          value={option}
                                          onChange={(event) => setChoiceOptions(sectionIndex, componentIndex, options.map((item, index) => index === optionIndex ? event.target.value : item))}
                                          aria-label={`Opção ${optionIndex + 1}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setChoiceOptions(sectionIndex, componentIndex, options.filter((_, index) => index !== optionIndex))}
                                          className="rounded-xl border border-line px-3 text-[11px] text-fog hover:border-pulse/40 hover:text-pulse"
                                          aria-label={`Remover opção ${optionIndex + 1}`}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => addComponent(sectionIndex)}
                        disabled={busy}
                        className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-dashed border-mint/35 bg-mint/[0.035] text-[11px] font-semibold text-mint transition hover:bg-mint/[0.07] disabled:opacity-40"
                      >
                        + Adicionar pergunta
                      </button>
                    </div>
                  ))}

                  <Btn variant="ghost" onClick={addSection} disabled={busy} className="w-full">+ Adicionar seção</Btn>
                </section>
              </div>
            </div>

            <footer className="shrink-0 border-t border-line/70 bg-panel px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Btn variant="ghost" onClick={requestCloseEditor} disabled={busy}>Cancelar</Btn>
                <Btn variant="subtle" onClick={saveDraft} disabled={busy || !name.trim()}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Btn>
                <Btn onClick={publish} disabled={busy || !name.trim()}>Publicar versão</Btn>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function TemplateGroup({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <p className="font-display text-[14px] font-semibold">{title}</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-fog">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function TemplateCard({
  template,
  sourceLabel,
  action,
  onAction,
  secondary,
  busy,
}: {
  template: AssessmentTemplate;
  sourceLabel: string;
  action: string;
  onAction: (opener: HTMLElement) => void;
  secondary?: { label: string; onClick: () => void };
  busy: boolean;
}) {
  return (
    <article className="flex min-h-[160px] flex-col rounded-2xl border border-line bg-deep/45 p-4 transition hover:border-line2 hover:bg-deep/65">
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${template.ownerType === 'platform' ? 'border-aqua/30 text-aqua' : 'border-mint/30 text-mint'}`}>{sourceLabel}</span>
        <span className="font-mono text-[9px] text-fog">{template.status}</span>
        {template.specialty && <span className="ml-auto truncate font-mono text-[9px] text-fog">{template.specialty}</span>}
      </div>
      <h4 className="mt-3 font-display text-[14px] font-semibold leading-snug">{template.name}</h4>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-fog">{template.description || 'Modelo clínico reutilizável.'}</p>
      <div className="mt-auto flex gap-2 border-t border-line/60 pt-3">
        <Btn variant="ghost" className="min-h-9 px-3 py-2 text-[11px]" onClick={(event) => onAction(event.currentTarget)} disabled={busy}>{action}</Btn>
        {secondary && <Btn variant="ghost" className="min-h-9 px-3 py-2 text-[11px]" onClick={secondary.onClick} disabled={busy}>{secondary.label}</Btn>}
      </div>
    </article>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-deep/35 p-6 text-center text-[11px] text-fog">{text}</div>;
}
