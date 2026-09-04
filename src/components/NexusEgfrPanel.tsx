import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { calculateEgfr2021, NEXUS_EGFR_RULE_VERSION, type EgfrSex } from '../lib/nexus/egfr';
import { persistEgfrResult } from '../lib/nexus/egfrPersistence';

export function NexusEgfrPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [creatinine, setCreatinine] = useState('1.0');
  const [age, setAge] = useState('45');
  const [sex, setSex] = useState<EgfrSex>('female');
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );

  const preview = useMemo(() => {
    const cr = Number(creatinine);
    const years = Number(age);
    if (!Number.isFinite(cr) || !Number.isFinite(years) || cr <= 0 || years <= 0) return null;
    try { return calculateEgfr2021(cr, years, sex); } catch { return null; }
  }, [creatinine, age, sex]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      hasProfessionalCapability('nexus.calculators').catch(() => false),
      listPatientNexusResults(patient.id),
    ]).then(([capability, results]) => {
      if (!cancelled) {
        setCanApply(capability);
        setHistory(results.filter((item) => item.toolKey === 'egfr-ckdepi'));
      }
    }).catch((error) => {
      console.error('[MedicsPro/Nexus] carregar CKD-EPI:', error);
      toast('Não foi possível carregar a calculadora renal.', 'warn');
    });
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  async function finalize() {
    if (!user || !preview || !canApply) return;
    setBusy(true);
    try {
      const result = await persistEgfrResult({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        creatinineMgDl: Number(creatinine),
        ageYears: Number(age),
        sex,
      });
      setHistory((current) => [result, ...current]);
      toast('CKD-EPI 2021 finalizada e disponível ao SOAP.', 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao finalizar CKD-EPI.', 'warn');
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <Card>
      <CardHead title="Nexus · Função Renal (CKD-EPI 2021)" sub="Calculadora determinística · fórmula sem raça · resultado versionado" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">CKD-EPI 2021</Chip><Chip className="border-line text-fog">{NEXUS_EGFR_RULE_VERSION}</Chip><Chip className="border-line text-fog">SOAP: O</Chip></div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-[11px] text-fog">Creatinina (mg/dL)<input type="number" step="0.1" min="0.1" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-deep px-3 py-2 text-paper" /></label>
          <label className="text-[11px] text-fog">Idade (anos)<input type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-deep px-3 py-2 text-paper" /></label>
          <label className="text-[11px] text-fog">Sexo usado pela equação<select value={sex} onChange={(e) => setSex(e.target.value as EgfrSex)} className="mt-1 w-full rounded-lg border border-line bg-deep px-3 py-2 text-paper"><option value="female">Feminino</option><option value="male">Masculino</option></select></label>
        </div>
        {preview && <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4"><p className="font-mono text-[10px] uppercase tracking-wide text-fog">Prévia</p><p className="mt-1 font-display text-[26px] font-bold text-mint">{preview.egfr} <span className="text-[12px] font-normal text-fog">mL/min/1,73m²</span></p><p className="mt-2 text-[12px] font-semibold text-paper">{preview.stage}</p><p className="mt-1 text-[11px] leading-relaxed text-fog">{preview.interpretation}</p></div>}
        {canApply ? <div className="flex justify-end"><Btn disabled={busy || !preview} onClick={() => void finalize()}>{busy ? 'Finalizando…' : 'Finalizar cálculo'}</Btn></div> : <p className="text-[11px] text-fog">Registrar calculadoras Nexus exige <span className="font-mono text-paper">nexus.calculators</span>.</p>}
      </div>
    </Card>
    <Card><CardHead title="Histórico renal" sub="Resultados CKD-EPI permanecem versionados" />{history.length === 0 ? <Empty title="Nenhum cálculo renal" sub="O primeiro resultado finalizado aparecerá aqui." /> : <ul className="divide-y divide-line/70">{history.map((item) => <li key={item.id} className="px-5 py-4"><div className="flex flex-wrap gap-2"><span className="font-mono text-[10px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</span><Chip className="border-line text-fog">{item.classification}</Chip></div><p className="mt-2 text-[11px] text-fog">{item.interpretation}</p></li>)}</ul>}</Card>
  </div>;
}
