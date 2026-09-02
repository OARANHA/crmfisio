import { Crm } from './Crm';
import { TreatmentContinuityWatch } from '../components/TreatmentContinuityWatch';

export function CrmOperational() {
  return (
    <div className="space-y-4">
      <TreatmentContinuityWatch />
      <Crm />
    </div>
  );
}
