# Clinical Encounter — Visual Acceptance Follow-up

**Updated:** 2026-09-11  
**Base observed:** `main@217ab3697fcb022b7052518e61a01ef18f5f6a0f`

## Status

`#417` is **IMPLEMENTED IN MAIN / NOT YET VISUALLY ACCEPTED IN PRODUCTION**.

The first production inspection after redeploy found two remaining UX issues. Do not describe the compact Encounter layout as fully validated until these are closed.

## Observed blocker 1 — competing sticky layers

The left persistent context rail can still be partially hidden under the Encounter workspace toolbar (`Registro / Anamneses & Avaliações / Nexus`).

Current structure has independent sticky layers:

- `Shell` desktop header: `h-[68px]`, `sticky top-0`, `z-30`;
- Encounter hero + workspace toolbar: `sticky top-2`, `z-20`;
- left rail: `xl:sticky` with `top: calc(68px + 0.75rem)`.

The rail accounts only for the global shell header. It does not reserve the dynamic height of the Encounter sticky hero/toolbar. The Encounter sticky block itself also uses a viewport `top-2`, which allows it to slide behind the 68px shell header.

### Preferred correction

Do not solve this with another arbitrary larger `top` value.

Prefer restructuring the sticky composition:

1. make the Encounter hero non-sticky;
2. keep only the workspace toolbar sticky;
3. place the sticky workspace toolbar inside the main/right column;
4. keep the patient/context rail sticky in the left column;
5. both columns may then share the same shell offset without overlapping each other.

This removes the need for the rail to know the dynamic height of the Encounter toolbar.

## Observed blocker 2 — desktop global header wastes vertical space

The desktop shell keeps a 68px global header containing presentation mode, unit selector, theme and notification controls, while the sidebar already provides persistent navigation and a footer/user area.

There is also duplicated presentation context in desktop UX: `PresentationModeControl` exists in the sidebar while `PresentationHeaderControl` occupies the top header.

### Product direction for next slice

Compact the desktop shell, without changing authorization or navigation semantics:

- move desktop-only utility controls toward the sidebar footer where practical;
- avoid duplicating presentation mode in both sidebar and top header;
- consider moving theme/notification controls to the sidebar footer;
- keep unit selection accessible, with a deliberate collapsed-sidebar behavior;
- keep mobile behavior separate and safe; mobile may retain a compact top header because the fixed desktop sidebar is absent;
- move contextual help away from the desktop top strip if needed to keep the top visually quiet.

A stronger desktop option is to remove the global top header entirely at `lg+`, while preserving a mobile/tablet header. If chosen, audit all sticky offsets that currently assume `68px`.

## Acceptance criteria for follow-up

The next visual slice is accepted only when production inspection confirms:

- `Estado da consulta` is never hidden by the Encounter toolbar during scroll;
- the left rail remains usable at 1366x768, 1440x900 and 1920x1080;
- no awkward double-scroll appears in normal desktop use;
- `Registro / Anamneses & Avaliações / Nexus` remains reachable and sticky without covering the rail;
- the top of the application is visibly less wasteful on desktop;
- unit selection, presentation mode, theme, notifications and help remain reachable;
- mobile/tablet navigation remains intact;
- draft persistence, save/finalize flows and authorization remain unchanged.

## Scope boundary

Frontend/UX only unless new evidence proves otherwise.

Do not alter:

- migrations;
- RLS;
- capabilities;
- Assessment Engine contracts;
- clinical persistence;
- encounter lifecycle;
- authorization semantics.

## Manual/documentation rule

Until this follow-up is visually accepted in production, the future user manual must use the state:

`IMPLEMENTED / AWAITING VISUAL VALIDATION`

Do not use the post-#417 screenshot as the final reference image for the manual.