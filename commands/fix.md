---
description: Fix the SEO problems found by the static scan, one rule at a time, then re-scan to prove it
argument-hint: "[rule-id,rule-id | all] (default: all errors and warnings)"
allowed-tools: Bash(node:*), Read, Edit, Write
hooks:
  PreToolUse:
    - matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|Bash"
      hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/env-guard.mjs"'
          timeout: 10
---

## Current scan

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" --max 50 --exit-zero`

## Your job

Scope: `$ARGUMENTS`. If empty, fix every **error** and **warn** finding. Leave info findings alone unless they're named.

1. Work one rule at a time, errors first.
2. Read only the flagged files, and only the parts you need.
3. Before writing a pattern you haven't used in this session, load the matching reference from the `nextjs-seo` skill (`references/metadata.md`, `crawlability.md`, `json-ld.md`, `og-images.md`, `i18n.md`). Follow the installed Next.js version's docs in `node_modules/next/dist/docs/` if they exist.
4. Reuse existing helpers (site config, metadata helpers, `JsonLd` component). Create a shared helper only when the same fix repeats in 3+ files.
5. Make the smallest correct change. Don't restyle or refactor surrounding code.
6. Skip a finding and say why if it's a false positive (e.g. noindex on an admin area).
7. Ask before:
   - a fix that touches more than 8 files
   - a fix that changes visible content, URLs, or which pages are indexed (adding/removing `noindex`, robots rules, redirects)
   - a fix that needs a value you don't have (site URL, verification token, GA/GTM ID). Use an env var name like `process.env.NEXT_PUBLIC_SITE_URL` in code and ask the user to set it.
8. Re-run the scan when done:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs"
   ```

   If `CLAUDE_PLUGIN_ROOT` is empty in the shell, use the script path printed by `/nextjs-seo:check`'s setup, or ask the user to re-run `/nextjs-seo:check`.
9. Report: what was fixed (`file:line`), what was skipped and why, and the before/after counts.

Don't run `next build`, `next dev`, or `next start` to verify. They load env files automatically. Suggest the user run `/nextjs-seo:live <url>` against their running site instead.

**Env files are off-limits.** Never read, write, grep, list, copy, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`, and never ask to. Editing `.env.example` (template, no secrets) is allowed.
