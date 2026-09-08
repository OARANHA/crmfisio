import type { NexusClinicalResult } from '../nexusClinical';

export type LongitudinalDirection = 'higher_is_worse' | 'higher_is_better' | 'neutral' | 'non_directional';
export type LongitudinalState =
  | 'insufficient_data'
  | 'comparable'
  | 'incomparable_version'
  | 'incompatible_metric'
  | 'incomparable_tool'
  | 'missing_measurement'
  | 'stable'
  | 'improved'
  | 'worsened'
  | 'non_directional';

export type LongitudinalMetricContract = {
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  metric: 'total_score' | 'clinical_event';
  unit: 'points' | 'event';
  minScore: number | null;
  maxScore: number | null;
  direction: LongitudinalDirection;
};

export type LongitudinalPoint = {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  toolKey: string;
  ruleKey: string;
  ruleVersion: string;
  date: string;
  score: number | null;
  maxScore: number | null;
  classification: string | null;
  answers: Array<number | null>;
  contract: LongitudinalMetricContract | null;
};

export type LongitudinalSummary = {
  state: LongitudinalState;
  first: LongitudinalPoint | null;
  last: LongitudinalPoint | null;
  absoluteChange: number | null;
  percentChange: number | null;
  count: number;
  reason?: string;
};

const TOOL_TITLES: Record<string,string> = {
  phq9:'PHQ-9', gad7:'GAD-7', eem:'EEM',
  'phq-9':'PHQ-9', 'gad-7':'GAD-7',
};

export function toolTitle(toolKey:string){ return TOOL_TITLES[toolKey] ?? toolKey; }

const CONTRACTS: LongitudinalMetricContract[] = [
  { toolKey:'phq9', ruleKey:'nexus.phq9', ruleVersion:'nexus-2026-09-03', metric:'total_score', unit:'points', minScore:0, maxScore:27, direction:'higher_is_worse' },
  { toolKey:'gad7', ruleKey:'nexus.gad7', ruleVersion:'nexus-2026-09-03', metric:'total_score', unit:'points', minScore:0, maxScore:21, direction:'higher_is_worse' },
  { toolKey:'eem', ruleKey:'nexus.eem', ruleVersion:'nexus-eem-2026-09-03', metric:'clinical_event', unit:'event', minScore:null, maxScore:null, direction:'non_directional' },
];

export const NEXUS_LONGITUDINAL_CONTRACTS = Object.freeze(CONTRACTS.map((contract)=>Object.freeze({...contract})));

export function longitudinalContractFor(item: Pick<NexusClinicalResult,'toolKey'|'ruleKey'|'ruleVersion'>): LongitudinalMetricContract | null {
  return NEXUS_LONGITUDINAL_CONTRACTS.find((contract)=>
    contract.toolKey===item.toolKey && contract.ruleKey===item.ruleKey && contract.ruleVersion===item.ruleVersion,
  ) ?? null;
}

function numericAnswers(snapshot: Record<string,unknown>): Array<number | null> {
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const answers = snapshot.answers;
  if (Array.isArray(answers)) return answers.map(toNumber);
  if (answers && typeof answers === 'object') {
    return Object.entries(answers as Record<string,unknown>)
      .sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))
      .map(([,value])=>toNumber(value));
  }
  const selected = snapshot.selectedOptions;
  if (selected && typeof selected === 'object') {
    return Object.entries(selected as Record<string,{value?:unknown}>)
      .sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))
      .map(([,value])=>toNumber(value?.value));
  }
  return [];
}

const clinicallyReviewed = (item: NexusClinicalResult) =>
  item.lifecycleState === 'reviewed' || item.lifecycleState === 'signed';

export function toLongitudinalPoints(
  results:NexusClinicalResult[],
  toolKey:string,
  scope?: { patientId?: string; clinicId?: string },
):LongitudinalPoint[] {
  const seen = new Set<string>();
  return results
    .filter((item)=>clinicallyReviewed(item) && item.toolKey===toolKey)
    .filter((item)=>!scope?.patientId || item.patientId===scope.patientId)
    .filter((item)=>!scope?.clinicId || item.clinicId===scope.clinicId)
    .filter((item)=>{ if(seen.has(item.id)) return false; seen.add(item.id); return true; })
    .map((item)=>({
      id:item.id, clinicId:item.clinicId, patientId:item.patientId, professionalId:item.professionalId,
      toolKey:item.toolKey, ruleKey:item.ruleKey, ruleVersion:item.ruleVersion,
      date:item.reviewedAt ?? item.signedAt ?? item.finalizedAt ?? item.createdAt,
      score:item.totalScore == null || !Number.isFinite(Number(item.totalScore)) ? null : Number(item.totalScore),
      maxScore:item.maxScore == null || !Number.isFinite(Number(item.maxScore)) ? null : Number(item.maxScore),
      classification:item.classification, answers:numericAnswers(item.inputSnapshot), contract:longitudinalContractFor(item),
    }))
    .sort((a,b)=>{
      const byTime=new Date(a.date).getTime()-new Date(b.date).getTime();
      return byTime!==0 ? byTime : a.id.localeCompare(b.id);
    });
}

