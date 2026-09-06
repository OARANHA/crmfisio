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
according to the session/profile published by AuthProvider.

The lifecycle tests mount the real Patient, Agenda, Finance and Clinical providers
with deferred repository/network responses. They cover scope changes, late loads,
late inserts, failed optimistic mutations, same-clinic re-login, and token renewal.
They do not substitute for server-side tenant isolation tests.

AuthProvider versions access/profile resolution so obsolete results cannot publish
state after a newer auth event, logout or unmount. Initial getSession snapshots
cannot replace a newer auth event. Password login uses the same resolver and an
action version so an obsolete response cannot decide to sign out a newer session.
Changing user clears the old profile before loading the next one; token renewal
for the same user retains the current profile while revalidating access.

Remaining follow-up: overlapping domain refreshes within one unchanged session
need ordering separately; session isolation alone does not order those responses.
Server-side operations already submitted remain subject to Supabase authorization
and completion; these client guards do not cancel them.
