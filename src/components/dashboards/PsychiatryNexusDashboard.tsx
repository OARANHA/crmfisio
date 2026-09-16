import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfessionalIdentity } from '../../hooks/useProfessionalIdentity';
import { useCurrentUserAccess } from '../../lib/currentUserAccess';
import { resolveNexusClinicalTools } from '../../lib/nexus/clinicalToolRegistry';
import { hasProfessionalCapability, type NexusCapabilityStatus } from '../../lib/nexusClinical';
import { Card, Chip, IconChevronR } from '../../lib/ui';
import { Reveal } from '../Reveal';
import { ClinicianDashboard } from './ClinicianDashboard';

type NexusHomeCapabilities = {
  eem: boolean;
  scales: boolean;
};

export function PsychiatryNexusDashboard() {
  return <ClinicianDashboard nexusContext={<PsychiatryNexusContext />} />;
}

function PsychiatryNexusContext() {
  const { user } = useCurrentUserAccess();
  const { identity, loading: identityLoading } = useProfessionalIdentity(user?.id);
  const [capabilities, setCapabilities] = useState<NexusHomeCapabilities | null>(null);
  const [capabilityStatus, setCapabilityStatus] = useState<NexusCapabilityStatus>('loading');

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setCapabilities({ eem: false, scales: false });
      setCapabilityStatus('denied');
      return () => { active = false; };
    }

    setCapabilities(null);
    setCapabilityStatus('loading');
    void Promise.all([
      hasProfessionalCapability('nexus.eem'),
      hasProfessionalCapability('nexus.scales'),
    ])
      .then(([eem, scales]) => {
        if (active) {
          setCapabilities({ eem, scales });
          setCapabilityStatus('allowed');
        }
      })
      .catch((error) => {
        console.error('[Nexus] clinician Home capabilities:', error);
        if (active) {
          setCapabilities(null);
          setCapabilityStatus('error');
        }
      });

    return () => { active = false; };
  }, [user?.id]);

  const resolving = identityLoading || capabilityStatus === 'loading';

  if (resolving) {
    return (
      <Reveal delay={145}>
        <Card className="border-aqua/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Nexus clínico</p>
          <p className="mt-2 text-[12.5px] text-fog">Preparando somente os recursos autorizados para este contexto clínico…</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-raise/65" />)}
          </div>
        </Card>
      </Reveal>
    );
  }

  if (capabilityStatus === 'error') {
    return <Reveal delay={145}><Card className="border-amber/25"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber">Nexus clínico</p><p className="mt-2 text-[12.5px] text-fog">Não foi possível verificar as capabilities Nexus. Os recursos permanecem ocultos por segurança até a autorização poder ser confirmada.</p></Card></Reveal>;
  }

  if (!capabilities) return null;

  const tools = resolveNexusClinicalTools({
    state: 'ready',
    // The parent dashboard is reachable only after the canonical nexus.access
    // resolver succeeds. Per-tool grants remain on the separate Nexus path.
    entitlementAllowed: true,
    nexusAccess: true,
    capabilities: {
      'nexus.eem': capabilities.eem,
      'nexus.scales': capabilities.scales,
    },
  }, identity)
    // Clinician-assisted PHQ/GAD is intentionally outside this slice. The
    // authorization remains intact; this Home simply does not surface it yet.
    .filter((tool) => tool.id !== 'mental-health-screening');

  if (tools.length === 0) return null;

  return (
    <Reveal delay={145}>
      <Card className="border-aqua/20">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Nexus no contexto clínico</p>
              <Chip className="border-aqua/25 bg-aqua/[0.07] text-aqua">Psiquiatria</Chip>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">Recursos autorizados aparecem como apoio ao mesmo fluxo de atendimento — não como um produto separado.</p>
          </div>
          <Link to="/nexus" className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-aqua hover:text-paper">Abrir Nexus <IconChevronR className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.id} to="/nexus" className="group rounded-2xl border border-line/75 bg-deep/35 p-4 transition-colors hover:border-aqua/30 hover:bg-raise/45">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[13.5px] font-semibold text-paper">{tool.title}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog">{tool.detail}</p>
                </div>
                {tool.level === 'relevant' && <Chip className="shrink-0 border-aqua/25 text-aqua">contextual</Chip>}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </Reveal>
  );
}
