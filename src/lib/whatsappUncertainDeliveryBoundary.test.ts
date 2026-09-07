import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(
  fileURLToPath(new URL(relative, import.meta.url)),
  'utf8',
);

const worker = source('../../supabase/functions/evolution-worker/index.ts');
const webhook = source('../../supabase/functions/evolution-webhook/index.ts');
const migration = source('../../supabase-migrations/20260907_whatsapp_uncertain_delivery_reconciliation.sql');

describe('WhatsApp uncertain-delivery boundary', () => {
  it('quarantines stale sends instead of returning them to the queue', () => {
    expect(migration).toContain("provider_status = 'DELIVERY_UNCERTAIN'");
    expect(migration).toContain("status = 'falhou'");
    const staleFunction = migration.match(/CREATE OR REPLACE FUNCTION public\.requeue_stale_messages[\s\S]*?\$\$;\n/)?.[0] ?? '';
    expect(staleFunction).not.toMatch(/SET\s+status\s*=\s*'fila'/);
  });

  it('does not resend after a provider acceptance if local persistence fails', () => {
    expect(worker).toContain('deliveryAccepted = true');
    expect(worker).toContain("provider_status: 'ACCEPTED_RECOVERED'");
    expect(worker).toContain('Retry only the local persistence');
    expect(worker).toContain("provider_status: uncertain ? 'DELIVERY_UNCERTAIN' : 'ERROR'");
  });

  it('reconciles only outbound provider events through the canonical server RPC', () => {
    expect(webhook).toContain('fromMe === true');
    expect(webhook).toContain("admin.rpc('reconcile_whatsapp_outbound_event'");
    expect(webhook).toContain('p_provider_message_id: outboundProviderId');
    expect(webhook).toContain('p_remote_jid: remoteJid');
    expect(webhook).toContain('p_message_text: messageText');
  });

  it('requires one unique exact-text recipient candidate in a bounded time window', () => {
    expect(migration).toContain('w.mensagem = v_message_text');
    expect(migration).toContain("now() - interval '6 hours'");
    expect(migration).toContain('w.provider_message_id IS NULL');
    expect(migration).toContain('IF v_count <> 1 OR v_candidate IS NULL THEN');
  });
});
