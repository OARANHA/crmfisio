import { useCallback, useEffect, useState } from 'react';
import { flushMessageOutbox, loadMessageOutbox, loadMessageTemplates, queueAppointmentConfirmations, queueSelectedAppointmentConfirmations, queueNpsSurveys, queueSelectedNpsSurveys, queueSelectedReactivationCampaign, resolveWhatsappReview, saveMessageTemplate, type MessageDispatchResult, type MessageOutboxRow, type MessageTemplateRow } from '../lib/messageOutbox';
import { resolveClinicId } from '../lib/repository';
export function useMessageCenter(userId?:string){
 const[clinicId,setClinicId]=useState('');const[logs,setLogs]=useState<MessageOutboxRow[]>([]);const[templates,setTemplates]=useState<MessageTemplateRow[]>([]);const[loading,setLoading]=useState(false);
 const refresh=useCallback(async(id=clinicId)=>{if(!id)return;const[nextLogs,nextTemplates]=await Promise.all([loadMessageOutbox(id),loadMessageTemplates(id)]);setLogs(nextLogs);setTemplates(nextTemplates);},[clinicId]);
 useEffect(()=>{if(!userId)return;let cancelled=false;resolveClinicId(userId).then(async id=>{if(cancelled)return;setClinicId(id);const[nextLogs,nextTemplates]=await Promise.all([loadMessageOutbox(id),loadMessageTemplates(id)]);if(!cancelled){setLogs(nextLogs);setTemplates(nextTemplates);}}).catch(error=>console.error('[MedicsPro] central de mensagens:',error));return()=>{cancelled=true;};},[userId]);
 const dispatchQueued=async(queued:number):Promise<MessageDispatchResult>=>queued>0?flushMessageOutbox(Math.min(Math.max(queued,1),100)):{processed:0,sent:0,failed:0};
 const execute=async(queue:()=>Promise<number>)=>{setLoading(true);try{const queued=await queue();const dispatch=await dispatchQueued(queued);await refresh();return{queued,dispatch};}finally{setLoading(false);}};
 const queueConfirmations=()=>execute(()=>queueAppointmentConfirmations(48));
 const queueSelectedConfirmations=(ids:string[])=>execute(()=>queueSelectedAppointmentConfirmations(ids,48));
 const queueNps=()=>execute(()=>queueNpsSurveys(7));
 const queueSelectedNps=(ids:string[])=>execute(()=>queueSelectedNpsSurveys(ids,7));
 const queueSelectedReactivation=(ids:string[])=>execute(()=>queueSelectedReactivationCampaign(ids,30));
 const resolveReview=async(logId:string,resolution:string,note?:string)=>{setLoading(true);try{await resolveWhatsappReview(logId,resolution,note);await refresh();}finally{setLoading(false);}};
 const flush=async(limit=20)=>{setLoading(true);try{const dispatch=await flushMessageOutbox(limit);await refresh();return dispatch;}finally{setLoading(false);}};
 const saveTemplate=async(id:string,body:string)=>{setLoading(true);try{await saveMessageTemplate(id,body);await refresh();}finally{setLoading(false);}};
 return{clinicId,logs,templates,loading,refresh,queueConfirmations,queueSelectedConfirmations,queueNps,queueSelectedNps,queueSelectedReactivation,resolveReview,flush,saveTemplate};
}
