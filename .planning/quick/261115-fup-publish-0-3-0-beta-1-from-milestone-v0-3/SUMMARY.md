---
status: complete
date: 2026-11-15
quick_id: 261115-fup
release: 0.3.0-beta.1
commit: bdc5f0f53f060c10180dd2446bfb67556deb1ec1
---

# Published 0.3.0-beta.1

User explicitly authorized a beta from milestone-v0.3 after disclosure of unverified physical checks and BRAT latest behavior. Executed inline; preserved unrelated local config and untracked files. Stable Phase 7 remains incomplete at 17/19 plans; this task does not satisfy Plan 07-05 or 07-06.

- Release: https://github.com/judealnas/obsidian-tasknotes-timer-pane/releases/tag/0.3.0-beta.1
- Successful workflow: https://github.com/judealnas/obsidian-tasknotes-timer-pane/actions/runs/43735538641
- Tagged source: bdc5f0f53f060c10180dd2446bfb67556deb1ec1, from milestone-v0.3.
- Package/lock/manifest metadata aligned to 0.3.0-beta.1; plugin ID and minimum Obsidian unchanged.
- Workflow marks hyphenated tags as prereleases with latest=false and uses committed release notes. GitHub confirms isPrerelease=true and Latest=0.2.0.
- Local npm run check and GitHub's npm ci / npm run check passed build, lint, 725 tests in 28 files. Planning artifacts are excluded from lint so archived upgrade bundles are not treated as application sources.
- Published main.js matches the locally tested production build byte-for-byte. Published manifest.json and styles.css match tagged Git blobs byte-for-byte; their differences from Windows working-tree hashes are CRLF normalization.

## Downloaded SHA256

| Asset | SHA256 |
|---|---|
| main.js | 0d49928c2d505bf0972705e7e5edeaccf0596b6eff042cbdab3e8fc6188d7bee |
| manifest.json | 04dc5bfad863f7c4f8e2f71a63bff061d743f6c635e60cc09742b9913a26e095 |
| styles.css | d927d78d2852b110b9907c92820a45bd5eeb2dcbd543b43da6f067e32a115677 |

Downloaded assets are in the local Temp/tasknotes-beta-verification-261115-fup directory, outside the repository.

## Remaining limits

No real overnight, physical sleep/wake, physical mobile/touch, or actual BRAT update was performed. These limits appear in the public release notes. Native upgrade/recurrence evidence predates the beta version-only metadata change. BRAT users following latest may receive prereleases; pin 0.2.0 to stay stable. The default master branch was not changed.
