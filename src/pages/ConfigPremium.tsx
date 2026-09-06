import { useMemo, useState } from 'react';
import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { StorageAdmin } from '../components/StorageAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { useApp } from '../lib/store';
import { Config } from './Config';

type ConfigSection = 'estrutura' | 'equipe' | 'modelos' | 'governanca';

const SECTION_META: Array<{
  key: ConfigSection;
  title: string;
  short: string;
  description: string;
  step: string;
}> = [
  {
    key: 'estrutura',
    title: 'Estrutura da clínica',
    short: 'Unidades, salas e recursos',
    description: 'Comece pelo espaço físico usado pela agenda e pela operação diária.',
    step: '01',
  },
  {
    key: 'equipe',
    title: 'Equipe & acessos',
    short: 'Profissionais e funcionários',
    description: 'Cadastre quem atende, quem opera a recepção e quem administra a clínica.',
    step: '02',
  },
  {
    key: 'modelos',
    title: 'Modelos clínicos',
    short: 'Avaliações, termos e arquivos',
    description: 'Prepare os conteúdos reutilizáveis que reduzem retrabalho no atendimento.',
    step: '03',
  },
  {
    key: 'governanca',
    title: 'Governança',
    short: 'RBAC, LGPD e auditoria',
    description: 'Revise permissões, conformidade e trilha de ações sensíveis da clínica.',
    step: '04',
  },
];

export function ConfigPremium() {
  const { unidades, users } = useApp();
  const [section, setSection] = useState<ConfigSection>('estrutura');

  const activeUnits = unidades.length;
  const activeUsers = useMemo(() => users.filter((item) => item.ativo !== false).length, [users]);

  const readiness = [
    { label: 'Unidade ativa', done: activeUnits > 0 },
    { label: 'Equipe cadastrada', done: activeUsers > 0 },
  ];
  const readyCount = readiness.filter((item) => item.done).length;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.08] via-panel to-panel p-5 md:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-mint/[0.08] blur-3xl" />
        <div className="relative grid gap-5 xl:grid-cols-[1.35fr_0.65fr] xl:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Configuração inicial</p>
            <h1 className="mt-2 max-w-3xl font-display text-[27px] font-bold leading-tight tracking-tight md:text-[31px]">Prepare a clínica por etapas, sem transformar configurações em uma parede de opções.</h1>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">A ordem abaixo acompanha a implantação real: primeiro estrutura, depois equipe, modelos operacionais e, por fim, governança. Você pode voltar a qualquer etapa quando precisar.</p>
          </div>

          <div className="rounded-[20px] border border-line/70 bg-deep/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fog">Fundação operacional</p>
                <p className="mt-1 font-display text-[24px] font-bold">{readyCount}/{readiness.length}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${readyCount === readiness.length ? 'border-mint/30 bg-mint/[0.07] text-mint' : 'border-amber/30 bg-amber/[0.06] text-amber'}`}>{readyCount === readiness.length ? 'Base pronta' : 'Em configuração'}</span>
            </div>
            <div className="mt-3 space-y-2">
              {readiness.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[10.5px] text-fog">
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] ${item.done ? 'border-mint/35 bg-mint/[0.08] text-mint' : 'border-line bg-panel text-fog'}`}>{item.done ? '✓' : '•'}</span>
                  <span className={item.done ? 'text-paper' : undefined}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Etapas de configuração da clínica">
        {SECTION_META.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              aria-pressed={active}
              className={`rounded-[20px] border p-4 text-left transition ${active ? 'border-mint/30 bg-mint/[0.07] shadow-sm' : 'border-line bg-panel hover:border-aqua/25 hover:bg-deep/35'}`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[10px] font-bold ${active ? 'border-mint/30 bg-mint/[0.09] text-mint' : 'border-line bg-deep text-fog'}`}>{item.step}</span>
                <div className="min-w-0">
                  <p className="font-display text-[13.5px] font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-fog">{item.short}</p>
                </div>
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-fog">{item.description}</p>
            </button>
          );
        })}
      </section>

      <section aria-live="polite">
        {section === 'estrutura' && <InfrastructureAdmin />}
        {section === 'equipe' && <TeamAdmin />}
        {section === 'modelos' && (
          <div className="space-y-5">
            <StorageAdmin />
            <AssessmentTemplatesAdmin />
            <ConsentTemplatesAdmin />
          </div>
        )}
        {section === 'governanca' && <Config />}
      </section>
    </div>
  );
}
