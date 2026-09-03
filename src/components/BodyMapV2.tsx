import { useMemo, useState } from 'react';
import { Btn, Chip, Field, Input, Select, Textarea } from '../lib/ui';
import {
  addAssessmentBodyPoint,
  removeAssessmentBodyPoint,
  type AssessmentBodyPoint,
  type BodyLaterality,
  type BodyView,
} from '../lib/assessmentEngine';
import {
  BODY_MAP_REGIONS,
  bodyMapRegionById,
  bodyMapRegionsForView,
  type BodyMapRegion,
} from '../lib/bodyMapRegions';

type FrontBackView = Extract<BodyView, 'front' | 'back'>;
type Mode = 'region' | 'free';
type PendingPoint = {
  view: FrontBackView;
  x: number;
  y: number;
  regionId: string | null;
  regionLabel: string | null;
  laterality: BodyLaterality | null;
};

const SYMPTOMS = ['Dor', 'Rigidez', 'Formigamento', 'Queimação', 'Pontada', 'Choque', 'Pressão', 'Peso', 'Outro'];

export function BodyMapV2({ assessmentId, componentKey, points, onChange, toast }: {
  assessmentId: string;
  componentKey: string;
  points: AssessmentBodyPoint[];
  onChange: (points: AssessmentBodyPoint[]) => void;
  toast: (message: string, type?: 'info' | 'warn' | 'ok') => void;
}) {
  const [mode, setMode] = useState<Mode>('region');
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [intensity, setIntensity] = useState('5');
  const [symptom, setSymptom] = useState('Dor');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterView, setFilterView] = useState<'all' | FrontBackView>('all');

  const orderedPoints = useMemo(
    () => [...points].sort((a, b) => (b.intensity ?? -1) - (a.intensity ?? -1)),
    [points],
  );
  const visibleList = filterView === 'all'
    ? orderedPoints
    : orderedPoints.filter((point) => point.view === filterView);

  const selectRegion = (region: BodyMapRegion) => {
    setMode('region');
    setPending({
      view: region.view,
      x: region.x,
      y: region.y,
      regionId: region.id,
      regionLabel: region.label,
      laterality: region.laterality,
    });
  };

  const selectFreePoint = (view: FrontBackView, event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'free') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPending({
      view,
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      regionId: null,
      regionLabel: null,
      laterality: null,
    });
  };

  const addPoint = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const created = await addAssessmentBodyPoint({
        assessmentId,
        componentKey,
        view: pending.view,
        x: pending.x,
        y: pending.y,
        region: pending.regionId,
        laterality: pending.laterality,
        intensity: intensity === '' ? null : Number(intensity),
        symptom: symptom.trim() || null,
        note: note.trim() || null,
      });
      onChange([...points, created]);
      setPending(null);
      setNote('');
      toast('Marcação corporal adicionada.');
    } catch (error) {
      console.error('[MedicsPro] mapa corporal V2:', error);
      toast('Não foi possível salvar a marcação corporal.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const removePoint = async (point: AssessmentBodyPoint) => {
    if (!window.confirm('Remover esta marcação do mapa corporal?')) return;
    setBusy(true);
    try {
      await removeAssessmentBodyPoint(point.id);
      onChange(points.filter((item) => item.id !== point.id));
    } catch (error) {
      console.error('[MedicsPro] remover ponto corporal:', error);
      toast('Não foi possível remover a marcação.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-panel overflow-hidden">
      <div className="border-b border-line px-4 sm:px-5 py-4 flex flex-wrap items-center gap-3">
        <div>
          <p className="font-display font-semibold text-[14px]">Mapa corporal clínico</p>
          <p className="text-[10.5px] text-fog mt-1">Selecione uma região anatômica ou marque um ponto livre para localização precisa.</p>
        </div>
        <div className="ml-auto inline-flex rounded-xl border border-line bg-deep p-1">
          <ModeButton active={mode === 'region'} onClick={() => setMode('region')}>Regiões</ModeButton>
          <ModeButton active={mode === 'free'} onClick={() => { setMode('free'); setPending(null); }}>Ponto livre</ModeButton>
        </div>
      </div>

      <div className="grid 2xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <div className="p-4 sm:p-5 border-b 2xl:border-b-0 2xl:border-r border-line">
          <div className="grid lg:grid-cols-2 gap-4">
            <AnatomicalFigure
              view="front"
              title="Vista anterior"
              points={points.filter((point) => point.view === 'front')}
              pending={pending?.view === 'front' ? pending : null}
              mode={mode}
              onRegion={selectRegion}
              onFreePoint={selectFreePoint}
            />
            <AnatomicalFigure
              view="back"
              title="Vista posterior"
              points={points.filter((point) => point.view === 'back')}
              pending={pending?.view === 'back' ? pending : null}
              mode={mode}
              onRegion={selectRegion}
              onFreePoint={selectFreePoint}
            />
          </div>
          <p className="mt-3 text-[10px] text-fog">
            {mode === 'region'
              ? 'Passe o cursor sobre os pontos para ver o nome completo da região. Você também pode selecionar pela lista ao lado.'
              : 'Clique diretamente sobre a figura para registrar uma localização específica.'}
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-4 bg-deep/35">
          {mode === 'region' && (
            <Field label="Selecionar região anatômica">
              <Select
                value={pending?.regionId ?? ''}
                onChange={(event) => {
                  const region = bodyMapRegionById(event.target.value);
                  if (region) selectRegion(region);
                }}
              >
                <option value="">Escolha uma região…</option>
                <optgroup label="Vista anterior">
                  {BODY_MAP_REGIONS.filter((region) => region.view === 'front').map((region) => (
                    <option key={region.id} value={region.id}>{region.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Vista posterior">
                  {BODY_MAP_REGIONS.filter((region) => region.view === 'back').map((region) => (
                    <option key={region.id} value={region.id}>{region.label}</option>
                  ))}
                </optgroup>
              </Select>
            </Field>
          )}

          <div>
            <p className="font-display font-semibold text-[13px]">Registro selecionado</p>
            <p className="text-[10.5px] text-fog mt-1">
              {pending
                ? `${pending.regionLabel ?? 'Ponto livre'} · ${pending.view === 'front' ? 'vista anterior' : 'vista posterior'}`
                : 'Selecione uma região no corpo para registrar o achado.'}
            </p>
          </div>

          {pending && (
            <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-3 flex flex-wrap gap-2 items-center">
              <Chip className="border-mint/40 text-mint">{pending.regionLabel ?? 'Ponto livre'}</Chip>
              <span className="font-mono text-[9.5px] text-fog">{lateralityLabel(pending.laterality)}</span>
            </div>
          )}

          <Field label="Intensidade 0–10">
            <Input type="number" min={0} max={10} value={intensity} onChange={(event) => setIntensity(event.target.value)} />
          </Field>
          <Field label="Sintoma / tipo">
            <Select value={symptom} onChange={(event) => setSymptom(event.target.value)}>
              {SYMPTOMS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
          <Field label="Observação clínica">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Irradiação, comportamento, fatores agravantes, palpação…"
            />
          </Field>
          <Btn onClick={addPoint} disabled={!pending || busy}>{busy ? 'Salvando…' : 'Adicionar marcação'}</Btn>

          <div className="border-t border-line pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div>
                <p className="font-display font-semibold text-[12.5px]">Marcações registradas</p>
                <p className="font-mono text-[9.5px] text-fog mt-0.5">{points.length} achado(s)</p>
              </div>
              <Select
                className="!w-auto !py-1.5 !text-[10px] ml-auto"
                value={filterView}
                onChange={(event) => setFilterView(event.target.value as 'all' | FrontBackView)}
              >
                <option value="all">Todas</option>
                <option value="front">Frente</option>
                <option value="back">Costas</option>
              </Select>
            </div>

            {visibleList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-4 text-[10.5px] text-fog">Nenhuma marcação nesta vista.</div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {visibleList.map((point) => {
                  const region = bodyMapRegionById(point.region);
                  return (
                    <div key={point.id} className="rounded-xl border border-line bg-panel p-3">
                      <div className="flex items-start gap-2">
                        <span className="w-7 h-7 rounded-full bg-pulse/15 border border-pulse/35 text-pulse grid place-items-center font-mono font-bold text-[10px] shrink-0">{point.intensity ?? '•'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-semibold text-[11.5px]">{region?.label ?? 'Ponto livre'}</p>
                          <p className="text-[10px] text-fog mt-0.5">{point.symptom || 'Sem tipo'} · {point.view === 'front' ? 'anterior' : 'posterior'} · {lateralityLabel(point.laterality)}</p>
                          {point.note && <p className="text-[10.5px] text-paper/80 mt-1.5 leading-relaxed">{point.note}</p>}
                        </div>
                        <button type="button" disabled={busy} onClick={() => void removePoint(point)} className="text-[9.5px] text-fog hover:text-pulse transition-colors disabled:opacity-40">remover</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-[10.5px] font-semibold transition-colors ${active ? 'bg-mint text-on-accent' : 'text-fog hover:text-paper'}`}>
      {children}
    </button>
  );
}

function AnatomicalFigure({ view, title, points, pending, mode, onRegion, onFreePoint }: {
  view: FrontBackView;
  title: string;
  points: AssessmentBodyPoint[];
  pending: PendingPoint | null;
  mode: Mode;
  onRegion: (region: BodyMapRegion) => void;
  onFreePoint: (view: FrontBackView, event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const regions = bodyMapRegionsForView(view);
  return (
    <div className="rounded-2xl border border-line bg-deep overflow-hidden">
      <div className="px-3 py-2.5 border-b border-line flex items-center gap-2">
        <p className="font-display font-semibold text-[12px]">{title}</p>
        <span className="font-mono text-[9px] text-fog ml-auto">{mode === 'region' ? 'regiões anatômicas' : 'ponto livre'}</span>
      </div>
      <div
        className={`relative h-[540px] overflow-hidden ${mode === 'free' ? 'cursor-crosshair' : 'cursor-default'}`}
        onClick={(event) => onFreePoint(view, event)}
      >
        <ClinicalBodySvg view={view} />

        {mode === 'region' && regions.map((region) => (
          <button
            type="button"
            key={region.id}
            aria-label={region.label}
            title={region.label}
            onClick={(event) => { event.stopPropagation(); onRegion(region); }}
            className="group absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-mint bg-panel/95 text-mint shadow-sm hover:scale-125 hover:bg-mint hover:text-on-accent focus:scale-125 focus:bg-mint focus:text-on-accent transition-all"
            style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
          >
            <span className="sr-only">{region.label}</span>
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[9px] font-medium text-paper shadow-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-20 ${region.x < 0.5 ? 'right-[calc(100%+8px)]' : 'left-[calc(100%+8px)]'}`}>
              {region.label}
            </span>
          </button>
        ))}

        {points.map((point) => (
          <span
            key={point.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-pulse border-2 border-paper shadow-lg text-white grid place-items-center font-mono font-bold text-[8px] pointer-events-none z-10"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          >
            {point.intensity ?? '•'}
          </span>
        ))}

        {pending && (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-amber bg-amber/25 pointer-events-none z-10"
            style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function ClinicalBodySvg({ view }: { view: FrontBackView }) {
  const back = view === 'back';
  return (
    <svg viewBox="0 0 260 520" className="absolute inset-0 w-full h-full text-fog/50 pointer-events-none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="130" cy="42" rx="27" ry="34" fill="currentColor" opacity="0.13" />
        <path d="M111 75 C105 87 99 93 90 99 C77 108 70 126 69 151 C68 181 76 210 78 240 C80 264 73 286 69 310 L61 381 C58 416 58 458 59 498 L105 498 L111 390 L104 326 C98 301 91 282 92 258 C93 232 101 206 102 178 C103 145 99 121 90 99" fill="currentColor" opacity="0.08" />
        <path d="M149 75 C155 87 161 93 170 99 C183 108 190 126 191 151 C192 181 184 210 182 240 C180 264 187 286 191 310 L199 381 C202 416 202 458 201 498 L155 498 L149 390 L156 326 C162 301 169 282 168 258 C167 232 159 206 158 178 C157 145 161 121 170 99" fill="currentColor" opacity="0.08" />
        <path d="M111 75 C105 87 99 93 90 99 C77 108 70 126 69 151 C68 181 76 210 78 240 C80 264 73 286 69 310 L61 381 C58 416 58 458 59 498" fill="none" />
        <path d="M149 75 C155 87 161 93 170 99 C183 108 190 126 191 151 C192 181 184 210 182 240 C180 264 187 286 191 310 L199 381 C202 416 202 458 201 498" fill="none" />
        <path d="M90 99 C99 120 104 145 102 178 C101 206 93 232 92 258 C91 282 98 301 104 326 L111 390 L105 498" fill="none" />
        <path d="M170 99 C161 120 156 145 158 178 C159 206 167 232 168 258 C169 282 162 301 156 326 L149 390 L155 498" fill="none" />
        <path d="M111 76 C117 88 143 88 149 76" fill="none" />
        <path d="M102 178 C115 184 145 184 158 178" fill="none" />
        <path d="M92 258 C107 268 153 268 168 258" fill="none" />
        <path d="M104 326 C114 333 146 333 156 326" fill="none" />
        <path d="M111 390 C119 396 141 396 149 390" fill="none" />
        <path d="M69 151 C50 174 43 208 39 244 L32 317" fill="none" />
        <path d="M191 151 C210 174 217 208 221 244 L228 317" fill="none" />
        {back ? (
          <>
            <path d="M100 113 C114 122 146 122 160 113" fill="none" />
            <path d="M130 91 L130 258" strokeDasharray="4 5" fill="none" />
            <path d="M101 139 C111 130 121 130 130 138 C139 130 149 130 159 139" fill="none" />
            <path d="M103 190 C113 184 123 184 130 191 C137 184 147 184 157 190" fill="none" />
            <path d="M103 223 C116 217 144 217 157 223" fill="none" opacity="0.55" />
          </>
        ) : (
          <>
            <path d="M101 118 C111 110 121 109 130 116 C139 109 149 110 159 118" fill="none" />
            <path d="M130 118 L130 258" strokeDasharray="3 6" fill="none" />
            <ellipse cx="130" cy="205" rx="24" ry="34" fill="none" opacity="0.7" />
          </>
        )}
      </g>
      <text x="130" y="510" textAnchor="middle" fill="currentColor" fontSize="9" fontFamily="monospace" opacity="0.7">{back ? 'POSTERIOR' : 'ANTERIOR'}</text>
    </svg>
  );
}

function lateralityLabel(value: BodyLaterality | null): string {
  if (value === 'left') return 'esquerda';
  if (value === 'right') return 'direita';
  if (value === 'bilateral') return 'bilateral';
  if (value === 'midline') return 'linha média';
  return 'sem lateralidade';
}
