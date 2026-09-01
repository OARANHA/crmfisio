import { InfrastructureAdmin } from '../components/InfrastructureAdmin';
import { Config } from './Config';

export function ConfigPremium() {
  return (
    <div className="space-y-6">
      <InfrastructureAdmin />
      <Config />
    </div>
  );
}
