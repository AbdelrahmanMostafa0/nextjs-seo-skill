---
description: Deep SEO review of one route (metadata, canonical, OG, JSON-LD, rendering, 404 handling)
argument-hint: "<route path or file>  e.g. /blog/[slug] or app/blog/[slug]/page.tsx"
allowed-tools: Bash(node:*), Bash(ls:*), Read
---

Route: `$ARGUMENTS` (ask for one if empty)

1. Find the route folder under `app/` or `src/app/`. List it with `ls` and read only: its `page.*`, its `layout.*` if present, `opengraph-image.*` if present, and the parent layouts' metadata exports (just the `metadata`/`generateMetadata` block).
2. Run the scanner on the rules that apply to a single route:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" --only page-metadata-missing,page-canonical-missing,sync-params,dynamic-route-no-notfound,og-images-shadow-file,jsonld-unescaped,client-fetched-content --max 50
   ```

   Keep only the findings for this route.
3. Work out the **effective** metadata for this route, remembering that metadata merges shallowly: a page that sets `openGraph` replaces the layout's whole `openGraph`. Report the resolved title, description, canonical, `og:url`, `og:image`, robots, and hreflang.
4. Check:
   - content in server HTML, not client-fetched
   - unique title and description, sensible lengths
   - self-referencing canonical
   - real 404 for unknown params
   - JSON-LD matches visible content
5. Report problems with `file:line` and the fix. Suggest `/nextjs-seo:live <url>` to confirm against the running page.

**Env files are off-limits.** Never read, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`.
