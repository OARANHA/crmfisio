import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(
  fileURLToPath(new URL(relative, import.meta.url)),
  'utf8',
);

const waitlist = source('../components/WaitlistPanel.tsx');
const messageOutbox = source('./messageOutbox.ts');
const automation = source('../../supabase/functions/medicspro-automation/index.ts');
const worker = source('../../supabase/functions/evolution-worker/index.ts');

describe('Evolution worker browser boundary', () => {
  it('keeps the waitlist as an enqueue-only browser flow', () => {
    expect(waitlist).toContain('queueWaitlistOffer');
    expect(waitlist).toContain('queueWaitlistSlotOffers');
    expect(waitlist).not.toContain('flushMessageOutbox');
    expect(waitlist).toContain('adicionada à fila segura');
  });

  it('does not expose a browser helper that invokes the global worker', () => {
    expect(messageOutbox).not.toContain("functions.invoke('evolution-worker'");
    expect(messageOutbox).not.toContain('flushMessageOutbox');
  });

  it('keeps global delivery behind the internal automation secret chain', () => {
    expect(automation).toContain("'x-worker-secret': workerSecret");
    expect(worker).toContain("req.headers.get('x-worker-secret') !== workerSecret");
    expect(worker).toContain('service_role');
  });
});
