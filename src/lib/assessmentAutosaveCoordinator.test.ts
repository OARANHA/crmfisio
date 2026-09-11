import { describe, expect, it, vi } from 'vitest';
import { createAssessmentAutosaveCoordinator } from './assessmentAutosaveCoordinator';

const job = (contextKey: string, draftId: string, value: string) => ({ contextKey, draftId, answers: { value } });

describe('assessment autosave coordinator', () => {
  it('debounces to the latest immutable snapshot and serializes one context', async () => {
    vi.useFakeTimers();
    const saves: string[] = [];
    const coordinator = createAssessmentAutosaveCoordinator({ delayMs: 900, save: async (item) => { saves.push(String(item.answers.value)); return item; }, onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn() });
    coordinator.setContext('A', 'draft-a');
    coordinator.schedule(job('A', 'draft-a', 'first'));
    coordinator.schedule(job('A', 'draft-a', 'latest'));
    await vi.advanceTimersByTimeAsync(900);
    expect(saves).toEqual(['latest']);
    vi.useRealTimers();
  });

  it('cancels timer A on a context switch before any old mutation can start', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const coordinator = createAssessmentAutosaveCoordinator({ delayMs: 900, save, onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn() });
    coordinator.setContext('A', 'draft-a');
    coordinator.schedule(job('A', 'draft-a', 'answer-a'));
    coordinator.setContext('B', 'draft-b');
    await vi.advanceTimersByTimeAsync(900);
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('keeps B independent when A is in flight, and lets B save while A completes', async () => {
    let resolveA!: () => void;
    const save = vi.fn((item) => item.contextKey === 'A' ? new Promise<void>((resolve) => { resolveA = resolve; }) : Promise.resolve());
    const onSaved = vi.fn();
    const coordinator = createAssessmentAutosaveCoordinator({ delayMs: 1, save, onSaving: vi.fn(), onSaved, onError: vi.fn() });
    coordinator.setContext('A', 'draft-a');
    const pendingA = coordinator.flush(job('A', 'draft-a', 'answer-a'));
    coordinator.setContext('B', 'draft-b');
    await coordinator.flush(job('B', 'draft-b', 'answer-b'));
    resolveA();
    await pendingA;
    expect(save.mock.calls.map(([item]) => [item.contextKey, item.answers.value])).toEqual([['A', 'answer-a'], ['B', 'answer-b']]);
    expect(onSaved.mock.calls.map(([item]) => item.contextKey)).toEqual(['B']);
  });

  it('queues the latest change behind an in-flight save in the same context', async () => {
    let resolveFirst!: () => void;
    const saves: string[] = [];
    const coordinator = createAssessmentAutosaveCoordinator({
      delayMs: 1,
      save: async (item) => {
        saves.push(String(item.answers.value));
        if (saves.length === 1) await new Promise<void>((resolve) => { resolveFirst = resolve; });
        return item;
      },
      onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn(),
    });
    coordinator.setContext('A', 'draft-a');
    const first = coordinator.flush(job('A', 'draft-a', 'first'));
    coordinator.schedule(job('A', 'draft-a', 'latest'));
    resolveFirst();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(saves).toEqual(['first', 'latest']);
  });

  it('reports a real current-context failure without marking it saved', async () => {
    const onSaved = vi.fn();
    const onError = vi.fn();
    const coordinator = createAssessmentAutosaveCoordinator({ delayMs: 1, save: async () => { throw new Error('network'); }, onSaving: vi.fn(), onSaved, onError });
    coordinator.setContext('A', 'draft-a');
    await expect(coordinator.flush(job('A', 'draft-a', 'answer'))).rejects.toThrow('network');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('flushes the final immutable snapshot after cancelling a pending debounce', async () => {
    const saves: string[] = [];
    const coordinator = createAssessmentAutosaveCoordinator({ delayMs: 1000, save: async (item) => { saves.push(String(item.answers.value)); return item; }, onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn() });
    coordinator.setContext('A', 'draft-a');
    coordinator.schedule(job('A', 'draft-a', 'stale'));
    await coordinator.flush(job('A', 'draft-a', 'final'));
    expect(saves).toEqual(['final']);
  });
});
