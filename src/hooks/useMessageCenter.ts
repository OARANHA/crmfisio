import { useCallback, useEffect, useState } from 'react';
import { loadMessageOutbox, loadMessageTemplates, queueAppointmentConfirmations, queueSelectedAppointmentConfirmations, queueNpsSurveys, queueSelectedNpsSurveys, queueSelectedReactivationCampaign, resolveWhatsappReview, saveMessageTemplate, type MessageOutboxRow, type MessageTemplateRow } from '../lib/messageOutbox';
import { resolveClinicId } from '../lib/repository';
export function useMessageCenter(userId?:string){
 const[clinicId,setClinicId]=useState('');const[logs,setLogs]=useState<MessageOutboxRow[]>([]);const[templates,setTemplates]=useState<MessageTemplateRow[]>([]);const[loading,setLoading]=useState(false);
 const refresh=useCallback(async(id=clinicId)=>{if(!id)return;const[nextLogs,nextTemplates]=await Promise.all([loadMessageOutbox(id),loadMessageTemplates(id)]);setLogs(nextLogs);setTemplates(nextTemplates);},[clinicId]);
 useEffect(()=>{if(!userId)return;let cancelled=false;resolveClinicId(userId).then(async id=>{if(cancelled)return;setClinicId(id);const[nextLogs,nextTemplates]=await Promise.all([loadMessageOutbox(id),loadMessageTemplates(id)]);if(!cancelled){setLogs(nextLogs);setTemplates(nextTemplates);}}).catch(error=>console.error('[MedicsPro] central de mensagens:',error));return()=>{cancelled=true;};},[userId]);
 // Human clinic sessions only enqueue tenant-scoped work. The Evolution delivery
 // worker uses service_role, claims a global queue and requires x-worker-secret,
 // so it must never be invoked from the browser.
 const execute=async(queue:()=>Promise<number>)=>{setLoading(true);try{const queued=await queue();await refresh();return{queued};}finally{setLoading(false);}};
 const queueConfirmations=()=>execute(()=>queueAppointmentConfirmations(48));
 const queueSelectedConfirmations=(ids:string[])=>execute(()=>queueSelectedAppointmentConfirmations(ids,48));
 const queueNps=()=>execute(()=>queueNpsSurveys(7));
 const queueSelectedNps=(ids:string[])=>execute(()=>queueSelectedNpsSurveys(ids,7));
 const queueSelectedReactivation=(ids:string[])=>execute(()=>queueSelectedReactivationCampaign(ids,30,30));
 const resolveReview=async(logId:string,resolution:string,note?:string)=>{setLoading(true);try{await resolveWhatsappReview(logId,resolution,note);await refresh();}finally{setLoading(false);}};
 const saveTemplate=async(id:string,body:string)=>{setLoading(true);try{await saveMessageTemplate(id,body);await refresh();}finally{setLoading(false);}};
 return{clinicId,logs,templates,loading,refresh,queueConfirmations,queueSelectedConfirmations,queueNps,queueSelectedNps,queueSelectedReactivation,resolveReview,saveTemplate};
}
