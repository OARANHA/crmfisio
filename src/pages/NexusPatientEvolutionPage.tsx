import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { NexusLongitudinalPanel } from '../components/NexusLongitudinalPanel';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { usePatients } from '../lib/patientContext';
import { hasProfessionalCapability, type NexusCapabilityStatus } from '../lib/nexusClinical';
import { Card, Empty } from '../lib/ui';

export function NexusPatientEvolutionPage() {
  const { id } = useParams();
  const { user } = useCurrentUserAccess();
  const userId = user?.id;
  const { patients } = usePatients();
  const [authorizationStatus, setAuthorizationStatus] = useState<NexusCapabilityStatus>('loading');

  useEffect(() => {
    let active = true;
    if (!userId) {
      setAuthorizationStatus('denied');
      return () => {
        active = false;
      };
    }

    setAuthorizationStatus('loading');
    void hasProfessionalCapability('nexus.access')
      .then((allowed) => {
        if (active) setAuthorizationStatus(allowed ? 'allowed' : 'denied');
      })
      .catch((error) => {
        console.error('[Nexus] longitudinal route authorization:', error);
        if (active) setAuthorizationStatus('error');
      });

    return () => {
      active = false;
    };
  }, [userId]);

  if (!user) return <Navigate to="/" replace />;
  if (authorizationStatus === 'loading') return <Card><div className="p-6 text-[12px] text-fog">Validando acesso ao Nexus…</div></Card>;
  if (authorizationStatus === 'error') return <Card><div className="p-6 text-[12px] leading-relaxed text-fog"><p className="font-semibold text-amber">Não foi possível verificar o acesso à evolução Nexus.</p><p className="mt-1">O recurso permanece bloqueado por segurança até a autorização poder ser confirmada.</p></div></Card>;
  if (authorizationStatus === 'denied') return <Navigate to="/pacientes" replace />;

  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Card><Empty title="Paciente não encontrado" sub="A evolução Nexus sempre usa o paciente canônico do MedicsPro." /></Card>;
  return <NexusLongitudinalPanel patient={patient} />;
}
