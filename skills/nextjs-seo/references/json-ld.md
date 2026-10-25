# JSON-LD structured data

## The component

```tsx
// components/seo/json-ld.tsx
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
```

- The `.replace` is load-bearing. Without it, a title or CMS field containing `</script>` closes the tag and injects markup (XSS). `<` parses identically in JSON.
- Use a native `<script>`, not `next/script`. JSON-LD is data, not executable code.
- Render it in `page.tsx` or `layout.tsx` (Server Components). It must be in the server HTML.
- No library needed. `schema-dts` is optional for typing: `WithContext<Product>`.

## Build a graph, not confetti

Disconnected blobs (a `Person` here, a `BlogPosting` there, nothing linking them) tell Google little. Give entities stable `@id`s and reference them.

```ts
// lib/seo/schema.ts
const personId = `${site.url}/#person`;
const websiteId = `${site.url}/#website`;

// Declared in full once, site-wide (homepage or root layout)
export function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId,
    name: site.name,
    url: site.url,
    jobTitle: site.jobTitle,
    sameAs: site.sameAs,
  };
}

// Used on other pages. Google doesn't resolve @ids declared on a different
// page, so the reference carries enough to stand alone.
const authorRef = { "@type": "Person", "@id": personId, name: site.name, url: site.url };

export function blogPostingSchema(post: Post) {
  const url = `${site.url}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: authorRef,
    isPartOf: { "@id": websiteId },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: `${url}/opengraph-image`,
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${site.url}${item.path}`,
    })),
  };
}
```

Alternatively, emit one `{"@context", "@graph": [...]}` per page containing every node that page needs. Within one graph, `@id` references resolve.

`@id` conventions: absolute URL plus a fragment (`/#person`, `/#organization`, `/#website`, `/blog/x#post`). Never reuse one `@id` for two different entities.

## Templates by site type

| Site type | Site-wide nodes | Per-page nodes | Rich result? |
| --- | --- | --- | --- |
| Blog | `Person`/`Organization`, `WebSite` | `BlogPosting`, `BreadcrumbList` | Article features, breadcrumbs |
| E-commerce | `Organization` | `Product` + `Offer` (+ `AggregateRating` only with real visible reviews), `BreadcrumbList` | Yes: price, availability, reviews |
| SaaS | `Organization`, `SoftwareApplication`/`WebApplication` with `offers` | — | Software app (limited) |
| Local business | Most specific `LocalBusiness` subtype (`Restaurant`, `Dentist`…) with `address`, `geo`, `openingHoursSpecification`, `telephone` | — | Strong: Maps, local pack |
| Real estate | `Organization` | `RealEstateListing` with `about: Residence` and `offers` | Weak: mostly entity clarity |
| Portfolio | `Person` with `sameAs`, `WebSite`; `ProfilePage` on the about page | `SoftwareSourceCode` or `CreativeWork` per project | Profile page |
| Docs | `WebSite` | `TechArticle`, `BreadcrumbList` | Breadcrumbs |

Ready-made `@id`-linked templates for each: https://abdelrahmanmostafa.com/schema-guide

## Honesty rules (spam enforcement targets these)

- Structured data must describe content visible on the page.
- `price`, `priceCurrency`, `availability` come from the same data that renders the visible price and stock. Never hardcode `InStock`.
- `AggregateRating` and `Review` only from real reviews shown on the page.
- `dateModified` from real edit dates. If edits aren't tracked, use the publish date for both.
- Local business hours and `geo` must match reality.
- Only list `sameAs` profiles the owner controls and keeps active.

## Deprecated or reduced (as of October 2026)

- **FAQPage**: rich results stopped showing in Google Search on May 7, 2026. The type is still valid schema.org and harmless. Keep it if it already exists and matches visible content, but don't add it expecting a rich result. If the project generates FAQ schema and visible FAQ from one source (e.g. a frontmatter `faq` array), that's fine to keep.
- **HowTo**: rich results deprecated since 2023. Use `TechArticle`/`Article` instead.

Check https://developers.google.com/search/docs/appearance/structured-data/search-gallery for the current supported list before promising a rich result.

## Validate

- Rich Results Test: https://search.google.com/test/rich-results (what Google detects and supports).
- Schema Markup Validator: https://validator.schema.org (stricter, checks the raw graph and `@id` links).
