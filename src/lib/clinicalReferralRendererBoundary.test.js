import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const renderer = read('./referralPrintRenderer.ts');
const workspace = read('../components/ClinicalReferralWorkspace.tsx');
const preview = read('../components/ReferralDocumentPreview.tsx');
const migration = read('../../supabase-migrations/20260912_clinical_referral_renderer_v1.sql');
const verifier = read('../../supabase-verifiers/VERIFY_20260912_CLINICAL_REFERRAL_RENDERER_V1.sql');

describe('Referral Professional Renderer V1 boundary', () => {
  it('uses a closed code-owned render contract with no arbitrary HTML/CSS/JS fields', () => {
    expect(renderer).toContain("REFERRAL_RENDER_LAYOUT_V1 = 'clinical-document/referral-v1'");
    expect(renderer).toContain('RENDER_DEFINITION_KEYS');
    expect(renderer).toContain('escapeHtml');
    expect(renderer).not.toContain('dangerouslySetInnerHTML');
    expect(migration).toContain('clinical-document/referral-v1');
    expect(migration).not.toContain('custom_html');
    expect(migration).not.toContain('custom_css');
    expect(migration).not.toContain('custom_js');
  });

  it('keeps draft preview and issued print on the same renderer', () => {
    expect(preview).toContain('buildReferralDocumentHtml');
    expect(preview).toContain("mode: 'draft'");
    expect(workspace).toContain('buildReferralDocumentHtml({');
    expect(workspace).toContain("mode: 'issued'");
    expect(workspace).toContain('referralDocumentRenderDefinition(document)');
    expect(workspace).toContain('buildReferralRenderContextFromSnapshot');
    expect(workspace).toContain('document.payloadSnapshot');
  });

  it('adds human A4 identity and signature elements without exposing the internal type label', () => {
    expect(renderer).toContain('Encaminhamento clínico');
    expect(renderer).toContain('Motivo do encaminhamento');
    expect(renderer).toContain('Resumo clínico relevante');
    expect(renderer).toContain('Avaliação / ação solicitada');
    expect(renderer).toContain('Assinatura do profissional responsável pelo encaminhamento');
    expect(renderer).toContain('asString(issuer.councilType)');
    expect(renderer).toContain('asString(issuer.registration)');
    expect(renderer).not.toContain('Documento: referral');
  });

  it('preserves legacy issued referral snapshots and version immutability', () => {
    expect(renderer).toContain("data-referral-renderer=\"legacy\"");
    expect(renderer).toContain('input.renderedSnapshot');
    expect(migration).toContain("AND t.current_version_id = '12100000-0000-4000-8000-000000000007'::uuid");
    expect(verifier).toContain('clinical_referral_renderer_v1_legacy_version_drift');
    expect(verifier).toContain('trg_clinical_document_template_version_immutable');
  });

  it('does not broaden authorization, RLS, roles, grants or clinical capabilities', () => {
    expect(migration).not.toContain('current_user_can_issue_clinical_document');
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).not.toContain('GRANT ');
    expect(migration).not.toContain('role');
    expect(migration).not.toContain('clinical.documents');
  });

  it('exposes print only for issued documents backed by frozen payload snapshots', () => {
    expect(workspace).toContain("document.status === 'issued' && document.payloadSnapshot");
    expect(workspace).toContain('printIssuedReferral(document, patientName)');
    expect(workspace).toContain("if (document.status !== 'issued' || !document.payloadSnapshot) return;");
    expect(workspace).toContain("window.open('', '_blank', 'width=900,height=760')");
  });
});
