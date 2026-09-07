import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const outbox = source('./messageOutbox.ts');
const messages = source('../pages/Mensagens.tsx');
const activity = source('../components/messages/MessageActivity.tsx');

describe('WhatsApp operational observability', () => {
  it('preserves provider diagnostics from wa_logs', () => {
    expect(outbox).toContain('providerStatus:string|null');
    expect(outbox).toContain('attemptCount:number');
    expect(outbox).toContain('provider_status');
    expect(outbox).toContain('last_attempt_at');
    expect(outbox).toContain('delivered_at');
  });

  it('separates uncertain delivery from definitive failure and reconciled delivery', () => {
    expect(messages).toContain("log.providerStatus === 'DELIVERY_UNCERTAIN'");
    expect(messages).toContain("log.providerStatus === 'RECONCILED'");
    expect(messages).toContain('Falha definitiva');
    expect(messages).toContain('Resultado incerto');
    expect(messages).toContain('Recuperados');
  });

  it('warns operators not to blindly resend uncertain delivery', () => {
    expect(activity).toContain('Não reenviar automaticamente');
    expect(messages).toContain('Não reenviar automaticamente');
    expect(activity).toContain("log.providerStatus === 'DELIVERY_UNCERTAIN'");
  });
});
