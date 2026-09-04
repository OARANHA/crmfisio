import { Link, Navigate, useParams } from 'react-router-dom';
import { NexusScaleRuntimePanel } from '../components/NexusScaleRuntimePanel';
import { getNexusScaleDefinition } from '../lib/nexus/scaleCatalog';
import { useApp } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
import { Card, Empty } from '../lib/ui';

export function NexusPatientScalePage() {
  const { id, scaleKey } = useParams();
  const { user, patients } = useApp();
  if (!user) return <Navigate to="/" replace />;
  const canSeeClinical = user.role === 'fisio' || isClinicManager(user.role);
  if (!canSeeClinical) return <Navigate to="/pacientes" replace />;

  const patient = patients.find((item) => item.id === id);
  const definition = getNexusScaleDefinition(scaleKey);

  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A escala Nexus precisa estar vinculada ao paciente canônico do MedicsPro." /></Card>;
  if (!definition) return <Card><Empty title="Escala Nexus não encontrada" sub="Este instrumento não está cadastrado no Scale Runtime ou ainda não foi migrado." /></Card>;

  return <div className="space-y-4">
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div><p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-aqua">MedicsPro · Nexus Clinical Engine</p><h1 className="mt-1 font-display text-[17px] font-semibold">{patient.preferredName || patient.nome}</h1><p className="mt-1 text-[11px] text-fog">Saúde Mental › Escalas › {definition.acronym}</p></div>
        <Link to={`/pacientes/${patient.id}/nexus`} className="ml-auto rounded-xl border border-line px-3 py-2 text-[11.5px] font-semibold text-fog transition-colors hover:border-line2 hover:text-paper">Visão Nexus</Link>
      </div>
    </div>
    <NexusScaleRuntimePanel patient={patient} definition={definition} />
  </div>;
}
