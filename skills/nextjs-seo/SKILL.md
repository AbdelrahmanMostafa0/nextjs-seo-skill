---
name: nextjs-seo
description: Technical SEO for Next.js App Router sites — audit or implement metadata (generateMetadata, metadataBase, canonicals, Open Graph, Twitter), sitemap.ts, robots.ts, JSON-LD structured data graphs, opengraph-image files, hreflang for i18n, crawlability, Core Web Vitals, and AI-crawler access. Use when the user asks to "add SEO", "fix SEO", "audit SEO", set up a sitemap/robots/canonical/OG image/structured data/schema/JSON-LD/hreflang in a Next.js project, asks why a page isn't indexed or why link previews are wrong, or mentions next-seo-doctor.
---

# Next.js SEO

Technical SEO for the **Next.js App Router** in TypeScript: the parts of SEO that live in code. Content strategy and keyword research are out of scope unless the user asks.

The core idea: **SEO breaks silently.** Nothing errors, results just get worse months later. So every change ends with verifying the *served HTML*, not the source code.

## Env files are off-limits

Never read, write, edit, copy, grep, list, source, print, diff, or delete env files (`.env`, `.env.local`, `.env.production`, any `.env.*`, `.envrc`, `.dev.vars`), and never ask to. `.env.example` and other templates are fine to read and edit.

This covers indirect access too. Don't run `next dev`, `next build`, or `next start`; they load env files automatically. Don't use `dotenv`, `--env-file`, or `source`. Refer to config by variable name (`process.env.NEXT_PUBLIC_SITE_URL`) and ask the user to set real values in their host. The plugin's env-guard hook blocks these calls anyway; don't try to work around it.

## Commands

| Command | What it does |
| --- | --- |
| `/nextjs-seo:check` | Static scan of the codebase, findings with `file:line` and fixes. Cheapest way to start. |
| `/nextjs-seo:fix [rule]` | Apply fixes for scan findings, then re-scan. |
| `/nextjs-seo:tools` | Detect Search Console, Bing, GTM, GA4, and other analytics, and how they're wired. |
| `/nextjs-seo:live <url>` | Check what a running site actually serves to crawlers. |
| `/nextjs-seo:page <route>` | Deep review of one route's effective metadata. |
| `/nextjs-seo:setup [type]` | Build baseline SEO in a project. |
| `/nextjs-seo:schema [type]` | Add an `@id`-linked JSON-LD graph. |
| `/nextjs-seo:ai [policy]` | AI crawler rules in robots + optional llms.txt. |
| `/nextjs-seo:rules` | List the scanner's checks. |

To find problems without a command, run the scanner instead of reading files: `node "${CLAUDE_PLUGIN_ROOT}/scripts/seo-check.mjs" [dir] [--tools] [--only ids]`. Its output is a few lines per finding. If `CLAUDE_PLUGIN_ROOT` isn't set, the script is at `../../scripts/seo-check.mjs` relative to this skill's folder.

## Step 0: check the Next.js version first

APIs change between majors. Before writing code:

1. Read `package.json` for the `next` version.
2. If `node_modules/next/dist/docs/` exists, read the relevant page there before writing code. It matches the installed version. Key pages:
   - `01-app/03-api-reference/04-functions/generate-metadata.md`
   - `01-app/03-api-reference/03-file-conventions/01-metadata/` (sitemap, robots, opengraph-image, icons, manifest)
   - `01-app/02-guides/json-ld.md`
   - `01-app/03-api-reference/05-config/01-next-config-js/htmlLimitedBots.md`
3. Respect the project's `AGENTS.md`/`CLAUDE.md` if it says the Next.js version differs from your training data.

Facts true as of Next.js 16 (verify on other versions):
- `params` and `searchParams` are Promises in pages, `generateMetadata`, and `opengraph-image.tsx`. Always `await` them.
- `generateSitemaps` passes `id` as a `Promise<string>`.
- `themeColor`, `colorScheme`, and `viewport` belong in `export const viewport` / `generateViewport`, not in `metadata`.
- Metadata from `generateMetadata` can **stream** into `<body>` for JS-capable bots. HTML-limited bots (detected by user agent, see `htmlLimitedBots`) get it blocking in `<head>`. This affects how you verify (see `references/verify.md`).
- `next/image` `priority` is deprecated in favor of `preload`.
- `PageProps<"/route">` is a global type helper for page props (no import).
- The Pages Router (`next/head`, `next-seo` package) is a different system. Only use it if the project is on `pages/`.

