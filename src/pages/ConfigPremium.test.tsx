import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ConfigPremium } from './ConfigPremium';

vi.mock('../components/configuration/ClinicGeneralAdmin', () => ({
  ClinicGeneralAdmin: () => <div data-testid="clinic-general">clinic-general</div>,
}));
vi.mock('../components/TeamAdmin', () => ({
  TeamAdmin: () => <div data-testid="team-admin">team-admin</div>,
}));
vi.mock('../components/InfrastructureAdmin', () => ({
  InfrastructureAdmin: ({ mode }: { mode?: string }) => <div data-testid="infrastructure-admin">infrastructure-{mode}</div>,
}));
vi.mock('../components/StorageAdmin', () => ({ StorageAdmin: () => <div data-testid="storage-admin">storage-admin</div> }));
vi.mock('../components/AssessmentTemplatesAdmin', () => ({ AssessmentTemplatesAdmin: () => <div data-testid="assessment-admin">assessment-admin</div> }));
vi.mock('../components/ConsentTemplatesAdmin', () => ({ ConsentTemplatesAdmin: () => <div data-testid="consent-admin">consent-admin</div> }));
vi.mock('./Config', () => ({ Config: () => <div data-testid="governance">governance</div> }));

function clickSection(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType('button').find((candidate) =>
    candidate.findAllByType('span').some((span) => span.children.includes(label)),
  );
  if (!button) throw new Error(`Section button not found: ${label}`);
  act(() => button.props.onClick());
}

describe('ConfigPremium', () => {
  it('starts in General and exposes only functional configuration areas', () => {
    const renderer = create(<ConfigPremium />);
    expect(renderer.root.findByProps({ 'data-testid': 'clinic-general' })).toBeTruthy();

    const labels = renderer.root.findAllByType('button').flatMap((button) =>
      button.findAllByType('span').flatMap((span) => span.children.filter((child): child is string => typeof child === 'string')),
    );
    expect(labels).toContain('Geral');
    expect(labels).toContain('Equipe & Acessos');
    expect(labels).toContain('Agenda & Atendimento');
    expect(labels).toContain('Anamneses & Avaliações');
    expect(labels).toContain('Termos');
    expect(labels).toContain('Governança');
    expect(labels).not.toContain('Prescrições');
    expect(labels).not.toContain('Comunicação');
    expect(labels).not.toContain('Financeiro');
    expect(labels).not.toContain('Integrações');
  });

  it('keeps each functional domain in a single active workspace', () => {
    const renderer = create(<ConfigPremium />);

    clickSection(renderer, 'Equipe & Acessos');
    expect(renderer.root.findByProps({ 'data-testid': 'team-admin' })).toBeTruthy();

    clickSection(renderer, 'Agenda & Atendimento');
    expect(renderer.root.findByProps({ 'data-testid': 'infrastructure-admin' }).children.join('')).toBe('infrastructure-rooms');

    clickSection(renderer, 'Anamneses & Avaliações');
    expect(renderer.root.findByProps({ 'data-testid': 'assessment-admin' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ 'data-testid': 'consent-admin' })).toHaveLength(0);

    clickSection(renderer, 'Termos');
    expect(renderer.root.findByProps({ 'data-testid': 'consent-admin' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ 'data-testid': 'assessment-admin' })).toHaveLength(0);

    clickSection(renderer, 'Governança');
    expect(renderer.root.findByProps({ 'data-testid': 'storage-admin' })).toBeTruthy();
    expect(renderer.root.findByProps({ 'data-testid': 'governance' })).toBeTruthy();
  });
});
