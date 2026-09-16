import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { useAgenda } from '../lib/agendaContext';
import {
  loadClinicalEncounterAddendumContext,
  type ClinicalEncounterRecordAddendum,
  type FinalizedEncounterRecordReference,
} from '../lib/clinicalEncounterAddendum';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { userName } from '../lib/displayNames';
import { Card, CardHead, Chip } from '../lib/ui';
import { ClinicalEncounterAddendumPanel } from './ClinicalEncounterAddendumPanel';

export function ClinicalEncounterAddendumTimeline({ patientId }: { patientId: string }) {
  const { user } = useCurrentUserAccess();
  const { users } = useClinicDirectory();
  const { appointments } = useAgenda();
  const attend = useClinicalCapability('clinical.attend', user?.id);
  const evolution = useClinicalCapability('clinical.evolution.write', user?.id);
  const [records, setRecords] = useState<FinalizedEncounterRecordReference[]>([]);
  const [addenda, setAddenda] = useState<ClinicalEncounterRecordAddendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void loadClinicalEncounterAddendumContext(patientId)
      .then((context) => {
        if (cancelled) return;
        setRecords(context.records);
        setAddenda(context.addenda);
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error('[MedicsPro] retificações/adendos longitudinais:', cause);
        setRecords([]);
        setAddenda([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [patientId]);

  const addendaByRecord = useMemo(() => {
    const grouped = new Map<string, ClinicalEncounterRecordAddendum[]>();
    for (const item of addenda) grouped.set(item.encounterRecordId, [...(grouped.get(item.encounterRecordId) ?? []), item]);
    return grouped;
  }, [addenda]);

  const canCreateFor = (record: FinalizedEncounterRecordReference) => Boolean(
    user?.id === record.professionalId
    && attend.allowed
    && evolution.allowed,
  );
  const visibleRecords = records.filter((record) => (
    (addendaByRecord.get(record.id)?.length ?? 0) > 0 || canCreateFor(record)
  ));

  const handleCreated = (item: ClinicalEncounterRecordAddendum) => {
    setAddenda((current) => current.some((existing) => existing.id === item.id)
      ? current
      : [...current, item]);
  };

  if (!loading && !error && visibleRecords.length === 0) return null;

  return (
    <Card>
      <CardHead
        title="Retificações e adendos"
        sub="Atos posteriores ficam vinculados ao atendimento finalizado sem alterar o registro original."
      />
      {loading && <div className="px-5 py-5 text-[17px] text-fog">Carregando atos posteriores…</div>}
      {error && (
        <div className="mx-5 my-5 rounded-xl border border-amber/25 bg-amber/[0.04] px-4 py-3 text-[16.5px] leading-relaxed text-fog">
          Retificações e adendos estão temporariamente indisponíveis. Os registros clínicos originais continuam preservados.
        </div>
      )}
      {!loading && !error && visibleRecords.length > 0 && (
        <div className="divide-y divide-line/70">
          {visibleRecords.map((record) => {
            const appointment = appointments.find((item) => item.id === record.appointmentId);
            const linkedAddenda = addendaByRecord.get(record.id) ?? [];
            return (
              <section key={record.id} className="px-5 py-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[14px] text-mint">
                    {format(new Date(record.finalizedAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}
                  </span>
                  <span className="text-[15px] text-fog">por {userName(users, record.professionalId)}</span>
                  <Chip className="border-mint/35 text-mint">original preservado</Chip>
                  {appointment && <Chip className="border-aqua/35 text-aqua">{appointment.data} · {appointment.inicio}</Chip>}
                </div>
                <p className="mt-3 text-[17px] leading-relaxed text-paper/90">
                  Registro finalizado. Qualquer informação posterior é acrescentada como novo ato auditável.
                </p>
                <ClinicalEncounterAddendumPanel
                  record={record}
                  addenda={linkedAddenda}
                  canCreate={canCreateFor(record)}
                  authorName={(authorId) => userName(users, authorId)}
                  onCreated={handleCreated}
                />
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
