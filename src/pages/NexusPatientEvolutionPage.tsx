import { Navigate, useParams } from 'react-router-dom';
import { NexusLongitudinalPanel } from '../components/NexusLongitudinalPanel';
import { useApp } from '../lib/store';
import { Card, Empty } from '../lib/ui';

export function NexusPatientEvolutionPage(){
  const {id}=useParams();
  const {user,patients}=useApp();
  if(!user)return <Navigate to="/" replace />;
  const patient=patients.find((item)=>item.id===id);
  if(!patient)return <Card><Empty title="Paciente não encontrado" sub="A evolução Nexus sempre usa o paciente canônico do MedicsPro." /></Card>;
  return <NexusLongitudinalPanel patient={patient}/>;
}
