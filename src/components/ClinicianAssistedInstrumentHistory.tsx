import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClinicalCapability } from "../hooks/useClinicalCapability";
import { useClinicDirectory } from "../lib/clinicDirectoryContext";
import {
  loadClinicalInstrumentHistory,
  type ClinicalInstrumentHistoryItem,
} from "../lib/clinicalInstrumentClinicianAssisted";
import { useCurrentUserAccess } from "../lib/currentUserAccess";
import { userName } from "../lib/displayNames";
import { getClinicianAssistedInstrumentDefinition } from "../lib/nexus/clinicianAssistedInstrumentCatalog";
import { isClinicManager } from "../lib/permissions";
import { Card, CardHead, Chip, Empty } from "../lib/ui";

type Props = {
  patientId: string;
  refreshKey?: number;
  presentation?: "card" | "embedded";
};

export function ClinicianAssistedInstrumentHistory({
  patientId,
  refreshKey = 0,
  presentation = "card",
}: Props) {
  const { user } = useCurrentUserAccess();
  const { users } = useClinicDirectory();
  const { allowed: canReadTimeline } = useClinicalCapability(
    "clinical.timeline.read",
    user?.id,
  );
  const [items, setItems] = useState<ClinicalInstrumentHistoryItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const clinicalRead = Boolean(
    user && (isClinicManager(user.role) || canReadTimeline),
  );

  useEffect(() => {
    let cancelled = false;
    if (!clinicalRead) {
      setItems([]);
      setState("ready");
      return () => {
        cancelled = true;
      };
    }

    setState("loading");
    void loadClinicalInstrumentHistory(patientId)
      .then((history) => {
        if (cancelled) return;
        setItems(history);
        setState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[MedicsPro] histórico clínico de instrumentos:", error);
        setItems([]);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [clinicalRead, patientId, refreshKey]);

  if (!clinicalRead) return null;

  const content =
    state === "loading" ? (
      <div className="px-5 py-5 text-[17px] text-fog">
        Carregando histórico de instrumentos…
      </div>
    ) : state === "error" ? (
      <HistoryUnavailable />
    ) : items.length === 0 ? (
      <Empty
        title="Nenhum instrumento registrado"
        sub="Resultados assistidos e respostas do próprio paciente aparecerão aqui depois do processamento e persistência server-side."
      />
    ) : (
      <HistoryList items={items} authorName={(id) => userName(users, id)} />
    );

  if (presentation === "embedded") {
    return (
      <section className="overflow-hidden rounded-2xl border border-line/70 bg-panel">
        <div className="border-b border-line/65 px-5 py-4">
          <h3 className="font-display text-[20px] font-semibold text-paper">
            Histórico de instrumentos
          </h3>
          <p className="mt-1 text-[16.5px] leading-relaxed text-fog">
            Aplicações assistidas e respostas do paciente, preservadas como
            contexto clínico longitudinal.
          </p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card>
      <CardHead
        title="Histórico de instrumentos"
        sub="Instrumentos clínicos preservados como contexto longitudinal, sem expor respostas ou payloads internos da engine."
      />
      {content}
    </Card>
  );
}

function HistoryList({
  items,
  authorName,
}: {
  items: ClinicalInstrumentHistoryItem[];
  authorName: (id: string) => string;
}) {
  return (
    <ul className="divide-y divide-line/70">
      {items.map((item) => (
        <HistoryRow
          key={item.id}
          item={item}
          authorName={authorName(item.professionalId)}
        />
      ))}
    </ul>
  );
}
function HistoryRow({
  item,
  authorName,
}: {
  item: ClinicalInstrumentHistoryItem;
  authorName: string;
}) {
  const acronym =
    getClinicianAssistedInstrumentDefinition(item.instrumentKey)?.acronym ??
    item.instrumentKey.toUpperCase();

  return (
    <li className="px-5 py-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-display text-[19px] font-semibold text-paper">
          {acronym}
        </span>
        <Chip className="border-mint/35 text-mint">
          {item.totalScore}/{item.maxScore}
        </Chip>
        <Chip className="border-aqua/35 text-aqua">
          {item.provenance === "patient_self"
            ? "respondido pelo paciente"
            : "aplicação assistida"}
        </Chip>
        <span className="text-[15px] text-fog">
          versão {item.engineRuleVersion}
        </span>
      </div>

      <p className="mt-3 text-[17px] font-medium leading-relaxed text-paper/90">
        {item.classification}
      </p>
      <p className="mt-1.5 text-[16.5px] leading-relaxed text-fog">
        {item.interpretation}
      </p>

      {item.hasSafetySignal && (
        <div
          className={`mt-3 rounded-xl border px-3.5 py-3 text-[16px] leading-relaxed ${item.hasCriticalSafetySignal ? "border-pulse/40 bg-pulse/[0.055] text-paper" : "border-amber/35 bg-amber/[0.045] text-paper"}`}
        >
          {item.hasCriticalSafetySignal
            ? "Sinal crítico de segurança registrado nesta aplicação."
            : "Sinal de segurança registrado nesta aplicação."}
        </div>
      )}
      <p className="mt-3 text-[15px] leading-relaxed text-fog">
        {format(new Date(item.completedAt), "dd MMM yyyy '·' HH:mm", {
          locale: ptBR,
        })}
        {" · "}por {authorName}
      </p>
      <p className="mt-1 text-[14.5px] leading-relaxed text-fog">
        Instrumento de rastreio. O resultado não estabelece diagnóstico nem
        conduta isoladamente.
      </p>
    </li>
  );
}

function HistoryUnavailable() {
  return (
    <div className="mx-5 my-5 rounded-xl border border-amber/30 bg-amber/[0.045] px-4 py-3 text-[16.5px] leading-relaxed text-fog">
      O histórico de instrumentos está temporariamente indisponível. O
      prontuário clínico e os demais registros permanecem acessíveis conforme
      sua autorização.
    </div>
  );
}
