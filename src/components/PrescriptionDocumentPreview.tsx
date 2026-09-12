import { prescriptionItemSummary, type MedicationPrescriptionPayload } from '../lib/clinicalPrescription';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import type { Patient } from '../lib/types';

type PrescriptionDocumentPreviewProps = {
  patient: Patient;
  payload: MedicationPrescriptionPayload;
};

export function PrescriptionDocumentPreview({ patient, payload }: PrescriptionDocumentPreviewProps) {
  const { user } = useCurrentUserAccess();
  const patientName = patient.preferredName || patient.nome;
  const professionalName = user?.nome || 'Profissional responsável';
  const professionalRegistration = user?.registro || '';
  const previewDate = new Date().toLocaleDateString('pt-BR');
  const visibleItems = payload.items.filter((item) => (
    item.medicationName.trim()
    || item.dose.trim()
    || item.route.trim()
    || item.frequency.trim()
    || item.duration.trim()
    || item.instructions.trim()
  ));

  return (
    <section className="self-start overflow-hidden rounded-2xl border border-line/65 bg-panel 2xl:sticky 2xl:top-4" data-prescription-live-preview="draft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/65 px-4 py-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">Visualização</p>
          <p className="mt-0.5 text-[11px] text-paper">A receita muda em tempo real enquanto você edita.</p>
        </div>
        <span className="rounded-full border border-amber/35 bg-amber/[0.08] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-amber">Rascunho · não emitida</span>
      </div>

      <div className="overflow-auto bg-deep/35 p-3 sm:p-4">
        <article className="mx-auto flex min-h-[640px] w-full max-w-[720px] flex-col rounded-[18px] border border-slate-200 bg-white px-5 py-7 text-slate-900 shadow-[0_18px_45px_rgba(2,16,67,0.12)] sm:px-9 sm:py-9" aria-label="Pré-visualização da receita médica">
          <header className="border-b border-slate-300 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold text-slate-950">{professionalName}</p>
                <p className="mt-1 text-[11px] text-slate-600">CRM: {professionalRegistration || 'identificação disponível na emissão'}</p>
              </div>
              <div className="text-right text-[10px] leading-relaxed text-slate-500">
                <p>Prévia em {previewDate}</p>
                <p>Sem validade até a emissão</p>
              </div>
            </div>
          </header>

          <div className="flex-1 pt-7">
            <h3 className="text-center text-[16px] font-bold uppercase tracking-[0.28em] text-slate-950">Receita médica</h3>

            <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-6 text-slate-700">
              <p><span className="font-semibold text-slate-950">Paciente:</span> {patientName}</p>
              <p><span className="font-semibold text-slate-950">Data de nascimento:</span> {formatDateOnly(patient.nascimento)}</p>
              <p><span className="font-semibold text-slate-950">Data:</span> {previewDate}</p>
            </div>

            <div className="mt-7">
              {visibleItems.length === 0 ? (
                <p className="text-[12px] italic text-slate-400">Nenhum medicamento adicionado.</p>
              ) : (
                <ol className="space-y-5">
                  {visibleItems.map((item, index) => {
                    const summary = prescriptionItemSummary(item);
                    return (
                      <li key={`${item.medicationName}:${index}`} className="border-b border-slate-100 pb-4 last:border-0">
                        <p className="text-[13px] font-semibold leading-relaxed text-slate-950">{index + 1}. {item.medicationName.trim() || 'Medicamento ainda não identificado'}</p>
                        {summary && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{summary}</p>}
                        {item.instructions.trim() && <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">{item.instructions.trim()}</p>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {payload.observations.trim() && (
              <section className="mt-7 border-t border-slate-200 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Observações</p>
                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">{payload.observations.trim()}</p>
              </section>
            )}
          </div>

          <footer className="mt-8 border-t border-dashed border-slate-300 pt-4 text-center">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Pré-visualização de rascunho · documento não emitido</p>
          </footer>
        </article>
      </div>
    </section>
  );
}

function formatDateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value || 'não informada';
  return `${match[3]}/${match[2]}/${match[1]}`;
}
