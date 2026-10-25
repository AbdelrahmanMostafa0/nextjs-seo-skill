# Open Graph images

Put an `opengraph-image` file in a route folder and Next.js injects the `og:image` meta tags (with width, height, type, and alt). The same for `twitter-image`, which falls back to `og:image` if absent.

## Static page: just a file

```txt
app/
  about/
    page.tsx
    opengraph-image.png      <- 1200×630, Next.js wires the meta tags
    opengraph-image.alt.txt  <- optional alt text
```

## Dynamic route: generated image

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const alt = "Blog post preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", fontSize: 64 }}>
      {post?.title}
    </div>,
    size,
  );
}
```

`ImageResponse` supports a subset of CSS (flexbox, no grid). Load custom fonts via the `fonts` option. Check `node_modules/next/dist/docs/.../image-response.md` for the installed version's limits.

## Dynamic route: image stored in a CMS

When the CMS already has the image, proxy it so the public URL stays stable:

```tsx
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  const image = await fetch(post.ogImage);
  return new Response(await image.arrayBuffer(), {
    headers: { "Content-Type": "image/png" },
  });
}
```

Why route it instead of putting the CDN URL in `openGraph.images`: the URL stays conventional (`/blog/<slug>/opengraph-image`), JSON-LD `image` can point at the same route, and swapping the image in the CMS needs no meta change.

## Rules

- **1200×630**, PNG or JPG. Platforms crop or letterbox other sizes. Keep text away from the edges.
- **Explicit `openGraph.images` overrides the file.** Don't put a default image in the layout or a shared OG helper. Pages without their own file pass `images: [defaultOgImage]` explicitly.
- Don't set `twitter.images` in the layout. It would override every page's image in X previews.
- With `generateStaticParams`, images render at build time, so previews never wait on the CMS.
- The image URL must return 200 with the right `Content-Type`, no redirect to a login page.
- Check the real preview: paste the link in Slack, or use https://www.opengraph.xyz. Platforms cache previews; use their debuggers (LinkedIn Post Inspector, Facebook Sharing Debugger) to refresh.
