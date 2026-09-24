# Project guidance

The user's latest request is authoritative. Specifications are in SPEC.md and docs/00–09. Keep this a two-color, single-lane rhythm game with an independently animated original Shiba character.

Keep user audio, source references, private song packs and all Studio user data in `_private/`, outside Git and outside `dist/`. Do not publish or send those files to external services. Do not add a deployment destination without the user's authorization.

Use TypeScript strict, preserve the pure engine boundary, and run `npm run verify` and `npm run test:e2e` after material changes. Record actual evidence in reports; don't label emulation as iPhone or TD-17 hardware verification.

Don't delete failing tests or relax the fixed judgment windows to obtain a pass. Update PROGRESS.md and DELIVERY.md when completing work.
