import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadAvailableClinicalInstrumentPatientDelivery,
  loadClinicalInstrumentPatientDeliveries,
  sendClinicalInstrumentPatientDelivery,
  type ClinicalInstrumentPatientDeliveryOption,
  type ClinicalInstrumentPatientDeliveryStatus,
} from "../lib/clinicalInstrumentPatientDelivery";
import { useToast } from "../lib/toastContext";
import { Chip } from "../lib/ui";

type Props = {
  appointmentId: string;
  onStatusRefresh?: () => void;
};

type LoadState = "loading" | "ready" | "error";

function deliveryStatusLabel(
  item: ClinicalInstrumentPatientDeliveryStatus,
): string {
  if (item.processed) return "resultado processado";
  if (item.status === "submitted")
    return "respondido · aguardando processamento";
  if (item.status === "opened") return "link aberto";
  if (item.status === "pending") return "aguardando resposta";
  return item.status.replace(/_/g, " ");
}

export function ClinicalInstrumentPatientDelivery({
  appointmentId,
  onStatusRefresh,
}: Props) {
  const { toast } = useToast();
  const [available, setAvailable] = useState<
    ClinicalInstrumentPatientDeliveryOption[]
  >([]);
  const [deliveries, setDeliveries] = useState<
    ClinicalInstrumentPatientDeliveryStatus[]
  >([]);
  const [state, setState] = useState<LoadState>("loading");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [requestIds, setRequestIds] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);

  const reload = useCallback(
    async (refreshHistory = false) => {
      const [nextAvailable, nextDeliveries] = await Promise.all([
        loadAvailableClinicalInstrumentPatientDelivery(appointmentId),
        loadClinicalInstrumentPatientDeliveries(appointmentId),
      ]);
      setAvailable(nextAvailable);
      setDeliveries(nextDeliveries);
      setState("ready");
      if (refreshHistory) onStatusRefresh?.();
    },
    [appointmentId, onStatusRefresh],
  );

  useEffect(() => {
    let active = true;
    setState("loading");
    setAvailable([]);
    setDeliveries([]);
    setSendError(null);
    setRequestIds({});

    void Promise.all([
      loadAvailableClinicalInstrumentPatientDelivery(appointmentId),
      loadClinicalInstrumentPatientDeliveries(appointmentId),
    ])
      .then(([nextAvailable, nextDeliveries]) => {
        if (!active) return;
        setAvailable(nextAvailable);
        setDeliveries(nextDeliveries);
        setState("ready");
      })
      .catch((error) => {
        console.error(
          "[MedicsPro] entrega de instrumentos ao paciente:",
          error,
        );
        if (!active) return;
        setAvailable([]);
        setDeliveries([]);
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [appointmentId]);

  const latestByInstrument = useMemo(() => {
    const latest = new Map<string, ClinicalInstrumentPatientDeliveryStatus>();
    for (const item of deliveries) {
      if (!latest.has(item.instrumentKey)) latest.set(item.instrumentKey, item);
    }
    return latest;
  }, [deliveries]);

  const send = async (item: ClinicalInstrumentPatientDeliveryOption) => {
    if (busyKey) return;
    const requestId = requestIds[item.instrumentKey] ?? crypto.randomUUID();
    if (!requestIds[item.instrumentKey]) {
      setRequestIds((current) => ({
        ...current,
        [item.instrumentKey]: requestId,
      }));
    }

    setBusyKey(item.instrumentKey);
    setSendError(null);
    try {
      const delivery = await sendClinicalInstrumentPatientDelivery({
        appointmentId,
        instrumentKey: item.instrumentKey,
        requestId,
        expiresHours: item.defaultExpiresHours,
      });
      setRequestIds((current) => {
        const next = { ...current };
        delete next[item.instrumentKey];
        return next;
      });
      toast(`${delivery.displayLabel} preparado para envio ao paciente.`);
      await reload(true);
    } catch (error) {
      console.error("[MedicsPro] enviar instrumento ao paciente:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível preparar o envio deste instrumento. Tente novamente.";
      setSendError(message);
      toast(message, "warn");
    } finally {
      setBusyKey(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="rounded-xl border border-line/65 bg-deep/30 px-4 py-3 text-[11.5px] text-fog">
        Verificando instrumentos disponíveis para envio ao paciente…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] px-4 py-3">
        <p className="text-[12px] font-semibold text-pulse">
          Envio ao paciente indisponível
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fog">
          Não foi possível confirmar a autorização e o contrato de entrega.
          Nenhum envio foi liberado.
        </p>
      </div>
    );
  }

  if (available.length === 0 && deliveries.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4"
      aria-label="Enviar instrumento ao paciente"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">
            Instrumentos clínicos · patient self
          </p>
          <h3 className="mt-1 font-display text-[16px] font-semibold text-paper">
            Enviar ao paciente
          </h3>
          <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-fog">
            Somente instrumentos com contrato remoto versionado e habilitados
            pela clínica aparecem aqui. O paciente recebe um link individual por
            WhatsApp; o prontuário não é exposto.
          </p>
        </div>
        <Chip className="border-aqua/30 text-aqua">contrato server-side</Chip>
      </div>

      {available.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {available.map((item) => {
            const latest = latestByInstrument.get(item.instrumentKey);
            const busy = busyKey === item.instrumentKey;
            return (
              <div
                key={`${item.instrumentKey}:${item.engineRuleVersion}`}
                className="rounded-xl border border-line/70 bg-panel p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-[14px] font-semibold text-paper">
                      {item.displayLabel}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-fog">
                      versão {item.engineRuleVersion} · link por até{" "}
                      {item.defaultExpiresHours}h
                    </p>
                  </div>
                  {latest && (
                    <Chip
                      className={
                        latest.processed
                          ? "border-mint/30 text-mint"
                          : "border-aqua/30 text-aqua"
                      }
                    >
                      {deliveryStatusLabel(latest)}
                    </Chip>
                  )}
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyKey)}
                  onClick={() => void send(item)}
                  className="mt-3 rounded-lg bg-aqua px-3.5 py-2 text-[11px] font-semibold text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Preparando…" : "Enviar ao paciente"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sendError && (
        <div className="mt-3 rounded-xl border border-pulse/30 bg-pulse/[0.04] px-3 py-2.5 text-[11.5px] text-pulse">
          {sendError}
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog">
                Envios deste atendimento
              </p>
              <p className="mt-1 text-[11px] text-fog">
                A projeção não expõe respostas brutas, token, mensagem do
                WhatsApp ou internals da engine.
              </p>
            </div>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => void reload(true)}
              className="rounded-lg border border-line/70 px-3 py-1.5 text-[10.5px] font-semibold text-fog hover:text-paper disabled:opacity-50"
            >
              Atualizar status
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {deliveries.slice(0, 6).map((item) => (
              <li
                key={item.inviteId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line/60 bg-deep/25 px-3 py-2.5 text-[10.5px] text-fog"
              >
                <span className="font-semibold text-paper">
                  {item.displayLabel}
                </span>
                <Chip
                  className={
                    item.processed
                      ? "border-mint/30 text-mint"
                      : "border-aqua/30 text-aqua"
                  }
                >
                  {deliveryStatusLabel(item)}
                </Chip>
                <span>
                  criado em {new Date(item.createdAt).toLocaleString("pt-BR")}
                </span>
                <span>
                  expira em {new Date(item.expiresAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
