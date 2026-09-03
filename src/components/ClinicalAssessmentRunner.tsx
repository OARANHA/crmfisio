import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Input, Select, Textarea } from '../lib/ui';
import { isClinicManager } from '../lib/permissions';
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

export function ClinicalAssessmentRunner({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [assessments, setAssessments] = useState<ClinicalAssessment[]>([]);
  const [draft, setDraft] = useState<ClinicalAssessment | null>(null);
  const [schema, setSchema] = useState<AssessmentTemplateSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [bodyPoints, setBodyPoints] = useState<AssessmentBodyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const clinicalRead = user?.role === 'fisio' || isClinicManager(user?.role);
  const clinicalWrite = user?.role === 'fisio';
  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );
  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);

  const openDraft = async (assessment: ClinicalAssessment) => {
    const versions = await listPublishedTemplateVersions(assessment.templateId);
    const exact = versions.find((item) => item.id === assessment.templateVersionId);
    if (!exact) throw new Error('A versão usada por este rascunho não está disponível.');
    const points = await listAssessmentBodyPoints(assessment.id);
    setDraft(assessment);
    setSchema(exact.schema);
    setAnswers(assessment.answers);
    setBodyPoints(points);
  };

  const load = async () => {
    if (!clinicalRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [available, history] = await Promise.all([
        listAvailableAssessmentTemplates(),
        listPatientClinicalAssessments(patient.id),
      ]);
      setTemplates(available.filter((template) => template.status === 'active'));
      setAssessments(history);
      if (clinicalWrite && user) {
        const ownDraft = history.find((item) => item.status === 'draft' && item.professionalId === user.id) ?? null;
        if (ownDraft) await openDraft(ownDraft);
      }
    } catch (error) {
      console.error('[MedicsPro] assessment runner:', error);
      toast('Não foi possível carregar o novo motor de avaliações.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [patient.id, user?.id, clinicalRead]);

  const startAssessment = async (template: AssessmentTemplate) => {
    if (!user || !clinicalWrite) return;
    setBusy(true);
    try {
      const versions = await listPublishedTemplateVersions(template.id);
      const latest = versions[0];
      if (!latest) throw new Error('Este modelo ainda não possui versão publicada.');
      const created = await createClinicalAssessmentDraft({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        templateId: template.id,
        templateVersionId: latest.id,
      });
      setAssessments((current) => [created, ...current]);
      setDraft(created);
      setSchema(latest.schema);
      setAnswers({});
      setBodyPoints([]);
      toast('Avaliação iniciada como rascunho.');
    } catch (error) {
      console.error('[MedicsPro] iniciar avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível iniciar a avaliação.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const saved = await saveClinicalAssessmentDraft(draft.id, answers);
      setDraft(saved);
      setAssessments((current) => current.map((item) => item.id === saved.id ? saved : item));
      toast('Rascunho salvo.');
    } catch (error) {
      console.error('[MedicsPro] salvar avaliação:', error);
      toast('Não foi possível salvar o rascunho.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!draft || !schema) return;
    const missing = requiredMissing(schema, answers, bodyPoints);
    if (missing.length) {
      toast(`Preencha os campos obrigatórios: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`, 'warn');
      return;
    }
    setBusy(true);
    try {
      await saveClinicalAssessmentDraft(draft.id, answers);
      const finalized = await finalizeClinicalAssessment(draft.id);
      setAssessments((current) => current.map((item) => item.id === finalized.id ? finalized : item));
      setDraft(null);
      setSchema(null);
      setAnswers({});
      setBodyPoints([]);
      toast('Avaliação finalizada e registrada no prontuário.');
    } catch (error) {
      console.error('[MedicsPro] finalizar avaliação:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar a avaliação.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (!clinicalRead) return null;

  return (
    <Card>
      <CardHead title="Avaliação atual" sub="preenchimento clínico em foco, com rascunho seguro e finalização versionada" />
      <div className="p-5 space-y-4">
        {loading ? (
          <p className="font-mono text-[11px] text-fog">Carregando avaliação…</p>
        ) : (
          <>
            {clinicalWrite && !draft && (
              <div>
                <p className="font-display font-semibold text-[13.5px]">Escolha um modelo</p>
                <div className="mt-3 grid md:grid-cols-2 gap-2">
                  {templates.map((template) => (
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
                  ))}
                  {templates.length === 0 && (
                    <Empty title="Nenhum modelo publicado" sub="Publique um modelo em Configurações para iniciar avaliações estruturadas." />
                  )}
                </div>
              </div>
            )}

            {draft && schema && (
              <div className="border border-mint/30 bg-deep rounded-xl p-4 sm:p-5 space-y-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div>
                    <p className="font-display font-semibold text-[15px]">{templateById.get(draft.templateId)?.name || 'Avaliação clínica'}</p>
                    <p className="font-mono text-[10px] text-mint mt-1">rascunho em andamento{activeAppointment ? ` · atendimento ${activeAppointment.inicio}` : ''}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Btn variant="ghost" onClick={() => void saveDraft()} disabled={busy}>Salvar rascunho</Btn>
                    <Btn onClick={() => void finalize()} disabled={busy}>Finalizar avaliação</Btn>
                  </div>
                </div>
                {schema.sections.map((section) => (
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
                              assessmentId={draft.id}
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
