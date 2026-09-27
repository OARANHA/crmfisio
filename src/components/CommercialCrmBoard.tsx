import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  executeCommercialCrmStageTransition,
  loadCurrentClinicCommercialCrm,
  type CommercialCrmLead,
  type CommercialCrmPipeline,
  type CommercialCrmSnapshot,
  type CommercialCrmStage,
  type CommercialCrmStageKind,
} from '../lib/commercialCrm';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { isOperationalRole } from '../lib/permissions';
import { useToast } from '../lib/toastContext';
import { Btn, Card, CardHead, Chip, Field, Input, Modal, Select } from '../lib/ui';

const STAGE_KIND_LABEL: Record<CommercialCrmStageKind, string> = {
  open: 'Aberto',
  won: 'Ganho',
  lost: 'Perdido',
};

const STAGE_KIND_COLOR: Record<CommercialCrmStageKind, string> = {
  open: '#4fd1a5',
  won: '#60a5fa',
  lost: '#f2545b',
};

function choosePipeline(pipelines: CommercialCrmPipeline[], current: string | null): string | null {
  const active = pipelines.filter((pipeline) => !pipeline.archivedAt);
  if (current && active.some((pipeline) => pipeline.id === current)) return current;
  return active.find((pipeline) => pipeline.isDefault)?.id ?? active[0]?.id ?? null;
}

function isLegacyLead(
  lead: CommercialCrmLead,
  pipelineById: Map<string, CommercialCrmPipeline>,
  stageById: Map<string, CommercialCrmStage>,
): boolean {
  const pipeline = pipelineById.get(lead.pipelineId);
  const stage = stageById.get(lead.stageId);
  return !pipeline || !stage || Boolean(pipeline.archivedAt) || Boolean(stage.archivedAt);
}

function contactLabel(lead: CommercialCrmLead): string {
  if (lead.contactAnonymizedAt) return 'Contato anonimizado';
  return lead.contactName || 'Contato sem nome';
}

function CommercialLeadCard({
  lead,
  stages,
  canMutate,
  busy,
  onDragStart,
  onMove,
}: {
  lead: CommercialCrmLead;
  stages: CommercialCrmStage[];
  canMutate: boolean;
  busy: boolean;
  onDragStart: () => void;
  onMove: (stage: CommercialCrmStage) => void;
}) {
  const stageIndex = stages.findIndex((stage) => stage.id === lead.stageId);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;
  const anonymized = Boolean(lead.contactAnonymizedAt);

  return (
    <div
      draggable={canMutate && !busy}
      onDragStart={canMutate && !busy ? onDragStart : undefined}
      className={'node-card border border-line bg-panel px-3 py-2.5 hover:border-line2 ' + (canMutate && !busy ? 'cursor-grab active:cursor-grabbing' : '')}
    >
      <p className="font-display font-semibold text-[13px] truncate">{contactLabel(lead)}</p>
      {!anonymized && <p className="text-[11px] text-fog truncate mt-0.5">{lead.title}</p>}
      {!anonymized && (lead.contactPhone || lead.contactEmail) && (
        <p className="font-mono text-[10px] text-fog truncate mt-2">
          {[lead.contactPhone, lead.contactEmail].filter(Boolean).join(' · ')}
        </p>
      )}
      {anonymized && (
        <p className="font-mono text-[10px] text-fog/80 mt-2">
          Dados comerciais identificáveis ocultados.
        </p>
      )}
      {canMutate && nextStage && (
        <button
          type="button"
          onClick={() => onMove(nextStage)}
          disabled={busy}
          className="mt-2 w-full border border-line px-2 py-1 font-mono text-[10px] text-fog hover:text-mint hover:border-mint/40 transition-colors disabled:opacity-40"
        >
          {busy ? 'movendo…' : 'avançar para ' + nextStage.name}
        </button>
      )}
    </div>
  );
}

function LegacyLeadCard({ lead }: { lead: CommercialCrmLead }) {
  const anonymized = Boolean(lead.contactAnonymizedAt);
  return (
    <div className="border border-line bg-deep/45 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display font-semibold text-[13px]">{contactLabel(lead)}</p>
        <Chip className="border-amber/45 text-amber">somente leitura</Chip>
      </div>
      {!anonymized && <p className="mt-1 text-[11px] text-fog">{lead.title}</p>}
      <p className="mt-1 font-mono text-[10px] text-fog/80">
        {lead.pipelineName} · {lead.stageName}
      </p>
      {anonymized && (
        <p className="mt-1 font-mono text-[10px] text-fog/80">
          Dados comerciais identificáveis ocultados.
        </p>
      )}
    </div>
  );
}

