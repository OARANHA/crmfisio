import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Select, Textarea } from '../lib/ui';
import {
  acceptClinicalNoteImport,
  createClinicalNote,
  getClinicalNoteForAppointment,
  listClinicalNoteImports,
  proposeNexusImport,
  rejectClinicalNoteImport,
  signClinicalNote,
  updateClinicalNoteDraft,
  type ClinicalNote,
  type ClinicalNoteImport,
  type SoapSectionKey,
} from '../lib/clinicalNotes';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';

const sectionLabels: Record<SoapSectionKey, string> = {
  subjective: 'S · Subjetivo',
  objective: 'O · Objetivo',
  assessment: 'A · Avaliação',
  plan: 'P · Plano',
};

export function CanonicalSoapPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [imports, setImports] = useState<ClinicalNoteImport[]>([]);
  const [results, setResults] = useState<NexusClinicalResult[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [targetByResult, setTargetByResult] = useState<Record<string, SoapSectionKey>>({});

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [capability, nexusResults] = await Promise.all([
        hasProfessionalCapability('clinical.soap').catch(() => false),
        listPatientNexusResults(patient.id),
      ]);
      setCanWrite(capability);
      setResults(nexusResults);

      if (activeAppointment) {
        const existing = await getClinicalNoteForAppointment(activeAppointment.id);
        setNote(existing);
        setImports(existing ? await listClinicalNoteImports(existing.id) : []);
      } else {
        setNote(null);
        setImports([]);
      }
    } catch (error) {
      console.error('[MedicsPro] SOAP canônico:', error);
      toast('Não foi possível carregar o prontuário SOAP canônico.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [patient.id, user?.id, activeAppointment?.id]);

  const start = async () => {
    if (!user || !canWrite) return;
    setBusy(true);
    try {
      const created = await createClinicalNote({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
      });
      setNote(created);
      setImports([]);
      toast('Rascunho SOAP canônico criado.');
    } catch (error) {
      console.error('[MedicsPro] criar SOAP:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível criar o SOAP.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!note || note.status !== 'draft') return;
    setBusy(true);
    try {
      const saved = await updateClinicalNoteDraft(note.id, {
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
      });
      setNote(saved);
      toast('Rascunho SOAP salvo.');
    } catch (error) {
      console.error('[MedicsPro] salvar SOAP:', error);
      toast('Não foi possível salvar o rascunho SOAP.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (!note || note.status !== 'draft') return;
    setBusy(true);
    try {
      const saved = await updateClinicalNoteDraft(note.id, {
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
      });
      const signed = await signClinicalNote(saved.id);
      setNote(signed);
      toast('Prontuário SOAP assinado. Novas alterações exigem adendo.');
    } catch (error) {
      console.error('[MedicsPro] assinar SOAP:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível assinar o prontuário.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const propose = async (result: NexusClinicalResult) => {
    if (!note || note.status !== 'draft') return;
    setBusy(true);
    try {
      const target = targetByResult[result.id] ?? 'objective';
      const created = await proposeNexusImport(note.id, result, target);
      setImports((current) => [created, ...current]);
      toast('Contribuição Nexus proposta. Revise antes de aceitar no SOAP.');
    } catch (error) {
      console.error('[MedicsPro] propor Nexus no SOAP:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível propor a contribuição Nexus.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const reviewImport = async (item: ClinicalNoteImport, accept: boolean) => {
    setBusy(true);
    try {
      if (accept) {
        const updated = await acceptClinicalNoteImport(item.id);
        setNote(updated);
      } else {
        await rejectClinicalNoteImport(item.id);
      }
      setImports((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        status: accept ? 'accepted' : 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.id ?? null,
      } : entry));
      toast(accept ? 'Conteúdo Nexus adicionado ao SOAP para revisão final.' : 'Contribuição Nexus rejeitada.');
    } catch (error) {
      console.error('[MedicsPro] revisar importação Nexus:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível revisar a contribuição Nexus.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando prontuário canônico…</div></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Prontuário SOAP" sub="documentação multiprofissional canônica · MedicsPro" />
        <div className="p-5 space-y-4">
          {!canWrite && <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu perfil possui leitura clínica, mas não possui a capability <span className="font-mono text-paper">clinical.soap</span> para produzir ou assinar SOAP.</div>}

          {!note ? (
            <div className="rounded-xl border border-line bg-deep p-5">
              <p className="font-display font-semibold text-[14px]">Nenhum SOAP canônico aberto</p>
              <p className="mt-1 text-[11px] text-fog">{activeAppointment ? `Atendimento em andamento às ${activeAppointment.inicio}.` : 'Sem atendimento em andamento. Um rascunho avulso pode ser criado, mas o fluxo preferencial é vinculá-lo ao atendimento.'}</p>
              {canWrite && <div className="mt-4"><Btn onClick={() => void start()} disabled={busy}>{busy ? 'Criando…' : 'Criar rascunho SOAP'}</Btn></div>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip className={note.status === 'signed' ? 'border-mint/40 text-mint' : 'border-amber/40 text-amber'}>{note.status === 'signed' ? 'assinado' : 'rascunho'}</Chip>
                {note.appointmentId && <Chip className="border-aqua/40 text-aqua">vinculado ao atendimento</Chip>}
                {note.amendsNoteId && <Chip className="border-line text-fog">adendo</Chip>}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {(['subjective', 'objective', 'assessment', 'plan'] as SoapSectionKey[]).map((section) => (
                  <Field key={section} label={sectionLabels[section]}>
                    <Textarea
                      disabled={note.status === 'signed' || !canWrite}
                      value={note[section]}
                      onChange={(event) => setNote((current) => current ? { ...current, [section]: event.target.value } : current)}
                      placeholder={section === 'subjective' ? 'Relato, sintomas, contexto e queixa do paciente.' : section === 'objective' ? 'Achados observáveis, escalas, EEM, sinais e resultados.' : section === 'assessment' ? 'Síntese clínica, hipóteses e estratificação.' : 'Conduta, orientações, seguimento e plano terapêutico.'}
                    />
                  </Field>
                ))}
              </div>

              {note.status === 'draft' && canWrite && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                  <Btn variant="ghost" onClick={() => void save()} disabled={busy}>Salvar rascunho</Btn>
                  <Btn onClick={() => void sign()} disabled={busy}>Assinar prontuário</Btn>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {note && note.status === 'draft' && canWrite && (
        <Card>
          <CardHead title="Contribuições Nexus" sub="resultado clínico nunca entra no SOAP sem revisão explícita do profissional" />
          <div className="p-5 space-y-3">
            {results.length === 0 ? <Empty title="Sem resultados Nexus" sub="Aplique uma ferramenta Nexus para propor conteúdo estruturado ao SOAP." /> : results.slice(0, 8).map((result) => {
              const existing = imports.find((item) => item.nexusResultId === result.id);
              return (
                <div key={result.id} className="rounded-xl border border-line bg-deep p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-[12.5px]">{result.toolKey.toUpperCase()} · {result.classification || 'resultado clínico'}</p>
                      <p className="mt-1 text-[10.5px] text-fog">{result.soapText || 'Sem texto SOAP estruturado.'}</p>
                    </div>
                    {existing ? <Chip className={existing.status === 'accepted' ? 'border-mint/40 text-mint' : existing.status === 'rejected' ? 'border-line text-fog' : 'border-amber/40 text-amber'}>{existing.status}</Chip> : null}
                  </div>
                  {!existing && result.soapText && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={targetByResult[result.id] ?? 'objective'} onChange={(event) => setTargetByResult((current) => ({ ...current, [result.id]: event.target.value as SoapSectionKey }))}>
                        <option value="objective">O · Objetivo</option>
                        <option value="assessment">A · Avaliação</option>
                        <option value="plan">P · Plano</option>
                        <option value="subjective">S · Subjetivo</option>
                      </Select>
                      <Btn variant="subtle" onClick={() => void propose(result)} disabled={busy}>Propor ao SOAP</Btn>
                    </div>
                  )}
                  {existing?.status === 'proposed' && (
                    <div className="mt-3 rounded-lg border border-aqua/25 bg-aqua/[0.03] p-3">
                      <p className="text-[10.5px] text-fog">Destino: <strong className="text-paper">{sectionLabels[existing.targetSection]}</strong></p>
                      <p className="mt-2 text-[11px] text-paper/90">{existing.suggestedText}</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <Btn variant="ghost" onClick={() => void reviewImport(existing, false)} disabled={busy}>Rejeitar</Btn>
                        <Btn onClick={() => void reviewImport(existing, true)} disabled={busy}>Aceitar no SOAP</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
