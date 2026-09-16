#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=clinical_instrument_patient_delivery_v1_test}"
export PGHOST PGPORT PGUSER PGDATABASE

if [[ "$PGDATABASE" != "clinical_instrument_patient_delivery_v1_test" ]]; then
  echo "Refusing to run Patient Delivery V1 harness outside clinical_instrument_patient_delivery_v1_test" >&2
  exit 1
fi

GENERATED="/tmp/clinical_instrument_patient_delivery_v1.sql"
PSQL=(psql -v ON_ERROR_STOP=1 -X)

python3 - <<'PY'
from pathlib import Path
import re

migration = Path('supabase-migrations/20260916_clinical_instrument_patient_delivery_v1.sql').read_text()
edge = Path('supabase/functions/clinical-instrument-patient-delivery/index.ts').read_text()
processor = Path('supabase/functions/nexus-self-assessment-processor/index.ts').read_text()
client = Path('src/lib/clinicalInstrumentPatientDelivery.ts').read_text()
ui = Path('src/components/ClinicalInstrumentPatientDelivery.tsx').read_text()
history = Path('src/lib/clinicalInstrumentClinicianAssisted.ts').read_text()
public_catalog = Path('src/lib/nexus/publicSelfAssessmentCatalog.ts').read_text()

for token in [
    'clinical_instrument_patient_self_contracts',
    'can_send_clinical_instrument_to_patient',
    'enqueue_clinical_instrument_patient_delivery',
    'claim_clinical_instrument_patient_invites',
    'complete_clinical_instrument_patient_self_processing',
    'list_patient_clinical_instrument_history',
    "authority_source IN ('nexus','clinical_instrument')",
    "provenance IN ('clinician_assisted','patient_self')",
    "authority_source = 'nexus'",
]:
    if token not in migration:
        raise SystemExit(f'Patient Delivery static safety failed: missing {token}')

boundary = re.search(
    r'CREATE OR REPLACE FUNCTION public\.can_send_clinical_instrument_to_patient\([\s\S]*?\$\$;',
    migration,
    re.I,
)
if not boundary:
    raise SystemExit('Patient Delivery static safety failed: send boundary extraction')
for forbidden in ['nexus.scales', 'nexus.access', 'current_app_role']:
    if forbidden in boundary.group():
        raise SystemExit(f'Patient Delivery static safety failed: neutral send boundary depends on {forbidden}')

for token in [
    'admin.auth.getUser',
    'p_actor_user_id: authData.user.id',
    "admin.rpc('enqueue_clinical_instrument_patient_delivery'",
]:
    if token not in edge:
        raise SystemExit(f'Patient Delivery static safety failed: Edge missing {token}')
for forbidden in ['clinicId', 'patientId', 'professionalId']:
    if forbidden in edge:
        raise SystemExit(f'Patient Delivery static safety failed: browser authority field found: {forbidden}')

for token in [
    'LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS',
    "admin.rpc('claim_clinical_instrument_patient_invites'",
    "admin.rpc('complete_clinical_instrument_patient_self_processing'",
]:
    if token not in processor:
        raise SystemExit(f'Patient Delivery static safety failed: processor missing {token}')

for pattern, label in [
    (r"db\.rpc\(\s*['\"]list_available_clinical_instrument_patient_delivery['\"]", 'available-delivery RPC'),
    (r"db\.rpc\(\s*['\"]list_clinical_instrument_patient_deliveries['\"]", 'delivery-status RPC'),
    (r"supabase\.functions\.invoke\(\s*['\"]clinical-instrument-patient-delivery['\"]", 'patient-delivery Edge invoke'),
]:
    if not re.search(pattern, client):
        raise SystemExit(f'Patient Delivery static safety failed: client missing {label}')
for forbidden in ["'phq9'", "'gad7'", 'nexus.scales']:
    if forbidden in ui:
        raise SystemExit(f'Patient Delivery static safety failed: delivery UI hardcodes {forbidden}')
if 'available.map((item) =>' not in ui:
    raise SystemExit('Patient Delivery static safety failed: registry-driven UI missing')
if not re.search(r'if\s*\(\s*!latest\.has\(item\.instrumentKey\)\s*\)\s*latest\.set\(item\.instrumentKey,\s*item\)', ui):
    raise SystemExit('Patient Delivery static safety failed: newest-status preservation missing')

for token in ["toolKey: 'phq9'", "toolKey: 'gad7'"]:
    if token not in public_catalog:
        raise SystemExit(f'Patient Delivery static safety failed: public definition missing {token}')
if not re.search(r"db\.rpc\(\s*['\"]list_patient_clinical_instrument_history['\"]", history):
    raise SystemExit('Patient Delivery static safety failed: neutral history RPC missing')
if not re.search(r"['\"]clinician_assisted['\"]\s*\|\s*['\"]patient_self['\"]", history):
    raise SystemExit('Patient Delivery static safety failed: combined provenance missing')

print('Patient Delivery static safety: neutral auth + registry UI + split workers + combined history OK')
PY

python3 scripts/build-clinical-instrument-patient-delivery-v1-sql-test.py > "$GENERATED"
"${PSQL[@]}" -f "$GENERATED"
"${PSQL[@]}" -f supabase-verifiers/VERIFY_20260916_CLINICAL_INSTRUMENT_PATIENT_DELIVERY_V1.sql

echo "Clinical Instrument Patient Delivery V1 PostgreSQL 16: behavior + replay + authority split + verifier passed"
