import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Input, Select, Textarea } from '../lib/ui';
import { isClinicManager } from '../lib/permissions';
import {
  addAssessmentBodyPoint,
  createClinicalAssessmentDraft,
  finalizeClinicalAssessment,
  listAssessmentBodyPoints,
  listAvailableAssessmentTemplates,
  listPatientClinicalAssessments,
  listPublishedTemplateVersions,
  removeAssessmentBodyPoint,
  saveClinicalAssessmentDraft,
  type AssessmentBodyPoint,
  type AssessmentComponent,
  type AssessmentTemplate,
  type AssessmentTemplateSchema,
  type BodyView,
  type ClinicalAssessment,
} from '../lib/assessmentEngine';

const BODY_VIEWS: { value: BodyView; label: string }[] = [
  { value: 'front', label: 'Frente' },
  { value: 'back', label: 'Costas' },
  { value: 'left', label: 'Lateral E' },
  { value: 'right', label: 'Lateral D' },
];

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

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const load = async () => {
    if (!clinicalRead) return;
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

  const updateAnswer = (key: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  if (!clinicalRead) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Avaliações estruturadas" sub="modelos versionados, rascunho seguro e histórico longitudinal" />
        <div className="p-5 space-y-4">
          {loading ? <p className="font-mono text-[11px] text-fog">Carregando avaliações…</p> : (
            <>
              {clinicalWrite && !draft && (
                <div>
                  <p className="font-display font-semibold text-[13.5px]">Escolha um modelo</p>
                  <div className="mt-3 grid md:grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => startAssessment(template)}
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
                    {templates.length === 0 && <Empty title="Nenhum modelo publicado" sub="Publique um modelo em Configurações para iniciar avaliações estruturadas." />}
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
                      <Btn variant="ghost" onClick={saveDraft} disabled={busy}>Salvar rascunho</Btn>
                      <Btn onClick={finalize} disabled={busy}>Finalizar avaliação</Btn>
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
                            onChange={(value) => updateAnswer(component.key, value)}
                            bodyMap={component.type === 'body_map' ? (
                              <BodyMapEditor
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

      <Card>
        <CardHead title="Histórico de avaliações" sub="registros finalizados preservam a versão exata do modelo utilizado" />
        {assessments.filter((item) => item.status === 'finalized').length === 0 ? (
          <Empty title="Nenhuma avaliação estruturada finalizada" sub="As avaliações antigas continuam disponíveis logo abaixo durante a transição." />
        ) : (
          <ul className="divide-y divide-line/70">
            {assessments.filter((item) => item.status === 'finalized').map((assessment) => (
              <li key={assessment.id} className="px-5 py-4 flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-display font-semibold text-[13px]">{templateById.get(assessment.templateId)?.name || 'Avaliação estruturada'}</p>
                  <p className="font-mono text-[10.5px] text-fog mt-1">
                    {assessment.finalizedAt ? format(new Date(assessment.finalizedAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR }) : 'finalizada'}
                  </p>
                </div>
                <Chip className="border-mint/40 text-mint">finalizada ✓</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AssessmentField({
  component,
  value,
  onChange,
  bodyMap,
}: {
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
  if (component.type === 'long_text') return <Field label={label}><Textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></Field>;
  if (component.type === 'short_text' || component.type === 'attachment') return <Field label={label}><Input value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={component.type === 'attachment' ? 'Referência/descrição do anexo' : undefined} /></Field>;
  if (component.type === 'integer' || component.type === 'decimal') return <Field label={label}><Input type="number" step={component.type === 'decimal' ? '0.01' : '1'} value={String(value ?? '')} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /></Field>;
  if (component.type === 'date') return <Field label={label}><Input type="date" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></Field>;
  if (component.type === 'yes_no') return <Field label={label}><Select value={value === true ? 'yes' : value === false ? 'no' : ''} onChange={(event) => onChange(event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Selecione…</option><option value="yes">Sim</option><option value="no">Não</option></Select></Field>;
  if (component.type === 'scale') {
    const min = typeof component.config?.min === 'number' ? component.config.min : 0;
    const max = typeof component.config?.max === 'number' ? component.config.max : 10;
    return <Field label={label}><Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}><option value="">Selecione…</option>{Array.from({ length: max - min + 1 }, (_, index) => min + index).map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>;
  }
  if (component.type === 'single_choice') return <Field label={label}><Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}><option value="">Selecione…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>;
  if (component.type === 'multiple_choice') {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    return (
      <div>
        <p className="text-[11.5px] font-semibold text-fog mb-1.5">{label}</p>
        <div className="rounded-xl border border-line bg-deep p-3 space-y-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              />
              {option}
            </label>
          ))}
          {options.length === 0 && <p className="text-[11px] text-fog">Sem opções configuradas.</p>}
        </div>
      </div>
    );
  }
  return null;
}

function BodyMapEditor({
  assessmentId,
  componentKey,
  points,
  onChange,
  toast,
}: {
  assessmentId: string;
  componentKey: string;
  points: AssessmentBodyPoint[];
  onChange: (points: AssessmentBodyPoint[]) => void;
  toast: (message: string, type?: 'info' | 'warn' | 'ok') => void;
}) {
  const [view, setView] = useState<BodyView>('front');
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [intensity, setIntensity] = useState('5');
  const [symptom, setSymptom] = useState('Dor');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = points.filter((point) => point.view === view);

  const choosePoint = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPending({
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    });
  };

  const addPoint = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const created = await addAssessmentBodyPoint({
        assessmentId,
        componentKey,
        view,
        x: pending.x,
        y: pending.y,
        region: null,
        laterality: view === 'left' ? 'left' : view === 'right' ? 'right' : null,
        intensity: intensity === '' ? null : Number(intensity),
        symptom: symptom.trim() || null,
        note: note.trim() || null,
      });
      onChange([...points, created]);
      setPending(null);
      setNote('');
    } catch (error) {
      console.error('[MedicsPro] mapa corporal:', error);
      toast('Não foi possível salvar o ponto corporal.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const removePoint = async (point: AssessmentBodyPoint) => {
    setBusy(true);
    try {
      await removeAssessmentBodyPoint(point.id);
      onChange(points.filter((item) => item.id !== point.id));
    } catch (error) {
      console.error('[MedicsPro] remover ponto corporal:', error);
      toast('Não foi possível remover o ponto.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 rounded-xl border border-line bg-panel p-4">
      <div>
        <div className="grid grid-cols-4 gap-1 mb-3">
          {BODY_VIEWS.map((item) => (
            <button key={item.value} type="button" onClick={() => setView(item.value)} className={`rounded-lg px-2 py-2 text-[10px] font-semibold ${view === item.value ? 'bg-mint text-on-accent' : 'bg-deep text-fog border border-line'}`}>{item.label}</button>
          ))}
        </div>
        <div className="relative h-[390px] rounded-xl border border-line bg-deep overflow-hidden cursor-crosshair" onClick={choosePoint}>
          <HumanSilhouette view={view} />
          {visible.map((point) => (
            <button
              key={point.id}
              type="button"
              title={`${point.symptom || 'Ponto'}${point.intensity != null ? ` · ${point.intensity}/10` : ''}`}
              onClick={(event) => { event.stopPropagation(); void removePoint(point); }}
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-pulse border-2 border-paper shadow-lg text-[8px] font-bold text-white grid place-items-center"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              {point.intensity ?? '•'}
            </button>
          ))}
          {pending && <span className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-amber bg-amber/25" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} />}
        </div>
        <p className="text-[10px] text-fog mt-2">Clique sobre o corpo para marcar. Clique em um ponto salvo para removê-lo enquanto a avaliação estiver em rascunho.</p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-display font-semibold text-[13px]">Ponto corporal</p>
          <p className="text-[10.5px] text-fog mt-1">{pending ? 'Local selecionado. Complete os dados clínicos.' : 'Selecione um ponto no corpo para adicionar uma marcação.'}</p>
        </div>
        <Field label="Intensidade 0–10"><Input type="number" min={0} max={10} value={intensity} onChange={(event) => setIntensity(event.target.value)} /></Field>
        <Field label="Sintoma / tipo"><Input value={symptom} onChange={(event) => setSymptom(event.target.value)} placeholder="Dor, formigamento, queimação…" /></Field>
        <Field label="Observação"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Irradiação, comportamento, fatores agravantes…" /></Field>
        <Btn onClick={addPoint} disabled={!pending || busy}>{busy ? 'Salvando…' : 'Adicionar ponto'}</Btn>
        <div className="border-t border-line pt-3">
          <p className="font-mono text-[10px] text-fog">{points.length} ponto(s) registrado(s) neste mapa</p>
        </div>
      </div>
    </div>
  );
}

function HumanSilhouette({ view }: { view: BodyView }) {
  const side = view === 'left' || view === 'right';
  return (
    <svg viewBox="0 0 200 400" className="absolute inset-0 w-full h-full text-fog/35 pointer-events-none" aria-hidden="true">
      <circle cx={side ? 105 : 100} cy="42" r="25" fill="currentColor" />
      {side ? (
        <>
          <path d="M92 70 C82 105 84 150 90 190 C94 225 89 268 84 305 L75 382 H95 L105 305 L112 205 L119 305 L125 382 H145 L137 300 C131 260 130 220 132 185 C134 145 130 105 119 76 Z" fill="currentColor" />
          <path d="M94 92 C72 135 64 180 59 225 L75 229 C82 185 91 145 105 113 Z" fill="currentColor" />
          <path d="M119 92 C142 135 148 180 151 225 L136 229 C130 185 123 145 110 113 Z" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M72 75 C65 110 65 155 72 195 L78 270 L65 382 H91 L100 270 L109 382 H135 L122 270 L128 195 C135 155 135 110 128 75 Z" fill="currentColor" />
          <path d="M74 88 L47 210 L63 214 L89 112 Z" fill="currentColor" />
          <path d="M126 88 L153 210 L137 214 L111 112 Z" fill="currentColor" />
        </>
      )}
      <text x="100" y="395" textAnchor="middle" fill="currentColor" fontSize="9">{BODY_VIEWS.find((item) => item.value === view)?.label}</text>
    </svg>
  );
}

function requiredMissing(
  schema: AssessmentTemplateSchema,
  answers: Record<string, unknown>,
  bodyPoints: AssessmentBodyPoint[],
): string[] {
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
