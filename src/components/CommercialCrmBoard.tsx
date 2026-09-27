import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  executeCommercialCrmProspectResolution,
  executeCommercialCrmStageTransition,
  listCurrentClinicCrmContactIdentityCandidates,
  loadCurrentClinicCommercialCrm,
  type CommercialCrmIdentityCandidate,
  type CommercialCrmIdentityResolutionMode,
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

const IDENTITY_REASON_LABEL: Record<string, string> = {
  phone_exact: 'telefone exato',
  phone_br_legacy: 'variante histórica de telefone',
  email_exact: 'e-mail exato',
};

function identityReasonLabel(reason: string): string {
  return IDENTITY_REASON_LABEL[reason] ?? reason.replace(/_/g, ' ');
}

function hasSplitSignalConflict(candidates: CommercialCrmIdentityCandidate[]): boolean {
  const phoneIds = new Set(
    candidates
      .filter((candidate) => candidate.matchReasons.some((reason) => reason.startsWith('phone_')))
      .map((candidate) => candidate.contactId),
  );
  const emailIds = new Set(
    candidates
      .filter((candidate) => candidate.matchReasons.includes('email_exact'))
      .map((candidate) => candidate.contactId),
  );

  return phoneIds.size > 0
    && emailIds.size > 0
    && !Array.from(phoneIds).some((contactId) => emailIds.has(contactId));
}

