import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Patient } from '../lib/types';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { availableLongitudinalTools, radarComparison, summarizeTrend, toolTitle, toLongitudinalPoints } from '../lib/nexus/longitudinal';

export function NexusLongitudinalPanel({ patient }: { patient: Patient }) {
  const [results,setResults]=useState<NexusClinicalResult[]>([]);
  const [selected,setSelected]=useState('');
  const [view,setView]=useState<'trend'|'radar'>('trend');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{let cancelled=false;setLoading(true);listPatientNexusResults(patient.id).then((items)=>{if(cancelled)return;setResults(items);const tools=availableLongitudinalTools(items);setSelected((current)=>current||tools[0]?.[0]||'');}).catch((e)=>console.error('[MedicsPro/Nexus] longitudinal:',e)).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true};},[patient.id]);

  const tools=useMemo(()=>availableLongitudinalTools(results),[results]);
  const points=useMemo(()=>selected?toLongitudinalPoints(results,selected):[],[results,selected]);
  const summary=useMemo(()=>summarizeTrend(points),[points]);
  const radar=useMemo(()=>radarComparison(points),[points]);
  const chartData=points.map((point,index)=>({consultation:`#${index+1}`,date:format(new Date(point.date),'dd/MM/yy',{locale:ptBR}),score:point.score,classification:point.classification,version:point.ruleVersion}));

  if(loading)return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando evolução Nexus…</div></Card>;
  if(!tools.length)return <Card><Empty title="Sem evolução longitudinal ainda" sub="Quando o paciente tiver resultados Nexus finalizados com escore, a série temporal aparecerá aqui." /></Card>;

  return <div className="space-y-4">
    <Card><CardHead title="Nexus · Evolução Longitudinal" sub="Resultados reais do paciente · sem dados demo · versões clínicas preservadas" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">{tools.map(([key,count])=><button key={key} type="button" onClick={()=>setSelected(key)} className={`rounded-lg border px-3 py-2 text-[10.5px] ${selected===key?'border-aqua bg-aqua/10 text-aqua':'border-line text-fog'}`}>{toolTitle(key)} · {count}</button>)}</div>
          <div className="flex gap-2"><button type="button" onClick={()=>setView('trend')} className={`rounded-lg border px-3 py-2 text-[10px] ${view==='trend'?'border-mint text-mint':'border-line text-fog'}`}>Tendência</button><button type="button" disabled={!radar.length} onClick={()=>setView('radar')} className={`rounded-lg border px-3 py-2 text-[10px] ${view==='radar'?'border-mint text-mint':'border-line text-fog'} disabled:opacity-40`}>Radar</button></div>
        </div>

        {summary && <div className="grid gap-3 sm:grid-cols-4"><Metric label="Primeiro escore" value={String(summary.first.score)} /><Metric label="Último escore" value={String(summary.last.score)} /><Metric label="Variação absoluta" value={`${summary.absoluteChange>0?'+':''}${summary.absoluteChange}`} /><Metric label="Variação percentual" value={summary.percentChange==null?'—':`${summary.percentChange>0?'+':''}${summary.percentChange}%`} /></div>}

        <div className="h-[340px] rounded-xl border border-line bg-deep p-3">
          {view==='trend'?<ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.2}/><XAxis dataKey="date" fontSize={10}/><YAxis fontSize={10}/><Tooltip contentStyle={{fontSize:11}}/><Line type="monotone" dataKey="score" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer>:<ResponsiveContainer width="100%" height="100%"><RadarChart data={radar}><PolarGrid/><PolarAngleAxis dataKey="domain" fontSize={9}/><Radar name="Inicial" dataKey="baseline" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/><Radar name="Atual" dataKey="current" stroke="currentColor" fill="currentColor" fillOpacity={0.08}/><Tooltip contentStyle={{fontSize:11}}/></RadarChart></ResponsiveContainer>}
        </div>

        <div className="rounded-xl border border-line bg-deep p-4"><p className="font-mono text-[9.5px] uppercase tracking-wide text-fog">Histórico versionado</p><div className="mt-3 space-y-2">{points.map((point,index)=><div key={point.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/70 p-3"><Chip className="border-line text-fog">#{index+1}</Chip><span className="font-mono text-[10px] text-mint">{format(new Date(point.date),'dd MMM yyyy · HH:mm',{locale:ptBR})}</span><span className="text-[11px] font-semibold text-paper">{point.score}{point.maxScore!=null?`/${point.maxScore}`:''}</span>{point.classification&&<span className="text-[10.5px] text-fog">{point.classification}</span>}<Chip className="border-line text-fog">{point.ruleVersion}</Chip></div>)}</div></div>
        <p className="text-[10.5px] leading-relaxed text-fog">A visualização calcula apenas a mudança entre escores registrados. Não reclassifica resultados antigos e não converte variação matemática em diagnóstico, resposta ou remissão sem regra clínica versionada do instrumento.</p>
      </div>
    </Card>
  </div>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-line bg-deep p-3"><p className="text-[9.5px] uppercase tracking-wide text-fog">{label}</p><p className="mt-1 font-display text-[20px] font-semibold text-paper">{value}</p></div>}
