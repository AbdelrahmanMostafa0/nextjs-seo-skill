---
description: Set up baseline technical SEO in a Next.js App Router project (site config, metadataBase, metadata helper, sitemap, robots, JSON-LD, OG image)
argument-hint: "[site type: blog | ecommerce | saas | local | portfolio | docs]"
allowed-tools: Bash(node:*), Read, Edit, Write
---

## What already exists

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" --max 5 --exit-zero`

## Your job

Load the `nextjs-seo` skill and follow its **Implement** workflow, using the scan above to skip what's already done. Site type: `$ARGUMENTS` (ask if empty and it isn't obvious from the routes).

1. Check `package.json` for the Next.js version and read the matching docs in `node_modules/next/dist/docs/` before writing code.
2. Ask the user once, together, for anything you can't infer: production URL, site name, author/organization name, social profiles (`sameAs`). Use `process.env.NEXT_PUBLIC_SITE_URL` for the URL in code and tell the user to set it in their host. Don't read env files to look for it.
3. Build in order, reusing existing files: `lib/site.ts` → root layout (`metadataBase`, title template, `viewport`) → `pageOpenGraph` helper → per-page `generateMetadata` with canonicals → `app/sitemap.ts` → `app/robots.ts` → `JsonLd` component + schema graph for the site type → `opengraph-image`.
4. Re-run the scan and report what was added and what's left.

**Env files are off-limits.** Never read, write, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`, and never ask to. You may add variable names to `.env.example`.
