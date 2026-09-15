import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clinicianEncounterPath } from '../lib/clinicianDaily';
import { usePresentationContext } from '../lib/presentationContextContext';
import type { Appointment } from '../lib/types';

type EncounterHandoffTarget = Pick<Appointment, 'id' | 'pacienteId'>;

/**
 * Presentation-only handoff for an explicit clinical action.
 * Authorization remains server-side; unavailable clinical presentation is ignored
 * by PresentationContextProvider rather than inferred from role/profession here.
 */
export function useClinicalEncounterHandoff() {
  const navigate = useNavigate();
  const { availableContexts, setContext } = usePresentationContext();

  const enterClinicalPresentation = useCallback(() => {
    if (availableContexts.includes('clinical')) setContext('clinical');
  }, [availableContexts, setContext]);

  const openEncounter = useCallback((encounter: EncounterHandoffTarget) => {
    enterClinicalPresentation();
    navigate(clinicianEncounterPath(encounter));
  }, [enterClinicalPresentation, navigate]);

  return { enterClinicalPresentation, openEncounter };
}
