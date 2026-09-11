import { useState } from 'react';
import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { ClinicGeneralAdmin } from '../components/configuration/ClinicGeneralAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { StorageAdmin } from '../components/StorageAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { Config } from './Config';

type ConfigSection = 'geral' | 'equipe' | 'agenda' | 'modelos' | 'governanca';

const SECTION_META: Array<{
  key: ConfigSection;
  title: string;
  description: string;
}> = [
  { key: 'geral', title: 'Geral', description: 'Identidade, unidades e horários' },
  { key: 'equipe', title: 'Equipe & Acessos', description: 'Pessoas e permissões operacionais' },
  { key: 'agenda', title: 'Agenda & Atendimento', description: 'Salas e recursos físicos' },
  { key: 'modelos', title: 'Modelos Clínicos', description: 'Avaliações, termos e arquivos' },
  { key: 'governanca', title: 'Governança', description: 'RBAC, LGPD e auditoria' },
];

export function ConfigPremium() {
  const [section, setSection] = useState<ConfigSection>('geral');

  return (
    <div className="space-y-5">
      <header className="border-b border-line/70 pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Administração da clínica</p>
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-tight md:text-[32px]">Configurações</h1>
        <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-fog">Organize a base operacional da clínica por domínio. Cada área abaixo corresponde a uma configuração funcional do produto.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <nav className="h-fit rounded-[18px] border border-line bg-panel p-2" aria-label="Domínios de configuração da clínica">
          {SECTION_META.map((item) => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`w-full rounded-[13px] px-3 py-3 text-left transition ${active ? 'bg-mint/[0.09] text-paper' : 'text-fog hover:bg-deep/50 hover:text-paper'}`}
              >
                <span className={`block font-display text-[12.5px] font-semibold ${active ? 'text-mint' : ''}`}>{item.title}</span>
                <span className="mt-0.5 block text-[9.5px] leading-relaxed">{item.description}</span>
              </button>
            );
          })}
        </nav>

        <main className="min-w-0" aria-live="polite">
          {section === 'geral' && <ClinicGeneralAdmin />}
          {section === 'equipe' && <TeamAdmin />}
          {section === 'agenda' && <InfrastructureAdmin mode="rooms" />}
          {section === 'modelos' && (
            <div className="space-y-5">
              <StorageAdmin />
              <AssessmentTemplatesAdmin />
              <ConsentTemplatesAdmin />
            </div>
          )}
          {section === 'governanca' && <Config />}
        </main>
      </div>
    </div>
  );
}
