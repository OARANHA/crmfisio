import { Link } from 'react-router-dom';
import type { Patient } from '../lib/types';
import { Chip } from '../lib/ui';
import { NexusLongitudinalPanel } from './NexusLongitudinalPanel';
import { NexusSelfAssessmentInviteAction } from './NexusSelfAssessmentInviteAction';
import { NexusSelfAssessmentStatus } from './NexusSelfAssessmentStatus';

const DOMAINS = [
  { key: 'mental-health', label: 'Saúde Mental', description: 'Escalas, rastreios e acompanhamento por domínio clínico.', status: 'ativo' },
  { key: 'eem', label: 'Exame do Estado Mental', description: 'EEM estruturado, narrativa e integração com prontuário.', status: 'ativo' },
  { key: 'psychopharm', label: 'Psicofarmacologia', description: 'Ferramentas clínicas, monitoramento e evidências.', status: 'em integração' },
  { key: 'cognition', label: 'Cognição', description: 'MEEM, domínios cognitivos e evolução longitudinal.', status: 'em integração' },
  { key: 'longitudinal', label: 'Evolução longitudinal', description: 'Tendências, baseline, alertas e comparação temporal.', status: 'ativo' },
  { key: 'evidence', label: 'Evidências', description: 'Versões de regra, referências e proveniência clínica.', status: 'em integração' },
] as const;

export function NexusPatientContextHub({ patient }: { patient: Patient }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-aqua/25 bg-panel shadow-[0_12px_38px_rgba(15,28,24,0.055)]">
      <div className="border-b border-line/60 bg-gradient-to-r from-aqua/[0.08] via-panel to-panel px-5 py-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aqua">Nexus Clinical Engine</p>
              <Chip className="border-aqua/25 bg-aqua/[0.06] text-aqua">contexto do paciente</Chip>
            </div>
            <h2 className="mt-2 font-display text-[19px] font-bold tracking-tight">Visão clínica Nexus</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">
              Inteligência clínica integrada ao prontuário de {patient.preferredName || patient.nome}. O Nexus usa o mesmo paciente, a mesma sessão e as mesmas fronteiras de autorização do MedicsPro.
            </p>
          </div>
          <div className="text-right text-[10.5px] leading-relaxed text-fog">
            <p className="font-semibold text-paper/80">Conteúdo e arquitetura clínica</p>
            <p>Dr. Adolfo Aranha · Médico Psiquiatra</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {DOMAINS.map((domain) => (
          <article key={domain.key} className="rounded-2xl border border-line/70 bg-deep/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-[13.5px] font-semibold">{domain.label}</h3>
              <span className={`font-mono text-[9.5px] uppercase tracking-[0.08em] ${domain.status === 'ativo' ? 'text-mint' : 'text-fog'}`}>{domain.status}</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-fog">{domain.description}</p>
            {domain.key === 'eem' && <Link to={`/pacientes/${patient.id}/nexus/eem`} className="mt-3 inline-flex text-[11px] font-semibold text-aqua hover:text-paper">Abrir EEM →</Link>}
            {domain.key === 'longitudinal' && <Link to={`/pacientes/${patient.id}/nexus/evolution`} className="mt-3 inline-flex text-[11px] font-semibold text-aqua hover:text-paper">Abrir evolução →</Link>}
          </article>
        ))}
      </div>

      <div className="space-y-3 border-t border-line/60 p-4">
        <NexusSelfAssessmentInviteAction patient={patient} />
        <NexusSelfAssessmentStatus patient={patient} />
        <NexusLongitudinalPanel patient={patient} />
      </div>
    </section>
  );
}
