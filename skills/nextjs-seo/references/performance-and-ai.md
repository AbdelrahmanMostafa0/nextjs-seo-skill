# Performance and AI crawlers

## Core Web Vitals

Good thresholds, at the 75th percentile of real-user data: **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.** Field data (CrUX, Search Console) decides; Lighthouse is a lab estimate.

Next.js levers:

- **LCP**: the hero image uses `next/image` with `preload` (Next 16+; `priority` before 16, deprecated in 16) and correct `sizes`. Don't lazy-load above-the-fold images. Avoid client-side-only hero content. Prefer static or cached rendering for landing pages.
- **CLS**: `next/image` with `width`/`height` or `fill` inside a sized container. `next/font` (self-hosted, `size-adjust` fallback) instead of `<link>` to Google Fonts. Reserve space for embeds, ads, and banners.
- **INP**: keep client JS small. Push work into Server Components. Load heavy third-party scripts with `next/script` `strategy="lazyOnload"` or `"afterInteractive"`. Split long event handlers; use `useTransition` for non-urgent updates.
- Measure with `useReportWebVitals` from `next/web-vitals` or Vercel Speed Insights.

## Other technical checks

- One canonical host: redirect `www`↔apex and `http`→`https` with 301/308 (in `next.config` `redirects()` or at the host).
- Consistent trailing slash policy (`trailingSlash` in `next.config`).
- Permanent URL changes use `permanentRedirect()` or `redirects()` with `permanent: true`. Never redirect-chain.
- Images: descriptive `alt`, meaningful filenames.
- Mobile-friendly viewport (Next.js sets it by default).

## AI crawlers

AI crawlers mostly don't run JavaScript, so server HTML (see `crawlability.md`) matters even more for them.

Main vendors split crawlers by purpose. Verify user-agent names against each vendor's own docs before shipping rules, since they change:

| Vendor | Training | Search index | User-triggered fetch |
| --- | --- | --- | --- |
| OpenAI | `GPTBot` | `OAI-SearchBot` | `ChatGPT-User` |
| Anthropic | `ClaudeBot` | `Claude-SearchBot` | `Claude-User` |
| Google | `Google-Extended` (a robots.txt token, not a separate crawler; doesn't affect Search ranking) | `Googlebot` | — |
| Perplexity | — | `PerplexityBot` | `Perplexity-User` |

Common policy: allow search bots (visibility in AI answers), decide on training bots per the owner's preference. Ask the user; don't choose for them.

```ts
// app/robots.ts
rules: [
  { userAgent: "*", allow: "/", disallow: ["/api/"] },
  { userAgent: ["GPTBot", "ClaudeBot", "Google-Extended"], disallow: "/" }, // only if the user opts out of training
],
```

User-triggered fetchers may not fully honor robots.txt. Hard blocking needs CDN/WAF rules.

## llms.txt

`/llms.txt` is a proposed Markdown index of a site's key content for LLMs. No major AI provider has officially committed to using it. It's cheap to add as a route handler (`app/llms.txt/route.ts` returning `text/plain`), but don't present it as a ranking factor.
