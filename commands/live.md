---
description: Check what crawlers actually get from a running site (status, head tags, JSON-LD, robots, sitemap, OG image) without dumping full HTML
argument-hint: "<url>  e.g. http://localhost:3000/blog/post or https://example.com"
allowed-tools: Bash(curl:*), Bash(npx next-seo-doctor:*)
---

Target: `$ARGUMENTS`

If no URL was given, ask for one and stop. **Don't start, build, or deploy the app yourself.** `next dev`, `next build`, and `next start` load env files automatically. The user starts it; you only fetch.

Run these with `curl -s` and print only the extracted lines, never the full HTML. Use a bot user agent so Next.js serves metadata in `<head>` (it streams metadata into `<body>` for normal browsers):

```bash
URL="$ARGUMENTS"; ORIGIN=$(printf %s "$URL" | grep -oE '^https?://[^/]+')
UA="facebookexternalhit/1.1"

# status + redirects
curl -s -o /dev/null -A "$UA" -w "status %{http_code} · final %{url_effective} · %{num_redirects} redirects\n" -L "$URL"

# head tags that matter
curl -s -A "$UA" "$URL" | grep -oE '<title>[^<]*</title>|<meta[^>]+(name="(description|robots)"|property="og:[a-z:_]+"|name="twitter:[a-z:]+")[^>]*>|<link[^>]+rel="(canonical|alternate)"[^>]*>' | sort -u

# JSON-LD: count, types, and whether < is escaped
curl -s -A "$UA" "$URL" | grep -oE '<script type="application/ld\+json">[^<]*' | sed 's/<script type="application\/ld+json">//' | grep -oE '"@type":"[A-Za-z]+"' | sort | uniq -c

# robots.txt and sitemap
curl -s "$ORIGIN/robots.txt" | head -30
curl -s "$ORIGIN/sitemap.xml" | grep -oE '<loc>[^<]+</loc>|<lastmod>[^<]+</lastmod>' | head -20
curl -s "$ORIGIN/sitemap.xml" | grep -oE '<lastmod>[^<]+' | sort | uniq -c | sort -rn | head -3

# soft-404 check
curl -s -o /dev/null -w "missing page → %{http_code}\n" "$ORIGIN/this-page-should-not-exist-$(date +%s)"
```

Then check the `og:image` URL: `curl -sI <og:image>` must be 200 with `content-type: image/*`.

Report, per check: ✓ or ✗, what was observed, and the fix. Flag specifically:
- canonical missing, relative, pointing at another page, or at a different host
- `og:url` not equal to this page; missing `og:image`
- `noindex` on a page that should be indexed
- JSON-LD that doesn't parse, or contains a raw `</script`
- sitemap entries that all share one `lastmod` (build-time date)
- the missing page returning 200 (soft 404)
- robots.txt disallowing `/`, `/_next/`, or revealing sensitive paths

For a whole-site crawl, offer: `npx next-seo-doctor <origin>`. It reads the sitemap and checks every page. Mention that `npx` downloads it from npm the first time.

**Env files are off-limits.** Never read, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`.
