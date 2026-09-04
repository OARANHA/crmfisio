import { Link } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Card, Chip, IconChevronR } from '../lib/ui';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { isPsychiatristIdentity, professionalIdentityLabel } from '../lib/professionalIdentity';
import { Reveal } from '../components/Reveal';
import { NexusPatientLauncher } from '../components/NexusPatientLauncher';

const DOMAINS = [
  { key: 'mental-health', title: 'Saúde Mental', sub: 'Depressão, ansiedade, bipolaridade, risco, álcool e substâncias, TDAH, TOC, sono e funcionalidade.', state: 'ativo parcial' },
  { key: 'eem', title: 'Exame do Estado Mental', sub: 'EEM estruturado, resumo narrativo e destino contextual para o prontuário/SOAP.', state: 'em integração' },
  { key: 'psychopharm', title: 'Psicofarmacologia', sub: 'Troca de antidepressivos, monitoramentos e evidências com regra clínica versionada.', state: 'restrito' },
  { key: 'cognition', title: 'Cognição', sub: 'MEEM, domínios cognitivos e comparação longitudinal.', state: 'em integração' },
  { key: 'calculators', title: 'Calculadoras Clínicas', sub: 'Função renal, risco cardiovascular e outros cálculos Nexus validados.', state: 'em integração' },
  { key: 'longitudinal', title: 'Evolução Clínica', sub: 'Baseline, tendências por escala, comparação entre consultas e alertas persistentes.', state: 'em integração' },
  { key: 'education', title: 'Educação em Saúde', sub: 'Conteúdo contextual para paciente e profissional, preservando proveniência clínica.', state: 'em integração' },
  { key: 'evidence', title: 'Evidências', sub: 'Fontes, versões, validações, pontos de corte e histórico de revisão.', state: 'fundação ativa' },
] as const;

export function NexusGlobalPage() {
  const { user } = useApp();
  const { identity } = useProfessionalIdentity(user?.id);
  const psychiatrist = isPsychiatristIdentity(identity);

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="relative overflow-hidden rounded-[24px] border border-aqua/25 bg-panel p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aqua/75 to-transparent" />
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Chip className="border-aqua/35 bg-aqua/10 text-aqua">Nexus Clinical Engine</Chip>
                {psychiatrist && <Chip className="border-mint/30 bg-mint/8 text-mint">Psiquiatria</Chip>}
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Inteligência clínica dentro do MedicsPro</h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-fog">
                Biblioteca clínica Nexus para consulta e apoio ao fluxo assistencial. O paciente, o prontuário, a sessão e a governança continuam canônicos no MedicsPro.
              </p>
              <p className="mt-3 text-[11px] font-mono text-fog">Perfil atual: {professionalIdentityLabel(identity)} · acesso funcional continua sujeito a capability + entitlement + autorização do recurso.</p>
            </div>
            <Link to="/pacientes" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line/80 bg-deep px-4 py-2.5 font-display text-[13px] font-semibold text-paper transition-colors hover:border-aqua/35 hover:bg-raise/50">
              Pacientes <IconChevronR className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal delay={40}>
        <NexusPatientLauncher />
      </Reveal>

      <Reveal delay={70}>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {DOMAINS.map((domain) => (
            <Card key={domain.key} className="p-4 transition-colors hover:border-aqua/30 hover:bg-raise/20">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14.5px] font-semibold">{domain.title}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog">{domain.sub}</p>
                </div>
                <Chip className="shrink-0 border-aqua/25 text-aqua">{domain.state}</Chip>
              </div>
            </Card>
          ))}
        </div>
      </Reveal>

      <Reveal delay={110}>
        <section className="rounded-2xl border border-line/70 bg-deep/55 p-4">
          <p className="font-display text-[13.5px] font-semibold">Como usar o Nexus no MedicsPro</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-line/60 bg-panel/60 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-aqua">1 · Global</p><p className="mt-1.5 text-[11.5px] text-fog">Consulte instrumentos, evidências e ferramentas sem precisar abrir um paciente.</p></div>
            <div className="rounded-xl border border-line/60 bg-panel/60 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-aqua">2 · Contextual</p><p className="mt-1.5 text-[11.5px] text-fog">Selecione o paciente acima e continue no mesmo prontuário para executar recursos com contexto clínico.</p></div>
            <div className="rounded-xl border border-line/60 bg-panel/60 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-aqua">3 · Revisão humana</p><p className="mt-1.5 text-[11.5px] text-fog">Resultados, alertas e sugestões não substituem autoria, julgamento ou decisão clínica do profissional.</p></div>
          </div>
        </section>
      </Reveal>

      <Reveal delay={140}>
        <div className="rounded-2xl border border-line/70 bg-deep/50 px-4 py-3 text-[10.5px] leading-relaxed text-fog">
          <strong className="font-semibold text-paper/80">Nexus Clinical Engine.</strong> Conteúdo e arquitetura clínica: Dr. Adolfo Aranha · Médico Psiquiatra. Motor de suporte à decisão clínica baseado em evidências e desenvolvido para assistência ao profissional de saúde.
        </div>
      </Reveal>
    </div>
  );
}
