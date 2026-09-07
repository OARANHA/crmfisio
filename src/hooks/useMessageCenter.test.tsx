import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({
  resolveClinicId: vi.fn(),
  loadMessageOutbox: vi.fn(),
  loadMessageTemplates: vi.fn(),
  queueSelectedAppointmentConfirmations: vi.fn(),
  queueAppointmentConfirmations: vi.fn(),
  queueNpsSurveys: vi.fn(),
  queueSelectedNpsSurveys: vi.fn(),
  queueSelectedReactivationCampaign: vi.fn(),
  resolveWhatsappReview: vi.fn(),
  saveMessageTemplate: vi.fn(),
  flushMessageOutbox: vi.fn(),
}));

vi.mock('../lib/repository', () => ({ resolveClinicId: mocks.resolveClinicId }));
vi.mock('../lib/messageOutbox', () => ({
  loadMessageOutbox: mocks.loadMessageOutbox,
  loadMessageTemplates: mocks.loadMessageTemplates,
  queueSelectedAppointmentConfirmations: mocks.queueSelectedAppointmentConfirmations,
  queueAppointmentConfirmations: mocks.queueAppointmentConfirmations,
  queueNpsSurveys: mocks.queueNpsSurveys,
  queueSelectedNpsSurveys: mocks.queueSelectedNpsSurveys,
  queueSelectedReactivationCampaign: mocks.queueSelectedReactivationCampaign,
  resolveWhatsappReview: mocks.resolveWhatsappReview,
  saveMessageTemplate: mocks.saveMessageTemplate,
  flushMessageOutbox: mocks.flushMessageOutbox,
}));

import { useMessageCenter } from './useMessageCenter';

let current: ReturnType<typeof useMessageCenter>;
let renderer: ReactTestRenderer;
function Probe() { current = useMessageCenter('user-1'); return null; }

beforeEach(() => {
  mocks.resolveClinicId.mockResolvedValue('clinic-1');
  mocks.loadMessageOutbox.mockResolvedValue([]);
  mocks.loadMessageTemplates.mockResolvedValue([]);
  mocks.queueSelectedAppointmentConfirmations.mockResolvedValue(2);
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  vi.resetAllMocks();
});

describe('useMessageCenter worker boundary', () => {
  it('enqueues tenant-scoped work without invoking the internal Evolution worker', async () => {
    await act(async () => { renderer = create(<Probe />); });

    let result!: { queued: number };
    await act(async () => {
      result = await current.queueSelectedConfirmations(['a1', 'a2']);
    });

    expect(result).toEqual({ queued: 2 });
    expect(mocks.queueSelectedAppointmentConfirmations).toHaveBeenCalledWith(['a1', 'a2'], 48);
    expect(mocks.flushMessageOutbox).not.toHaveBeenCalled();
  });
});
