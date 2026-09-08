import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Patient } from '../lib/types';
import { Card, CardHead, Chip, Empty } from '../lib/ui';
import { listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { availableLongitudinalTools, radarComparison, summarizeTrend, toolTitle, toLongitudinalPoints, type LongitudinalState } from '../lib/nexus/longitudinal';

const STATE_LABEL: Record<LongitudinalState,string> = {
  insufficient_data:'Dados insuficientes', comparable:'Comparável', incomparable_version:'Versão incompatível', incompatible_metric:'Métrica incompatível', incomparable_tool:'Ferramenta/regra incompatível', missing_measurement:'Medição ausente', stable:'Estável', improved:'Melhora', worsened:'Piora', non_directional:'Sem direção ordinal',
};

export function NexusLongitudinalPanel({ patient }: { patient: Patient }) {
  const [results,setResults]=useState<NexusClinicalResult[]>([]);
  const [selected,setSelected]=useState('');
  const [view,setView]=useState<'trend'|'radar'>('trend');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true); setError(null); setResults([]); setSelected('');
    listPatientNexusResults(patient.id)
      .then((items)=>{if(cancelled)return;setResults(items);const tools=availableLongitudinalTools(items);setSelected(tools[0]?.[0]||'');})
      .catch((e)=>{console.error('[MedicsPro/Nexus] longitudinal:',e);if(!cancelled)setError('Não foi possível carregar a evolução longitudinal Nexus.');})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[patient.id]);

  const tools=useMemo(()=>availableLongitudinalTools(results),[results]);
  const points=useMemo(()=>selected?toLongitudinalPoints(results,selected,{patientId:patient.id}):[],[results,selected,patient.id]);
  const summary=useMemo(()=>summarizeTrend(points),[points]);
  const radar=useMemo(()=>radarComparison(points),[points]);
  const quantitative=['stable','improved','worsened'].includes(summary.state);
  const chartData=points.filter((point)=>point.score!==null).map((point,index)=>({consultation:`#${index+1}`,date:format(new Date(point.date),'dd/MM/yy',{locale:ptBR}),score:point.score,classification:point.classification,version:point.ruleVersion}));

  if(loading)return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando evolução Nexus…</div></Card>;
  if(error)return <Card><Empty title="Falha ao carregar longitudinal" sub={error} /></Card>;
  if(!tools.length)return <Card><Empty title="Sem evolução longitudinal revisada ainda" sub="Resultados apenas processados não entram como evolução clínica. A série aparece após revisão humana explícita." /></Card>;

  return <div className="space-y-4">
    <Card><CardHead title="Nexus · Evolução Longitudinal" sub="Comparação fail-closed por ferramenta, regra, versão, métrica e direção clínica" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">{tools.map(([key,count])=><button key={key} type="button" onClick={()=>{setSelected(key);setView('trend')}} className={`rounded-lg border px-3 py-2 text-[10.5px] ${selected===key?'border-aqua bg-aqua/10 text-aqua':'border-line text-fog'}`}>{toolTitle(key)} · {count}</button>)}</div>
          <div className="flex gap-2"><button type="button" onClick={()=>setView('trend')} className={`rounded-lg border px-3 py-2 text-[10px] ${view==='trend'?'border-mint text-mint':'border-line text-fog'}`}>Tendência</button><button type="button" disabled={!radar.length} onClick={()=>setView('radar')} className={`rounded-lg border px-3 py-2 text-[10px] ${view==='radar'?'border-mint text-mint':'border-line text-fog'} disabled:opacity-40`}>Radar</button></div>
        </div>

        <div className="rounded-xl border border-line bg-deep p-4">
          <div className="flex flex-wrap items-center gap-2"><Chip className={quantitative?'border-mint/40 text-mint':'border-amber/40 text-amber'}>{STATE_LABEL[summary.state]}</Chip>{summary.first?.ruleVersion&&<Chip className="border-line text-fog">{summary.first.ruleVersion}</Chip>}{summary.last?.ruleVersion&&summary.last.ruleVersion!==summary.first?.ruleVersion&&<Chip className="border-amber/40 text-amber">{summary.last.ruleVersion}</Chip>}</div>
          {summary.reason&&<p className="mt-2 text-[11px] leading-relaxed text-fog">{summary.reason}</p>}
        </div>

        {quantitative&&summary.first&&summary.last&&<div className="grid gap-3 sm:grid-cols-4"><Metric label="Primeiro escore" value={String(summary.first.score)} /><Metric label="Último escore" value={String(summary.last.score)} /><Metric label="Variação absoluta" value={`${(summary.absoluteChange??0)>0?'+':''}${summary.absoluteChange??'—'}`} /><Metric label="Variação percentual" value={summary.percentChange==null?'—':`${summary.percentChange>0?'+':''}${summary.percentChange}%`} /></div>}

        {selected==='eem'?<div className="rounded-xl border border-line bg-deep p-5 text-[11.5px] leading-relaxed text-fog">O EEM é exibido como marco clínico revisado/assinado. Sem uma métrica ordinal única aprovada, o Nexus não atribui automaticamente melhora, piora ou estabilidade.</div>:<div className="h-[340px] rounded-xl border border-line bg-deep p-3">
          {quantitative&&chartData.length>=2?(view==='trend'?<ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.2}/><XAxis dataKey="date" fontSize={10}/><YAxis fontSize={10}/><Tooltip contentStyle={{fontSize:11}}/><Line type="monotone" dataKey="score" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer>:<ResponsiveContainer width="100%" height="100%"><RadarChart data={radar}><PolarGrid/><PolarAngleAxis dataKey="domain" fontSize={9}/><Radar name="Inicial" dataKey="baseline" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/><Radar name="Atual" dataKey="current" stroke="currentColor" fill="currentColor" fillOpacity={0.08}/><Tooltip contentStyle={{fontSize:11}}/></RadarChart></ResponsiveContainer>):<div className="grid h-full place-items-center px-6 text-center text-[11.5px] text-fog">A visualização de tendência fica desativada enquanto os pontos não forem clinicamente comparáveis.</div>}
        </div>}

        <div className="rounded-xl border border-line bg-deep p-4"><p className="font-mono text-[9.5px] uppercase tracking-wide text-fog">Histórico revisado e versionado</p><div className="mt-3 space-y-2">{points.map((point,index)=><div key={point.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/70 p-3"><Chip className="border-line text-fog">#{index+1}</Chip><span className="font-mono text-[10px] text-mint">{format(new Date(point.date),'dd MMM yyyy · HH:mm',{locale:ptBR})}</span>{point.score!==null&&<span className="text-[11px] font-semibold text-paper">{point.score}{point.maxScore!=null?`/${point.maxScore}`:''}</span>}{point.classification&&<span className="text-[10.5px] text-fog">{point.classification}</span>}<Chip className="border-line text-fog">{point.ruleVersion}</Chip></div>)}</div></div>
        <p className="text-[10.5px] leading-relaxed text-fog">Somente resultados revisados ou assinados entram no longitudinal. Resultado processado, ausência de medida, versões diferentes e métricas incompatíveis nunca são convertidos em tendência clínica. Incorporação C-04 continua independente.</p>
      </div>
    </Card>
  </div>;
}

function Metric({label,value}:{label:string,value:string}){return <div className="rounded-xl border border-line bg-deep p-3"><p className="text-[9.5px] uppercase tracking-wide text-fog">{label}</p><p className="mt-1 font-display text-[20px] font-semibold text-paper">{value}</p></div>}
