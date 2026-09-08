"""Emit a disposable PostgreSQL RLS regression suite. Never target production.

Only dependency tables are reduced fixtures. The auth.uid shim reads a test JWT
subject. Actual domain helpers, Nexus table DDL and every historical Nexus policy
are extracted from versioned SQL; no boolean authorization mocks are used.

C-01 is a historical regression gate. Later C-06 helper replacements are excluded
so this suite keeps reproducing and verifying the exact C-01 boundary it owns.
"""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
fix = root / 'supabase-migrations/20260908_nexus_c01_read_boundary.sql'
c06 = root / 'supabase-migrations/20260908_nexus_c06_professional_authorization.sql'
c06_verifier = root / 'supabase-migrations/20260908_verify_nexus_c06_professional_authorization.sql'
sources = sorted((root / 'supabase-migrations').glob('20*.sql'))
tables = ('capability_catalog', 'professional_capabilities', 'nexus_evidence_sources',
          'nexus_clinical_results', 'nexus_red_flags', 'nexus_self_assessment_invites')
helpers = ('current_clinic_id', 'current_app_role', 'current_nexus_medical_identity_valid',
           'current_nexus_entitlement_allowed', 'has_professional_capability',
           'can_access_patient_clinical_record')
contents = [(p, p.read_text()) for p in sources if p not in {fix, c06, c06_verifier}]
print((root / 'tests/sql/nexus_c01_fixture.sql').read_text())
for table in tables:
    pattern = rf'CREATE TABLE IF NOT EXISTS public\.{table}\s*\([\s\S]*?\n\);'
    matches = [m.group() for _, text in contents for m in re.finditer(pattern, text, re.I)]
    if len(matches) != 1:
        raise SystemExit(f'Expected one canonical table definition: {table}, found {len(matches)}')
    print(matches[0])
    print(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;')
for helper in helpers:
    pattern = rf'CREATE OR REPLACE FUNCTION public\.{helper}\([\s\S]*?\$\$;'
    matches = [(p, m.group()) for p, text in contents for m in re.finditer(pattern, text, re.I)]
    if not matches:
        raise SystemExit(f'Missing canonical helper: {helper}')
    print(f'-- Effective helper: {matches[-1][0].name}')
    print(matches[-1][1])
    signature = 'uuid' if helper == 'can_access_patient_clinical_record' else 'text' if helper == 'has_professional_capability' else ''
    print(f'REVOKE ALL ON FUNCTION public.{helper}({signature}) FROM PUBLIC;')
    print(f'GRANT EXECUTE ON FUNCTION public.{helper}({signature}) TO authenticated;')
for path, text in contents:
    for match in re.finditer(r'(?:CREATE|DROP) POLICY\s+[\s\S]*?;', text, re.I):
        sql = match.group()
        if any(re.search(rf'ON\s+public\.{table}\b', sql, re.I) for table in tables):
            print(f'-- {path.name}\n{sql}')
print('GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;')
print('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;')
# Explicit table privileges are necessary to exercise RLS for anonymous users too;
# production has no anon table grant. The restrictive guard must deny even with it.
print('GRANT SELECT ON public.nexus_clinical_results, public.nexus_red_flags, public.nexus_self_assessment_invites TO anon;')
print((root / 'tests/sql/nexus_c01_seed.sql').read_text())
if '--before' not in sys.argv:
    print(fix.read_text())
    print(fix.read_text())  # Idempotency, no extra permissive policies on replay.
print((root / 'tests/sql/nexus_c01_cases.sql').read_text())