export function compareLongitudinalPoints(first:LongitudinalPoint,last:LongitudinalPoint): LongitudinalSummary {
  const base={first,last,count:2,absoluteChange:null,percentChange:null};
  if(first.toolKey!==last.toolKey || first.ruleKey!==last.ruleKey) return {...base,state:'incomparable_tool',reason:'Ferramenta ou regra clínica diferente.'};
  if(first.ruleVersion!==last.ruleVersion) return {...base,state:'incomparable_version',reason:'Versões clínicas diferentes sem contrato explícito de equivalência.'};
  if(first.date===last.date) return {...base,state:'insufficient_data',reason:'Não há sequência temporal clínica determinística entre os pontos.'};
  if(!first.contract || !last.contract) return {...base,state:'incompatible_metric',reason:'Métrica sem contrato longitudinal fechado.'};
  if(first.contract.metric!==last.contract.metric || first.contract.unit!==last.contract.unit || first.contract.minScore!==last.contract.minScore || first.contract.maxScore!==last.contract.maxScore || first.contract.direction!==last.contract.direction || first.maxScore!==last.maxScore) return {...base,state:'incompatible_metric',reason:'Métrica, unidade, range ou direção clínica incompatível.'};
  if(first.contract.direction==='non_directional' || first.contract.direction==='neutral') return {...base,state:'non_directional',reason:'A ferramenta não possui direção ordinal aprovada para melhora/piora.'};
  if(first.score===null || last.score===null) return {...base,state:'missing_measurement',reason:'Uma das medições necessárias está ausente.'};
  if(first.contract.minScore!==null && (first.score<first.contract.minScore || last.score<first.contract.minScore)) return {...base,state:'incompatible_metric',reason:'Score fora do range contratado.'};
  if(first.contract.maxScore!==null && (first.score>first.contract.maxScore || last.score>first.contract.maxScore)) return {...base,state:'incompatible_metric',reason:'Score fora do range contratado.'};
  const absoluteChange=last.score-first.score;
  const percentChange=first.score===0?null:Math.round((absoluteChange/first.score)*100);
  if(absoluteChange===0) return {...base,state:'stable',absoluteChange,percentChange};
  const improved=first.contract.direction==='higher_is_worse' ? absoluteChange<0 : absoluteChange>0;
  return {...base,state:improved?'improved':'worsened',absoluteChange,percentChange};
}

export function summarizeTrend(points:LongitudinalPoint[]): LongitudinalSummary {
  if(points.length<2) return {state:'insufficient_data',first:points[0]??null,last:points[0]??null,absoluteChange:null,percentChange:null,count:points.length,reason:'São necessários pelo menos dois pontos clínicos comparáveis.'};
  const first=points[0]; const last=points[points.length-1];
  return {...compareLongitudinalPoints(first,last),count:points.length};
}

export function availableLongitudinalTools(results:NexusClinicalResult[]) {
  const map=new Map<string,number>();
  for(const item of results){ if(clinicallyReviewed(item)) map.set(item.toolKey,(map.get(item.toolKey)??0)+1); }
  return [...map.entries()].sort((a,b)=>toolTitle(a[0]).localeCompare(toolTitle(b[0])));
}

export const RADAR_LABELS: Record<string,string[]> = {
  phq9:['Anedonia','Humor deprimido','Sono','Energia','Apetite','Culpa/autoestima','Concentração','Psicomotricidade','Ideação/segurança'],
  gad7:['Nervosismo/tensão','Controle da preocupação','Preocupação excessiva','Dificuldade de relaxar','Inquietação','Irritabilidade','Medo do pior'],
};

export function radarComparison(points:LongitudinalPoint[]) {
  if(points.length<2) return [];
  const first=points[0]; const last=points[points.length-1];
  const summary=compareLongitudinalPoints(first,last);
  if(!['stable','improved','worsened'].includes(summary.state)) return [];
  if(first.answers.length===0 || first.answers.length!==last.answers.length) return [];
  if(first.answers.some((value)=>value===null) || last.answers.some((value)=>value===null)) return [];
  const labels=RADAR_LABELS[first.toolKey];
  if(!labels || labels.length!==first.answers.length) return [];
  return labels.map((domain,i)=>({domain,baseline:first.answers[i] as number,current:last.answers[i] as number}));
}
