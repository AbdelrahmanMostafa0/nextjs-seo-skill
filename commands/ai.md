---
description: Configure AI crawler access (GPTBot, ClaudeBot, PerplexityBot, Google-Extended...) in robots.ts and optionally add llms.txt
argument-hint: "[allow-all | search-only | block-training | block-all]"
allowed-tools: Read, Edit, Write, WebFetch
---

Policy requested: `$ARGUMENTS`

1. Load `references/performance-and-ai.md` from the `nextjs-seo` skill.
2. If no policy was given, ask the user, explaining the options in one line each:
   - **allow-all**: visible in AI answers, and content may be used for training
   - **search-only**: allow AI *search* bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot), block *training* bots (GPTBot, ClaudeBot, Google-Extended, CCBot)
   - **block-training**: same as search-only
   - **block-all**: block every AI bot. The site won't be cited in AI answers.
3. Before writing rules, confirm the current user-agent tokens from the vendors' docs (OpenAI, Anthropic, Perplexity, Google crawler pages). They change.
4. Edit `app/robots.ts` (or `public/robots.txt`). Keep the existing `*` rule and sitemap. Never add `Googlebot` or `Bingbot` blocks here; those control normal search.
5. Offer `app/llms.txt/route.ts`: a short Markdown index of the site's key pages, built from the same content source as the sitemap. Say plainly that no major AI provider has committed to reading it.
6. Note: robots.txt is advisory. User-triggered fetchers (ChatGPT-User, Claude-User) may not honor it. Hard blocks need CDN/WAF rules.

**Env files are off-limits.** Never read, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`.
