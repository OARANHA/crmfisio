import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { StorageAdmin } from '../components/StorageAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { Config } from './Config';

export function ConfigPremium() {
  return (
    <div className="space-y-6">
      <InfrastructureAdmin />
      <TeamAdmin />
      <StorageAdmin />
      <AssessmentTemplatesAdmin />
      <ConsentTemplatesAdmin />
      <Config />
    </div>
  );
}
