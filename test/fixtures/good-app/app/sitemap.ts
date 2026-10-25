import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://example.com/blog/post", lastModified: "2026-01-01" }];
}
