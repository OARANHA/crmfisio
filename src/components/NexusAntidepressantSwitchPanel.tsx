import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { ANTIDEPRESSANTS_DB, calculateAntidepressantTransition, NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION } from '../lib/nexus/antidepressantSwitch';
import { persistAntidepressantSwitch } from '../lib/nexus/antidepressantSwitchPersistence';

export function NexusAntidepressantSwitchPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [sourceDrugId,setSourceDrugId]=useState('sertralina');
  const [sourceDoseMg,setSourceDoseMg]=useState(100);
  const [targetDrugId,setTargetDrugId]=useState('desvenlafaxina');
  const [canApply,setCanApply]=useState(false);
  const [history,setHistory]=useState<NexusClinicalResult[]>([]);
  const [busy,setBusy]=useState(false);
  const activeAppointment=useMemo(()=>appointments.find((a)=>a.pacienteId===patient.id&&a.status==='em_atendimento')??null,[appointments,patient.id]);
  const plan=useMemo(()=>calculateAntidepressantTransition(sourceDrugId,sourceDoseMg,targetDrugId),[sourceDrugId,sourceDoseMg,targetDrugId]);
  const drugKeys=Object.keys(ANTIDEPRESSANTS_DB);
  const moclobemideBlocked=sourceDrugId==='moclobemida'||targetDrugId==='moclobemida';

  useEffect(()=>{let cancelled=false;Promise.all([hasProfessionalCapability('nexus.psychopharmacology').catch(()=>false),listPatientNexusResults(patient.id)]).then(([cap,items])=>{if(!cancelled){setCanApply(cap);setHistory(items.filter((x)=>x.toolKey==='antidepressant-switch'));}}).catch((e)=>console.error('[MedicsPro/Nexus] psychopharm:',e));return()=>{cancelled=true};},[patient.id,user?.id]);

  const submit=async()=>{if(!user||!canApply||moclobemideBlocked)return;setBusy(true);try{const saved=await persistAntidepressantSwitch({patientId:patient.id,professionalId:user.id,appointmentId:activeAppointment?.id??null,sourceDrugId,sourceDoseMg,targetDrugId});setHistory((x)=>[saved,...x]);toast('Plano de transição finalizado no Nexus.','info');}catch(e){toast(e instanceof Error?e.message:'Falha ao finalizar plano.','warn');}finally{setBusy(false);}};

  return <div className="space-y-4">
    <Card><CardHead title="Nexus · Troca de Antidepressivos" sub="Equivalência + estratégia + cronograma + riscos · Maudsley / Hayasaka" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">{NEXUS_ANTIDEPRESSANT_SWITCH_RULE_VERSION}</Chip><Chip className="border-line text-fog">nexus.psychopharmacology</Chip><Chip className="border-line text-fog">SOAP: Plano</Chip></div>
        <div className="grid gap-3 md:grid-cols-[1fr_.45fr_1fr]">
          <label><span className="mb-1 block text-[10px] text-fog">Medicação atual</span><select value={sourceDrugId} onChange={(e)=>{setSourceDrugId(e.target.value);const d=ANTIDEPRESSANTS_DB[e.target.value];setSourceDoseMg(d.standardDoses[1]??d.standardDoses[0]);}} className="field">{drugKeys.map((k)=><option key={k} value={k}>{ANTIDEPRESSANTS_DB[k].name}</option>)}</select></label>
          <label><span className="mb-1 block text-[10px] text-fog">Dose mg/dia</span><input type="number" value={sourceDoseMg} onChange={(e)=>setSourceDoseMg(Number(e.target.value))} className="field" /></label>
          <label><span className="mb-1 block text-[10px] text-fog">Nova medicação</span><select value={targetDrugId} onChange={(e)=>setTargetDrugId(e.target.value)} className="field">{drugKeys.filter((k)=>k!==sourceDrugId).map((k)=><option key={k} value={k}>{ANTIDEPRESSANTS_DB[k].name}</option>)}</select></label>
        </div>

        {moclobemideBlocked && <div className="rounded-xl border border-pulse/35 bg-pulse/[0.04] p-4 text-[11px] text-pulse"><strong>Moclobemida em revisão clínica.</strong> O banco original contém o fármaco, mas o motor Nexus atual não fecha um cronograma específico para esse ramo IMAO. A prévia pode ser inspecionada, porém a finalização está bloqueada até decisão clínica versionada.</div>}

        <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9.5px] uppercase text-fog">Estratégia</p><p className="mt-1 font-display text-[18px] font-semibold text-paper">{plan.strategyTitle}</p><p className="mt-1 text-[11px] leading-relaxed text-fog">{plan.strategySummary}</p></div><div className="text-right"><p className="font-mono text-[10px] text-aqua">≈ {plan.calculatedEquivalentDoseMg.toFixed(1)} mg</p><p className="text-[10px] text-fog">alvo comercial {plan.recommendedTargetDoseMg} mg/dia</p></div></div>
          <div className="mt-4 space-y-2">{plan.timelineSteps.map((step)=><div key={step.stepNumber} className="rounded-lg border border-line bg-deep p-3"><p className="text-[11px] font-semibold text-paper">{step.periodLabel}</p><p className="mt-1 text-[10.5px] text-fog">Desmame: {step.sourceDose}</p><p className="text-[10.5px] text-fog">Introdução: {step.targetDose}</p><p className="mt-1 text-[10px] text-aqua">{step.clinicalAction}</p></div>)}</div>
          <div className="mt-4 grid gap-2 md:grid-cols-2"><div className="rounded-lg border border-line bg-deep p-3"><p className="text-[10px] text-fog">Síndrome serotoninérgica</p><p className="mt-1 text-[11px] font-semibold text-paper">{plan.clinicalRisks.serotoninSyndrome.risk}</p><p className="mt-1 text-[10px] text-fog">{plan.clinicalRisks.serotoninSyndrome.note}</p></div><div className="rounded-lg border border-line bg-deep p-3"><p className="text-[10px] text-fog">Descontinuação</p><p className="mt-1 text-[11px] font-semibold text-paper">{plan.clinicalRisks.discontinuationSyndrome.risk}</p><p className="mt-1 text-[10px] text-fog">{plan.clinicalRisks.discontinuationSyndrome.note}</p></div></div>
          <div className="mt-4 flex justify-end"><Btn disabled={busy||!canApply||moclobemideBlocked} onClick={()=>void submit()}>{busy?'Finalizando…':'Finalizar plano'}</Btn></div>
        </div>
      </div>
    </Card>
    <Card><CardHead title="Histórico de transições" sub="Planos versionados; nenhum plano finalizado é sobrescrito" /><div className="p-5 text-[11px] text-fog">{history.length?`${history.length} plano(s) finalizado(s).`:'Nenhum plano finalizado.'}</div></Card>
  </div>;
}
