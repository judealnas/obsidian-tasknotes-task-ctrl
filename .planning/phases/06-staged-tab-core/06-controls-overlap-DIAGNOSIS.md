---
status: diagnosed
gap_id: G-06-6
phase: 06-staged-tab-core
---

# Overlapping card controls

User accepted neutral age wording/appearance and separately reported the X button overlapping the reorder grip. The existing native screenshot 06-age-review.png shows this overlap.

Native measurement on the guarded worktree build e5d33c6+dirty, main.js hash prefix 9fd9432d5f62, TaskNotes 4.18.2:

| Element | Left | Right | Width | Height | Padding | Inline-end |
|---|---:|---:|---:|---:|---|---:|
| Reorder handle | 846.5 | 870.5 | 24 | 24 | 0 | 36 |
| Unstage | 863.875 | 898.5 | 34.625 | 30 | 4px 12px | 8 |

Card width: 448px. Horizontal intersection: 6.625px. Values are CSS pixels.

styles.css positions both buttons absolutely. The staged grip rule reserves a fixed offset, but .tntp-unstage leaves width/height/padding to Obsidian. Inherited button padding expands the X button into the grip. TaskCard.ts creates the grip first and the Unstage button later; the overlap can obscure part of the grip's hit area. No click misrouting was claimed as reproduced.

Fix property: explicitly size the neighboring controls, remove inherited padding from the icon-only button, retain a positive gap and reserve the corner area from title content. 06-05-PLAN.md includes native width/state/title/direction and hit-target verification. No product source was changed during diagnosis. Temporary fixture was removed, saved order cleaned up, and the isolated UAT process stopped.
