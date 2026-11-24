---
phase: 07-complete-roll-over-release-0-3-0
release: "0.3.0"
publication: published
acceptance: brat-upgrade-verified
---

# Phase 7 release record

| Release | Git commit | Published (UTC) | GitHub workflow | Plugin ID |
|---|---|---|---|---|
| [0.3.0](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.3.0) | `da52d990c6f2bf69dc09cab276ee50c14e5155a6` | 2026-11-24 00:38:57 | [45298719634](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/actions/runs/45298719634), success | `tasknotes-timer-pane` |
| [0.4.0](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.4.0) | `cd63530a669e302a8a0f19c2a3b2eaccabb0cd77` | 2026-11-24 01:02:02 | [45301756825](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/actions/runs/45301756825), success | `tasknotes-task-ctrl` |
| [0.5.0-beta.1](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.5.0-beta.1) | `5a2bd7ea941557feac4737bd80e715ef7d04506d` | 2026-11-24 04:25:22 | [45326121423](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/actions/runs/45326121423), success | `tasknotes-task-ctrl` |

GitHub lists 0.4.0 as Latest and 0.5.0-beta.1 as a prerelease. All three releases are published with `main.js`, `manifest.json`, `styles.css` and `THIRD_PARTY_NOTICES.md`. The published 0.3.0 hashes below come from GitHub asset metadata. The manifest identity and version were cross-checked against the tag.

| 0.3.0 asset | SHA-256 |
|---|---|
| `main.js` | `fd06dfd1edc9960397e8cd25ff0f7e16265c56007d60b659d8e9d4b92ca4a941` |
| `manifest.json` | `dbdf5ec98deaa7d0863f2060b7e44bd4b753580ee5330c1b30332c9c5412f2d3` |
| `styles.css` | `740d9793f32282654493d85fd3666db2879a5019cd51a736b1a3d3be3c785218` |
| `THIRD_PARTY_NOTICES.md` | `2b34ce38c0c5aadf326cf83dfa30169c447dd4713cf194ee60256712eae0b736` |

## Acceptance evidence

- The 0.3.0 display name is TaskNotes Task Control, with minimum Obsidian 1.12.2, plugin ID and saved view type `tasknotes-timer-pane`, and local command ID `open-timer-pane`. 0.4.0 moved the repository, install folder and generated command prefix to the new ID and kept the saved view type. Automatic transfer between plugin data folders is unverified.
- [Candidate native evidence](07-NATIVE-EVIDENCE.md) covers the production completion matrix and cold asset-swap retention. [Published BRAT acceptance](../../verification/2026-11-24-native-followup.md) records the separate in-place 0.2.0 → 0.3.0 upgrade with two pauses, preserved Timers order and saved pane. The installed 0.3.0 bundle and stylesheet matched the GitHub asset hashes.
- [Stable 0.3.0 release notes](../../../docs/releases/0.3.0.md) record the pre-release 681 feature tests and 13 vault-switch tests. [The tagged workflow](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/actions/runs/45298719634) passed for the final release commit.
- This record was reconstructed from the releases, workflow and local source. The pre-publication exact-SHA approval packet and comparison against the pre-publication reviewed build are absent from the local record.
