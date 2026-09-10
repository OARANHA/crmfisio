import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationContext } from '../lib/presentationContextContext';
import { IconShield } from './icons';

export function PresentationPrivacyBoundary({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { context, availableContexts, setContext } = usePresentationContext();

  if (context !== 'clinical') return <>{children}</>;

  const canUseManagement = availableContexts.includes('management');

  return (
    <section className="mx-auto max-w-2xl py-8 sm:py-12" aria-label="Proteção do Modo Consultório">
      <div className="overflow-hidden rounded-[24px] border border-mint/25 bg-panel shadow-[0_22px_70px_rgba(0,0,0,0.08)]">
        <div className="border-b border-line/65 bg-mint/[0.055] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-mint/25 bg-mint/10 text-mint">
              <IconShield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Modo Consultório</p>
              <h1 className="mt-1 font-display text-[22px] font-bold tracking-tight text-paper">Área administrativa protegida</h1>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
          {canUseManagement ? (
            <p className="max-w-xl text-[14px] leading-relaxed text-fog">
              Você está no Modo Consultório. Para proteger informações administrativas durante o atendimento,
              saia do Modo Consultório para acessar esta área.
            </p>
          ) : (
            <p className="max-w-xl text-[14px] leading-relaxed text-fog">
              Esta área não está disponível no Modo Consultório. Volte ao seu dia clínico para continuar.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="min-h-11 rounded-xl border border-line bg-deep px-4 py-2.5 font-display text-[13px] font-semibold text-paper transition-colors hover:bg-raise/55"
            >
              {canUseManagement ? 'Continuar no Consultório' : 'Voltar ao Consultório'}
            </button>
            {canUseManagement && (
              <button
                type="button"
                onClick={() => setContext('management')}
                className="min-h-11 rounded-xl bg-mint px-4 py-2.5 font-display text-[13px] font-semibold text-on-accent transition-[filter] hover:brightness-105"
              >
                Sair do Modo Consultório
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
