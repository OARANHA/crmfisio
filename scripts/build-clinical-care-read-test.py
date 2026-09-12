from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
cutover = (root / 'supabase-migrations/20260907_professional_role_cutover.sql').read_text()
for name, sig in [('current_user_has_valid_clinical_identity', ''), ('current_user_has_clinical_capability', 'p_capability text')]:
    match = re.search(rf'create or replace function public\.{name}\({sig}\)[\s\S]*?\$\$;', cutover, re.I)
    if not match:
        raise SystemExit(f'missing canonical helper {name}')
    print(match.group())
