import { AssessmentTemplatesAdmin } from '../components/AssessmentTemplatesAdmin';
import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { TeamAdmin } from '../components/TeamAdmin';
import { Config } from './Config';

export function ConfigPremium() {
  return (
    <div className="space-y-6">
      <InfrastructureAdmin />
      <TeamAdmin />
      <AssessmentTemplatesAdmin />
      <ConsentTemplatesAdmin />
      <Config />
    </div>
  );
}
