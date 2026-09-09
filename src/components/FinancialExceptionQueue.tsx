import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { financialExceptionReasonLabel, type FinancialException } from '../lib/financialExceptionResolution';
import {
  canChargeFinancialException,
  canListFinancialExceptions,
  canWaiveFinancialException,
} from '../lib/permissions';
import { useToast } from '../lib/toastContext';
import { fmtBRL } from '../lib/types';
import { Btn, Card, CardHead, Chip, Field, Input, Modal } from '../lib/ui';

export function FinancialExceptionQueue() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const {
    financialExceptions,
    financialExceptionsLoading,
    financialExceptionsError,
    refreshFinancialExceptions,
    resolveFinancialException,
  } = useFinance();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<FinancialException | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const role = user?.role;
  if (!canListFinancialExceptions(role)) return null;

  const charge = async (item: FinancialException) => {
    setResolvingId(item.id);
    try {
      await resolveFinancialException(item.id, 'charge');
      toast('Cobrança gerada e pendência de cobertura resolvida.');
    } catch (error) {
      console.error('[MedicsPro] resolver pendência com cobrança:', error);
      toast('Não foi possível gerar a cobrança desta pendência.', 'warn');
    } finally {
      setResolvingId(null);
    }
  };

  const confirmWaive = async () => {
    if (!waiveTarget) return;
    const reason = waiveReason.trim();
    if (!reason) {
      setWaiveError('Informe o motivo da cortesia.');
      return;
    }

    setResolvingId(waiveTarget.id);
    setWaiveError(null);
    try {
      await resolveFinancialException(waiveTarget.id, 'waived', reason);
      toast('Cortesia registrada e pendência de cobertura resolvida.');
      setWaiveTarget(null);
      setWaiveReason('');
    } catch (error) {
      console.error('[MedicsPro] resolver pendência com cortesia:', error);
      setWaiveError('Não foi possível registrar a cortesia. A pendência permanece aberta.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Card>
      <CardHead
        title={`Pendências de cobertura · ${financialExceptions.length}`}
        sub="atendimentos finalizados cuja cobertura de pacote não pôde ser materializada"
        right={(
          <Btn
            variant="ghost"
            className="!px-3 !py-1.5 !text-[11px]"
            onClick={() => void refreshFinancialExceptions()}
            disabled={financialExceptionsLoading}
          >
            {financialExceptionsLoading ? 'Atualizando…' : 'Atualizar'}
          </Btn>
        )}
      />

      {financialExceptionsError && (
        <div className="mx-5 mb-4 border border-pulse/35 bg-pulse/[0.05] px-4 py-3 text-[12px] text-pulse">
          {financialExceptionsError}
        </div>
      )}

      <ul className="divide-y divide-line/70">
        {!financialExceptionsLoading && financialExceptions.length === 0 && !financialExceptionsError && (
          <li className="px-5 py-6 text-[12px] text-fog">Nenhuma pendência de cobertura aguardando decisão.</li>
        )}
        {financialExceptions.map((item) => {
          const busy = resolvingId === item.id;
          return (
            <li key={item.id} className="px-5 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-[14px]">{item.patientName}</p>
                    <Chip className="border-amber/45 text-amber">{financialExceptionReasonLabel(item.reasonCode)}</Chip>
                  </div>
                  <p className="mt-1 font-mono text-[10.5px] text-fog">
                    Atendimento {format(new Date(`${item.appointmentDate}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })}
                    {item.appointmentStart ? ` · ${item.appointmentStart.slice(0, 5)}` : ''}
                    {item.packageName ? ` · ${item.packageName}` : ''}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-fog/80">
                    Detectado em {format(new Date(item.detectedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <span className="mr-1 font-mono text-[13px] font-semibold text-amber">{fmtBRL(item.amount)}</span>
                  {canChargeFinancialException(role) && (
                    <Btn
                      className="!px-3 !py-1.5 !text-[11px]"
                      onClick={() => void charge(item)}
                      disabled={busy}
                    >
                      {busy ? 'Resolvendo…' : 'Gerar cobrança'}
                    </Btn>
                  )}
                  {canWaiveFinancialException(role) && (
                    <Btn
                      variant="subtle"
                      className="!px-3 !py-1.5 !text-[11px]"
                      onClick={() => {
                        setWaiveTarget(item);
                        setWaiveReason('');
                        setWaiveError(null);
                      }}
                      disabled={busy}
                    >
                      Conceder cortesia
                    </Btn>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {waiveTarget && (
        <Modal
          open
          onClose={() => {
            if (resolvingId !== waiveTarget.id) {
              setWaiveTarget(null);
              setWaiveReason('');
              setWaiveError(null);
            }
          }}
          title="Confirmar cortesia"
        >
          <div className="space-y-4">
            <div className="border border-line bg-deep p-3">
              <p className="font-semibold text-[13px]">{waiveTarget.patientName}</p>
              <p className="mt-1 text-[11.5px] text-fog">
                A cortesia será registrada por {fmtBRL(waiveTarget.amount)} e não criará um lançamento financeiro.
              </p>
            </div>
            <Field label="Motivo da cortesia · obrigatório">
              <Input
                value={waiveReason}
                onChange={(event) => {
                  setWaiveReason(event.target.value);
                  if (waiveError) setWaiveError(null);
                }}
                placeholder="Ex.: cortesia autorizada pela administração"
                disabled={resolvingId === waiveTarget.id}
              />
            </Field>
            {waiveError && <p className="text-[11.5px] text-pulse">{waiveError}</p>}
            <div className="flex justify-end gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setWaiveTarget(null);
                  setWaiveReason('');
                  setWaiveError(null);
                }}
                disabled={resolvingId === waiveTarget.id}
              >
                Cancelar
              </Btn>
              <Btn
                onClick={() => void confirmWaive()}
                disabled={!waiveReason.trim() || resolvingId === waiveTarget.id}
              >
                {resolvingId === waiveTarget.id ? 'Registrando…' : 'Confirmar cortesia'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
