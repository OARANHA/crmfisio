# Rollout gate — patient clinical boundary

The clinical snapshot migration is intentionally additive. Do not revoke table-wide patient SELECT before the application bootstrap consumes an explicit operational projection and clinical roles consume the guarded snapshot RPC.

Production order:

1. install `20260906_patient_clinical_read_boundary.sql`;
2. run `VERIFY_20260906_PATIENT_CLINICAL_READ_BOUNDARY.sql`;
3. deploy compatible frontend projection;
4. validate clinical vs operational roles;
5. apply final column-privilege hardening.
