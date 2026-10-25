# nextjs-seo: Claude Code plugin

Technical SEO for **Next.js App Router** projects, as a Claude Code plugin: a skill that knows the current Metadata API and Google's rules, slash commands that scan and fix your codebase, and a hook that keeps Claude away from your env files.

SEO breaks silently: no error, no warning, just worse results months later. This plugin finds those problems in the code, tells you how to fix each one, and checks the fix against what the running site actually serves.

## Install

In Claude Code:

```
/plugin marketplace add AbdelrahmanMostafa0/nextjs-seo-skill
/plugin install nextjs-seo@nextjs-seo
```

Restart Claude Code. Update later with `/plugin marketplace update nextjs-seo`.

## Commands

| Command | What it does |
| --- | --- |
| `/nextjs-seo:check [dir]` | Static scan of the codebase. Every finding comes with `file:line` and a fix. Start here. |
| `/nextjs-seo:fix [rule-id]` | Applies the fixes one rule at a time, then re-scans to prove it. Asks before changing what's indexed. |
| `/nextjs-seo:tools [dir]` | Finds Google Search Console, Bing Webmaster, GTM, GA4, Vercel Analytics, Plausible, PostHog, Clarity, Meta Pixel and more. Shows how each is wired and how to connect what's missing. |
| `/nextjs-seo:live <url>` | Fetches a running page like a crawler and checks status, canonical, OG tags, JSON-LD, robots.txt, the sitemap, and soft 404s. It doesn't dump the full HTML. |
| `/nextjs-seo:page <route>` | Reviews one route's *effective* metadata (after Next.js's shallow merge). |
| `/nextjs-seo:setup [site-type]` | Builds baseline SEO: site config, `metadataBase`, metadata helper, sitemap, robots, JSON-LD, OG image. |
| `/nextjs-seo:schema [site-type]` | Adds an `@id`-linked, XSS-safe JSON-LD graph (blog, ecommerce, saas, local, realestate, portfolio, docs). |
| `/nextjs-seo:ai [policy]` | Sets AI crawler rules (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) in robots, plus an optional `llms.txt`. |
| `/nextjs-seo:rules` | Lists every check the scanner runs. |

Without a command, the `nextjs-seo` skill loads on its own when you ask Claude things like "add a sitemap", "why is og:url wrong on my blog posts", or "audit my SEO".

## Why it's cheap on tokens

`check`, `tools`, and `fix` don't have Claude explore your repo. A zero-dependency Node script (`scripts/seo-check.mjs`) reads the source as text, runs 36 rules, and prints a few lines per finding. Claude reads that output and opens only the flagged lines. A full `/nextjs-seo:check` on the test fixture (22 findings, explained with code fixes) cost under one cent on Haiku.

The scanner never executes your code, never starts your app, and never opens env files.

You can run it without Claude too, for example in CI:

```bash
node scripts/seo-check.mjs path/to/next-app            # human-readable, exit 1 on errors
node scripts/seo-check.mjs path/to/next-app --json     # machine-readable
node scripts/seo-check.mjs path/to/next-app --tools    # integrations only
node scripts/seo-check.mjs . --only sitemap-fake-lastmod,jsonld-unescaped
```

## What it checks

Crawl/index blockers, metadata, sitemap and robots, structured data, previews, i18n, and performance. Some examples:

- `noindex` in a layout with no environment check
- robots blocking `/` or `/_next/`
- `params` read synchronously (it's a Promise since Next 15)
- canonical or hreflang set in a layout (every child page inherits it)
- `openGraph.url` in a layout, or `twitter.images` overriding per-page OG images
- page metadata missing, or missing a canonical
- `new Date()` as sitemap `lastModified`; relative sitemap URLs
- robots `Disallow` lines that leak sensitive paths
- JSON-LD serialized without escaping `<` (an XSS sink)
- `FAQPage`/`HowTo` schema, whose rich results Google retired (FAQ on May 7, 2026)
- localized routes without hreflang, or without `x-default`
- deprecated `metadata.themeColor`, deprecated `next/image` `priority` (Next 16)
- analytics loaded `beforeInteractive`, GTM + direct GA4 double counting, no consent handling

Run `/nextjs-seo:rules` for the full list.

## Env-file guard

The plugin ships a `PreToolUse` hook that blocks any tool call that reads, writes, lists, greps, sources, or loads `.env`, `.env.*`, `.envrc`, or `.dev.vars`. That includes `dotenv`, `--env-file`, `source .env`, and `printenv`. `.env.example` and other templates stay accessible.

The hook is active in every session while the plugin is enabled, not only during SEO commands. That's deliberate: secrets stay out of the model's context whatever you're doing. The commands also never run `next dev`, `next build`, or `next start`, because Next.js loads env files automatically. Start the app yourself and point `/nextjs-seo:live` at it.

## Background

The rules come from these write-ups, where every pattern runs on the site that hosts them:

- [Technical SEO in Next.js: crawlability, sitemaps, canonicals, and JSON-LD](https://abdelrahmanmostafa.com/blog/technical-seo-in-nextjs)
- [JSON-LD schema templates by site type](https://abdelrahmanmostafa.com/schema-guide)
- [Next.js localization and hreflang](https://abdelrahmanmostafa.com/blog/multi-language-site-in-nextjs)
- [next-seo-doctor](https://github.com/AbdelrahmanMostafa0/next-seo-doctor): crawls a running site, pairs well with `/nextjs-seo:live`

## Contributing

New rules, commands, and integrations are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). `npm test` runs every rule against the fixtures and the env guard against sample tool calls.

## License

MIT
