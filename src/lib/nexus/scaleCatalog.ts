import type { NexusScaleDefinition } from './scaleRuntime';
import { HCL32_DEFINITION } from './hcl32';
import { AUDIT_DEFINITION, AUDITC_DEFINITION, CAGE_DEFINITION } from './alcoholScales';
import {
  ASRS18_DEFINITION,
  EPDS_DEFINITION,
  PHQ15_DEFINITION,
  SRQ20_DEFINITION,
  YBOCS_DEFINITION,
} from './mentalHealthScalesBatch2';

const catalog: Record<string, NexusScaleDefinition> = {
  [HCL32_DEFINITION.toolKey]: HCL32_DEFINITION,
  [AUDIT_DEFINITION.toolKey]: AUDIT_DEFINITION,
  [AUDITC_DEFINITION.toolKey]: AUDITC_DEFINITION,
  [CAGE_DEFINITION.toolKey]: CAGE_DEFINITION,
  [ASRS18_DEFINITION.toolKey]: ASRS18_DEFINITION,
  [YBOCS_DEFINITION.toolKey]: YBOCS_DEFINITION,
  [EPDS_DEFINITION.toolKey]: EPDS_DEFINITION,
  [SRQ20_DEFINITION.toolKey]: SRQ20_DEFINITION,
  [PHQ15_DEFINITION.toolKey]: PHQ15_DEFINITION,
};

export function getNexusScaleDefinition(toolKey: string | undefined): NexusScaleDefinition | null {
  if (!toolKey) return null;
  return catalog[toolKey] ?? null;
}

export function listNexusRuntimeScales(): NexusScaleDefinition[] {
  return Object.values(catalog);
}
