# Phase 7: Complete, Roll Over & Release 0.3.0 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 7-complete-roll-over-release-0-3-0
**Areas discussed:** Completion feedback, Done today display, Mobile reorder controls, Rollover transition

---

## Completion feedback

### How should a successful ✓ be confirmed?
| Option | Description | Selected |
|--------|-------------|----------|
| Quiet update | Update the card or Done today section without a success notice. | ✓ |
| Obsidian notice | Show a brief Obsidian notice. | |
| Inline message | Show an inline success message in the pane. | |

**User's choice:** Quietly update the card or Done today section, with no success notice.

### Where should failures or partial success be explained?
| Option | Description | Selected |
|--------|-------------|----------|
| Existing notices | Use the existing Obsidian notices, including the partial-success warning. | ✓ |
| Inline card message | Show an inline message on the affected card. | |
| Both | Show a notice and an inline message. | |

**User's choice:** Keep the existing Obsidian notices.

### How should ✓ appear when completion is unavailable?
| Option | Description | Selected |
|--------|-------------|----------|
| Disabled with explanation | Keep ✓ visible but disabled, with an explanation. | ✓ |
| Enabled with notice | Keep ✓ enabled and show the existing notice if clicked. | |
| Hidden | Hide ✓ until completion is available. | |

**User's choice:** Keep ✓ visible but disabled, with an explanation.

### How should duplicate clicks be prevented while completion runs?
| Option | Description | Selected |
|--------|-------------|----------|
| Existing busy state | Disable controls using the existing busy state, with no added animation. | ✓ |
| Button spinner | Disable ✓ and show a spinner on that button. | |
| Leave enabled | Leave controls enabled. | |

**User's choice:** Use the existing busy state to disable controls.

---

## Done today display

### What should appear when no tasks are completed?
| Option | Description | Selected |
|--------|-------------|----------|
| Empty-state message | Show “Nothing completed yet”. | ✓ |
| Hide section | Hide Done today until it has an item. | |
| Heading only | Show the heading without a message or tasks. | |

**User's choice:** Show “Nothing completed yet”.

### What should each completed task show?
| Option | Description | Selected |
|--------|-------------|----------|
| Clickable title | Show a clickable task title only, without timer controls. | ✓ |
| Title and time | Show the title plus its completion time. | |
| Compact card | Show a compact task card with additional details. | |

**User's choice:** Clickable task title only.

### How should completed tasks be ordered?
| Option | Description | Selected |
|--------|-------------|----------|
| Staged order | Keep the existing Staged order. | |
| Most recent first | Put the most recently completed task first. | ✓ |
| Alphabetical | Sort task titles alphabetically. | |

**User's choice:** Most recently completed first.

### What if a task is reopened before rollover?
| Option | Description | Selected |
|--------|-------------|----------|
| Remove | Remove it when TaskNotes shows it is no longer completed. | ✓ |
| Keep as history | Keep it in Done today until rollover. | |

**User's choice:** Remove it when TaskNotes shows it is no longer completed.

---

## Mobile reorder controls

### Where should the arrows appear?
The assistant offered the existing action row, beside the title, or a card menu. The user specified: “Arrows on the left side of the card.”

### How should the arrows be arranged?
| Option | Description | Selected |
|--------|-------------|----------|
| Vertical | Stack ▲ above ▼. | ✓ |
| Side by side | Place them next to each other. | |
| Other | Describe another arrangement. | |

**User's choice:** Stack ▲ above ▼ vertically.

### What should happen at the top or bottom of the list?
| Option | Description | Selected |
|--------|-------------|----------|
| Disable | Disable the arrow that cannot move the card farther. | ✓ |
| Hide | Hide the arrow at that boundary. | |
| Wrap | Move the card to the other end of the list. | |

**User's choice:** Disable the arrow at the list boundary.

### How should a move be confirmed?
| Option | Description | Selected |
|--------|-------------|----------|
| Screen-reader announcement | Announce the task’s new position without a visual notice. | ✓ |
| Silent | Update the position silently. | |
| Visual notice | Show a brief visual notice. | |

**User's choice:** Announce the task’s new position to screen readers, without a visual notice.

---

## Rollover transition

### Should rollover notify the user?
| Option | Description | Selected |
|--------|-------------|----------|
| Quiet refresh | Refresh Staged and Done today quietly. | ✓ |
| Obsidian notice | Show a brief notice that the new staging day started. | |
| Inline message | Show a message in the pane. | |

**User's choice:** Refresh quietly.

### Should unfinished tasks keep their order?
| Option | Description | Selected |
|--------|-------------|----------|
| Preserve | Preserve the manually chosen Staged order. | ✓ |
| Reset | Reset to the default order. | |
| Other | Describe another behavior. | |

**User's choice:** Preserve the manually chosen order.

### When should a changed rollover-hour setting take effect?
| Option | Description | Selected |
|--------|-------------|----------|
| Immediately | Recalculate immediately; clear Done today if the staging day changes. | ✓ |
| Next rollover | Apply the setting at the next rollover. | |
| Confirm first | Ask before changing the displayed day. | |

**User's choice:** Recalculate immediately.

### How should staged age change after sleep across multiple staging days?
| Option | Description | Selected |
|--------|-------------|----------|
| Actual elapsed days | Reflect the actual days elapsed since staging. | ✓ |
| One increment per wake | Increase by one each time Obsidian wakes. | |
| Other | Describe another behavior. | |

**User's choice:** Reflect the actual days elapsed since staging.

---

## the agent's Discretion

No explicit “you decide” selections.

## Deferred Ideas

None.
