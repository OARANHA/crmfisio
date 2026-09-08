import { describe, expect, it } from 'vitest';
import { availableLongitudinalTools, radarComparison, summarizeTrend, toLongitudinalPoints } from './longitudinal';
import type { NexusClinicalResult, NexusClinicalLifecycleState } from '../nexusClinical';

const result = (
  id:string,
  score:number,
  date:string,
  answers:Record<string,number>,
  lifecycleState:NexusClinicalLifecycleState='reviewed',
):NexusClinicalResult => ({
  id,
  clinicId:'c1',
  patientId:'p1',
  professionalId:'u1',
  appointmentId:null,
  moduleKey:'mental-health',
  toolKey:'phq-9',
  ruleKey:'nexus.phq9',
  ruleVersion:'v1',
  requiredCapability:'nexus.scales',
  status:'finalized',
  lifecycleState,
  processedAt:date,
  reviewedAt:lifecycleState === 'reviewed' || lifecycleState === 'signed' ? date : null,
  reviewedBy:lifecycleState === 'reviewed' || lifecycleState === 'signed' ? 'u1' : null,
  signedAt:lifecycleState === 'signed' ? date : null,
  signedBy:lifecycleState === 'signed' ? 'u1' : null,
  inputSnapshot:{answers},
  outputSnapshot:{},
  totalScore:score,
  maxScore:27,
  classification:'x',
  severity:'low',
  interpretation:null,
  soapText:null,
  evidenceSnapshot:[],
  startedAt:date,
  finalizedAt:date,
  createdAt:date,
  updatedAt:date,
});

describe('Nexus longitudinal model',()=>{
  const results=[result('2',8,'2026-02-01T10:00:00Z',{q1:1,q2:2}),result('1',18,'2026-01-01T10:00:00Z',{q1:3,q2:3})];
  it('orders clinically reviewed results chronologically',()=>{const points=toLongitudinalPoints(results,'phq-9');expect(points.map((p)=>p.score)).toEqual([18,8]);});
  it('excludes technically processed results that were not human-reviewed',()=>{const processed=result('3',5,'2026-03-01T10:00:00Z',{q1:1,q2:1},'processed');expect(toLongitudinalPoints([...results,processed],'phq-9').map((p)=>p.id)).toEqual(['1','2']);});
  it('calculates percentage change without inventing interpretation',()=>{const summary=summarizeTrend(toLongitudinalPoints(results,'phq-9'));expect(summary?.percentChange).toBe(-56);});
  it('builds baseline/current radar from raw answers',()=>{const radar=radarComparison(toLongitudinalPoints(results,'phq-9'));expect(radar[0]).toMatchObject({baseline:3,current:1});});
  it('lists only reviewed tools with numeric history',()=>{const processed=result('3',5,'2026-03-01T10:00:00Z',{q1:1,q2:1},'processed');expect(availableLongitudinalTools([...results,processed])).toEqual([['phq-9',2]]);});
});