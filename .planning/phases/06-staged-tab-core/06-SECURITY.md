---
phase: "06"
slug: staged-tab-core
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-14"
register_authored_at_plan_time: true
---

# Phase 6 Security

All 15 distinct planned threats have implemented mitigations. L1 source inspection and the recorded automated tests support closure; this is not an independent penetration test. The common T-06-SC entry is deduplicated across four plans.

## Trust boundaries

Untrusted TaskNotes task/catalog responses cross into the projection and DOM. User selection crosses into the shared mutation queue. Saved plugin data crosses into bounded order loading and the single persistence writer.

## Threat register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and evidence | Status |
|---|---|---|---|---|---|---|
| T-06-01 | Tampering | StagingStore refresh | high | mitigate | StagingStore generation invalidation, superseding refresh/disposal guards, retained last-good items; stagingStore tests | closed |
| T-06-02 | Tampering | TaskCard title | medium | mitigate | Existing taskWikilink/text rendering, generation-scoped Components and event ownership retained; taskCard tests | closed |
| T-06-03 | Denial of service | Refresh lifecycle | medium | mitigate | Shared debounced single-flight refresh loop; dispose cancels scheduled work/subscriptions; stagingStore tests | closed |
| T-06-04 | Tampering | Stage | high | mitigate | Fresh catalog/task/status checks inside WriteQueue, revision/availability guards, fixed staged-only patch; stagingController tests | closed |
| T-06-05 | Spoofing | Picker selection | medium | mitigate | Pending/opening guards, public selectSuggestion override, nested chip-event capture; taskPickerModal tests and native batching | closed |
| T-06-06 | Information disclosure | Stage diagnostics | medium | mitigate | New staging errors use concise fixed text and path-free logs; source inspection of StagingController/Store and inline picker errors | closed |
| T-06-07 | Elevation of privilege | Unstage stop body | high | mitigate | Fresh active/ownership checks, exact path/start identity, unreadable-ownership refusal, final replacement/takeover tests | closed |
| T-06-08 | Tampering | Staged completion | high | mitigate | Disabled Complete and handler-level stagedCard/idle refusal; zero-call mounted tests in every state | closed |
| T-06-09 | Tampering | Stale card handlers | medium | mitigate | Handlers resolve current model at event time and disposed guards prevent removed-card writes; mounted stable-card tests | closed |
| T-06-10 | Denial of service | Unstage queue | medium | mitigate | Private nonqueued stopForUnstage body, single queue callback, finally refresh and busy release; barrier tests | closed |
| T-06-11 | Tampering | persistAll | high | mitigate | Main owns stagedOrder and serializes current settings/pauses/orders inside saveChain; main interleaved-save/restart tests | closed |
| T-06-12 | Denial of service | Order loader | medium | mitigate | MAX_STORED_ORDER cap, string validation, normalization, deduplication and defensive copies; stagedOrderStore tests | closed |
| T-06-13 | Spoofing | Reorder | medium | mitigate | CardList local dragKey and current-card identity checks, list-specific callbacks; cross-list/foreign-payload tests | closed |
| T-06-14 | Tampering | Rename/prune | high | mitigate | Exact/slash-boundary remap, generation invalidation, reindex retention and successful full-read plus vault-missing prune authority; stagingStore/order tests | closed |
| T-06-SC | Tampering | Package installs | high | mitigate | No packages installed; package.json and package-lock.json unchanged from execution base 8bb93284 | closed |

## Remaining API limitation

TaskNotes stop accepts a path, not a conditional path/start identity. An external actor can replace a timer after the final safety read and before stop. This pre-existing API race is documented in 06-03-SUMMARY.md; the planned mitigation performs the latest available identity and ownership checks. Closure means that mitigation exists, not that the underlying API operation is atomic.

## Accepted risks log

No additional risk acceptance was requested or inferred.

## Security audit trail

| Date | Total | Closed | Open | Method |
|---|---|---|---|---|
| 2026-11-14 | 15 | 15 | 0 | Planned-register L1 source/test verification |

All planned threats have a disposition. threats_open: 0. Verified 2026-11-14.
