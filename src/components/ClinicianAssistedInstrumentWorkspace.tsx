import { useState } from "react";
import type { ClinicianAssistedAdministration } from "../lib/clinicalInstrumentClinicianAssisted";
import { ClinicianAssistedInstrumentApplyNow } from "./ClinicianAssistedInstrumentApplyNow";
import { ClinicalInstrumentPatientDelivery } from "./ClinicalInstrumentPatientDelivery";
import { ClinicianAssistedInstrumentHistory } from "./ClinicianAssistedInstrumentHistory";

export function ClinicianAssistedInstrumentWorkspace({
  appointmentId,
  patientId,
}: {
  appointmentId: string;
  patientId: string;
}) {
  const [historyRevision, setHistoryRevision] = useState(0);

  const handleRecorded = (_administration: ClinicianAssistedAdministration) => {
    setHistoryRevision((current) => current + 1);
  };

  return (
    <div className="space-y-4">
      <ClinicianAssistedInstrumentApplyNow
        appointmentId={appointmentId}
        onRecorded={handleRecorded}
      />
      <ClinicalInstrumentPatientDelivery
        appointmentId={appointmentId}
        onStatusRefresh={() => setHistoryRevision((current) => current + 1)}
      />
      <ClinicianAssistedInstrumentHistory
        patientId={patientId}
        refreshKey={historyRevision}
        presentation="embedded"
      />
    </div>
  );
}
