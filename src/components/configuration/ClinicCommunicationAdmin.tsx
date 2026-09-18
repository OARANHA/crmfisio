import { useCallback, useEffect, useState } from 'react';
import { AutomationControlPanel } from '../messages/AutomationControlPanel';
import { MessageTemplatesEditor } from '../messages/MessageTemplatesEditor';
import {
  isCurrentClinicEntitlementAllowed,
  loadCurrentClinicEntitlementState,
  type CurrentClinicEntitlementState,
} from '../../lib/clinicEntitlement';
import { useCurrentUserAccess } from '../../lib/currentUserAccess';
import { loadMessageTemplates, saveMessageTemplate, type MessageTemplateRow } from '../../lib/messageOutbox';
import { isClinicManager } from '../../lib/permissions';
import { useToast } from '../../lib/toastContext';
import { Btn, Chip } from '../../lib/ui';

export function ClinicCommunicationAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const canManage = isClinicManager(user?.role);
  const [entitlement, setEntitlement] = useState<CurrentClinicEntitlementState | null>(null);
  const [loading, setLoading] = useState(canManage);
  const [error, setError] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplateRow[]>([]);
  const [templateBusy, setTemplateBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(false);
    setEntitlement(null);
    try {
      const nextEntitlement = await loadCurrentClinicEntitlementState('whatsapp.access');
      setEntitlement(nextEntitlement);
      if (isCurrentClinicEntitlementAllowed(nextEntitlement)) {
        setTemplates(await loadMessageTemplates());
      } else {
        setTemplates([]);
      }
    } catch (cause) {
      console.error('[MedicsPro] configuração de comunicação:', cause);
      setEntitlement(null);
      setError(true);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (canManage) void refresh();
  }, [canManage, refresh]);

  if (!canManage) {
    return <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Configurações indisponíveis para o acesso atual.</div>;
  }

  const allowed = entitlement ? isCurrentClinicEntitlementAllowed(entitlement) : false;

  const persistTemplate = async (id: string, body: string) => {
    setTemplateBusy(true);
    try {
      await saveMessageTemplate(id, body);
      setTemplates(await loadMessageTemplates());
      toast('Modelo salvo e alteração registrada na auditoria.');
    } catch (cause) {
      console.error('[MedicsPro] salvar template de comunicação:', cause);
      toast('Não foi possível salvar o modelo de comunicação.', 'warn');
    } finally {
      setTemplateBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="border-b border-line/70 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-aqua">Comunicação</p>
        <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[23px] font-bold tracking-tight">Regras de comunicação da clínica</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">Configure somente comportamentos já suportados pelo MedicsPro. A disponibilidade do produto continua sendo definida pelo entitlement da plataforma.</p>
          </div>
          {allowed && <Chip className="border-mint/40 text-mint">Módulo liberado</Chip>}
        </div>
      </header>

      {loading && <div className="rounded-[20px] border border-line bg-panel p-6 text-[12px] text-fog">Validando disponibilidade de Mensagens / WhatsApp…</div>}

      {!loading && error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-amber/35 bg-amber/[0.05] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber">Validação indisponível</p>
            <p className="mt-1 text-[12px] text-fog">Não foi possível confirmar e carregar a configuração da clínica. A área permanece bloqueada por segurança.</p>
          </div>
          <Btn variant="ghost" onClick={() => void refresh()}>Tentar novamente</Btn>
        </div>
      )}

      {!loading && entitlement && !allowed && (
        <div className="rounded-[20px] border border-line bg-panel p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">Módulo não liberado</p>
          <h3 className="mt-1 font-display text-[18px] font-semibold">Mensagens / WhatsApp não está disponível para esta clínica</h3>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-fog">A disponibilidade é controlada pelo MedicsPro Platform Admin. Nenhuma regra existente foi apagada; esta clínica apenas não pode alterar a configuração enquanto o módulo estiver fora do entitlement efetivo.</p>
        </div>
      )}

      {!loading && entitlement && allowed && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <AutomationControlPanel onToast={toast} />
          <MessageTemplatesEditor templates={templates} busy={templateBusy} onSave={persistTemplate} />
        </div>
      )}
    </div>
  );
}
