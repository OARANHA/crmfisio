# Clinic state lifecycle

`ClinicDataBoundary`, below `AuthProvider`, gives the clinic providers, compatibility
store and screen state a shared React lifetime. A change in session user, profile,
clinic, role, active flag or tenant access state remounts this subtree. Setters
captured by old requests, mutations and optimistic rollbacks then belong to the
unmounted tree and cannot populate the new session.

Token renewal and profile presentation changes do not reset the subtree. Security
scope changes deliberately discard open form state; carrying drafts between users
or clinics is unsafe. The URL remains in the browser hash.

Keep all clinic providers and their consumers inside this boundary. Do not move
clinical or financial state above it. This does not cancel server operations already
submitted and does not replace database authorization. It isolates client state
according to the session/profile published by AuthProvider; it does not resolve
competing asynchronous authentication results inside AuthProvider.

The lifecycle tests mount the real Patient, Agenda, Finance and Clinical providers
with deferred repository/network responses. They cover scope changes, late loads,
late inserts, failed optimistic mutations, same-clinic re-login, and token renewal.
They do not substitute for server-side tenant isolation tests.

Remaining P1 follow-up: guard asynchronous AuthProvider session resolution itself
against obsolete results. Also handle overlapping refreshes within one unchanged
session separately; session isolation alone does not order those responses.
