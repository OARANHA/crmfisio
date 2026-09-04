import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { NexusEemPanel } from '../components/NexusEemPanel';
import { useApp } from '../lib/store';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import { Card, Empty } from '../lib/ui';

export function NexusPatientEemPage() {
  const { id } = useParams();
  const { user, patients } = useApp();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAuthorized(false);
      return () => {
        active = false;
      };
    }

    void hasProfessionalCapability('nexus.access')
      .then((allowed) => {
        if (active) setAuthorized(allowed);
      })
      .catch((error) => {
        console.error('[Nexus] EEM route authorization:', error);
        if (active) setAuthorized(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (!user) return <Navigate to="/" replace />;
  if (authorized === null) return <Card><div className="p-6 text-[12px] text-fog">Validando acesso ao Nexus…</div></Card>;
  if (!authorized) return <Navigate to="/pacientes" replace />;

  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="O EEM Nexus precisa estar vinculado ao paciente canônico do MedicsPro." /></Card>;

  return <div className="space-y-4">
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div><p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-aqua">MedicsPro · Nexus Clinical Engine</p><h1 className="mt-1 font-display text-[17px] font-semibold">{patient.preferredName || patient.nome}</h1><p className="mt-1 text-[11px] text-fog">Exame do Estado Mental › EEM estruturado</p></div>
        <Link to={`/pacientes/${patient.id}/nexus`} className="ml-auto rounded-xl border border-line px-3 py-2 text-[11.5px] font-semibold text-fog transition-colors hover:border-line2 hover:text-paper">Visão Nexus</Link>
      </div>
    </div>
    <NexusEemPanel patient={patient} />
  </div>;
}
