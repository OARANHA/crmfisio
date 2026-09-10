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
    if (!draft || editorContextKey !== contextKey) return;
    const saveContextKey = contextKey;
    setBusy(true);
    try {
      const saved = await saveClinicalAssessmentDraft(draft.id, answers);
      if (contextKeyRef.current !== saveContextKey) return;
      setDraft(saved);
      setAssessments((current) => current.map((item) => item.id === saved.id ? saved : item));
      toast('Rascunho salvo.');
    } catch (error) {
      if (contextKeyRef.current !== saveContextKey) return;
      console.error('[MedicsPro] salvar avaliação:', error);
      toast('Não foi possível salvar o rascunho.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!draft || !schema || editorContextKey !== contextKey) return;
    const finalizeContextKey = contextKey;
    const missing = requiredMissing(schema, answers, bodyPoints);
    if (missing.length) {
      toast(`Preencha os campos obrigatórios: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`, 'warn');
      return;
    }
    setBusy(true);
    try {
      await saveClinicalAssessmentDraft(draft.id, answers);
      if (contextKeyRef.current !== finalizeContextKey) return;
      const finalized = await finalizeClinicalAssessment(draft.id);
      if (contextKeyRef.current !== finalizeContextKey) return;
      setAssessments((current) => current.map((item) => item.id === finalized.id ? finalized : item));
      setDraft(null);
      setSchema(null);
      setAnswers({});
      setBodyPoints([]);
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
                    <Btn variant="ghost" onClick={() => void saveDraft()} disabled={busy}>Salvar rascunho</Btn>
                    <Btn onClick={() => void finalize()} disabled={busy}>Finalizar avaliação</Btn>
                  </div>
                </div>
                {visibleSchema.sections.map((section) => (
                  <section key={section.key} className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
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
                          onChange={(value) => setAnswers((current) => ({ ...current, [component.key]: value }))}
                          bodyMap={component.type === 'body_map' ? (
                            <BodyMapV2
                              assessmentId={visibleDraft.id}
                              componentKey={component.key}
                              points={bodyPoints.filter((point) => point.componentKey === component.key)}
                              onChange={(points) => setBodyPoints((current) => [
                                ...current.filter((point) => point.componentKey !== component.key),
                                ...points,
                              ])}
                              toast={toast}
                            />
                          ) : undefined}
                        />
                      ))}
                    </div>
                  </section>
                ))}
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
