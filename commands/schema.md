---
description: Add or fix an @id-linked JSON-LD structured-data graph for this site type, XSS-safe
argument-hint: "[blog | ecommerce | saas | local | realestate | portfolio | docs] [route]"
allowed-tools: Bash(node:*), Bash(grep:*), Read, Edit, Write
---

## Existing structured data

!`grep -rln --include=*.ts --include=*.tsx --include=*.js --include=*.jsx -e "application/ld+json" -e "@context" app src lib components 2>/dev/null | head -20 || true`

## Your job

Request: `$ARGUMENTS`

1. Load `references/json-ld.md` from the `nextjs-seo` skill.
2. If structured data already exists (files listed above), read only those files and extend them. Don't create a parallel system.
3. Pick the schema types from the site-type table. Infer the type from the routes if it isn't given.
4. Build typed builder functions (`lib/seo/schema.ts`): one site-wide `Person`/`Organization` + `WebSite` with stable `@id`s, per-page nodes referencing them, and `BreadcrumbList` for nested routes.
5. Render through one `JsonLd` component that escapes `<` as `<`.
6. Data must come from the same source that renders the visible page. Never hardcode prices, availability, ratings, or dates.
7. Don't add `FAQPage` or `HowTo` expecting rich results (FAQ ended May 7, 2026; HowTo in 2023).
8. Finish by giving the user the Rich Results Test link (https://search.google.com/test/rich-results) and the Schema validator (https://validator.schema.org) to check the deployed page.

**Env files are off-limits.** Never read, grep, list, or load `.env`, `.env.*`, `.envrc`, or `.dev.vars`.
