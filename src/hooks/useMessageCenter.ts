import { useCallback, useEffect, useState } from 'react';
import { loadMessageOutbox, queueAppointmentConfirmations, queueSelectedAppointmentConfirmations, queueNpsSurveys, queueSelectedNpsSurveys, queueSelectedReactivationCampaign, resolveWhatsappReview, type MessageOutboxRow } from '../lib/messageOutbox';
import { resolveClinicId } from '../lib/repository';
export function useMessageCenter(userId?:string){
 const[clinicId,setClinicId]=useState('');const[logs,setLogs]=useState<MessageOutboxRow[]>([]);const[loading,setLoading]=useState(false);
 const refresh=useCallback(async(id=clinicId)=>{if(!id)return;setLogs(await loadMessageOutbox(id));},[clinicId]);
 useEffect(()=>{if(!userId)return;let cancelled=false;resolveClinicId(userId).then(async id=>{if(cancelled)return;setClinicId(id);const nextLogs=await loadMessageOutbox(id);if(!cancelled)setLogs(nextLogs);}).catch(error=>console.error('[MedicsPro] central de mensagens:',error));return()=>{cancelled=true;};},[userId]);
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
 return{clinicId,logs,loading,refresh,queueConfirmations,queueSelectedConfirmations,queueNps,queueSelectedNps,queueSelectedReactivation,resolveReview};
}
