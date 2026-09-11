export type AssessmentAutosaveJob = {
  contextKey: string;
  draftId: string;
  answers: Record<string, unknown>;
};

type Options<T> = {
  delayMs: number;
  save: (job: AssessmentAutosaveJob) => Promise<T>;
  onSaving: (job: AssessmentAutosaveJob) => void;
  onSaved: (job: AssessmentAutosaveJob, result: T) => void;
  onError: (job: AssessmentAutosaveJob, error: unknown) => void;
};

// This coordinator deliberately owns the debounce identity. A delayed save can
// only start while both its clinical context and draft are still current.
export function createAssessmentAutosaveCoordinator<T>(options: Options<T>) {
  let currentContextKey: string | null = null;
  let currentDraftId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerJob: AssessmentAutosaveJob | null = null;
  let queued: AssessmentAutosaveJob | null = null;
  const inFlight = new Map<string, Promise<unknown>>();

  const isCurrent = (job: AssessmentAutosaveJob) => currentContextKey === job.contextKey && currentDraftId === job.draftId;
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    timerJob = null;
  };

  const execute = async (job: AssessmentAutosaveJob): Promise<T | undefined> => {
    if (!isCurrent(job)) return undefined;
    const existing = inFlight.get(job.contextKey);
    if (existing) {
      queued = job;
      return undefined;
    }

    const operation = (async () => {
      if (!isCurrent(job)) return undefined;
      options.onSaving(job);
      try {
        const result = await options.save(job);
        if (isCurrent(job)) options.onSaved(job, result);
        return result;
      } catch (error) {
        if (isCurrent(job)) options.onError(job, error);
        throw error;
      }
    })();
    inFlight.set(job.contextKey, operation);
    try {
      return await operation;
    } finally {
      if (inFlight.get(job.contextKey) === operation) inFlight.delete(job.contextKey);
      if (isCurrent(job) && queued?.contextKey === job.contextKey && queued.draftId === job.draftId) {
        const next = queued;
        queued = null;
        arm(next);
      }
    }
  };

  const arm = (job: AssessmentAutosaveJob) => {
    if (!isCurrent(job)) return;
    clearTimer();
    timerJob = job;
    timer = setTimeout(() => {
      timer = null;
      timerJob = null;
      // Gate before the mutation, not merely after its completion.
      if (isCurrent(job)) void execute(job).catch(() => undefined);
    }, options.delayMs);
  };

  return {
    setContext(contextKey: string, draftId: string | null) {
      const changed = currentContextKey !== contextKey || currentDraftId !== draftId;
      currentContextKey = contextKey;
      currentDraftId = draftId;
      if (changed) {
        clearTimer();
        queued = null;
      }
    },
    schedule(job: AssessmentAutosaveJob) {
      if (!isCurrent(job)) return;
      if (inFlight.has(job.contextKey)) {
        queued = job;
        return;
      }
      arm(job);
    },
    async flush(job: AssessmentAutosaveJob) {
      if (!isCurrent(job)) return undefined;
      if (timerJob?.contextKey === job.contextKey && timerJob.draftId === job.draftId) clearTimer();
      if (queued?.contextKey === job.contextKey && queued.draftId === job.draftId) queued = null;
      const existing = inFlight.get(job.contextKey);
      if (existing) await existing.catch(() => undefined);
      if (!isCurrent(job)) return undefined;
      return execute(job);
    },
    cancel() {
      clearTimer();
      queued = null;
    },
  };
}
