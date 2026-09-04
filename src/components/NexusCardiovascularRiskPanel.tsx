import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { calculateCardiovascularRisk, NEXUS_CV_RISK_RULE_VERSION, type CardiovascularRiskInput } from '../lib/nexus/cardiovascularRisk';
import { persistCardiovascularRisk } from '../lib/nexus/cardiovascularRiskPersistence';

const controlClass = 'w-full rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-paper outline-none focus:border-aqua';
const initial: CardiovascularRiskInput = {
  age: 52, gender: 'male', sysBp: 135, isBpTreated: false, isSmoker: false, hasDiabetes: false,
  calcMode: 'lipid', totCholesterol: 210, hdlCholesterol: 45, weightKg: 78, heightCm: 172,
};

export function NexusCardiovascularRiskPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [values, setValues] = useState<CardiovascularRiskInput>(initial);
  const [canApply, setCanApply] = useState(false);
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [busy, setBusy] = useState(false);
  const activeAppointment = useMemo(() => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null, [appointments, patient.id]);
  const result = useMemo(() => calculateCardiovascularRisk(values), [values]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([hasProfessionalCapability('nexus.calculators').catch(() => false), listPatientNexusResults(patient.id)])
      .then(([capability, results]) => { if (!cancelled) { setCanApply(capability); setHistory(results.filter((item) => item.toolKey === 'cv-risk-sbc')); } })
      .catch((error) => console.error('[MedicsPro/Nexus] CV risk:', error));
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  const set = <K extends keyof CardiovascularRiskInput>(key: K, value: CardiovascularRiskInput[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggle = (key: keyof CardiovascularRiskInput) => setValues((current) => ({ ...current, [key]: !Boolean(current[key]) }));

  const submit = async () => {
    if (!user || !canApply) return;
    setBusy(true);
    try {
      const saved = await persistCardiovascularRisk({ patientId: patient.id, professionalId: user.id, appointmentId: activeAppointment?.id ?? null, values });
      setHistory((current) => [saved, ...current]);
      toast('Risco cardiovascular finalizado no Nexus.', 'info');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Falha ao finalizar risco cardiovascular.', 'warn');
    } finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <Card><CardHead title="Nexus · Risco Cardiovascular" sub="SBC / Framingham Global · cálculo determinístico e reclassificadores" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">{NEXUS_CV_RISK_RULE_VERSION}</Chip><Chip className="border-line text-fog">capability nexus.calculators</Chip></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Idade"><input type="number" value={values.age} onChange={(e) => set('age', Number(e.target.value))} className={controlClass} /></Field>
          <Field label="Sexo"><select value={values.gender} onChange={(e) => set('gender', e.target.value as 'male'|'female')} className={controlClass}><option value="male">Masculino</option><option value="female">Feminino</option></select></Field>
          <Field label="PAS mmHg"><input type="number" value={values.sysBp} onChange={(e) => set('sysBp', Number(e.target.value))} className={controlClass} /></Field>
          <Field label="Modo"><select value={values.calcMode} onChange={(e) => set('calcMode', e.target.value as 'lipid'|'bmi')} className={controlClass}><option value="lipid">Perfil lipídico</option><option value="bmi">IMC / sem laboratório</option></select></Field>
          {values.calcMode === 'lipid' ? <><Field label="Colesterol total"><input type="number" value={values.totCholesterol ?? ''} onChange={(e) => set('totCholesterol', Number(e.target.value))} className={controlClass} /></Field><Field label="HDL"><input type="number" value={values.hdlCholesterol ?? ''} onChange={(e) => set('hdlCholesterol', Number(e.target.value))} className={controlClass} /></Field></> : <><Field label="Peso kg"><input type="number" value={values.weightKg ?? ''} onChange={(e) => set('weightKg', Number(e.target.value))} className={controlClass} /></Field><Field label="Altura cm"><input type="number" value={values.heightCm ?? ''} onChange={(e) => set('heightCm', Number(e.target.value))} className={controlClass} /></Field></>}
        </div>

        <ToggleGroup title="Fatores principais" items={[['isBpTreated','HAS tratada'],['isSmoker','Tabagismo'],['hasDiabetes','Diabetes']]} values={values} toggle={toggle} />
        <ToggleGroup title="Critérios de risco direto" items={[['hasEstablishedCvd','DCV estabelecida'],['hasAorticAneurysm','Aneurisma de aorta'],['hasSevereCkd','DRC TFG <60'],['hasSevereHypercholesterolemia','LDL ≥190 / CT ≥310'],['hasSubclinicalAtherosclerosis','Aterosclerose subclínica'],['hasDiabetesWithRiskFactors','DM + órgão-alvo/tempo ≥10a']]} values={values} toggle={toggle} />
        <ToggleGroup title="Reclassificadores SBC" items={[['hasFamilyHistoryPrematureCvd','História familiar precoce'],['hasMetabolicSyndrome','Síndrome metabólica'],['hasMicroalbuminuria','Microalbuminúria'],['hasHighSensitivityCrp','PCR-us >2']]} values={values} toggle={toggle} />
        <ToggleGroup title="Saúde mental / metabolismo" items={[['usesHighRiskAntipsychotic','Antipsicótico de alto risco metabólico'],['hasSevereMentalIllness','Transtorno mental grave']]} values={values} toggle={toggle} />
        {values.usesHighRiskAntipsychotic && <Field label="Antipsicótico"><input value={values.antipsychoticName ?? ''} onChange={(e) => set('antipsychoticName', e.target.value)} className={controlClass} placeholder="Ex.: Olanzapina" /></Field>}

        <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] text-fog">RISCO ESTIMADO EM 10 ANOS</p><p className="mt-1 font-display text-[28px] font-bold text-paper">{result.riskPercentage.toFixed(1)}%</p><p className="text-[11.5px] text-mint">{result.riskLabel}</p></div><div className="text-right text-[10.5px] text-fog"><p>LDL {result.ldlTarget}</p><p>PA {result.bpTarget}</p>{result.isDirectRisk && <p className="mt-1 text-pulse">Risco direto</p>}{result.isReclassified && <p className="mt-1 text-pulse">Reclassificado</p>}</div></div>
          <p className="mt-3 text-[11px] leading-relaxed text-fog">{result.interpretation}</p>
          {result.psychiatricAlert && <div className="mt-3 rounded-lg border border-pulse/30 bg-pulse/[0.04] p-3 text-[10.5px] text-pulse">{result.psychiatricAlert}</div>}
          <div className="mt-4 flex justify-end"><Btn disabled={busy || !canApply} onClick={() => void submit()}>{busy ? 'Finalizando…' : 'Finalizar cálculo'}</Btn></div>
        </div>
      </div>
    </Card>
    <Card><CardHead title="Histórico cardiovascular" sub="Resultados versionados por paciente" /><div className="p-5 text-[11px] text-fog">{history.length ? `${history.length} resultado(s) finalizado(s).` : 'Nenhum resultado cardiovascular finalizado.'}</div></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-[10px] font-medium text-fog">{label}</span>{children}</label>; }
function ToggleGroup({ title, items, values, toggle }: { title: string; items: [keyof CardiovascularRiskInput,string][]; values: CardiovascularRiskInput; toggle: (key:keyof CardiovascularRiskInput)=>void }) { return <section><p className="mb-2 font-mono text-[9.5px] uppercase tracking-wide text-fog">{title}</p><div className="flex flex-wrap gap-2">{items.map(([key,label]) => <button key={String(key)} type="button" onClick={() => toggle(key)} className={`rounded-lg border px-3 py-2 text-[10.5px] ${values[key] ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog'}`}>{label}</button>)}</div></section>; }