## Workflow

Decide the mode from the request:

**Audit** ("check my SEO", "why isn't this indexed"): find the issues, report them ranked by impact, then fix only if asked. Follow `references/verify.md`. Start with crawlability, because nothing else matters if the crawler can't read the page.

**Implement** ("add SEO", "add a sitemap"): build the pieces in this order, since each depends on the previous one:

1. **Crawlability**: content in server HTML, real links, real 404s, no stray `noindex`. See `references/crawlability.md`.
2. **Site config + `metadataBase`**: one `lib/site.ts` (name, URL from env, author, `sameAs`). Set `metadataBase` once in the root layout.
3. **Metadata**: title template, descriptions, canonicals, Open Graph helper. See `references/metadata.md`.
4. **`sitemap.ts` + `robots.ts`**: computed from content, honest dates. See `references/crawlability.md`.
5. **JSON-LD graph**: `@id`-linked nodes, XSS-safe component. See `references/json-ld.md`.
6. **OG images**: `opengraph-image` file convention. See `references/og-images.md`.
7. **i18n** (only if the site has locales): hreflang per page. See `references/i18n.md`.
8. **Performance and AI crawlers** if asked or relevant: see `references/performance-and-ai.md`.
9. **Verify**: `references/verify.md`. Never skip this step.

Before adding anything, look at what the project already has (`grep -r "generateMetadata\|metadataBase\|application/ld+json" app lib components`). Extend existing helpers instead of creating parallel ones.

## Non-negotiable rules

These are the mistakes that most often ship. Check every change against them.

1. **Content must be in the initial HTML.** No indexable content fetched in `useEffect`, behind `dynamic(..., { ssr: false })`, or gated on a `mounted` flag. `"use client"` components are fine: they still render on the server.
2. **Set `metadataBase` once; keep canonicals relative.** Hardcoded absolute URLs let preview deployments claim to be canonical.
3. **Canonicals go in each page's `generateMetadata`, never in a layout.** Layout metadata is inherited, so a layout canonical makes every child page a duplicate of the layout's URL.
4. **Metadata merges shallowly.** A page that sets `openGraph` (or `twitter`, `robots`, `alternates`) replaces the parent's whole object. Build `openGraph` from a shared helper. Never put `openGraph.url` in the root layout.
5. **Explicit `openGraph.images` beats the `opengraph-image` file.** Don't put a default image in a shared helper or the layout, or every page's own image disappears. Same for `twitter.images`: leave it unset so it falls back to `og:image`.
6. **Escape JSON-LD.** `JSON.stringify(data).replace(/</g, "\\u003c")`. Plain `JSON.stringify` is an XSS sink when titles or CMS content contain `</script>`.
7. **Link JSON-LD nodes with `@id`.** One `Person`/`Organization` node, referenced from every page. On pages that don't declare the full node, the reference also carries `name` and `url`, because Google doesn't resolve `@id`s declared on other pages.
8. **Structured data must match visible content.** No ratings without real visible reviews, no `InStock` that isn't true, no FAQ schema for text not on the page.
9. **Sitemap `lastModified` comes from real content dates**, never `new Date()` at build time.
10. **`robots.txt` disallow is not access control.** It's public. Never list secret paths there. Protect them with auth.
11. **Missing pages return 404.** Call `notFound()`; set `dynamicParams = false` when `generateStaticParams` lists every valid slug.
12. **Gate `noindex` on the environment**, so a preview-only `robots: { index: false }` can't leak to production.

## Current search landscape (checked October 2026)

- **FAQ rich results are gone.** Google stopped showing them on May 7, 2026. `FAQPage` is still valid schema and harmless to keep, but don't promise a rich result. HowTo rich results have been gone since 2023.
- Google's supported rich-result features include Article, Breadcrumb, Product (and merchant listing), Review snippet, Local business, Organization, Profile page, Software app, Event, Recipe, Video, Discussion forum, Q&A, Job posting, Dataset, Course list. Check `https://developers.google.com/search/docs/appearance/structured-data/search-gallery` before promising any rich result, as this list changes.
- Core Web Vitals: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, at the 75th percentile of field data.

When a claim about Google's behavior matters to the user's decision, re-check the official Search Central docs rather than relying on this list.

## Reporting

For audits, report findings ranked by impact: crawl/index blockers first, then canonical/duplicate issues, then structured data, then previews and polish. For each finding give the file, the problem, and the fix. After implementing, show the verification output (curl, build, or `next-seo-doctor`) rather than claiming it works.
