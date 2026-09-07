import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveHelpContext } from '../lib/helpContent';
import type { Role } from '../lib/types';
import { IconX } from './icons';

export function ContextualHelp({ role }: { role: Role }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const help = resolveHelpContext(location.pathname, role);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, role]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-10 w-10 place-items-center rounded-xl border border-line/75 bg-panel font-display text-[15px] font-bold text-fog transition-colors hover:border-line2 hover:bg-raise/45 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/40"
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[120]">
          <button
            type="button"
            aria-label="Fechar ajuda"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(94vw,440px)] flex-col border-l border-line bg-panel shadow-[-24px_0_70px_rgba(0,0,0,0.20)]"
            aria-label={`Ajuda: ${help.title}`}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-mint">{help.eyebrow}</p>
                <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight">{help.title}</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-fog">{help.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-fog transition-colors hover:bg-raise hover:text-paper"
                aria-label="Fechar ajuda"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-3">
                {help.steps.map((step, index) => (
                  <div key={`${help.key}-${step.title}`} className="rounded-xl border border-line/80 bg-deep/55 p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-mint/35 bg-mint/[0.06] font-mono text-[10px] font-semibold text-mint">{index + 1}</span>
                      <div>
                        <p className="font-display text-[13px] font-semibold text-paper">{step.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-fog">{step.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {help.safetyNote && (
                <div className="mt-5 rounded-xl border border-amber/30 bg-amber/[0.045] px-4 py-3.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-amber">Próximo passo seguro</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-paper/90">{help.safetyNote}</p>
                </div>
              )}
            </div>

            <div className="border-t border-line px-5 py-4 text-[10.5px] leading-relaxed text-fog">
              A ajuda acompanha seu papel e a tela atual. Funções não disponíveis para seu perfil não são apresentadas como instrução operacional.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
