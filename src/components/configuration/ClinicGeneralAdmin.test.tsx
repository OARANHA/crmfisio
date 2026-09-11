import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  role: 'owner',
  toast: vi.fn(),
  updateIdentity: vi.fn(),
  saveHours: vi.fn(),
  weekdays: [
    { day: 0, label: 'Segunda' },
    { day: 1, label: 'Terça' },
    { day: 2, label: 'Quarta' },
    { day: 3, label: 'Quinta' },
    { day: 4, label: 'Sexta' },
    { day: 5, label: 'Sábado' },
    { day: 6, label: 'Domingo' },
  ] as const,
}));

vi.mock('../../lib/currentUserAccess', () => ({
  useCurrentUserAccess: () => ({
    user: { id: 'user-a', role: testState.role, name: 'Test User' },
  }),
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ toast: testState.toast }),
}));

vi.mock('../../lib/clinicConfiguration', () => ({
  CLINIC_WEEKDAYS: testState.weekdays,
  listIanaTimeZones: () => ['UTC', 'America/Sao_Paulo'],
  getCurrentClinicIdentity: vi.fn(async () => ({
    id: 'clinic-a',
    name: 'Clínica A',
    cnpj: '11111111000111',
    phone: null,
    email: null,
    address: null,
    timezone: 'UTC',
  })),
  loadClinicOpeningHours: vi.fn(async () => testState.weekdays.map(({ day }) => ({
    day_of_week: day,
    is_open: false,
    opens_at: null,
    closes_at: null,
  }))),
  openingHourForToggle: (row: { day_of_week: number; is_open: boolean; opens_at: string | null; closes_at: string | null }, isOpen: boolean) => isOpen
    ? { ...row, is_open: true, opens_at: row.opens_at || '08:00', closes_at: row.closes_at || '18:00' }
    : { ...row, is_open: false, opens_at: null, closes_at: null },
  validateOpeningHours: () => null,
  updateCurrentClinicIdentity: testState.updateIdentity,
  saveClinicOpeningHours: testState.saveHours,
}));

vi.mock('../InfrastructureAdmin', () => ({
  InfrastructureAdmin: ({ mode, readOnly }: { mode?: string; readOnly?: boolean }) => (
    <div data-testid="infrastructure">{mode}:{readOnly ? 'readonly' : 'editable'}</div>
  ),
}));

import { ClinicGeneralAdmin } from './ClinicGeneralAdmin';

async function renderGeneral(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ClinicGeneralAdmin />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return renderer;
}

function buttonByText(renderer: ReactTestRenderer, text: string) {
  return renderer.root.findAllByType('button').find((button) => button.children.includes(text));
}

describe('ClinicGeneralAdmin', () => {
  beforeEach(() => {
    testState.role = 'owner';
    testState.toast.mockClear();
    testState.updateIdentity.mockReset();
    testState.updateIdentity.mockImplementation(async (input) => ({ id: 'clinic-a', ...input }));
    testState.saveHours.mockReset();
    testState.saveHours.mockResolvedValue(undefined);
  });

  it('renders identity, reused units and weekly hours for an owner', async () => {
    const renderer = await renderGeneral();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Informações da clínica');
    expect(rendered).toContain('Horário de funcionamento');
    expect(renderer.root.findByProps({ 'data-testid': 'infrastructure' }).children).toContain('units:editable');
    expect(renderer.root.findAllByType('input').filter((input) => input.props.type === 'checkbox')).toHaveLength(7);
  });

  it('persists a selected IANA timezone through the narrow identity mutation', async () => {
    const renderer = await renderGeneral();
    const timezone = renderer.root.findAllByType('select').find((select) => select.props.value === 'UTC');
    expect(timezone).toBeTruthy();

    act(() => timezone?.props.onChange({ target: { value: 'America/Sao_Paulo' } }));
    const save = buttonByText(renderer, 'Salvar informações');
    expect(save).toBeTruthy();
    await act(async () => save?.props.onClick());

    expect(testState.updateIdentity).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'America/Sao_Paulo' }));
  });

  it('saves a seven-day schedule after explicitly opening a day', async () => {
    const renderer = await renderGeneral();
    const firstToggle = renderer.root.findAllByType('input').find((input) => input.props.type === 'checkbox');
    expect(firstToggle).toBeTruthy();
    act(() => firstToggle?.props.onChange({ target: { checked: true } }));

    const save = buttonByText(renderer, 'Salvar horários');
    await act(async () => save?.props.onClick());

    expect(testState.saveHours).toHaveBeenCalledTimes(1);
    const [, rows] = testState.saveHours.mock.calls[0] as [string, Array<{ day_of_week: number; is_open: boolean; opens_at: string | null; closes_at: string | null }>];
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ day_of_week: 0, is_open: true, opens_at: '08:00', closes_at: '18:00' });
  });

  it('keeps non-admin clinic roles read-only and exposes no mutation actions', async () => {
    testState.role = 'fisio';
    const renderer = await renderGeneral();
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('Somente leitura');
    expect(renderer.root.findByProps({ 'data-testid': 'infrastructure' }).children).toContain('units:readonly');
    expect(buttonByText(renderer, 'Salvar informações')).toBeUndefined();
    expect(buttonByText(renderer, 'Salvar horários')).toBeUndefined();
    expect(testState.updateIdentity).not.toHaveBeenCalled();
    expect(testState.saveHours).not.toHaveBeenCalled();
  });
});
