# Metadata API

## Site config

One source of truth, imported everywhere:

```ts
// lib/site.ts
export const site = {
  name: "Site Name",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  description: "Default description.",
  locale: "en_US",
  twitter: "@handle",
  sameAs: ["https://github.com/...", "https://www.linkedin.com/in/..."],
};
```

## Root layout

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: pageOpenGraph("/"),
  twitter: { card: "summary_large_image", creator: site.twitter },
  // no alternates.canonical here: it would be inherited by every page
};

export const viewport: Viewport = {
  themeColor: "#000000", // themeColor/colorScheme go here, not in metadata
};
```

- `metadataBase` makes every relative canonical, OG URL, and image path resolve against one env-driven base.
- `title.template` applies to child segments, not to the segment that defines it. Use `title: { absolute: "..." }` on a page to skip the template.
- Root layout `openGraph.url` would be inherited by every page that doesn't set its own `openGraph`, so they'd all announce the home page as `og:url`. That's why it's set via the helper here only for `/`, and every page sets its own.

## The shallow-merge trap

Next.js merges metadata between segments **shallowly**. If a page sets `openGraph` at all, the layout's entire `openGraph` is replaced. `siteName`, `locale`, `url`, and `images` from the layout vanish, with no warning. Same for `twitter`, `robots`, and `alternates`.

Fix: build every page's `openGraph` from one helper.

```ts
// lib/seo/metadata.ts
import type { Metadata } from "next";
type OpenGraph = NonNullable<Metadata["openGraph"]>;

export function pageOpenGraph(path: string, overrides?: OpenGraph): OpenGraph {
  return {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    url: path,
    ...overrides,
  };
}
```

The helper deliberately does **not** set `images`. An explicit `openGraph.images` on a page beats the `opengraph-image` file next to it. Pages with their own image file leave `images` out. Pages without one pass `images: [defaultOgImage]` explicitly. Leave `twitter.images` unset too; it falls back to `og:image`.

## Dynamic pages

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug); // one post by slug, not the whole list
  if (!post) return {};

  const path = `/blog/${post.slug}`;
  return {
    title: post.seoTitle ?? post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: pageOpenGraph(path, {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
    }),
  };
}
```

- `params` is a Promise in Next 15+. `PageProps<"/route">` types it (Next 15.5+; check the installed version).
- `fetch` in `generateMetadata` is memoized with the page's `fetch`. For non-fetch data sources, wrap the loader in React `cache()` so the page and metadata share one query.
- `openGraph.type: "article"` enables `publishedTime` and `modifiedTime`. Use `updated ?? date` so the fallback is never a fake date.
- Static pages export `const metadata` and still set their own canonical: `alternates: { canonical: "/about" }`.

## Titles and descriptions

- Every indexable page needs a unique title and description. Duplicates across pages are an audit finding.
- Title: lead with the topic, roughly 50–60 characters before the template suffix. Google rewrites titles it considers poor.
- Description: about 120–160 characters, a real summary of the page. It's not a ranking factor, but it is the snippet people read.
- A separate `seoTitle` field in content lets the H1 be long while the `<title>` stays short.
- One `<h1>` per page that matches the page topic.

## Canonical rules

- Self-referencing canonical on every indexable page, set per page.
- Canonical points at the URL you want indexed: no tracking params, consistent trailing slash (match `trailingSlash` in `next.config`), lowercase.
- Paginated pages canonicalize to themselves (`/blog?page=2` → itself), not to page 1.
- Filtered/sorted variants canonicalize to the unfiltered URL, or get `noindex`.
- Two different pages must never share a canonical unless one really is a duplicate of the other.
