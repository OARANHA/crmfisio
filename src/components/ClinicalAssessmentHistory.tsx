import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Patient } from '../lib/types';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { useApp, userName } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
import {
  listAvailableAssessmentTemplates,
  listPatientClinicalAssessments,
  type AssessmentTemplate,
  type ClinicalAssessment,
} from '../lib/assessmentEngine';

export function ClinicalAssessmentHistory({ patient }: { patient: Patient }) {
  const { user, users, toast } = useApp();
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [assessments, setAssessments] = useState<ClinicalAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const clinicalRead = user?.role === 'fisio' || isClinicManager(user?.role);
  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);
  const finalized = useMemo(
    () => assessments.filter((item) => item.status === 'finalized'),
    [assessments],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clinicalRead) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [available, history] = await Promise.all([
          listAvailableAssessmentTemplates(),
          listPatientClinicalAssessments(patient.id),
        ]);
        if (cancelled) return;
        setTemplates(available);
        setAssessments(history);
      } catch (error) {
        console.error('[MedicsPro] histórico de avaliações:', error);
        toast('Não foi possível carregar o histórico de avaliações.', 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, clinicalRead]);

  if (!clinicalRead) return null;

  return (
    <Card>
      <CardHead title="Histórico de avaliações" sub="registros finalizados preservam a versão exata usada no atendimento" />
      {loading ? (
        <div className="p-6 font-mono text-[11px] text-fog">Carregando histórico…</div>
      ) : finalized.length === 0 ? (
        <Empty title="Nenhuma avaliação estruturada finalizada" sub="Quando uma avaliação for finalizada, ela aparecerá aqui sem competir com o atendimento atual." />
      ) : (
        <ul className="divide-y divide-line/70">
          {finalized.map((assessment) => (
            <li key={assessment.id} className="px-5 py-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold text-[13px]">
                    {templateById.get(assessment.templateId)?.name || 'Avaliação estruturada'}
                  </p>
                  <Chip className="border-mint/40 text-mint">finalizada ✓</Chip>
                </div>
                <p className="font-mono text-[10.5px] text-fog mt-1">
                  {assessment.finalizedAt
                    ? format(new Date(assessment.finalizedAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })
                    : 'finalizada'}
                  {' · '}por {userName(users, assessment.professionalId)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
