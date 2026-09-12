import { useState } from 'react';
import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { ClinicGeneralAdmin } from '../components/configuration/ClinicGeneralAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { PrescriptionTemplatesAdmin } from '../components/PrescriptionTemplatesAdmin';
import { StorageAdmin } from '../components/StorageAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { Config } from './Config';

type ConfigSection = 'geral' | 'equipe' | 'agenda' | 'avaliacoes' | 'documentos' | 'termos' | 'governanca';

const SECTION_META: Array<{
  key: ConfigSection;
  title: string;
  description: string;
}> = [
  { key: 'geral', title: 'Geral', description: 'Identidade, unidades e horários' },
  { key: 'equipe', title: 'Equipe & Acessos', description: 'Pessoas e permissões operacionais' },
  { key: 'agenda', title: 'Agenda & Atendimento', description: 'Salas e recursos físicos' },
  { key: 'avaliacoes', title: 'Anamneses & Avaliações', description: 'Biblioteca clínica versionada' },
  { key: 'documentos', title: 'Documentos clínicos', description: 'Modelos de prescrição da clínica' },
  { key: 'termos', title: 'Termos', description: 'Modelos de consentimento' },
  { key: 'governanca', title: 'Governança', description: 'Storage, RBAC, LGPD e auditoria' },
];

export function ConfigPremium() {
  const [section, setSection] = useState<ConfigSection>('geral');
  const activeMeta = SECTION_META.find((item) => item.key === section) ?? SECTION_META[0];

  return (
    <div className="space-y-4">
      <header className="border-b border-line/70 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Administração da clínica</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight md:text-[32px]">Configurações</h1>
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-fog">Gerencie a operação da clínica em áreas independentes, sem perder o contexto da configuração atual.</p>
          </div>
          <div className="hidden text-right lg:block">
            <p className="font-display text-[12px] font-semibold text-paper">{activeMeta.title}</p>
            <p className="mt-0.5 text-[10px] text-fog">{activeMeta.description}</p>
          </div>
        </div>
      </header>

      <nav
        className="overflow-x-auto rounded-[16px] border border-line/80 bg-panel p-1.5 shadow-[0_6px_20px_rgba(15,28,24,0.035)]"
        aria-label="Áreas de configuração da clínica"
      >
        <div className="flex min-w-max items-center gap-1">
          {SECTION_META.map((item) => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[11px] px-3.5 py-2.5 text-left transition-colors ${active ? 'bg-mint/[0.10] text-mint' : 'text-fog hover:bg-raise/50 hover:text-paper'}`}
              >
                <span className="block whitespace-nowrap font-display text-[12.5px] font-semibold">{item.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="min-w-0" aria-live="polite">
        {section === 'geral' && <ClinicGeneralAdmin />}
        {section === 'equipe' && <TeamAdmin />}
        {section === 'agenda' && <InfrastructureAdmin mode="rooms" />}
        {section === 'avaliacoes' && <AssessmentTemplatesAdmin />}
        {section === 'documentos' && <PrescriptionTemplatesAdmin />}
        {section === 'termos' && <ConsentTemplatesAdmin />}
        {section === 'governanca' && (
          <div className="space-y-4">
            <StorageAdmin />
            <Config />
          </div>
        )}
      </main>
    </div>
  );
}
