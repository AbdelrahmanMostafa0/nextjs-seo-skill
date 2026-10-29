---
description: List every check the nextjs-seo scanner runs, with severity
allowed-tools: Bash(node:*)
hooks:
  PreToolUse:
    - matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|Bash"
      hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/env-guard.mjs"'
          timeout: 10
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" --list-rules`

Show the list above as-is. Mention that `/nextjs-seo:check --only <id>` runs one rule and `--skip <id>` turns one off. Don't add commentary.
