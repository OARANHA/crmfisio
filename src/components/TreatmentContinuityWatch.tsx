import { useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Card, CardHead, Btn, IconAlert } from '../lib/ui';

type ContinuityRisk = {
  patientId: string;
  patientName: string;
  lastVisit: string;
  daysWithoutVisit: number;
  completed: number;
  missed: number;
  packageRemaining: number | null;
};

export function TreatmentContinuityWatch() {
  const { patients, appointments, patientPackages } = useApp();

  const risks = useMemo<ContinuityRisk[]>(() => {
    const now = new Date();
    return patients
      .filter((patient) => patient.funilStage === 'tratamento' && !patient.anonimizado && patient.status !== 'alta')
      .map((patient) => {
        const appts = appointments
          .filter((item) => item.pacienteId === patient.id && item.status !== 'cancelado')
          .sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`));
        const completed = appts.filter((item) => item.status === 'finalizado');
        const last = completed.length ? completed[completed.length - 1] : null;
        const hasFuture = appts.some((item) => ['agendado', 'confirmado', 'em_atendimento'].includes(item.status) && `${item.data}T${item.inicio}` >= format(now, "yyyy-MM-dd'T'HH:mm"));
        const daysWithoutVisit = last ? differenceInDays(now, new Date(`${last.data}T12:00:00`)) : 0;
        const activePackage = patientPackages.find((item) => item.pacienteId === patient.id && item.status === 'ativo');
        const packageRemaining = activePackage ? Math.max(0, activePackage.sessoesTotais - activePackage.sessoesUsadas) : null;
        if (!last || hasFuture || daysWithoutVisit < 21) return null;
        return {
          patientId: patient.id,
          patientName: patient.nome,
          lastVisit: last.data,
          daysWithoutVisit,
          completed: completed.length,
          missed: appts.filter((item) => item.status === 'faltou').length,
          packageRemaining,
        };
      })
      .filter((item): item is ContinuityRisk => item !== null)
      .sort((a, b) => b.daysWithoutVisit - a.daysWithoutVisit);
  }, [patients, appointments, patientPackages]);

  return (
    <Card>
      <CardHead
        title="Continuidade do tratamento"
        sub="pacientes em tratamento sem próxima sessão há 21 dias ou mais"
        right={risks.length ? <IconAlert className="w-4.5 h-4.5 text-amber" /> : undefined}
      />
      {risks.length === 0 ? (
        <div className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">
          Nenhuma interrupção de tratamento identificada.
        </div>
      ) : (
        <ul className="divide-y divide-line/70">
          {risks.map((risk) => (
            <li key={risk.patientId} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link to={`/pacientes/${risk.patientId}`} className="font-display font-semibold text-[13.5px] hover:text-mint transition-colors">
                  {risk.patientName}
                </Link>
                <p className="font-mono text-[10.5px] text-fog mt-0.5">
                  {risk.daysWithoutVisit} dias sem sessão · {risk.completed} realizada(s) · {risk.missed} falta(s)
                  {risk.packageRemaining !== null ? ` · ${risk.packageRemaining} sessão(ões) restantes no pacote` : ''}
                </p>
                <p className="font-mono text-[9.5px] text-fog/70 mt-1">Última sessão: {risk.lastVisit}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/pacientes/${risk.patientId}`}><Btn variant="ghost" className="!px-3 !py-1.5 !text-[11.5px]">Ver paciente</Btn></Link>
                <Link to={`/agenda?patient=${risk.patientId}`}><Btn variant="subtle" className="!px-3 !py-1.5 !text-[11.5px]">Agendar continuidade</Btn></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {risks.length > 0 && (
        <div className="px-5 py-3 border-t border-line font-mono text-[10.5px] text-fog">
          {risks.length} paciente(s) exigem decisão de continuidade clínica antes de uma reativação automática.
        </div>
      )}
    </Card>
  );
}
