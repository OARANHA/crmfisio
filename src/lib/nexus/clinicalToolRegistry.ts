import { isPsychiatristIdentity, type ProfessionalIdentity } from '../professionalIdentity';

export type NexusClinicalToolId = 'eem' | 'mental-health-screening' | 'longitudinal' | 'results';
export type NexusClinicalToolFamily = 'mental_status' | 'mental_health_screening' | 'longitudinal' | 'results';
export type NexusClinicalToolCapability = 'nexus.eem' | 'nexus.scales';
export type NexusClinicalToolContextLevel = 'available' | 'relevant' | 'recommended';
export type NexusClinicalToolBoundaryState = 'loading' | 'ready' | 'error';

export type NexusClinicalToolDefinition = {
  id: NexusClinicalToolId;
  family: NexusClinicalToolFamily;
  title: string;
  detail: string;
  requiredCapability: NexusClinicalToolCapability | null;
  routeSuffix: '' | '/eem' | '/evolution' | null;
  psychiatryRelevant: boolean;
  defaultOrder: number;
  psychiatryOrder: number;
};

export type NexusClinicalToolAuthorization = {
  state: NexusClinicalToolBoundaryState;
  entitlementAllowed: boolean;
  nexusAccess: boolean;
  capabilities: Readonly<Record<NexusClinicalToolCapability, boolean>>;
};

export type ResolvedNexusClinicalTool = NexusClinicalToolDefinition & {
  level: Exclude<NexusClinicalToolContextLevel, 'recommended'>;
  recommendation: 'none';
};

export const NEXUS_CLINICAL_TOOL_REGISTRY: readonly NexusClinicalToolDefinition[] = [
  {
    id: 'eem',
    family: 'mental_status',
    title: 'Exame do Estado Mental',
    detail: 'EEM · encontro atual',
    requiredCapability: 'nexus.eem',
    routeSuffix: '/eem',
    psychiatryRelevant: true,
    defaultOrder: 30,
    psychiatryOrder: 10,
  },
  {
    id: 'mental-health-screening',
    family: 'mental_health_screening',
    title: 'PHQ-9 / GAD-7',
    detail: 'triagem e acompanhamento · convite seguro',
    requiredCapability: 'nexus.scales',
    routeSuffix: null,
    psychiatryRelevant: true,
    defaultOrder: 40,
    psychiatryOrder: 20,
  },
  {
    id: 'longitudinal',
    family: 'longitudinal',
    title: 'Longitudinal',
    detail: 'comparabilidade C-05',
    requiredCapability: null,
    routeSuffix: '/evolution',
    psychiatryRelevant: true,
    defaultOrder: 20,
    psychiatryOrder: 30,
  },
  {
    id: 'results',
    family: 'results',
    title: 'Resultados Nexus',
    detail: 'revisão, assinatura e C-04',
    requiredCapability: null,
    routeSuffix: '',
    psychiatryRelevant: false,
    defaultOrder: 10,
    psychiatryOrder: 40,
  },
] as const;

/**
 * Frontend presentation resolver only. `nexusAccess` is the result of the
 * server-side C-06 capability resolver, which already requires the effective
 * Nexus entitlement, valid medical identity and an explicit professional grant.
 * This function deliberately does not reproduce that authorization boundary.
 */
export function resolveNexusClinicalTools(
  authorization: NexusClinicalToolAuthorization,
  identity: ProfessionalIdentity | null | undefined,
): ResolvedNexusClinicalTool[] {
  if (
    authorization.state !== 'ready'
    || !authorization.entitlementAllowed
    || !authorization.nexusAccess
  ) {
    return [];
  }

  const psychiatry = isPsychiatristIdentity(identity);
  return NEXUS_CLINICAL_TOOL_REGISTRY
    .filter((tool) => !tool.requiredCapability || authorization.capabilities[tool.requiredCapability] === true)
    .map((tool) => ({
      ...tool,
      level: psychiatry && tool.psychiatryRelevant ? 'relevant' as const : 'available' as const,
      recommendation: 'none' as const,
    }))
    .sort((left, right) => {
      const leftOrder = psychiatry ? left.psychiatryOrder : left.defaultOrder;
      const rightOrder = psychiatry ? right.psychiatryOrder : right.defaultOrder;
      return leftOrder - rightOrder;
    });
}

export function nexusClinicalToolContextKey(input: {
  userId: string | null | undefined;
  patientId: string;
  encounterId: string;
}): string {
  return `${input.userId ?? 'no-user'}:${input.patientId}:${input.encounterId}`;
}
