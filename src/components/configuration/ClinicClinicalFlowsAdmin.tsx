import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentClinicClinicalFlowSettings,
  updateCurrentClinicClinicalFlowSettings,
  type ClinicClinicalFlowSettings,
} from '../../lib/clinicClinicalFlowSettings';
import { useCurrentUserAccess } from '../../lib/currentUserAccess';
import { useToast } from '../../lib/toastContext';
import { Btn } from '../../lib/ui';

const DEFAULT_SETTINGS: ClinicClinicalFlowSettings = {
  referralAuthoringEnabled: true,
  updatedAt: null,
};

export function ClinicClinicalFlowsAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const [settings, setSettings] = useState<ClinicClinicalFlowSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSettings(await getCurrentClinicClinicalFlowSettings());
    } catch (loadError) {
      console.error('[MedicsPro] políticas de fluxos clínicos:', loadError);
      setError('Não foi possível carregar as políticas de fluxos clínicos da clínica.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      const updated = await updateCurrentClinicClinicalFlowSettings(settings.referralAuthoringEnabled);
      setSettings(updated);
      toast('Políticas de fluxos clínicos atualizadas.');
    } catch (saveError) {
      console.error('[MedicsPro] salvar políticas de fluxos clínicos:', saveError);
      toast('Não foi possível salvar as políticas de fluxos clínicos.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Carregando políticas de fluxos clínicos…</div>;
  }

  if (!user) {
    return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Configurações indisponíveis para o acesso atual.</div>;
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-line/70 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Fluxos clínicos</p>
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[23px] font-bold tracking-tight">Políticas institucionais</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Defina quais fluxos clínicos a clínica disponibiliza. Essas preferências só podem restringir a operação: identidade clínica, capability, tenant e demais regras de autorização continuam obrigatórias no servidor.</p>
          </div>
          {!canManage && <span className="w-fit rounded-full border border-line px-3 py-1 text-[10px] font-medium text-fog">Somente leitura</span>}
        </div>
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-pulse/30 bg-pulse/[0.05] px-4 py-3 text-[11.5px] text-pulse">
          <span>{error}</span>
          <Btn variant="ghost" onClick={() => void load()}>Tentar novamente</Btn>
        </div>
      ) : (
        <section className="rounded-[20px] border border-line bg-panel p-5 md:p-6" aria-labelledby="clinic-referral-policy-title">
          <div className="mb-5 border-b border-line/60 pb-4">
            <h3 id="clinic-referral-policy-title" className="font-display text-[17px] font-semibold">Encaminhamentos</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fog">Controle institucional do fluxo de encaminhamento. Documentos já emitidos e o histórico clínico não são apagados nem reescritos quando a política é alterada.</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-line/70 bg-deep/25 p-4">
            <input
              type="checkbox"
              checked={settings.referralAuthoringEnabled}
              disabled={!canManage}
              onChange={(event) => setSettings((current) => ({ ...current, referralAuthoringEnabled: event.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-mint"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-paper">Permitir que profissionais emitam encaminhamentos</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-fog">Quando desativado, novos encaminhamentos não podem ser criados, alterados ou emitidos. O bloqueio é aplicado no PostgreSQL e não substitui as permissões clínicas individuais.</span>
            </span>
          </label>

          <div className="mt-4 rounded-[14px] border border-line/60 bg-deep/20 px-4 py-3 text-[10.5px] leading-relaxed text-fog">
            Alterar esta opção não concede acesso ao prontuário, não cria care relationship e não modifica encaminhamentos já emitidos.
          </div>

          {canManage && (
            <div className="mt-5 flex justify-end border-t border-line/60 pt-4">
              <Btn onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar políticas'}</Btn>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
