import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(
  fileURLToPath(new URL(relative, import.meta.url)),
  'utf8',
);

const messages = source('../pages/Mensagens.tsx');
const clinicConfig = source('../components/configuration/ClinicCommunicationAdmin.tsx');
const outbox = source('./messageOutbox.ts');
const migration = source('../../supabase-migrations/20260918_message_template_admin_boundary_v1.sql');

describe('Message Template Admin Boundary V1', () => {
  it('keeps template editing out of the operational message center', () => {
    expect(messages).not.toContain('MessageTemplatesEditor');
    expect(messages).not.toContain('saveTemplate');
    expect(clinicConfig).toContain('MessageTemplatesEditor');
  });

  it('uses current-clinic manager RPCs instead of direct template-table DML', () => {
    expect(outbox).toContain("rpc as Function)('list_current_clinic_message_templates'");
    expect(outbox).toContain("rpc as Function)('update_current_clinic_message_template'");
    expect(outbox).not.toContain("from('message_templates'");
  });

  it('closes direct client ACLs and audits template mutation server-side', () => {
    expect(migration).toContain('REVOKE ALL ON TABLE public.message_templates');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain("v_role NOT IN ('owner','admin')");
    expect(migration).toContain("current_clinic_entitlement_allowed('whatsapp.access')");
    expect(migration).toContain("'MESSAGE_TEMPLATE_UPDATED'");
  });
});
