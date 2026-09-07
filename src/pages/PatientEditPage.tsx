import { useParams } from 'react-router-dom';
import { usePatients } from '../lib/patientContext';
import { Empty } from '../lib/ui';
import { PatientRegistryForm } from '../components/PatientRegistryForm';

export function PatientEditPage() {
  const { id } = useParams();
  const { patients } = usePatients();
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Empty title="Paciente não encontrado" />;
  return <PatientRegistryForm patient={patient} />;
}