export function CommercialCrmBoard() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<CommercialCrmSnapshot | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [lossTarget, setLossTarget] = useState<{ lead: CommercialCrmLead; stage: CommercialCrmStage } | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [lossError, setLossError] = useState<string | null>(null);
  const canMutate = isOperationalRole(user?.role);

  const applySnapshot = useCallback((next: CommercialCrmSnapshot) => {
    setSnapshot(next);
    setSelectedPipelineId((current) => choosePipeline(next.pipelines, current));
    setLoadError(null);
  }, []);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      applySnapshot(await loadCurrentClinicCommercialCrm());
    } catch (error) {
      console.error('[MedicsPro] Falha ao carregar Commercial CRM:', error);
      setLoadError('Não foi possível carregar o quadro comercial.');
      throw error;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void refresh(true).catch(() => undefined);
  }, [refresh]);

  const pipelineById = useMemo(
    () => new Map((snapshot?.pipelines ?? []).map((pipeline) => [pipeline.id, pipeline])),
    [snapshot?.pipelines],
  );
  const stageById = useMemo(
    () => new Map((snapshot?.stages ?? []).map((stage) => [stage.id, stage])),
    [snapshot?.stages],
  );
  const activePipelines = useMemo(
    () => (snapshot?.pipelines ?? []).filter((pipeline) => !pipeline.archivedAt),
    [snapshot?.pipelines],
  );
  const legacyLeads = useMemo(
    () => (snapshot?.leads ?? []).filter((lead) => isLegacyLead(lead, pipelineById, stageById)),
    [snapshot?.leads, pipelineById, stageById],
  );
  const activeLeads = useMemo(
    () => (snapshot?.leads ?? []).filter((lead) => !isLegacyLead(lead, pipelineById, stageById)),
    [snapshot?.leads, pipelineById, stageById],
  );
  const selectedStages = useMemo(
    () => (snapshot?.stages ?? [])
      .filter((stage) => stage.pipelineId === selectedPipelineId && !stage.archivedAt)
      .sort((a, b) => a.position - b.position),
    [snapshot?.stages, selectedPipelineId],
  );
  const selectedLeads = useMemo(
    () => activeLeads.filter((lead) => lead.pipelineId === selectedPipelineId),
    [activeLeads, selectedPipelineId],
  );

  const persistTransition = async (
    lead: CommercialCrmLead,
    stage: CommercialCrmStage,
    lostReasonDetail?: string,
  ): Promise<boolean> => {
    if (!canMutate || movingLeadId || lead.stageId === stage.id) return false;

    setMovingLeadId(lead.id);
    try {
      const outcome = await executeCommercialCrmStageTransition({
        leadId: lead.id,
        toStageId: stage.id,
        lostReasonDetail,
      });
      if (outcome.snapshot) applySnapshot(outcome.snapshot);
      if (outcome.projectionWarning) {
        toast(outcome.projectionWarning, 'warn');
      } else {
        toast('Lead movido para "' + stage.name + '".');
      }
      return true;
    } catch (error) {
      console.error('[MedicsPro] Falha ao mover Lead comercial:', error);
      toast('Não foi possível mover o Lead. O estado persistido não foi alterado.', 'warn');
      return false;
    } finally {
      setMovingLeadId(null);
    }
  };

  const requestTransition = (lead: CommercialCrmLead, stage: CommercialCrmStage) => {
    if (!canMutate || lead.stageId === stage.id) return;
    if (stage.stageKind === 'lost') {
      setLossTarget({ lead, stage });
      setLossReason('');
      setLossError(null);
      return;
    }
    void persistTransition(lead, stage);
  };

  const confirmLoss = async () => {
    if (!lossTarget) return;
    const reason = lossReason.trim();
    if (!reason) {
      setLossError('Informe o motivo da perda.');
      return;
    }
    const persisted = await persistTransition(lossTarget.lead, lossTarget.stage, reason);
    if (persisted) {
      setLossTarget(null);
      setLossReason('');
      setLossError(null);
    }
  };

  if (loading && !snapshot) {
    return (
      <Card>
        <CardHead title="Pipeline comercial" sub="carregando Leads, pipelines e etapas canônicas" />
        <div className="px-5 py-8 text-center font-mono text-[11px] text-fog">Carregando quadro comercial…</div>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card>
        <CardHead title="Pipeline comercial" sub="Commercial CRM canônico" />
        <div className="px-5 py-6">
          <p className="text-[12px] text-pulse">{loadError ?? 'Não foi possível carregar o quadro comercial.'}</p>
          <Btn className="mt-3" variant="subtle" onClick={() => void refresh(true).catch(() => undefined)}>
            Tentar novamente
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHead
          title={'Pipeline comercial · ' + activeLeads.length + ' Lead(s)'}
          sub="Contact → Lead → Pipeline → Stage · autoridade server-side"
          right={(
            <Btn
              variant="ghost"
              className="!px-3 !py-1.5 !text-[11px]"
              onClick={() => void refresh(false).catch(() => undefined)}
            >
              Atualizar
            </Btn>
          )}
        />

        <div className="px-5 pt-4">
          {loadError && <p className="mb-3 text-[11.5px] text-pulse">{loadError}</p>}
          {activePipelines.length > 0 ? (
            <Field label="Pipeline ativo">
              <Select
                value={selectedPipelineId ?? ''}
                onChange={(event) => {
                  setSelectedPipelineId(event.target.value || null);
                  setDragLeadId(null);
                }}
              >
                {activePipelines.map((pipeline) => {
                  const count = activeLeads.filter((lead) => lead.pipelineId === pipeline.id).length;
                  return (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name + (pipeline.isDefault ? ' · padrão' : '') + ' · ' + count + ' Lead(s)'}
                    </option>
                  );
                })}
              </Select>
            </Field>
          ) : (
            <p className="border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">
              Nenhum pipeline comercial ativo. Leads arquivados continuam visíveis abaixo em modo somente leitura.
            </p>
          )}
        </div>

        {selectedPipelineId && (
          <div className="p-5">
            <div className={'grid gap-3 items-start ' + (selectedStages.length >= 4 ? 'xl:grid-cols-4' : selectedStages.length === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
              {selectedStages.map((stage) => {
                const leads = selectedLeads.filter((lead) => lead.stageId === stage.id);
                return (
                  <div
                    key={stage.id}
                    onDragOver={canMutate ? (event) => event.preventDefault() : undefined}
                    onDrop={canMutate ? () => {
                      const lead = selectedLeads.find((candidate) => candidate.id === dragLeadId);
                      setDragLeadId(null);
                      if (lead) requestTransition(lead, stage);
                    } : undefined}
                    className="border border-line bg-deep/60"
                  >
                    <div className="px-4 py-3 border-b border-line flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: STAGE_KIND_COLOR[stage.stageKind] }} />
                      <span className="font-display font-semibold text-[13.5px]">{stage.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wide text-fog">{STAGE_KIND_LABEL[stage.stageKind]}</span>
                      <span className="ml-auto font-mono text-[11px] text-fog">{leads.length}</span>
                    </div>
                    <div className="h-1" style={{ background: STAGE_KIND_COLOR[stage.stageKind], opacity: 0.7 }} />
                    <div className="p-2.5 space-y-2 min-h-[120px]">
                      {leads.length === 0 && (
                        <p className="font-mono text-[10.5px] text-fog/60 text-center py-6">vazio</p>
                      )}
                      {leads.map((lead) => (
                        <CommercialLeadCard
                          key={lead.id}
                          lead={lead}
                          stages={selectedStages}
                          canMutate={canMutate}
                          busy={movingLeadId === lead.id}
                          onDragStart={() => setDragLeadId(lead.id)}
                          onMove={(target) => requestTransition(lead, target)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedStages.length === 0 && (
              <p className="py-6 text-center font-mono text-[11px] text-fog">
                Este pipeline não possui etapas ativas disponíveis para o quadro.
              </p>
            )}

            <p className="mt-3 font-mono text-[10.5px] text-fog/70">
              {canMutate
                ? 'arraste entre etapas ou use avançar · a RPC canônica valida tenant, crm.access e invariantes'
                : 'visualização comercial em modo somente leitura'}
            </p>
          </div>
        )}
      </Card>

      {legacyLeads.length > 0 && (
        <Card>
          <CardHead
            title={'Leads arquivados / legado · ' + legacyLeads.length}
            sub="contexto preservado para leitura; pipeline ou etapa arquivada nunca vira alvo de mutação"
          />
          <div className="grid gap-2 p-5 md:grid-cols-2 xl:grid-cols-3">
            {legacyLeads.map((lead) => <LegacyLeadCard key={lead.id} lead={lead} />)}
          </div>
        </Card>
      )}

      {lossTarget && (
        <Modal
          open
          title="Registrar perda do Lead"
          onClose={() => {
            if (!movingLeadId) {
              setLossTarget(null);
              setLossReason('');
              setLossError(null);
            }
          }}
        >
          <div className="space-y-4">
            <div className="border border-line bg-deep p-3">
              <p className="font-semibold text-[13px]">{contactLabel(lossTarget.lead)}</p>
              <p className="mt-1 text-[11.5px] text-fog">
                Destino: {lossTarget.stage.name}. O motivo é obrigatório antes da transição canônica.
              </p>
            </div>
            <Field label="Motivo da perda · obrigatório">
              <Input
                value={lossReason}
                onChange={(event) => {
                  setLossReason(event.target.value);
                  if (lossError) setLossError(null);
                }}
                placeholder="Ex.: não deseja seguir neste momento"
                disabled={movingLeadId === lossTarget.lead.id}
              />
            </Field>
            {lossError && <p className="text-[11.5px] text-pulse">{lossError}</p>}
            <div className="flex justify-end gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setLossTarget(null);
                  setLossReason('');
                  setLossError(null);
                }}
                disabled={movingLeadId === lossTarget.lead.id}
              >
                Cancelar
              </Btn>
              <Btn
                onClick={() => void confirmLoss()}
                disabled={!lossReason.trim() || movingLeadId === lossTarget.lead.id}
              >
                {movingLeadId === lossTarget.lead.id ? 'Registrando…' : 'Confirmar perda'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
