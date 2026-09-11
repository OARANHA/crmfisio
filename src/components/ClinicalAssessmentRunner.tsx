import { useEffect, useMemo, useRef, useState } from 'react';
import { useAgenda } from '../lib/agendaContext';
import {
  rankAssessmentTemplatesForContext,
  resolveOwnActiveEncounter,
  selectAssessmentDraftForContext,
} from '../lib/activeClinicalEncounter';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useToast } from '../lib/toastContext';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Input, Select, Textarea } from '../lib/ui';
import { isClinicManager } from '../lib/permissions';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { BodyMapV2 } from './BodyMapV2';
import { assessmentProgress } from '../lib/assessmentRunnerV2';
import {
  createClinicalAssessmentDraft,
  finalizeClinicalAssessment,
  listAssessmentBodyPoints,
  listAvailableAssessmentTemplates,
  listPatientClinicalAssessments,
  listPublishedTemplateVersions,
  saveClinicalAssessmentDraft,
  type AssessmentBodyPoint,
  type AssessmentComponent,
  type AssessmentTemplate,
  type AssessmentTemplateSchema,
  type ClinicalAssessment,
} from '../lib/assessmentEngine';

type ClinicalAssessmentPresentation = 'default' | 'encounter';

export function ClinicalAssessmentRunner({
  patient,
  presentation = 'default',
}: {
  patient: Patient;
  presentation?: ClinicalAssessmentPresentation;
}) {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const { appointments } = useAgenda();
  const { identity } = useProfessionalIdentity(user?.id);
  const { allowed: canReadTimeline } = useClinicalCapability('clinical.timeline.read', user?.id);
  const { allowed: canApplyAssessment } = useClinicalCapability('clinical.assessment.apply', user?.id);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [, setAssessments] = useState<ClinicalAssessment[]>([]);
  const [draft, setDraft] = useState<ClinicalAssessment | null>(null);
  const [schema, setSchema] = useState<AssessmentTemplateSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [bodyPoints, setBodyPoints] = useState<AssessmentBodyPoint[]>([]);
  const [editorContextKey, setEditorContextKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showOtherTemplates, setShowOtherTemplates] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const bodyPointsRef = useRef(bodyPoints);
  answersRef.current = answers;
  bodyPointsRef.current = bodyPoints;

  const userId = user?.id ?? null;
  const clinicalRead = isClinicManager(user?.role) || canReadTimeline;
  const clinicalWrite = canApplyAssessment;
  const activeAppointment = useMemo(
    () => resolveOwnActiveEncounter(appointments, patient.id, userId),
    [appointments, patient.id, userId],
  );
  const activeAppointmentId = activeAppointment?.id ?? null;
  const contextKey = `${patient.id}:${userId ?? 'anonymous'}:${activeAppointmentId ?? 'longitudinal'}`;
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;

  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);
  const contextualTemplates = useMemo(
    () => rankAssessmentTemplatesForContext(templates, {
      professionalType: identity?.professionalType,
      specialty: identity?.specialty,
    }),
    [identity?.professionalType, identity?.specialty, templates],
  );
  const contextReady = editorContextKey === contextKey;
  const visibleDraft = contextReady ? draft : null;
  const visibleSchema = contextReady ? schema : null;
  const visibleDraftAppointment = activeAppointment && visibleDraft?.appointmentId === activeAppointment.id
    ? activeAppointment
    : null;

  useEffect(() => { setShowOtherTemplates(false); }, [contextKey, identity?.specialty]);

  useEffect(() => {
    let cancelled = false;

    // A context switch must never expose the previous editor while the new
    // patient/professional/encounter is resolving.
    setDraft(null);
    setSchema(null);
    setAnswers({});
    setBodyPoints([]);
    setActiveSection(0);
    setSaveState('saved');
    setEditorContextKey(null);

    if (!clinicalRead) {
      setLoading(false);
      setEditorContextKey(contextKey);
      return () => { cancelled = true; };
    }

    setLoading(true);
    void Promise.all([
      listAvailableAssessmentTemplates(),
      listPatientClinicalAssessments(patient.id),
    ]).then(async ([available, history]) => {
      if (cancelled || contextKeyRef.current !== contextKey) return;

      setTemplates(available.filter((template) => template.status === 'active'));
      setAssessments(history);

      const ownDraft = clinicalWrite
        ? selectAssessmentDraftForContext(history, {
            patientId: patient.id,
            professionalId: userId,
            activeAppointmentId,
          })
        : null;

      if (!ownDraft) {
        setEditorContextKey(contextKey);
        return;
      }

      const [versions, points] = await Promise.all([
        listPublishedTemplateVersions(ownDraft.templateId),
        listAssessmentBodyPoints(ownDraft.id),
      ]);
      if (cancelled || contextKeyRef.current !== contextKey) return;

      const exact = versions.find((item) => item.id === ownDraft.templateVersionId);
      if (!exact) throw new Error('A versão usada por este rascunho não está disponível.');

      setDraft(ownDraft);
      setSchema(exact.schema);
      setAnswers(ownDraft.answers);
      setBodyPoints(points);
      setEditorContextKey(contextKey);
    }).catch((error) => {
      if (cancelled || contextKeyRef.current !== contextKey) return;
      console.error('[MedicsPro] assessment runner:', error);
      setDraft(null);
      setSchema(null);
      setAnswers({});
      setBodyPoints([]);
      setActiveSection(0);
      setSaveState('saved');
      setEditorContextKey(contextKey);
      toast('Não foi possível carregar as avaliações clínicas.', 'warn');
    }).finally(() => {
      if (!cancelled && contextKeyRef.current === contextKey) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeAppointmentId, clinicalRead, clinicalWrite, contextKey, patient.id, toast, userId]);

  const startAssessment = async (template: AssessmentTemplate) => {
    if (!user || !clinicalWrite) return;
    const startContextKey = contextKey;
    const appointmentId = activeAppointmentId;
    setBusy(true);
    try {
      const versions = await listPublishedTemplateVersions(template.id);
      if (contextKeyRef.current !== startContextKey) return;
      const latest = versions[0];
      if (!latest) throw new Error('Este modelo ainda não possui versão publicada.');
      const created = await createClinicalAssessmentDraft({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId,
        templateId: template.id,
        templateVersionId: latest.id,
      });
      if (contextKeyRef.current !== startContextKey) return;
      setAssessments((current) => [created, ...current]);
      setDraft(created);
      setSchema(latest.schema);
      setAnswers({});
      setBodyPoints([]);
      setEditorContextKey(startContextKey);
      toast('Avaliação iniciada como rascunho.');
    } catch (error) {
      if (contextKeyRef.current !== startContextKey) return;
      console.error('[MedicsPro] iniciar avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível iniciar a avaliação.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft || editorContextKey !== contextKey || saveInFlight.current) return;
    const saveContextKey = contextKey;
    saveInFlight.current = true;
    setSaveState('saving');
    setBusy(true);
    try {
      const saved = await saveClinicalAssessmentDraft(draft.id, answersRef.current);
      if (contextKeyRef.current !== saveContextKey) return;
      setDraft(saved);
      setAssessments((current) => current.map((item) => item.id === saved.id ? saved : item));
      setSaveState('saved');
    } catch (error) {
      if (contextKeyRef.current !== saveContextKey) return;
      console.error('[MedicsPro] salvar avaliação:', error);
      setSaveState('error');
      toast('Não foi possível salvar o rascunho.', 'warn');
    } finally {
      saveInFlight.current = false;
      setBusy(false);
      if (saveQueued.current && contextKeyRef.current === saveContextKey) {
        saveQueued.current = false;
        scheduleSave();
      }
    }
  };

  const scheduleSave = () => {
    setSaveState('dirty');
    if (saveInFlight.current) { saveQueued.current = true; return; }
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => { void saveDraft(); }, 900);
  };

  useEffect(() => () => { if (pendingSave.current) clearTimeout(pendingSave.current); }, []);

  const finalize = async () => {
    if (!draft || !schema || editorContextKey !== contextKey) return;
    const finalizeContextKey = contextKey;
    if (pendingSave.current) { clearTimeout(pendingSave.current); pendingSave.current = null; }
    const finalAnswers = answersRef.current;
    const finalBodyPoints = bodyPointsRef.current;
    const missing = requiredMissing(schema, finalAnswers, finalBodyPoints);
    if (missing.length) {
      const progress = assessmentProgress(schema, finalAnswers, finalBodyPoints);
      if (progress.firstRequiredSection >= 0) setActiveSection(progress.firstRequiredSection);
      toast(`Preencha os campos obrigatórios: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`, 'warn');
      return;
    }
    setBusy(true);
    try {
      await saveClinicalAssessmentDraft(draft.id, finalAnswers);
      if (contextKeyRef.current !== finalizeContextKey) return;
      const finalized = await finalizeClinicalAssessment(draft.id);
      if (contextKeyRef.current !== finalizeContextKey) return;
      setAssessments((current) => current.map((item) => item.id === finalized.id ? finalized : item));
      setDraft(null);
      setSchema(null);
      setAnswers({});
      setBodyPoints([]);
      setActiveSection(0);
      setEditorContextKey(finalizeContextKey);
      toast('Avaliação finalizada e registrada no prontuário.');
    } catch (error) {
      if (contextKeyRef.current !== finalizeContextKey) return;
      console.error('[MedicsPro] finalizar avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar a avaliação.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (!clinicalRead) return null;

  const renderTemplate = (template: AssessmentTemplate) => (
    <button
      type="button"
      key={template.id}
      onClick={() => void startAssessment(template)}
      disabled={busy}
      className="text-left rounded-xl border border-line bg-deep p-4 hover:border-mint/45 transition-colors disabled:opacity-40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display font-semibold text-[13px]">{template.name}</p>
        <Chip className={template.ownerType === 'platform' ? 'border-aqua/40 text-aqua' : 'border-mint/40 text-mint'}>
          {template.ownerType === 'platform' ? 'padrão' : 'minha avaliação'}
        </Chip>
      </div>
      <p className="text-[11px] text-fog mt-2">{template.description || 'Modelo clínico sem descrição.'}</p>
    </button>
  );

  return (
    <Card>
      <CardHead
        title="Avaliação atual"
        sub={presentation === 'encounter'
          ? 'Preenchimento clínico desta consulta.'
          : 'preenchimento clínico em foco, com rascunho seguro e finalização versionada'}
      />
      <div className="p-5 space-y-4">
        {loading || !contextReady ? (
          <p className="font-mono text-[11px] text-fog">Carregando avaliação…</p>
        ) : (
          <>
            {clinicalWrite && !visibleDraft && (
              <div>
                <p className="font-display font-semibold text-[13.5px]">Escolha um modelo</p>
                {contextualTemplates.recommended.length > 0 ? (
                  <div className="mt-3 grid md:grid-cols-2 gap-2">
                    {contextualTemplates.recommended.map(renderTemplate)}
                  </div>
                ) : templates.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-line bg-deep p-4 text-[11.5px] leading-relaxed text-fog">
                    Nenhum modelo publicado é uma recomendação contextual para esta especialidade. Outros modelos permitidos continuam disponíveis abaixo.
                  </div>
                ) : presentation === 'encounter' ? (
                  <Empty title="Nenhuma avaliação estruturada disponível para este atendimento." />
                ) : (
                  <Empty title="Nenhum modelo publicado" sub="Publique um modelo em Configurações para iniciar avaliações estruturadas." />
                )}

                {contextualTemplates.other.length > 0 && (
                  <div className="mt-3">
                    <button type="button" className="text-[11px] font-semibold text-aqua" onClick={() => setShowOtherTemplates((value) => !value)}>
                      {showOtherTemplates ? 'Ocultar outros modelos permitidos' : `Ver outros modelos permitidos (${contextualTemplates.other.length})`}
                    </button>
                    {showOtherTemplates && <div className="mt-3 grid md:grid-cols-2 gap-2">{contextualTemplates.other.map(renderTemplate)}</div>}
                  </div>
                )}
              </div>
            )}

            {visibleDraft && visibleSchema && (
              <div className="border border-mint/30 bg-deep rounded-xl p-4 sm:p-5 space-y-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div>
                    <p className="font-display font-semibold text-[15px]">{templateById.get(visibleDraft.templateId)?.name || 'Avaliação clínica'}</p>
                    <p className="font-mono text-[10px] text-mint mt-1">rascunho em andamento{visibleDraftAppointment ? ` · atendimento ${visibleDraftAppointment.inicio}` : ''}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <span className={`font-mono text-[10px] ${saveState === 'error' ? 'text-pulse' : saveState === 'saved' ? 'text-mint' : 'text-amber'}`}>{saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo ✓' : saveState === 'error' ? 'Não salvo' : 'Alterações não salvas'}</span>
                    <Btn variant="ghost" onClick={() => void saveDraft()} disabled={busy || saveState === 'saving'}>{saveState === 'error' ? 'Tentar novamente' : 'Salvar'}</Btn>
                    <Btn onClick={() => void finalize()} disabled={busy}>Finalizar avaliação</Btn>
                  </div>
                </div>
                {(() => {
                  const progress = assessmentProgress(visibleSchema, answers, bodyPoints);
                  const section = visibleSchema.sections[Math.min(activeSection, visibleSchema.sections.length - 1)];
                  if (!section) return null;
                  return <>
                    <div className="flex flex-wrap items-center gap-2 border-y border-line/70 py-3">
                      <span className="font-mono text-[10px] text-mint">{progress.complete} / {progress.total} respostas</span>
                      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Seções da avaliação">
                        {visibleSchema.sections.map((item, index) => {
                          const state = progress.sections[index];
                          return <button key={item.key} type="button" aria-current={index === activeSection ? 'step' : undefined} onClick={() => setActiveSection(index)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold ${index === activeSection ? 'bg-mint text-on-accent' : state.requiredMissing.length ? 'text-amber hover:bg-amber/10' : 'text-fog hover:bg-raise'}`}>{state.complete === state.total && state.total > 0 ? '✓ ' : ''}{item.title}</button>;
                        })}
                      </div>
                    </div>
                  <section key={section.key} className="space-y-3">
                    <div>
                      <h4 className="font-display font-semibold text-[14px]">{section.title}</h4>
                      {section.description && <p className="text-[11px] text-fog mt-1">{section.description}</p>}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {section.components.map((component) => (
                        <AssessmentField
                          key={component.key}
                          component={component}
                          value={answers[component.key]}
                          onChange={(value) => { setAnswers((current) => { const next = { ...current, [component.key]: value }; answersRef.current = next; return next; }); scheduleSave(); }}
                          bodyMap={component.type === 'body_map' ? (
                            <BodyMapV2
                              assessmentId={visibleDraft.id}
                              componentKey={component.key}
                              points={bodyPoints.filter((point) => point.componentKey === component.key)}
                              onChange={(points) => {
                                setBodyPoints((current) => { const next = [...current.filter((point) => point.componentKey !== component.key), ...points]; bodyPointsRef.current = next; return next; });
                                scheduleSave();
                              }}
                              toast={toast}
                            />
                          ) : undefined}
                        />
                      ))}
                    </div>
                  </section>
                  <div className="flex items-center justify-between border-t border-line/70 pt-4">
                    <Btn variant="ghost" disabled={activeSection === 0} onClick={() => setActiveSection((value) => Math.max(0, value - 1))}>← Anterior</Btn>
                    <span className="text-[10.5px] text-fog">Seção {activeSection + 1} de {visibleSchema.sections.length}</span>
                    <Btn variant="ghost" disabled={activeSection >= visibleSchema.sections.length - 1} onClick={() => setActiveSection((value) => Math.min(visibleSchema.sections.length - 1, value + 1))}>Próxima →</Btn>
                  </div>
                  </>;
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function AssessmentField({ component, value, onChange, bodyMap }: {
  component: AssessmentComponent;
  value: unknown;
  onChange: (value: unknown) => void;
  bodyMap?: React.ReactNode;
}) {
  const label = `${component.label}${component.required ? ' *' : ''}`;
  const options = Array.isArray(component.config?.options)
    ? component.config.options.filter((item): item is string => typeof item === 'string')
    : [];
  if (component.type === 'heading') return <div className="md:col-span-2 font-display font-semibold text-[13px]">{component.label}</div>;
  if (component.type === 'info') return <div className="md:col-span-2 rounded-xl border border-line bg-panel p-3 text-[12px] text-fog">{component.label}</div>;
  if (component.type === 'body_map') return <div className="md:col-span-2"><p className="text-[11.5px] font-semibold text-fog mb-1.5">{label}</p>{bodyMap}</div>;
  if (component.type === 'long_text') return <Field label={label}><Textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></Field>;
  if (component.type === 'short_text' || component.type === 'attachment') return <Field label={label}><Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={component.type === 'attachment' ? 'Referência/descrição do anexo' : undefined} /></Field>;
  if (component.type === 'integer' || component.type === 'decimal') return <Field label={label}><Input type="number" step={component.type === 'decimal' ? '0.01' : '1'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} /></Field>;
  if (component.type === 'date') return <Field label={label}><Input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></Field>;
  if (component.type === 'yes_no') return <Field label={label}><Select value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'yes')}><option value="">Selecione…</option><option value="yes">Sim</option><option value="no">Não</option></Select></Field>;
  if (component.type === 'scale') {
    const min = typeof component.config?.min === 'number' ? component.config.min : 0;
    const max = typeof component.config?.max === 'number' ? component.config.max : 10;
    return <Field label={label}><Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}><option value="">Selecione…</option>{Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index).map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>;
  }
  if (component.type === 'single_choice') return <Field label={label}><Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}><option value="">Selecione…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>;
  if (component.type === 'multiple_choice') {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    return <div><p className="text-[11.5px] font-semibold text-fog mb-1.5">{label}</p><div className="rounded-xl border border-line bg-deep p-3 space-y-2">{options.map((option) => <label key={option} className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={selected.includes(option)} onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}{options.length === 0 && <p className="text-[11px] text-fog">Sem opções configuradas.</p>}</div></div>;
  }
  return null;
}

function requiredMissing(schema: AssessmentTemplateSchema, answers: Record<string, unknown>, bodyPoints: AssessmentBodyPoint[]): string[] {
  const missing: string[] = [];
  for (const section of schema.sections) {
    for (const component of section.components) {
      if (!component.required || component.type === 'heading' || component.type === 'info') continue;
      if (component.type === 'body_map') {
        if (!bodyPoints.some((point) => point.componentKey === component.key)) missing.push(component.label);
        continue;
      }
      const value = answers[component.key];
      if (Array.isArray(value) ? value.length === 0 : value === null || value === undefined || value === '') missing.push(component.label);
    }
  }
  return missing;
}
