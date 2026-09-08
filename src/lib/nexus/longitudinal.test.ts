import { describe, expect, it } from 'vitest';
import { availableLongitudinalTools, compareLongitudinalPoints, NEXUS_LONGITUDINAL_CONTRACTS, radarComparison, summarizeTrend, toLongitudinalPoints } from './longitudinal';
import type { NexusClinicalResult, NexusClinicalLifecycleState } from '../nexusClinical';

const result = (overrides: Partial<NexusClinicalResult> & { id:string }): NexusClinicalResult => {
  const date=overrides.finalizedAt ?? '2026-01-01T10:00:00Z';
  const lifecycleState:NexusClinicalLifecycleState=overrides.lifecycleState ?? 'reviewed';
  return {
    id:overrides.id, clinicId:overrides.clinicId ?? 'c1', patientId:overrides.patientId ?? 'p1', professionalId:overrides.professionalId ?? 'u1', appointmentId:null,
    moduleKey:overrides.moduleKey ?? 'scales', toolKey:overrides.toolKey ?? 'phq9', ruleKey:overrides.ruleKey ?? 'nexus.phq9', ruleVersion:overrides.ruleVersion ?? 'nexus-2026-09-03', requiredCapability:'nexus.scales',
    status:'finalized', lifecycleState, processedAt:date,
    reviewedAt:lifecycleState==='reviewed'||lifecycleState==='signed'?date:null, reviewedBy:lifecycleState==='reviewed'||lifecycleState==='signed'?'u1':null,
    signedAt:lifecycleState==='signed'?date:null, signedBy:lifecycleState==='signed'?'u1':null,
    inputSnapshot:overrides.inputSnapshot ?? {answers:{q1:1,q2:2,q3:0,q4:0,q5:0,q6:0,q7:0,q8:0,q9:0}}, outputSnapshot:{},
    totalScore:overrides.totalScore === undefined ? 5 : overrides.totalScore, maxScore:overrides.maxScore === undefined ? 27 : overrides.maxScore,
    classification:'x', severity:'low', interpretation:null, soapText:null, evidenceSnapshot:[], startedAt:date, finalizedAt:date, createdAt:date, updatedAt:date,
  };
};

const points=(items:NexusClinicalResult[],tool='phq9')=>toLongitudinalPoints(items,tool,{patientId:'p1',clinicId:'c1'});

