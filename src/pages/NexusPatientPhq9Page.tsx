import { Navigate, useParams } from 'react-router-dom';
import { NexusPhq9Panel } from '../components/NexusPhq9Panel';
import { useApp } from '../lib/store';
import { Card, Empty } from '../lib/ui';

export function NexusPatientPhq9Page() {
  const { id } = useParams();
  const { user, patients } = useApp();

  if (!user) return <Navigate to="/" replace />;
  const patient = patients.find((item) => item.id === id);

  if (!patient) {
    return (
      <Card>
        <Empty title="Paciente não encontrado" sub="O PHQ-9 Nexus precisa estar vinculado a um paciente canônico do MedicsPro." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-aqua">MedicsPro · Nexus Clinical Engine</p>
        <h1 className="font-display font-semibold text-[17px] mt-1">{patient.preferredName || patient.nome}</h1>
        <p className="text-[11px] text-fog mt-1">Saúde Mental › Depressão › PHQ-9</p>
      </div>
      <NexusPhq9Panel patient={patient} />
    </div>
  );
}
