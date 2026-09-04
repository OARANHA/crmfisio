import { Link, Navigate, useParams } from 'react-router-dom';
import { CanonicalSoapPanel } from '../components/CanonicalSoapPanel';
import { useApp } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
import { Card, Empty } from '../lib/ui';

export function CanonicalSoapPage() {
  const { id } = useParams();
  const { user, patients } = useApp();

  if (!user) return <Navigate to="/" replace />;
  const canSeeClinical = user.role === 'fisio' || isClinicManager(user.role);
  if (!canSeeClinical) return <Navigate to="/pacientes" replace />;

  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="O SOAP precisa estar ligado ao paciente canônico do MedicsPro." /></Card>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-mint">MedicsPro · Prontuário canônico</p>
            <h1 className="font-display font-semibold text-[17px] mt-1">{patient.preferredName || patient.nome}</h1>
            <p className="text-[11px] text-fog mt-1">SOAP multiprofissional · revisão humana · assinatura imutável</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Link to={`/pacientes/${patient.id}/nexus`} className="rounded-xl border border-aqua/35 px-3 py-2 text-[11.5px] font-semibold text-aqua hover:bg-aqua/[0.05]">Nexus</Link>
            <Link to={`/pacientes/${patient.id}`} className="rounded-xl border border-line px-3 py-2 text-[11.5px] font-semibold text-fog hover:text-paper">Voltar ao paciente</Link>
          </div>
        </div>
      </div>
      <CanonicalSoapPanel patient={patient} />
    </div>
  );
}
