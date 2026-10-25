---
description: Scan this Next.js codebase for SEO problems and say how to fix each one (static scan, low token cost)
argument-hint: "[dir] [--only rule,rule] [--skip rule,rule] [--max N]"
allowed-tools: Bash(node:*), Read
---

## Scan output

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" $ARGUMENTS --exit-zero`

## Your job

The scan above is the source of truth. It already read the codebase, so **don't explore the project yourself**.

1. If the scan says there is no `next` dependency, tell the user to run the command from the Next.js project root (or pass the app dir, e.g. `/nextjs-seo:check apps/web`) and stop.
2. Report findings grouped by severity (error, then warn, then info). For each rule give:
   - the locations (`file:line`, clickable)
   - one sentence on why it hurts SEO
   - the concrete fix: a short code snippet when the fix is code
3. Read code only when the fix depends on what's there. Read just the flagged lines (`offset` = line − 10, `limit` = 25). Never read whole directories.
4. Rules are heuristics. If reading a flagged line shows a false positive (e.g. noindex on a page that should be private), say so and drop it.
5. Keep info-level findings to one line each.
6. End with one line: run `/nextjs-seo:fix` to apply the fixes, or `/nextjs-seo:fix <rule-id>` for one rule.

For background on any rule, the `nextjs-seo` skill's `references/` files have the full explanation. Load one only if the user asks why.

**Env files are off-limits.** Never read, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`, and never ask to. `.env.example` is fine. Refer to variables by name only.
