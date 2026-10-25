# Verify and audit

Check what shipped, not what the code intended. Check a production build, which the **user** starts (`next build && next start`, or a preview deploy). Dev mode output differs. Don't run these yourself: Next.js loads env files automatically.

For a code-only audit, run the static scanner first (`/nextjs-seo:check`). It finds most of what the grep list in section 3 finds, at a fraction of the tokens.

## 1. Fetch like a crawler

```bash
# Is the body content in the HTML? 0 means no.
curl -s http://localhost:3000/blog/post | grep -c "a sentence from the article"

# Dump the head-level tags. Use a bot UA: Next.js streams generateMetadata
# into <body> for normal browsers, and only blocks it into <head> for
# HTML-limited bots. A bot UA shows what non-JS crawlers see.
curl -s -A "facebookexternalhit/1.1" http://localhost:3000/blog/post \
  | grep -oE '<(title|meta|link)[^>]*(canonical|robots|og:|twitter:|description|alternate)[^>]*>|<title>[^<]*</title>'

# JSON-LD blocks
curl -s http://localhost:3000/blog/post | grep -o '<script type="application/ld+json">[^<]*</script>'

# Status codes: missing slug must be 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/blog/does-not-exist

# Metadata routes
curl -s http://localhost:3000/sitemap.xml | head -40
curl -s http://localhost:3000/robots.txt
curl -sI http://localhost:3000/blog/post/opengraph-image
```

Per page, check:
- one `<title>`, one `description`, one self-referencing absolute canonical
- `og:title`, `og:description`, `og:url` (this page, not `/`), `og:site_name`, `og:image` (1200×630, returns 200)
- no `noindex` in production
- JSON-LD parses, `<` is escaped, `@id` refs resolve
- hreflang reciprocal (i18n sites)

## 2. Crawl the whole site: next-seo-doctor

```bash
npx next-seo-doctor http://localhost:3000
npx next-seo-doctor http://localhost:3000 --json        # machine-readable
npx next-seo-doctor http://localhost:3000 --filter /blog --only canonical,og-image
```

It crawls the sitemap and reads served HTML (no JS execution). Checks: `canonical`, `duplicate-canonicals`, `jsonld-valid`, `jsonld-graph` (dangling `@id`s, unlinked nodes), `jsonld-xss`, `robots-leak`, `og-image` (exists, 2xx, 1200×630), `sitemap-honesty` (missing or identical `lastmod`). Exit codes: 0 clean, 1 SEO errors, 2 tool couldn't run. Use it as a CI step against staging.

## 3. Static checks in the codebase

```bash
grep -rn "useEffect" app components | grep -i fetch          # client-fetched content
grep -rn "ssr: false" app components                         # client-only content
grep -rn "router.push" app components                        # onClick navigation instead of links
grep -rn "new Date()" app/sitemap.ts                         # fake lastModified
grep -rn "canonical" app --include=layout.tsx                # canonical in a layout
grep -rn "JSON.stringify" app components | grep -v u003c     # unescaped JSON-LD
grep -rn "openGraph" app --include=layout.tsx                # check for url/images in layouts
grep -rn "index: false" app                                  # noindex that may leak
```

Each hit is a lead, not a verdict. Read the code before reporting it.

## 4. External tools (after deploy)

- **Search Console → URL Inspection → Test live URL → View tested page**: the HTML Googlebot rendered. "Request indexing" is on the same screen. Submit the sitemap under Sitemaps.
- **Rich Results Test**: https://search.google.com/test/rich-results
- **Schema validator**: https://validator.schema.org
- **PageSpeed Insights**: https://pagespeed.web.dev (field CWV + Lighthouse)
- **OG preview**: https://www.opengraph.xyz or paste the link in Slack.
- `site:yourdomain.com` in Google for a rough view of what's indexed.

## Audit report format

Rank by impact:
1. Blockers: content not in HTML, `noindex` in prod, robots blocking, 5xx/soft 404s.
2. Canonical and duplicate problems.
3. Sitemap and robots problems.
4. Structured data errors (invalid, dangling `@id`, unescaped, dishonest).
5. Preview problems (OG/Twitter).
6. Performance and polish.

Each finding: `file:line`, what's wrong, the fix, and how it was observed (curl output, tool output, code read).
