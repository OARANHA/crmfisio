import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const check = read('../../scripts/beta-operability-check.sh');
const runbook = read('../../docs/BETA_OPERABILITY_RUNBOOK.md');

describe('beta operability read-only boundary', () => {
  it('keeps the PostgreSQL probe explicitly read-only and rolled back', () => {
    expect(check).toContain('BEGIN READ ONLY;');
    expect(check).toContain('ROLLBACK;');
    expect(check).toContain('-v ON_ERROR_STOP=1');
    expect(check).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL)\s/i);
  });

  it('validates operator-controlled window and container inputs before composing commands or SQL', () => {
    expect(check).toContain('^\[1-9\]\[0-9\]*(m|h|d)$');
    expect(check).toContain('^\[1-9\]\[0-9\]*$');
    expect(check).toContain('validate_container_name');
    expect(check).toContain('^[A-Za-z0-9][A-Za-z0-9_.-]*$');
  });

  it('prints aggregate operational metadata instead of sensitive payload fields', () => {
    for (const forbidden of [
      'response_snapshot',
      'answers_snapshot',
      'output_snapshot',
      'mensagem',
      'reply_text',
      'patient_id',
      'paciente_id',
    ]) {
      expect(check).not.toContain(forbidden);
    }
    expect(check).toContain("'FINANCE','pending_financial_exceptions'");
    expect(check).toContain("'AUTOMATION','failed_runs_${WINDOW}'");
    expect(check).toContain("'CLINICAL','finalized_encounter_inconsistent'");
  });

  it('does not classify expected financial resolution work as clinical corruption', () => {
    expect(check).toContain("CASE WHEN count(*)=0 THEN 'PASS' ELSE 'ATTENTION' END");
    expect(runbook).toContain('A pending `appointment_financial_exception` is **ATTENTION**');
    expect(runbook).toContain('Never “fix” an ATTENTION item by editing the queue directly.');
  });

  it('keeps generic Edge isolate warnings informational unless correlated with real failure signals', () => {
    expect(check).toContain("edge_wall_clock_warnings_%s|%s|INFO");
    expect(check).toContain("edge_early_terminations_%s|%s|INFO");
    expect(runbook).toContain('they become actionable when correlated with persisted failed automation runs');
    expect(check).toContain('container_health "$EVOLUTION_CONTAINER" ATTENTION || true');
    expect(check).toContain('[[:space:]]*\"?5[0-9]{2}\"?');
    expect(check).toContain('\"(code|status|statusCode|status_code)\"[[:space:]]*:[[:space:]]*\"?5[0-9]{2}\"?');
    expect(check).not.toContain('(^|[^0-9])5[0-9]{2}([^0-9]|$)');
  });

  it('does not report intentionally disabled platform automation as a stale-run failure', () => {
    expect(check).toContain("key='automation.enabled'");
    expect(check).toContain("key='automation.core_tick'");
    expect(check).toContain("THEN 'master_disabled'");
    expect(check).toContain("THEN 'core_tick_disabled'");
    expect(runbook).toContain('A deliberately disabled platform master/core switch is reported as `INFO`');
  });

  it('keeps browser UX diagnosis explicitly separate from server integrity', () => {
    expect(runbook).toContain('UX/browser diagnosis remains manual');
    expect(runbook).toContain('if the server is healthy and the UI remains broken, classify as frontend/UX');
  });
});
