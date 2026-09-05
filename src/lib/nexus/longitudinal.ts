import type { NexusClinicalResult } from '../nexusClinical';

export type LongitudinalPoint = {
  id: string;
  toolKey: string;
  date: string;
  score: number;
  maxScore: number | null;
  classification: string | null;
  ruleVersion: string;
  answers: number[];
};

const TOOL_TITLES: Record<string,string> = {
  'phq-9':'PHQ-9','gad-7':'GAD-7','hcl-32':'HCL-32','cssrs':'C-SSRS','audit':'AUDIT','audit-c':'AUDIT-C','cage':'CAGE','asrs-18':'ASRS-18','ybocs':'Y-BOCS','epds':'EPDS','srq-20':'SRQ-20','phq-15':'PHQ-15','snap-iv':'SNAP-IV','isi':'ISI','ham-a':'HAM-A','mdq':'MDQ','pc-ptsd-5':'PC-PTSD-5','pcl-5':'PCL-5','meem':'MEEM','egfr-ckdepi':'CKD-EPI 2021','cv-risk-sbc':'Risco Cardiovascular','eem':'EEM',
};

export function toolTitle(toolKey:string){ return TOOL_TITLES[toolKey] ?? toolKey; }

function numericAnswers(snapshot: Record<string,unknown>): number[] {
  const answers = snapshot.answers;
  if (Array.isArray(answers)) return answers.map(Number).filter(Number.isFinite);
  if (answers && typeof answers === 'object') {
    return Object.entries(answers as Record<string,unknown>)
      .sort(([a],[b]) => {
        const ai=Number(a.replace(/\D/g,'')); const bi=Number(b.replace(/\D/g,''));
        return Number.isFinite(ai)&&Number.isFinite(bi)?ai-bi:a.localeCompare(b);
      })
      .map(([,value])=>Number(value)).filter(Number.isFinite);
  }
  const selected = snapshot.selectedOptions;
  if (selected && typeof selected === 'object') {
    return Object.entries(selected as Record<string,any>)
      .sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))
      .map(([,value])=>Number(value?.value)).filter(Number.isFinite);
  }
  return [];
}

export function toLongitudinalPoints(results:NexusClinicalResult[], toolKey:string):LongitudinalPoint[] {
  return results
    .filter((item)=>item.status==='finalized'&&item.toolKey===toolKey&&item.totalScore!=null)
    .map((item)=>({id:item.id,toolKey:item.toolKey,date:item.finalizedAt??item.createdAt,score:Number(item.totalScore),maxScore:item.maxScore,classification:item.classification,ruleVersion:item.ruleVersion,answers:numericAnswers(item.inputSnapshot)}))
    .sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
}

export function summarizeTrend(points:LongitudinalPoint[]) {
  if (points.length===0) return null;
  const first=points[0]; const last=points[points.length-1];
  const absoluteChange=last.score-first.score;
  const percentChange=first.score===0?null:Math.round((absoluteChange/first.score)*100);
  return {first,last,absoluteChange,percentChange,count:points.length};
}

export function availableLongitudinalTools(results:NexusClinicalResult[]) {
  const map=new Map<string,number>();
  for(const item of results){ if(item.status==='finalized'&&item.totalScore!=null) map.set(item.toolKey,(map.get(item.toolKey)??0)+1); }
  return [...map.entries()].filter(([,count])=>count>=1).sort((a,b)=>toolTitle(a[0]).localeCompare(toolTitle(b[0])));
}

export const RADAR_LABELS: Record<string,string[]> = {
  'phq-9':['Anedonia','Humor deprimido','Sono','Energia','Apetite','Culpa/autoestima','Concentração','Psicomotricidade','Ideação/segurança'],
  'gad-7':['Nervosismo/tensão','Controle da preocupação','Preocupação excessiva','Dificuldade de relaxar','Inquietação','Irritabilidade','Medo do pior'],
  'audit':['Frequência','Quantidade','Binge','Perda de controle','Obrigações','Uso matinal','Culpa','Amnésia','Lesões','Preocupação externa'],
  'epds':['Humor leve','Futuro','Culpa','Ansiedade','Pânico','Sobrecarga','Sono','Tristeza','Choro','Autoagressão'],
  'isi':['Início do sono','Manutenção','Despertar precoce','Satisfação','Impacto','Percepção','Preocupação'],
};

export function radarComparison(points:LongitudinalPoint[]) {
  if(points.length<1) return [];
  const first=points[0]; const last=points[points.length-1];
  const size=Math.max(first.answers.length,last.answers.length);
  const labels=RADAR_LABELS[first.toolKey]??Array.from({length:size},(_,i)=>`Item ${i+1}`);
  return Array.from({length:size},(_,i)=>({domain:labels[i]??`Item ${i+1}`,baseline:first.answers[i]??0,current:last.answers[i]??0}));
}
