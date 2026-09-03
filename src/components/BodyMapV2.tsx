import { useMemo, useState } from 'react';
import { Btn, Chip, Field, Input, Select, Textarea } from '../lib/ui';
import { addAssessmentBodyPoint, removeAssessmentBodyPoint, type AssessmentBodyPoint, type BodyLaterality, type BodyView } from '../lib/assessmentEngine';
import { BODY_MAP_REGIONS, bodyMapRegionById, bodyMapRegionsForView, type BodyMapRegion } from '../lib/bodyMapRegions';

type FrontBackView = Extract<BodyView, 'front' | 'back'>;
type Mode = 'region' | 'free';
type PendingPoint = { view: FrontBackView; x: number; y: number; regionId: string | null; regionLabel: string | null; laterality: BodyLaterality | null };
const SYMPTOMS = ['Dor', 'Rigidez', 'Formigamento', 'Queimação', 'Pontada', 'Choque', 'Pressão', 'Peso', 'Outro'];

export function BodyMapV2({ assessmentId, componentKey, points, onChange, toast }: {
  assessmentId: string; componentKey: string; points: AssessmentBodyPoint[]; onChange: (points: AssessmentBodyPoint[]) => void;
  toast: (message: string, type?: 'info' | 'warn' | 'ok') => void;
}) {
  const [mode, setMode] = useState<Mode>('region');
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [intensity, setIntensity] = useState('5');
  const [symptom, setSymptom] = useState('Dor');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterView, setFilterView] = useState<'all' | FrontBackView>('all');
  const orderedPoints = useMemo(() => [...points].sort((a, b) => (b.intensity ?? -1) - (a.intensity ?? -1)), [points]);
  const visibleList = filterView === 'all' ? orderedPoints : orderedPoints.filter((point) => point.view === filterView);

  const selectRegion = (region: BodyMapRegion) => setPending({ view: region.view, x: region.x, y: region.y, regionId: region.id, regionLabel: region.label, laterality: region.laterality });
  const selectFreePoint = (view: FrontBackView, event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'free') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPending({ view, x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)), regionId: null, regionLabel: null, laterality: null });
  };

  const addPoint = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const created = await addAssessmentBodyPoint({ assessmentId, componentKey, view: pending.view, x: pending.x, y: pending.y, region: pending.regionId, laterality: pending.laterality, intensity: intensity === '' ? null : Number(intensity), symptom: symptom.trim() || null, note: note.trim() || null });
      onChange([...points, created]); setPending(null); setNote(''); toast('Marcação corporal adicionada.');
    } catch (error) { console.error('[MedicsPro] mapa corporal V2:', error); toast('Não foi possível salvar a marcação corporal.', 'warn'); }
    finally { setBusy(false); }
  };

  const removePoint = async (point: AssessmentBodyPoint) => {
    if (!window.confirm('Remover esta marcação do mapa corporal?')) return;
    setBusy(true);
    try { await removeAssessmentBodyPoint(point.id); onChange(points.filter((item) => item.id !== point.id)); }
    catch (error) { console.error('[MedicsPro] remover ponto corporal:', error); toast('Não foi possível remover a marcação.', 'warn'); }
    finally { setBusy(false); }
  };

  return <div className="rounded-2xl border border-line bg-panel overflow-hidden">
    <div className="border-b border-line px-4 sm:px-5 py-4 flex flex-wrap items-center gap-3">
      <div><p className="font-display font-semibold text-[14px]">Mapa corporal clínico</p><p className="text-[10.5px] text-fog mt-1">Marque uma região anatômica ou use ponto livre para localização específica.</p></div>
      <div className="ml-auto inline-flex rounded-xl border border-line bg-deep p-1"><ModeButton active={mode === 'region'} onClick={() => setMode('region')}>Regiões</ModeButton><ModeButton active={mode === 'free'} onClick={() => setMode('free')}>Ponto livre</ModeButton></div>
    </div>
    <div className="grid 2xl:grid-cols-[minmax(0,1.65fr)_360px] gap-0">
      <div className="p-4 sm:p-5 border-b 2xl:border-b-0 2xl:border-r border-line">
        <div className="grid lg:grid-cols-2 gap-4">
          <AnatomicalFigure view="front" title="Vista anterior" points={points.filter((p) => p.view === 'front')} pending={pending?.view === 'front' ? pending : null} mode={mode} onRegion={selectRegion} onFreePoint={selectFreePoint} />
          <AnatomicalFigure view="back" title="Vista posterior" points={points.filter((p) => p.view === 'back')} pending={pending?.view === 'back' ? pending : null} mode={mode} onRegion={selectRegion} onFreePoint={selectFreePoint} />
        </div>
        <div className="mt-4 rounded-xl border border-line bg-deep p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">Regiões rápidas</p><div className="mt-2 flex flex-wrap gap-1.5">{BODY_MAP_REGIONS.map((region) => <button type="button" key={region.id} onClick={() => selectRegion(region)} className="rounded-full border border-line px-2.5 py-1 text-[10px] text-fog hover:text-paper hover:border-mint/40 transition-colors">{region.code} · {region.label}</button>)}</div></div>
      </div>
      <div className="p-4 sm:p-5 space-y-4 bg-deep/35">
        <div><p className="font-display font-semibold text-[13px]">Registro selecionado</p><p className="text-[10.5px] text-fog mt-1">{pending ? `${pending.regionLabel ?? 'Ponto livre'} · ${pending.view === 'front' ? 'vista anterior' : 'vista posterior'}` : 'Selecione uma região no corpo para registrar o achado.'}</p></div>
        {pending && <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-3 flex flex-wrap gap-2 items-center"><Chip className="border-mint/40 text-mint">{pending.regionLabel ?? 'Ponto livre'}</Chip><span className="font-mono text-[9.5px] text-fog">{lateralityLabel(pending.laterality)}</span></div>}
        <Field label="Intensidade 0–10"><Input type="number" min={0} max={10} value={intensity} onChange={(e) => setIntensity(e.target.value)} /></Field>
        <Field label="Sintoma / tipo"><Select value={symptom} onChange={(e) => setSymptom(e.target.value)}>{SYMPTOMS.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Observação clínica"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Irradiação, comportamento, fatores agravantes, palpação…" /></Field>
        <Btn onClick={addPoint} disabled={!pending || busy}>{busy ? 'Salvando…' : 'Adicionar marcação'}</Btn>
        <div className="border-t border-line pt-4"><div className="flex items-center gap-2 mb-3"><div><p className="font-display font-semibold text-[12.5px]">Marcações registradas</p><p className="font-mono text-[9.5px] text-fog mt-0.5">{points.length} achado(s)</p></div><Select className="!w-auto !py-1.5 !text-[10px] ml-auto" value={filterView} onChange={(e) => setFilterView(e.target.value as 'all' | FrontBackView)}><option value="all">Todas</option><option value="front">Frente</option><option value="back">Costas</option></Select></div>
          {visibleList.length === 0 ? <div className="rounded-xl border border-dashed border-line p-4 text-[10.5px] text-fog">Nenhuma marcação nesta vista.</div> : <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">{visibleList.map((point) => { const region = bodyMapRegionById(point.region); return <div key={point.id} className="rounded-xl border border-line bg-panel p-3"><div className="flex items-start gap-2"><span className="w-7 h-7 rounded-full bg-pulse/15 border border-pulse/35 text-pulse grid place-items-center font-mono font-bold text-[10px] shrink-0">{point.intensity ?? '•'}</span><div className="min-w-0 flex-1"><p className="font-display font-semibold text-[11.5px]">{region?.label ?? 'Ponto livre'}</p><p className="text-[10px] text-fog mt-0.5">{point.symptom || 'Sem tipo'} · {point.view === 'front' ? 'anterior' : 'posterior'} · {lateralityLabel(point.laterality)}</p>{point.note && <p className="text-[10.5px] text-paper/80 mt-1.5 leading-relaxed">{point.note}</p>}</div><button type="button" disabled={busy} onClick={() => void removePoint(point)} className="text-[9.5px] text-fog hover:text-pulse transition-colors disabled:opacity-40">remover</button></div></div>; })}</div>}
        </div>
      </div>
    </div>
  </div>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-[10.5px] font-semibold transition-colors ${active ? 'bg-mint text-on-accent' : 'text-fog hover:text-paper'}`}>{children}</button>; }

function AnatomicalFigure({ view, title, points, pending, mode, onRegion, onFreePoint }: { view: FrontBackView; title: string; points: AssessmentBodyPoint[]; pending: PendingPoint | null; mode: Mode; onRegion: (region: BodyMapRegion) => void; onFreePoint: (view: FrontBackView, event: React.MouseEvent<HTMLDivElement>) => void }) {
  const regions = bodyMapRegionsForView(view);
  return <div className="rounded-2xl border border-line bg-deep overflow-hidden"><div className="px-3 py-2.5 border-b border-line flex items-center gap-2"><p className="font-display font-semibold text-[12px]">{title}</p><span className="font-mono text-[9px] text-fog ml-auto">{mode === 'region' ? 'clique na região' : 'clique livre'}</span></div><div className={`relative h-[540px] overflow-hidden ${mode === 'free' ? 'cursor-crosshair' : 'cursor-default'}`} onClick={(event) => onFreePoint(view, event)}><ClinicalBodySvg view={view} />
    {mode === 'region' && regions.map((region) => <button type="button" key={region.id} aria-label={region.label} title={region.label} onClick={(event) => { event.stopPropagation(); onRegion(region); }} className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-mint/80 bg-panel/90 text-mint shadow-sm hover:scale-110 hover:bg-mint hover:text-on-accent transition-all font-mono font-bold text-[8px]" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}>{region.code.slice(0, 3)}</button>)}
    {points.map((point) => <span key={point.id} className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-pulse border-2 border-paper shadow-lg text-white grid place-items-center font-mono font-bold text-[8px] pointer-events-none" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>{point.intensity ?? '•'}</span>)}
    {pending && <span className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-amber bg-amber/25 pointer-events-none" style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }} />}
  </div></div>;
}

function ClinicalBodySvg({ view }: { view: FrontBackView }) {
  const back = view === 'back';
  return <svg viewBox="0 0 260 520" className="absolute inset-0 w-full h-full text-fog/35 pointer-events-none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="130" cy="42" rx="28" ry="34" fill="currentColor" opacity="0.22"/><path d="M112 74 C107 86 101 92 91 99 C78 108 70 123 67 146 C62 178 65 212 72 242 C76 258 77 272 74 292 L62 386 C59 416 57 452 59 498"/><path d="M148 74 C153 86 159 92 169 99 C182 108 190 123 193 146 C198 178 195 212 188 242 C184 258 183 272 186 292 L198 386 C201 416 203 452 201 498"/><path d="M91 99 C99 119 104 145 102 176 C100 205 93 232 92 258 C91 281 98 303 104 325 L111 390 L105 498"/><path d="M169 99 C161 119 156 145 158 176 C160 205 167 232 168 258 C169 281 162 303 156 325 L149 390 L155 498"/><path d="M112 76 C117 88 143 88 148 76"/><path d="M102 176 C115 184 145 184 158 176"/><path d="M92 258 C107 268 153 268 168 258"/><path d="M104 325 C114 333 146 333 156 325"/><path d="M111 390 C119 396 141 396 149 390"/><path d="M67 146 C48 168 42 204 38 244 L31 317"/><path d="M193 146 C212 168 218 204 222 244 L229 317"/>{back ? <><path d="M101 112 C115 122 145 122 159 112"/><path d="M130 91 L130 258" strokeDasharray="4 5"/><path d="M101 138 C110 130 121 129 130 137 C139 129 150 130 159 138"/><path d="M103 190 C113 183 123 184 130 191 C137 184 147 183 157 190"/></> : <><path d="M101 118 C111 110 121 109 130 116 C139 109 149 110 159 118"/><path d="M130 118 L130 258" strokeDasharray="3 6"/><ellipse cx="130" cy="205" rx="24" ry="34"/></>}</g><text x="130" y="510" textAnchor="middle" fill="currentColor" fontSize="9" fontFamily="monospace">{back ? 'POSTERIOR' : 'ANTERIOR'}</text></svg>;
}

function lateralityLabel(value: BodyLaterality | null): string { if (value === 'left') return 'esquerda'; if (value === 'right') return 'direita'; if (value === 'bilateral') return 'bilateral'; if (value === 'midline') return 'linha média'; return 'sem lateralidade'; }