function crmErrorContains(error: unknown, marker: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  return [record.message, record.details, record.hint]
    .some((value) => typeof value === 'string' && value.includes(marker));
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
  const [prospectOpen, setProspectOpen] = useState(false);
  const [prospectIds, setProspectIds] = useState<{ contactId: string; leadId: string } | null>(null);
  const [prospectName, setProspectName] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectTitle, setProspectTitle] = useState('');
  const [prospectPipelineId, setProspectPipelineId] = useState('');
  const [prospectCandidates, setProspectCandidates] = useState<CommercialCrmIdentityCandidate[] | null>(null);
  const [prospectDistinctReason, setProspectDistinctReason] = useState('');
  const [prospectRetryIntent, setProspectRetryIntent] = useState<{
    mode: CommercialCrmIdentityResolutionMode;
    selectedContactId: string | null;
    distinctReason: string | null;
  } | null>(null);
  const [prospectError, setProspectError] = useState<string | null>(null);
  const [creatingProspect, setCreatingProspect] = useState(false);
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

  const resetProspectForm = () => {
    setProspectIds(null);
    setProspectName('');
    setProspectPhone('');
    setProspectEmail('');
    setProspectTitle('');
    setProspectPipelineId('');
    setProspectCandidates(null);
    setProspectDistinctReason('');
    setProspectRetryIntent(null);
    setProspectError(null);
  };

  const closeProspect = () => {
    if (creatingProspect) return;
    setProspectOpen(false);
    resetProspectForm();
  };

  const openProspect = () => {
    if (!canMutate || activePipelines.length === 0) return;
    setProspectIds({
      contactId: crypto.randomUUID(),
      leadId: crypto.randomUUID(),
    });
    setProspectName('');
    setProspectPhone('');
    setProspectEmail('');
    setProspectTitle('');
    setProspectPipelineId(choosePipeline(activePipelines, selectedPipelineId) ?? '');
    setProspectCandidates(null);
    setProspectDistinctReason('');
    setProspectRetryIntent(null);
    setProspectError(null);
    setProspectOpen(true);
  };

  const prospectDraft = () => {
    if (!prospectIds) return null;
    const name = prospectName.trim();
    const title = prospectTitle.trim();
    const pipelineId = prospectPipelineId || null;
    if (!name || !title || !pipelineId) {
      setProspectError('Informe nome, interesse comercial e pipeline.');
      return null;
    }

    return {
      ...prospectIds,
      name,
      phone: prospectPhone,
      email: prospectEmail,
      title,
      pipelineId,
    };
  };

  const applyProspectSuccess = (
    outcome: Awaited<ReturnType<typeof executeCommercialCrmProspectResolution>>,
  ) => {
    if (outcome.snapshot) applySnapshot(outcome.snapshot);
    if (outcome.projectionWarning) {
      toast(outcome.projectionWarning, 'warn');
    } else if (outcome.command.resolutionMode === 'explicit_reuse') {
      toast('Novo Lead criado no Contact selecionado.');
    } else {
      toast('Prospect criado no CRM comercial.');
    }
    setProspectOpen(false);
    resetProspectForm();
  };

  const refreshIdentityCandidatesAfterServerRejection = async (): Promise<void> => {
    try {
      const candidates = await listCurrentClinicCrmContactIdentityCandidates({
        phone: prospectPhone,
        email: prospectEmail,
      });
      setProspectCandidates(candidates.length > 0 ? candidates : null);
    } catch {
      setProspectCandidates(null);
    }
  };

  const handleProspectResolutionError = async (
    error: unknown,
    retryIntent: {
      mode: CommercialCrmIdentityResolutionMode;
      selectedContactId: string | null;
      distinctReason: string | null;
    },
  ) => {
    if (
      crmErrorContains(error, 'crm_contact_identity_resolution_required')
      || crmErrorContains(error, 'crm_selected_contact_not_identity_candidate')
      || crmErrorContains(error, 'crm_explicit_distinct_requires_candidate')
      || crmErrorContains(error, 'crm_contact_not_found')
    ) {
      setProspectRetryIntent(null);
      await refreshIdentityCandidatesAfterServerRejection();
      setProspectError(
        'A situação dos possíveis contatos mudou no servidor. Revise os candidatos atuais antes de continuar; nenhuma escolha foi feita automaticamente.',
      );
      return;
    }

    if (crmErrorContains(error, 'crm_prospect_resolution_idempotency_conflict')) {
      setProspectRetryIntent(null);
      setProspectError(
        'Esta tentativa já possui um contrato diferente no servidor. Feche este rascunho e inicie outro somente depois de confirmar o estado atual do CRM.',
      );
      return;
    }

    setProspectRetryIntent(retryIntent);
    setProspectError(
      'A resposta do servidor ficou incerta. Repita exatamente a mesma tentativa; os mesmos IDs e a mesma decisão serão reutilizados sem refazer o preview.',
    );
    toast('Não foi possível confirmar a criação do prospect. Tente novamente com a mesma decisão.', 'warn');
  };

  const runProspectResolution = async (
    mode: CommercialCrmIdentityResolutionMode,
    selectedContactId: string | null = null,
    distinctReason: string | null = null,
  ) => {
    if (!canMutate || creatingProspect) return;
    const draft = prospectDraft();
    if (!draft) return;

    if (mode === 'explicit_distinct' && !distinctReason?.trim()) {
      setProspectError('Informe por que este Contact deve ser tratado como distinto.');
      return;
    }

    const retryIntent = {
      mode,
      selectedContactId,
      distinctReason: distinctReason?.trim() || null,
    };

    setCreatingProspect(true);
    setProspectError(null);
    try {
      const outcome = await executeCommercialCrmProspectResolution({
        ...draft,
        resolutionMode: mode,
        selectedContactId,
        distinctReason,
      });
      applyProspectSuccess(outcome);
    } catch (error) {
      await handleProspectResolutionError(error, retryIntent);
    } finally {
      setCreatingProspect(false);
    }
  };

  const verifyProspectIdentity = async () => {
    if (!canMutate || creatingProspect || prospectRetryIntent) return;
    const draft = prospectDraft();
    if (!draft) return;

    setCreatingProspect(true);
    setProspectError(null);

    let candidates: CommercialCrmIdentityCandidate[];
    try {
      candidates = await listCurrentClinicCrmContactIdentityCandidates({
        phone: draft.phone,
        email: draft.email,
      });
    } catch {
      setProspectError(
        'Não foi possível verificar possíveis Contacts agora. Nenhum cadastro foi enviado. Tente novamente.',
      );
      setCreatingProspect(false);
      return;
    }

    if (candidates.length > 0) {
      setProspectCandidates(candidates);
      setCreatingProspect(false);
      return;
    }

    const retryIntent = {
      mode: 'create_if_clear' as const,
      selectedContactId: null,
      distinctReason: null,
    };

    try {
      const outcome = await executeCommercialCrmProspectResolution({
        ...draft,
        resolutionMode: retryIntent.mode,
        selectedContactId: retryIntent.selectedContactId,
        distinctReason: retryIntent.distinctReason,
      });
      applyProspectSuccess(outcome);
    } catch (error) {
      if (crmErrorContains(error, 'crm_contact_identity_resolution_required')) {
        setProspectRetryIntent(null);
        await refreshIdentityCandidatesAfterServerRejection();
        setProspectError(
          'O servidor encontrou uma ambiguidade nova. Revise os candidatos antes de continuar; nenhum Contact foi selecionado automaticamente.',
        );
      } else {
        await handleProspectResolutionError(error, retryIntent);
      }
    } finally {
      setCreatingProspect(false);
    }
  };

  const retryProspectResolution = () => {
    if (!prospectRetryIntent || creatingProspect) return;
    void runProspectResolution(
      prospectRetryIntent.mode,
      prospectRetryIntent.selectedContactId,
      prospectRetryIntent.distinctReason,
    );
  };

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
      toast('Não foi possível confirmar a mudança do Lead. Atualize o quadro antes de tentar novamente.', 'warn');
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
            <div className="flex items-center gap-2">
              {canMutate && activePipelines.length > 0 && (
                <Btn
                  className="!px-3 !py-1.5 !text-[11px]"
                  onClick={openProspect}
                >
                  Novo prospect
                </Btn>
              )}
              <Btn
                variant="ghost"
                className="!px-3 !py-1.5 !text-[11px]"
                onClick={() => void refresh(false).catch(() => undefined)}
              >
                Atualizar
              </Btn>
            </div>
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

      {prospectOpen && prospectIds && (
        <Modal
          open
          title="Novo prospect comercial"
          onClose={closeProspect}
        >
          <div className="space-y-4">
            <div className="border border-aqua/25 bg-aqua/5 px-3 py-2.5 text-[11.5px] text-fog">
              Verifica possíveis Contacts pela projection canônica e resolve Contact + novo Lead no servidor.
              Nenhuma correspondência é escolhida automaticamente e nenhum Patient é criado.
            </div>
            <Field label="Nome do contato · obrigatório">
              <Input
                value={prospectName}
                onChange={(event) => {
                  setProspectName(event.target.value);
                  if (prospectError) setProspectError(null);
                }}
                placeholder="Nome do contato"
                disabled={creatingProspect || Boolean(prospectRetryIntent)}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Telefone">
                <Input
                  value={prospectPhone}
                  onChange={(event) => {
                    setProspectPhone(event.target.value);
                    setProspectCandidates(null);
                    setProspectDistinctReason('');
                    if (prospectError) setProspectError(null);
                  }}
                  placeholder="Telefone (opcional)"
                  disabled={creatingProspect || Boolean(prospectRetryIntent)}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  value={prospectEmail}
                  onChange={(event) => {
                    setProspectEmail(event.target.value);
                    setProspectCandidates(null);
                    setProspectDistinctReason('');
                    if (prospectError) setProspectError(null);
                  }}
                  placeholder="E-mail (opcional)"
                  disabled={creatingProspect || Boolean(prospectRetryIntent)}
                />
              </Field>
            </div>
            <Field label="Interesse / assunto comercial · obrigatório">
              <Input
                value={prospectTitle}
                onChange={(event) => {
                  setProspectTitle(event.target.value);
                  if (prospectError) setProspectError(null);
                }}
                placeholder="Interesse / assunto comercial"
                disabled={creatingProspect || Boolean(prospectRetryIntent)}
              />
            </Field>
            <Field label="Pipeline · obrigatório">
              <Select
                value={prospectPipelineId}
                onChange={(event) => {
                  setProspectPipelineId(event.target.value);
                  if (prospectError) setProspectError(null);
                }}
                disabled={creatingProspect || Boolean(prospectRetryIntent)}
              >
                {activePipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name + (pipeline.isDefault ? ' · padrão' : '')}
                  </option>
                ))}
              </Select>
            </Field>

            {prospectCandidates && prospectCandidates.length > 0 && (
              <div className="space-y-3 border border-amber/35 bg-amber/[0.04] p-3">
                <div>
                  <p className="font-display text-[13px] font-semibold">Decisão de identidade necessária</p>
                  <p className="mt-1 text-[11.5px] text-fog">
                    O servidor encontrou {prospectCandidates.length} Contact(s) candidato(s). Revise os sinais abaixo;
                    eles não afirmam que os registros representam a mesma pessoa.
                  </p>
                </div>

                {hasSplitSignalConflict(prospectCandidates) && (
                  <p className="border border-pulse/35 bg-pulse/[0.05] px-3 py-2 text-[11.5px] text-pulse">
                    Conflito de sinais: telefone e e-mail apontam para Contacts diferentes. O sistema não escolheu nenhum automaticamente.
                  </p>
                )}

                <div className="space-y-2">
                  {prospectCandidates.map((candidate) => (
                    <div key={candidate.contactId} className="border border-line bg-panel p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[13px] font-semibold">{candidate.displayName || 'Contact sem nome'}</p>
                          {(candidate.phone || candidate.email) && (
                            <p className="mt-1 font-mono text-[10.5px] text-fog">
                              {[candidate.phone, candidate.email].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {candidate.matchReasons.map((reason) => (
                              <Chip key={reason}>{identityReasonLabel(reason)}</Chip>
                            ))}
                            {candidate.openLeadCount > 0 && (
                              <Chip className="border-amber/45 text-amber">
                                {candidate.openLeadCount} Lead(s) aberto(s)
                              </Chip>
                            )}
                          </div>
                        </div>
                        <Btn
                          className="!px-3 !py-1.5 !text-[11px]"
                          onClick={() => void runProspectResolution('explicit_reuse', candidate.contactId)}
                          disabled={creatingProspect || Boolean(prospectRetryIntent)}
                        >
                          Criar novo Lead neste Contact
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-line pt-3">
                  <p className="text-[11.5px] text-fog">
                    Se nenhum candidato representa o Contact deste novo prospect, registre explicitamente por que ele deve ser tratado como distinto.
                  </p>
                  <div className="mt-2">
                    <Field label="Razão para Contact distinto · obrigatória">
                      <Input
                        value={prospectDistinctReason}
                        onChange={(event) => {
                          setProspectDistinctReason(event.target.value);
                          if (prospectError) setProspectError(null);
                        }}
                        placeholder="Explique por que este Contact é distinto"
                        disabled={creatingProspect || Boolean(prospectRetryIntent)}
                      />
                    </Field>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Btn
                      variant="subtle"
                      onClick={() => void runProspectResolution('explicit_distinct', null, prospectDistinctReason)}
                      disabled={!prospectDistinctReason.trim() || creatingProspect || Boolean(prospectRetryIntent)}
                    >
                      Criar Contact distinto + Lead
                    </Btn>
                  </div>
                </div>
              </div>
            )}

            {prospectError && <p className="text-[11.5px] text-pulse">{prospectError}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={closeProspect} disabled={creatingProspect || Boolean(prospectRetryIntent)}>
                Cancelar
              </Btn>
              {prospectRetryIntent ? (
                <Btn
                  onClick={retryProspectResolution}
                  disabled={creatingProspect}
                >
                  {creatingProspect ? 'Repetindo…' : 'Repetir mesma tentativa'}
                </Btn>
              ) : !prospectCandidates ? (
                <Btn
                  onClick={() => void verifyProspectIdentity()}
                  disabled={!prospectName.trim() || !prospectTitle.trim() || !prospectPipelineId || creatingProspect}
                >
                  {creatingProspect ? 'Verificando…' : 'Verificar e continuar'}
                </Btn>
              ) : null}
            </div>
          </div>
        </Modal>
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
