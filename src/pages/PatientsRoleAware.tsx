import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { Pacientes } from './Pacientes';
import { ReceptionPatients } from './ReceptionPatients';

export function PatientsRoleAware() {
  const { user } = useCurrentUserAccess();
  return user?.role === 'recep' ? <ReceptionPatients /> : <Pacientes />;
}
