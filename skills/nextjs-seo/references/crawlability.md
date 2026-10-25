# Crawlability, sitemap.ts, robots.ts

A crawler requests a URL, reads the HTML that comes back, and follows the links in it. Everything here makes that first response complete.

## 1. Content in the initial HTML

Not in the HTML:
- data fetched in `useEffect` (the HTML ships the spinner)
- anything behind `dynamic(() => import(...), { ssr: false })`
- anything gated on `mounted` or `typeof window !== "undefined"`

In the HTML: Server Components, and `"use client"` components (they render on the server for the first load). Static, ISR, and dynamic rendering all send full HTML. What matters is the server/browser split.

Google renders JS in a delayed second pass. Most other crawlers, link-preview bots, and AI crawlers don't run JS at all. Fetch indexable content in Server Components or with `generateStaticParams`.

## 2. Real links

`<Link href>` renders `<a href>`, which crawlers follow. `<div onClick={() => router.push(...)}>` is a dead end. This includes pagination, filters, tabs, and language switchers. A `<select onChange>` switcher is invisible to crawlers.

A URL that is only in the sitemap and never linked from any page is a weak orphan. Link important pages from nav or index pages.

## 3. Real 404s

```tsx
// app/blog/[slug]/page.tsx
export const dynamicParams = false; // only when generateStaticParams lists every slug

export default async function Page({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  // ...
}
```

A "not found" message served with status 200 is a soft 404, and Google indexes it as a thin page.

## 4. No accidental noindex

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  ...(process.env.VERCEL_ENV !== "production" && {
    robots: { index: false, follow: false },
  }),
};
```

Use whatever env flag the project already uses for "is production". Check production HTML for `<meta name="robots"`.

## 5. sitemap.ts

Compute it from content so it's never out of date:

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site.url}/blog`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${site.url}/blog/${post.slug}`,
    lastModified: post.updated ?? post.date,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...postRoutes];
}
```

- `lastModified` from real content dates (frontmatter, CMS `updatedAt`, git). Stamping `new Date()` on every entry tells crawlers everything changed today, every day, and they learn to ignore it. If there is no real date for a static page, omit `lastModified` rather than invent one.
- Sitemap URLs are absolute. `metadataBase` does not apply here.
- List only canonical, indexable, 200-status URLs. No redirects, no `noindex` pages, no query-string variants.
- Over 50,000 URLs: split with `generateSitemaps` (in Next 16, `id` is a `Promise<string>`; `await` it). Output lands at `/.../sitemap/[id].xml`.
- Image and video sitemaps: `images: [...]` and `videos: [...]` on an entry.
- i18n: `alternates.languages` per entry (see `i18n.md`).

## 6. robots.ts

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
```

- **Disallow is not access control.** robots.txt is public. Listing `/secret-admin` publishes the path. Disallow noise (`/api/`, search result pages); protect sensitive routes with auth.
- Disallow stops crawling, not indexing. A disallowed URL linked from elsewhere can still be indexed (without content). To keep a page out of the index, allow crawling and use `noindex`. The crawler must be able to fetch the page to see the `noindex`.
- Don't disallow `/_next/`. Google needs the JS and CSS to render.
- For AI crawler rules, see `performance-and-ai.md`.
