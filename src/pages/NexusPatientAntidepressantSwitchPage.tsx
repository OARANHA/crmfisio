import { Navigate, useParams } from 'react-router-dom';
import { NexusAntidepressantSwitchPanel } from '../components/NexusAntidepressantSwitchPanel';
import { useApp } from '../lib/store';
import { Card, Empty } from '../lib/ui';

export function NexusPatientAntidepressantSwitchPage() {
  const { id } = useParams();
  const { user, patients } = useApp();
  if (!user) return <Navigate to="/" replace />;
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A Psicofarmacologia Nexus sempre opera no paciente canônico do MedicsPro." /></Card>;
  return <NexusAntidepressantSwitchPanel patient={patient} />;
}