describe('Nexus C-05 longitudinal comparability',()=>{
  it('uses a closed versioned registry with explicit clinical direction',()=>{
    expect(NEXUS_LONGITUDINAL_CONTRACTS).toEqual(expect.arrayContaining([
      expect.objectContaining({toolKey:'phq9',ruleKey:'nexus.phq9',ruleVersion:'nexus-2026-09-03',metric:'total_score',unit:'points',minScore:0,maxScore:27,direction:'higher_is_worse'}),
      expect.objectContaining({toolKey:'gad7',maxScore:21,direction:'higher_is_worse'}),
      expect.objectContaining({toolKey:'eem',direction:'non_directional'}),
    ]));
  });

  it('orders by clinical timestamp then id and deduplicates the same result id',()=>{
    const late=result({id:'b',totalScore:10,finalizedAt:'2026-02-01T10:00:00Z'});
    const early=result({id:'a',totalScore:5,finalizedAt:'2026-01-01T10:00:00Z'});
    expect(points([late,early,early]).map((p)=>p.id)).toEqual(['a','b']);
  });

  it('excludes processed and legacy-frozen rows but accepts reviewed and signed',()=>{
    const processed=result({id:'p',lifecycleState:'processed'});
    const legacy=result({id:'l',lifecycleState:'legacy-frozen'});
    const reviewed=result({id:'r',lifecycleState:'reviewed'});
    const signed=result({id:'s',lifecycleState:'signed'});
    expect(points([processed,legacy,reviewed,signed]).map((p)=>p.id)).toEqual(['r','s']);
  });

  it('does not mix another patient or tenant when scope is explicit',()=>{
    expect(points([result({id:'ok'}),result({id:'patient',patientId:'p2'}),result({id:'tenant',clinicId:'c2'})]).map((p)=>p.id)).toEqual(['ok']);
  });

  it('one point is insufficient data',()=>expect(summarizeTrend(points([result({id:'1'})])).state).toBe('insufficient_data'));

  it('PHQ-9 5 -> 10 worsens and 10 -> 5 improves',()=>{
    const a=result({id:'a',totalScore:5,finalizedAt:'2026-01-01T10:00:00Z'});
    const b=result({id:'b',totalScore:10,finalizedAt:'2026-02-01T10:00:00Z'});
    expect(summarizeTrend(points([a,b])).state).toBe('worsened');
    expect(summarizeTrend(points([{...a,totalScore:10},{...b,totalScore:5}])).state).toBe('improved');
  });

  it('preserves legitimate zero and classifies zero -> zero as stable',()=>{
    const a=result({id:'a',totalScore:0,finalizedAt:'2026-01-01T10:00:00Z'});
    const b=result({id:'b',totalScore:0,finalizedAt:'2026-02-01T10:00:00Z'});
    const summary=summarizeTrend(points([a,b]));
    expect(summary.state).toBe('stable'); expect(summary.percentChange).toBeNull();
  });

  it('treats missing score as missing_measurement instead of zero',()=>{
    const a=result({id:'a',totalScore:null,finalizedAt:'2026-01-01T10:00:00Z'});
    const b=result({id:'b',totalScore:0,finalizedAt:'2026-02-01T10:00:00Z'});
    expect(summarizeTrend(points([a,b])).state).toBe('missing_measurement');
  });

  it('fails closed on different rule version, rule key and max score',()=>{
    const a=result({id:'a',finalizedAt:'2026-01-01T10:00:00Z'});
    expect(compareLongitudinalPoints(points([a,result({id:'b',ruleVersion:'v2',finalizedAt:'2026-02-01T10:00:00Z'})])[0],points([a,result({id:'b',ruleVersion:'v2',finalizedAt:'2026-02-01T10:00:00Z'})])[1]).state).toBe('incomparable_version');
    expect(summarizeTrend(points([a,result({id:'b',ruleKey:'other',finalizedAt:'2026-02-01T10:00:00Z'})])).state).toBe('incomparable_tool');
    expect(summarizeTrend(points([a,result({id:'b',maxScore:30,finalizedAt:'2026-02-01T10:00:00Z'})])).state).toBe('incompatible_metric');
  });

  it('never compares PHQ-9 with GAD-7',()=>{
    const phq=points([result({id:'p'})])[0];
    const gad=toLongitudinalPoints([result({id:'g',toolKey:'gad7',ruleKey:'nexus.gad7',maxScore:21})],'gad7')[0];
    expect(compareLongitudinalPoints(phq,gad).state).toBe('incomparable_tool');
  });

  it('GAD-7 follows higher-is-worse direction',()=>{
    const a=result({id:'a',toolKey:'gad7',ruleKey:'nexus.gad7',totalScore:12,maxScore:21,finalizedAt:'2026-01-01T10:00:00Z'});
    const b=result({id:'b',toolKey:'gad7',ruleKey:'nexus.gad7',totalScore:6,maxScore:21,finalizedAt:'2026-02-01T10:00:00Z'});
    expect(summarizeTrend(toLongitudinalPoints([a,b],'gad7')).state).toBe('improved');
  });

  it('EEM is a longitudinal event but never gets artificial direction',()=>{
    const a=result({id:'a',toolKey:'eem',ruleKey:'nexus.eem',ruleVersion:'nexus-eem-2026-09-03',totalScore:null,maxScore:null,finalizedAt:'2026-01-01T10:00:00Z'});
    const b={...a,id:'b',finalizedAt:'2026-02-01T10:00:00Z',reviewedAt:'2026-02-01T10:00:00Z'};
    expect(summarizeTrend(toLongitudinalPoints([a,b],'eem')).state).toBe('non_directional');
  });

  it('same timestamp does not infer temporal direction',()=>{
    const a=result({id:'a',totalScore:5}); const b=result({id:'b',totalScore:10});
    expect(summarizeTrend(points([a,b])).state).toBe('insufficient_data');
  });

  it('professional changes and long intervals do not invalidate valid historical math',()=>{
    const a=result({id:'a',professionalId:'u1',totalScore:10,finalizedAt:'2020-01-01T10:00:00Z'});
    const b=result({id:'b',professionalId:'u2',totalScore:5,finalizedAt:'2026-01-01T10:00:00Z'});
    expect(summarizeTrend(points([a,b])).state).toBe('improved');
  });

  it('radar refuses missing answers instead of filling them with zero',()=>{
    const a=result({id:'a',inputSnapshot:{answers:{q1:1,q2:null}},finalizedAt:'2026-01-01T10:00:00Z'});
    const b=result({id:'b',inputSnapshot:{answers:{q1:0,q2:1}},finalizedAt:'2026-02-01T10:00:00Z'});
    expect(radarComparison(points([a,b]))).toEqual([]);
  });

  it('lists reviewed/signed EEM even without numeric score while excluding processed rows',()=>{
    const eem=result({id:'e',toolKey:'eem',ruleKey:'nexus.eem',ruleVersion:'nexus-eem-2026-09-03',totalScore:null,maxScore:null});
    const processed=result({id:'p',lifecycleState:'processed'});
    expect(availableLongitudinalTools([eem,processed])).toEqual([['eem',1]]);
  });
});
