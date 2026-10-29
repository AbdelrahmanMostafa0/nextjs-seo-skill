---
description: Detect Google Search Console verification, GTM, GA4, and other analytics/webmaster tools in this Next.js codebase, and how each is wired
argument-hint: "[dir]"
allowed-tools: Bash(node:*), Read
hooks:
  PreToolUse:
    - matcher: "Read|Write|Edit|MultiEdit|NotebookEdit|Grep|Glob|Bash"
      hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/env-guard.mjs"'
          timeout: 10
---

## Integration scan

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" $ARGUMENTS --tools`

## Your job

Using only the scan above (don't explore the codebase):

1. List what is connected: tool name, how it's wired (`file:line`, package, verification file, or env var name), and whether it's wired the recommended way.
2. List what's missing among Search Console, Bing Webmaster Tools, and an analytics tool, with the one-step way to connect each.
3. Explain each integration finding (`analytics-*`, `gtm-and-ga4`, `gsc-not-detected`) with the fix.
4. Be clear about the limits of a code scan:
   - Search Console verified by DNS, or through a Google Analytics/GTM account, leaves no trace in code. A ✗ means "not visible in code", not "not verified".
   - IDs read from env vars are reported by variable name. Whether the variable is set in production can only be checked in the hosting dashboard. Don't try to find out by reading env files.
   - A tag in code doesn't prove it fires. Suggest Tag Assistant (tagassistant.google.com) or the browser network tab for that.

Recommended wiring for Next.js App Router:

```tsx
// app/layout.tsx
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";

export const metadata: Metadata = {
  verification: {
    google: "<search-console-token>",
    other: { "msvalidate.01": "<bing-token>" },
  },
};

// inside <html>: use GTM *or* GA, not both for the same GA4 property
<GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID!} />
```

After verification, submit `https://<domain>/sitemap.xml` in Search Console (Indexing → Sitemaps) and Bing Webmaster Tools.

**Env files are off-limits.** Never read, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`, and never ask to. If a value is needed, ask the user to set it in their hosting dashboard.
