import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import type { ClinicIdentity } from '../lib/clinicConfiguration';
import type { TherapeuticGuidancePayload } from '../lib/clinicalTherapeuticGuidance';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { buildTherapeuticGuidanceDocumentHtml } from '../lib/therapeuticGuidancePrintRenderer';
import type { Patient } from '../lib/types';

type TherapeuticGuidanceDocumentPreviewProps = {
  patient: Patient;
  payload: TherapeuticGuidancePayload;
  renderDefinition: unknown;
  clinic: ClinicIdentity;
};

export function TherapeuticGuidanceDocumentPreview({
  patient,
  payload,
  renderDefinition,
  clinic,
}: TherapeuticGuidanceDocumentPreviewProps) {
  const { user } = useCurrentUserAccess();
  const { identity } = useProfessionalIdentity(user?.id);
  const html = buildTherapeuticGuidanceDocumentHtml({
    payload,
    renderDefinition,
    mode: 'draft',
    context: {
      patient: {
        name: patient.preferredName || patient.nome,
        birthDate: patient.nascimento,
      },
      clinic: {
        name: clinic.name || 'Clínica',
        address: clinic.address,
        phone: clinic.phone,
      },
      issuer: {
        name: user?.nome || 'Profissional responsável',
        professionalType: identity?.professionalType,
        councilType: identity?.councilType,
        councilState: identity?.councilState,
        registration: user?.registro,
        specialty: identity?.specialty,
      },
      issuedAt: new Date().toISOString(),
    },
  });

  return (
    <section className="self-start overflow-hidden rounded-2xl border border-line/65 bg-panel 2xl:sticky 2xl:top-4" data-therapeutic-guidance-live-preview="draft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/65 px-4 py-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">Visualização</p>
          <p className="mt-0.5 text-[11px] text-paper">A mesma composição segura usada na impressão atualiza enquanto você edita.</p>
        </div>
        <span className="rounded-full border border-amber/35 bg-amber/[0.08] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-amber">Rascunho · não emitida</span>
      </div>

      <div className="bg-deep/35 p-3 sm:p-4">
        <iframe
          title="Pré-visualização da orientação terapêutica"
          srcDoc={html}
          sandbox=""
          className="h-[720px] w-full rounded-[16px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(2,16,67,0.12)]"
        />
        <p className="mt-2 text-center text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fog">Pré-visualização de rascunho · documento não emitido</p>
      </div>
    </section>
  );
}
