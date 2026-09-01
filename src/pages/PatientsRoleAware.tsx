import { useApp } from '../lib/store';
import { Pacientes } from './Pacientes';
import { ReceptionPatients } from './ReceptionPatients';

export function PatientsRoleAware() {
  const { user } = useApp();
  return user?.role === 'recep' ? <ReceptionPatients /> : <Pacientes />;
}
