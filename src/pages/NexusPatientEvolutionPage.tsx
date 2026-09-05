import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { NexusLongitudinalPanel } from '../components/NexusLongitudinalPanel';
import { useApp } from '../lib/store';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import { Card, Empty } from '../lib/ui';

export function NexusPatientEvolutionPage() {
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
        console.error('[Nexus] longitudinal route authorization:', error);
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
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A evolução Nexus sempre usa o paciente canônico do MedicsPro." /></Card>;
  return <NexusLongitudinalPanel patient={patient} />;
}
