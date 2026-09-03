import type { BodyLaterality, BodyView } from './assessmentEngine';

export type BodyMapRegion = {
  id: string;
  code: string;
  label: string;
  view: Extract<BodyView, 'front' | 'back'>;
  laterality: BodyLaterality;
  x: number;
  y: number;
};

export const BODY_MAP_REGIONS: readonly BodyMapRegion[] = [
  { id: 'front_cervical', code: 'CV', label: 'Cervical anterior', view: 'front', laterality: 'midline', x: 0.50, y: 0.17 },
  { id: 'front_shoulder_left', code: 'OE', label: 'Ombro esquerdo', view: 'front', laterality: 'left', x: 0.34, y: 0.23 },
  { id: 'front_shoulder_right', code: 'OD', label: 'Ombro direito', view: 'front', laterality: 'right', x: 0.66, y: 0.23 },
  { id: 'front_arm_left', code: 'BE', label: 'Braço esquerdo', view: 'front', laterality: 'left', x: 0.27, y: 0.33 },
  { id: 'front_arm_right', code: 'BD', label: 'Braço direito', view: 'front', laterality: 'right', x: 0.73, y: 0.33 },
  { id: 'front_elbow_left', code: 'CE', label: 'Cotovelo esquerdo', view: 'front', laterality: 'left', x: 0.23, y: 0.43 },
  { id: 'front_elbow_right', code: 'CD', label: 'Cotovelo direito', view: 'front', laterality: 'right', x: 0.77, y: 0.43 },
  { id: 'front_forearm_left', code: 'AE', label: 'Antebraço esquerdo', view: 'front', laterality: 'left', x: 0.19, y: 0.52 },
  { id: 'front_forearm_right', code: 'AD', label: 'Antebraço direito', view: 'front', laterality: 'right', x: 0.81, y: 0.52 },
  { id: 'front_wrist_left', code: 'PE', label: 'Punho/mão esquerda', view: 'front', laterality: 'left', x: 0.15, y: 0.60 },
  { id: 'front_wrist_right', code: 'PD', label: 'Punho/mão direita', view: 'front', laterality: 'right', x: 0.85, y: 0.60 },
  { id: 'front_thorax', code: 'TX', label: 'Tórax', view: 'front', laterality: 'midline', x: 0.50, y: 0.31 },
  { id: 'front_abdomen', code: 'AB', label: 'Abdome', view: 'front', laterality: 'midline', x: 0.50, y: 0.43 },
  { id: 'front_hip_left', code: 'QE', label: 'Quadril esquerdo', view: 'front', laterality: 'left', x: 0.42, y: 0.52 },
  { id: 'front_hip_right', code: 'QD', label: 'Quadril direito', view: 'front', laterality: 'right', x: 0.58, y: 0.52 },
  { id: 'front_thigh_left', code: 'CXE', label: 'Coxa esquerda', view: 'front', laterality: 'left', x: 0.43, y: 0.66 },
  { id: 'front_thigh_right', code: 'CXD', label: 'Coxa direita', view: 'front', laterality: 'right', x: 0.57, y: 0.66 },
  { id: 'front_knee_left', code: 'JE', label: 'Joelho esquerdo', view: 'front', laterality: 'left', x: 0.43, y: 0.77 },
  { id: 'front_knee_right', code: 'JD', label: 'Joelho direito', view: 'front', laterality: 'right', x: 0.57, y: 0.77 },
  { id: 'front_leg_left', code: 'PE', label: 'Perna esquerda', view: 'front', laterality: 'left', x: 0.43, y: 0.87 },
  { id: 'front_leg_right', code: 'PD', label: 'Perna direita', view: 'front', laterality: 'right', x: 0.57, y: 0.87 },
  { id: 'front_ankle_left', code: 'TE', label: 'Tornozelo/pé esquerdo', view: 'front', laterality: 'left', x: 0.42, y: 0.96 },
  { id: 'front_ankle_right', code: 'TD', label: 'Tornozelo/pé direito', view: 'front', laterality: 'right', x: 0.58, y: 0.96 },

  { id: 'back_cervical', code: 'CV', label: 'Cervical posterior', view: 'back', laterality: 'midline', x: 0.50, y: 0.17 },
  { id: 'back_trapezius_left', code: 'TE', label: 'Trapézio esquerdo', view: 'back', laterality: 'left', x: 0.40, y: 0.23 },
  { id: 'back_trapezius_right', code: 'TD', label: 'Trapézio direito', view: 'back', laterality: 'right', x: 0.60, y: 0.23 },
  { id: 'back_scapular_left', code: 'EE', label: 'Escapular esquerda', view: 'back', laterality: 'left', x: 0.41, y: 0.31 },
  { id: 'back_scapular_right', code: 'ED', label: 'Escapular direita', view: 'back', laterality: 'right', x: 0.59, y: 0.31 },
  { id: 'back_thoracic', code: 'TO', label: 'Torácica', view: 'back', laterality: 'midline', x: 0.50, y: 0.36 },
  { id: 'back_lumbar_left', code: 'LE', label: 'Lombar esquerda', view: 'back', laterality: 'left', x: 0.43, y: 0.46 },
  { id: 'back_lumbar_right', code: 'LD', label: 'Lombar direita', view: 'back', laterality: 'right', x: 0.57, y: 0.46 },
  { id: 'back_sacral', code: 'SC', label: 'Sacral', view: 'back', laterality: 'midline', x: 0.50, y: 0.52 },
  { id: 'back_gluteal_left', code: 'GE', label: 'Glúteo esquerdo', view: 'back', laterality: 'left', x: 0.43, y: 0.58 },
  { id: 'back_gluteal_right', code: 'GD', label: 'Glúteo direito', view: 'back', laterality: 'right', x: 0.57, y: 0.58 },
  { id: 'back_thigh_left', code: 'CXE', label: 'Coxa posterior esquerda', view: 'back', laterality: 'left', x: 0.43, y: 0.69 },
  { id: 'back_thigh_right', code: 'CXD', label: 'Coxa posterior direita', view: 'back', laterality: 'right', x: 0.57, y: 0.69 },
  { id: 'back_knee_left', code: 'JE', label: 'Joelho posterior esquerdo', view: 'back', laterality: 'left', x: 0.43, y: 0.78 },
  { id: 'back_knee_right', code: 'JD', label: 'Joelho posterior direito', view: 'back', laterality: 'right', x: 0.57, y: 0.78 },
  { id: 'back_calf_left', code: 'PE', label: 'Panturrilha esquerda', view: 'back', laterality: 'left', x: 0.43, y: 0.88 },
  { id: 'back_calf_right', code: 'PD', label: 'Panturrilha direita', view: 'back', laterality: 'right', x: 0.57, y: 0.88 },
  { id: 'back_ankle_left', code: 'TE', label: 'Tornozelo/pé esquerdo', view: 'back', laterality: 'left', x: 0.42, y: 0.96 },
  { id: 'back_ankle_right', code: 'TD', label: 'Tornozelo/pé direito', view: 'back', laterality: 'right', x: 0.58, y: 0.96 },
] as const;

export function bodyMapRegionById(id: string | null | undefined): BodyMapRegion | null {
  if (!id) return null;
  return BODY_MAP_REGIONS.find((region) => region.id === id) ?? null;
}

export function bodyMapRegionsForView(view: Extract<BodyView, 'front' | 'back'>): readonly BodyMapRegion[] {
  return BODY_MAP_REGIONS.filter((region) => region.view === view);
}
