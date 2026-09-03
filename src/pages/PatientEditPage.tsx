import { useParams } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Empty } from '../lib/ui';
import { PatientRegistryForm } from '../components/PatientRegistryForm';

export function PatientEditPage() {
  const { id } = useParams();
  const { patients } = useApp();
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Empty title="Paciente não encontrado" />;
  return <PatientRegistryForm patient={patient} />;
}
