import { ConsentTemplatesAdmin } from '../components/ConsentTemplatesAdmin';
import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { Config } from './Config';

export function ConfigPremium() {
  return (
    <div className="space-y-6">
      <InfrastructureAdmin />
      <ConsentTemplatesAdmin />
      <Config />
    </div>
  );
}
