---
status: complete
date: 2026-11-15
quick_id: 261115-ilj
commit: a91c0a8
---

# Simplified empty Staged tab and embedded screenshot

Removed the Staged header Stage button and normal empty-list heading/body. The empty ready state now shows one + insertion button below the tabs. Loading, setup and error/retry messages remain. Updated existing mounted-view expectations and README.

Verification: npm run check passed production build, zero-warning lint and 636 tests in 28 files. Native guarded sandbox with TaskNotes 4.18.2 loaded build mainjs=369ac0338a7e from this dirty checkout. native-empty.json verifies no Stage header or empty copy, exactly one enabled +, count zero, and successful picker opening. capture-empty.mjs records the reproducible capture procedure.

Screenshot empty-staged.png is an actual 480x360 native renderer capture, visually inspected. A temporary empty snapshot supplied the empty-list state; all 36 existing staged tasks were left staged and the snapshot was restored afterward. No task mutations were used. Production main.js SHA256: 369ac0338a7ed2d21504c1b39b723cb7db6fbfabfa75073761e07f59a21bbaa3.

Copied the screenshot to Personal Vault/Obsidian Task Pane/attachments/AI_Timer Pane empty Staged 2026-11-15.png and embedded it in Timer Pane v0.3 beta notes.md inside a dated expanded AI Contribution callout. Verified screenshot bytes match and the original note bytes remain an unchanged prefix, then read back the appended block. Screenshot SHA256: 422a5dc38c53d020a2ef6b66abeeffad03d6647e0cd1e01f8b37341bf33c3b29.

Before UAT, all five existing pane assets/data/workspace files were backed up and hash-verified, and disk-only restoration was proved. UAT was stopped after capture and all five original hashes restored. Backup is in Temp/tasknotes-empty-staged-261115-ilj-backup. No new beta was published and nothing pushed. Pre-existing config/local/lock/cache changes remain excluded.
