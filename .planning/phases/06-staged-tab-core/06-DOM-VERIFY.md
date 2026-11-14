---
schema_version: 1
wave: 4
outcome: could_not_look
reason: no_browser_mcp
checked: 0
passed: 0
needs_review: 0
---

The specialized wave DOM hook's Chrome MCP families are unavailable in this session. Intermediate wave hook observations were not collected. This is an observation limit, not a passing hook verdict.

The parent separately used the repository-approved CDP script fallback against the final native build. That aggregate check passed 17 assertions, including computed visible card bounds and retained keyboard focus after the CSS specificity correction. See 06-VERIFICATION.md and the repeatable expression in 06-native-check.txt. Native observations are explicitly separate from this unavailable MCP hook.
