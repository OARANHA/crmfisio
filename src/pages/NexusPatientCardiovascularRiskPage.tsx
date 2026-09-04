import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
import { Card, Empty } from '../lib/ui';
import { NexusCardiovascularRiskPanel } from '../components/NexusCardiovascularRiskPanel';

export function NexusPatientCardiovascularRiskPage() {
  const { id } = useParams();
  const { user, patients } = useApp();
  if (!user) return <Navigate to="/" replace />;
  if (!(user.role === 'fisio' || isClinicManager(user.role))) return <Navigate to="/pacientes" replace />;
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A calculadora cardiovascular depende do paciente canônico do MedicsPro." /></Card>;
  return <div className="space-y-4"><div className="rounded-xl border border-line bg-panel px-4 py-3"><div className="flex flex-wrap items-start gap-3"><div><p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-aqua">MedicsPro · Nexus Clinical Engine</p><h1 className="mt-1 font-display text-[17px] font-semibold">{patient.preferredName || patient.nome}</h1><p className="mt-1 text-[11px] text-fog">Calculadoras › Risco Cardiovascular</p></div><Link to={`/pacientes/${patient.id}/nexus`} className="ml-auto rounded-xl border border-line px-3 py-2 text-[11.5px] font-semibold text-fog hover:text-paper">Visão Nexus</Link></div></div><NexusCardiovascularRiskPanel patient={patient} /></div>;
}
