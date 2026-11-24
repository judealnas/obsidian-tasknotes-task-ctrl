# Native acceptance follow-up

Run on November 24, 2026 UTC in two separate temporary vaults named `dev-vault`, using the guarded hidden Obsidian launcher and its loopback debugging interface. Obsidian 1.15.1, TaskNotes 4.18.2 with public API v1, and BRAT 2.2.0 ran in both fixtures. Each fixture started with only TaskNotes and BRAT enabled. The repository's usual dev-vault and Personal Vault were outside both sessions.

## BRAT update to 0.5.0-beta.1

- In BRAT's **Add a beta plugin for testing** dialog, entered `judealnas/obsidian-tasknotes-task-ctrl`, selected `0.4.0`, and enabled it after installation. BRAT reported registration, and Obsidian loaded `tasknotes-task-ctrl` at `0.4.0`.
- Used the Timers selector to add an existing fixture without starting it. The card rendered with **Start**, and `data.json` contained its path under `idleTaskPaths` and its key under `cardOrder`.
- Opened BRAT's **Change plugin version** dialog via the same launcher used by its settings edit action. Selected `0.5.0-beta.1` and clicked **Change version**. BRAT reported that it reinstalled and reloaded the plugin at `0.5.0-beta.1`. Obsidian loaded that version under the same plugin ID. Parsed plugin data matched its pre-update value, and the idle card appeared in the pane.
- The installed `main.js` and `styles.css` SHA-256 values matched the published GitHub asset digests. BRAT reformatted `manifest.json`; the installed properties matched the tagged manifest. The beta tag points to `5a2bd7ea941557feac4737bd80e715ef7d04506d`. [0.4.0 release](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.4.0) · [0.5.0-beta.1 release](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.5.0-beta.1) · [Release workflow](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/actions/runs/45326121423)

| Published beta asset | Installed SHA-256 |
| --- | --- |
| `main.js` | `a22bf2342622617f26e87abd125ad38d4da91e140bca913cd2b78f56f1e3d9d0` |
| `styles.css` | `4d7bca6e274342263dc50fbdf3c9b846524393f3a25260fd337db675ce7063c9` |

## Selector, setup and idle cards on the published beta

| Check | Native result |
| --- | --- |
| Configure staged field | Clicking the settings action added and saved exactly one `staged` Date field with no default. The button became disabled and the positive setup message appeared. An unrelated custom field, the task form layout and the existing fixture task bytes matched their pre-click values. |
| Timers Enter | Selected the existing highlighted task, closed the selector and added an idle card without creating a file. Enter with no matching result left the selector open and created no file. |
| Timers Shift+Enter | Created one task from the typed query, closed the selector and added the task as an idle card. The file used the TaskNotes default open status and contained no time entries. |
| Staged Enter | Selected and staged the existing highlighted task with today's local date and no new file. The selector remained open, kept the query, and removed the staged task from its results. |
| Staged Shift+Enter | Created and staged one task from a query containing `due tomorrow`. The note contained the next local day's due date and the current local staging date. The query and input focus remained. Repeating Shift+Enter for the unchanged query created no duplicate. The metadata-only query `due tomorrow` prompted for a title and created no file. Escape closed the selector. |
| Cold restart | Stopped the first process and launched the beta from the BRAT-installed files with the build skipped. Three idle cards rendered in the saved order and the Timers count was zero. Both staged paths and the configured date field persisted. The TaskNotes active timer list was empty before and after restart. |

Enter, Shift+Enter and Escape were delivered as browser key input to the running Obsidian app. The settings button and pane actions used the app controls. This run covered these desktop interaction paths on TaskNotes 4.18.2. Physical mobile/touch and the full keyboard and input method matrix remain open.

## BRAT update from stable 0.2.0 to stable 0.3.0

- In the second temporary vault, used the same BRAT repository entry to install and enable `0.2.0` under the legacy plugin ID `tasknotes-timer-pane`. Obsidian loaded that version. Used the TaskNotes public API to create and start two fixture tasks, clicked **Pause all** in the pane, then pressed Down on the first card's reorder handle. The pane rendered both paused cards in the reversed order and saved two pause records and two timer-order keys.
- Selected `0.3.0` through BRAT's **Change plugin version** dialog. BRAT confirmed reinstall and reload. Obsidian loaded `0.3.0` under `tasknotes-timer-pane`; the existing view type remained `tasknotes-timer-pane`. Both saved cards appeared paused in the same order and the active timer list was empty. Before and after, parsed plugin data matched for `completionStatus: null`, `pauseRecordsVersion: 1`, both full pause records and both timer-order keys.
- The installed stable `0.3.0` `main.js` SHA-256 was `fd06dfd1edc9960397e8cd25ff0f7e16265c56007d60b659d8e9d4b92ca4a941` and `styles.css` SHA-256 was `740d9793f32282654493d85fd3666db2879a5019cd51a736b1a3d3be3c785218`. Both matched the published release. The `0.2.0` proof used the runtime version and BRAT registration notice. [0.2.0 release](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.2.0) · [0.3.0 release](https://github.com/judealnas/obsidian-tasknotes-task-ctrl/releases/tag/0.3.0)
- The separate historical cold-upgrade rehearsal covered a non-default completion preference, seeded staged order and unknown data. This BRAT fixture used the completion default and had no seeded staged order or unknown data. [Cold rehearsal](../phases/07-complete-roll-over-release-0-3-0/07-upgrade-cold-restart-result.json)

## Local relationship chip follow-up

The guarded launcher built the local source at `5a2bd7e` with the relationship-rendering changes in the working tree. The tested source and build inputs match commit `5430b4c`. The installed `main.js` SHA-256 was `a873b6a84e6c5eac1b9e5426cf5fa46bec3bc9f1cf7979644a54f462134ba205`. The published beta checks above used the separate GitHub release hash.

- Created one parent, one main task and one completed child in the temporary vault. TaskNotes' public relationship API resolved the parent and child from project links. Added the main task as an idle card through the Timers selector.
- With TaskNotes' overlay enabled, the main task, parent and child all contained TaskNotes' inline widget with native status and priority dots. The relationship area contained no custom status markers. The disclosure initially closed, displayed `Subtasks · 1 of 1 complete`, and showed the completed child after clicking it.
- At a 256 px card width, the long parent title wrapped and the card had no horizontal overflow. Inspected a screenshot of the expanded card.
- A right-click on each relationship chip opened TaskNotes' context menu. Choosing **Open note** opened that relationship's own file for both the parent and child.
- Turned the TaskNotes overlay off in the isolated fixture and reopened the pane. Both relationships rendered as internal note links. Clicking the parent link opened its file. Right-clicking the child link and choosing **Open note** opened the child file.

All hidden sessions were stopped after verification. The temporary vaults and their fixtures were removed.
