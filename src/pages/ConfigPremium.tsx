import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { AutomationSettingsAdmin } from '../components/AutomationSettingsAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { StorageAdmin } from '../components/StorageAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { Config } from './Config';

export function ConfigPremium() {
  return (
    <div className="space-y-6">
      <AutomationSettingsAdmin />
      <InfrastructureAdmin />
      <TeamAdmin />
      <StorageAdmin />
      <AssessmentTemplatesAdmin />
      <ConsentTemplatesAdmin />
      <Config />
    </div>
  );
}
