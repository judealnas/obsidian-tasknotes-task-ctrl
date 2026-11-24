# Publish 0.3.0-beta.1

User authorized publishing a beta from milestone-v0.3 on 2026-11-15 after disclosure of the outstanding physical acceptance checks and BRAT latest behavior. This authorizes beta publication only; stable Phase 7 acceptance remains open.

Execute inline on the explicitly requested milestone branch. Preserve unrelated local files and config changes.

1. Align package, lockfile, manifest and versions metadata to 0.3.0-beta.1; make tag-driven releases mark prerelease tags and exclude them from GitHub Latest. Include explicit beta notes.
2. Ignore planning artifacts in ESLint so archived upgrade bundles do not break repository checks. Run full build/lint/tests and record the reviewed commit and artifact hashes.
3. Commit, push milestone-v0.3 and the exact beta tag, inspect the workflow, and download/verify published assets. Record the result without closing Phase 7 or claiming physical/BRAT tests passed.
