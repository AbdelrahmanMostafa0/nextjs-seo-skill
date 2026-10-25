// Static SEO rules. Each rule returns findings as { file, line, msg? }.
//
// To add a rule: append an object to RULES with a unique kebab-case id, a
// severity (error = breaks indexing or is a security hole, warn = likely
// hurts SEO, info = worth a look), a one-line title, a one-line fix, and a
// check(ctx) function. Add a case to test/fixtures and test/run.mjs.
//
// Rules are heuristics over source text. Prefer missing a problem to
// flooding the report with false positives.

// Line numbers are identical across read/code/bare, so any variant works here.
const at = (ctx, file, idx, msg) => ({ file, line: ctx.lineOf(ctx.code(file), idx), msg });

function* matches(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = g.exec(text))) {
    yield m;
    if (m.index === g.lastIndex) g.lastIndex++;
  }
}

// Body of the object literal that follows `key:` (brace-matched), or null
// when the value isn't an inline object (e.g. a helper call).
function objectsFor(text, key) {
  const out = [];
  for (const m of matches(text, new RegExp(`\\b${key}\\s*:\\s*\\{`))) {
    const start = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) {
        out.push({ index: m.index, body: text.slice(start, i + 1) });
        break;
      }
    }
  }
  return out;
}

const segments = (f) => f.split("/").slice(0, -1);
const isDynamic = (f) => segments(f).some((s) => /^\[.+\]$/.test(s));
const PRIVATE_SEG = /^(admin|api|dashboard|account|settings|login|logout|signin|signup|auth|checkout|cart|\((protected|private|auth|admin|dashboard)[^)]*\))$/i;
const isPrivateRoute = (f) => segments(f).some((s) => PRIVATE_SEG.test(s));
const hasNoindex = (text) => /index\s*:\s*false|noindex/.test(text);
const redirectsOnly = (text) => /\b(permanentRedirect|redirect)\s*\(/.test(text) && !/return\s*\(?\s*</.test(text);
const META_HELPER = /\b(\w*(?:[Mm]eta(?:data)?|[Ss]eo|SEO|[Aa]lternates|[Cc]anonical)\w*)\s*\(/g;
const callsMetaHelper = (text) =>
  [...text.matchAll(META_HELPER)].some((m) => !/^(generateMetadata|generateViewport|generateImageMetadata)$/.test(m[1]));
const sitemapFiles = (ctx) => ctx.files.filter((f) => ctx.inApp(f) && /\/sitemap\.(tsx?|jsx?)$/.test(f));
const robotsFiles = (ctx) => ctx.files.filter((f) => ctx.inApp(f) && /\/robots\.(tsx?|jsx?)$/.test(f));

export const RULES = [
  // ---------- crawl / index blockers ----------
  {
    id: "noindex-unconditional",
    sev: "error",
    router: "app",
    title: "noindex in a layout with no environment check",
    fix: "Gate robots: { index: false } on an env flag (e.g. VERCEL_ENV !== 'production') so it can't ship to prod.",
    check: (ctx) =>
      ctx.layouts.filter((f) => !isPrivateRoute(f)).flatMap((f) => {
        const t = ctx.code(f);
        if (/process\.env|isProd|isProduction|isPreview/.test(t)) return [];
        const m = t.match(/index\s*:\s*false|content=["'][^"']*noindex/);
        return m ? [at(ctx, f, m.index, "every page under this layout is noindex")] : [];
      }),
  },
  {
    id: "robots-disallow-all",
    sev: "error",
    title: "robots blocks the whole site",
    fix: "Only disallow '/' outside production; gate it on an env flag.",
    check: (ctx) => {
      const out = [];
      for (const f of robotsFiles(ctx)) {
        const t = ctx.code(f);
        if (/process\.env/.test(t)) continue;
        const m = t.match(/disallow\s*:\s*\[?\s*["'`]\/["'`]/i);
        if (m) out.push(at(ctx, f, m.index));
      }
      const txt = ctx.files.find((f) => /^(src\/)?public\/robots\.txt$/.test(f));
      if (txt) {
        const t = ctx.read(txt);
        const m = t.match(/^Disallow:\s*\/\s*$/im);
        if (m) out.push({ file: txt, line: ctx.lineOf(t, m.index) });
      }
      return out;
    },
  },
  {
    id: "robots-blocks-next-assets",
    sev: "error",
    title: "robots disallows /_next/",
    fix: "Remove the /_next disallow. Google needs the JS and CSS to render pages.",
    check: (ctx) =>
      [...robotsFiles(ctx), ...ctx.files.filter((f) => /^(src\/)?public\/robots\.txt$/.test(f))].flatMap((f) => {
        const t = f.endsWith(".txt") ? ctx.read(f) : ctx.code(f);
        const m = t.match(/disallow[^\n]*\/_next/i);
        return m ? [{ file: f, line: ctx.lineOf(t, m.index) }] : [];
      }),
  },
  {
    id: "client-fetched-content",
    sev: "warn",
    title: "page content fetched in useEffect",
    fix: "Fetch in a Server Component (or generateStaticParams) so the content is in the initial HTML. Ignore if it isn't meant to be indexed.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) => {
        const t = ctx.bare(f);
        if (!/^\s*["']use client["']/m.test(ctx.code(f)) || !/useEffect\s*\(/.test(t)) return [];
        const m = t.match(/\bfetch\s*\(|axios\.|\buseSWR\b|\buseQuery\b/);
        if (!m) return [];
        if (!/\/page\.(tsx?|jsx?)$/.test(f) && !ctx.inApp(f)) return [];
        return [at(ctx, f, m.index)];
      }),
  },
  {
    id: "ssr-false",
    sev: "info",
    title: "component rendered with ssr: false",
    fix: "Content inside is missing from the server HTML. Fine for widgets; not for indexable text.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) => [...matches(ctx.bare(f), /ssr\s*:\s*false/)].map((m) => at(ctx, f, m.index))),
  },
  {
    id: "onclick-navigation",
    sev: "info",
    title: "navigation via onClick + router.push",
    fix: "Use <Link href> so crawlers can follow it.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) =>
        [...matches(ctx.bare(f), /on(Click|Change)=\{[^}]*router\.(push|replace)\(/)].map((m) => at(ctx, f, m.index)),
      ),
  },
  {
    id: "dynamic-route-no-notfound",
    sev: "warn",
    router: "app",
    title: "dynamic page never calls notFound()",
    fix: "Call notFound() when the slug doesn't exist (or set dynamicParams = false). Otherwise missing pages return 200 (soft 404).",
    check: (ctx) =>
      ctx.pages
        .filter((f) => isDynamic(f) && !isPrivateRoute(f))
        .filter((f) => {
          const t = ctx.code(f);
          return !/notFound\s*\(|dynamicParams\s*=\s*false|redirect\s*\(/.test(t);
        })
        .map((f) => ({ file: f, line: 1 })),
  },

  // ---------- metadata ----------
  {
    id: "metadata-base-missing",
    sev: "error",
    router: "app",
    title: "root layout has no metadataBase",
    fix: "Add metadataBase: new URL(siteUrl) to the root layout metadata so relative canonicals and OG URLs resolve.",
    check: (ctx) =>
      ctx.rootLayout && !/metadataBase/.test(ctx.code(ctx.rootLayout)) ? [{ file: ctx.rootLayout, line: 1 }] : [],
  },
  {
    id: "canonical-in-layout",
    sev: "error",
    router: "app",
    title: "canonical or hreflang set in a layout",
    fix: "Move alternates.canonical/languages into each page's generateMetadata. Layout metadata is inherited, so every child page claims the layout's URL.",
    check: (ctx) =>
      ctx.layouts.flatMap((f) => [...matches(ctx.code(f), /\bcanonical\s*:|\blanguages\s*:/)].map((m) => at(ctx, f, m.index))),
  },
  {
    id: "og-url-in-layout",
    sev: "warn",
    router: "app",
    title: "openGraph.url set in a layout",
    fix: "Every page that doesn't override openGraph inherits this og:url. Set url per page via a shared openGraph helper.",
    check: (ctx) =>
      ctx.layouts.flatMap((f) =>
        objectsFor(ctx.code(f), "openGraph")
          .filter((o) => /\burl\s*:/.test(o.body))
          .map((o) => at(ctx, f, o.index)),
      ),
  },
  {
    id: "twitter-images-in-layout",
    sev: "warn",
    router: "app",
    title: "twitter.images in a layout overrides per-page OG images",
    fix: "Remove twitter.images from the layout; twitter:image falls back to each page's og:image.",
    check: (ctx) => {
      if (!ctx.files.some((f) => /\/(opengraph|twitter)-image\.[a-z]+$/.test(f))) return [];
      return ctx.layouts.flatMap((f) =>
        objectsFor(ctx.code(f), "twitter")
          .filter((o) => /\bimages?\s*:/.test(o.body))
          .map((o) => at(ctx, f, o.index)),
      );
    },
  },
  {
    id: "og-images-shadow-file",
    sev: "warn",
    router: "app",
    title: "page sets openGraph.images next to an opengraph-image file",
    fix: "Explicit openGraph.images wins over the file convention. Remove images from this page's metadata.",
    check: (ctx) =>
      ctx.pages.flatMap((f) => {
        const dir = f.slice(0, f.lastIndexOf("/"));
        if (!ctx.files.some((x) => x.startsWith(dir + "/opengraph-image."))) return [];
        return objectsFor(ctx.code(f), "openGraph")
          .filter((o) => /\bimages\s*:/.test(o.body))
          .map((o) => at(ctx, f, o.index));
      }),
  },
  {
    id: "page-metadata-missing",
    sev: "warn",
    router: "app",
    title: "public page exports no metadata",
    fix: "Export metadata or generateMetadata with a unique title, description, and alternates.canonical.",
    check: (ctx) =>
      ctx.pages
        .filter((f) => !isPrivateRoute(f) && !f.endsWith(".mdx"))
        .filter((f) => {
          const t = ctx.code(f);
          return !/export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata|\{[^}]*\b(metadata|generateMetadata)\b)/.test(t) && !hasNoindex(t) && !redirectsOnly(t);
        })
        .map((f) => ({ file: f, line: 1 })),
  },
  {
    id: "page-canonical-missing",
    sev: "warn",
    router: "app",
    title: "page metadata has no canonical",
    fix: "Add alternates: { canonical: '/path' } (relative; resolved by metadataBase).",
    check: (ctx) =>
      ctx.pages
        .filter((f) => !isPrivateRoute(f))
        .filter((f) => {
          const t = ctx.code(f);
          const hasMeta = /export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata)/.test(t);
          return hasMeta && !/canonical|alternates/.test(t) && !callsMetaHelper(t) && !hasNoindex(t);
        })
        .map((f) => {
          const t = ctx.code(f);
          return at(ctx, f, t.search(/export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/));
        }),
  },
  {
    id: "title-template-missing",
    sev: "info",
    router: "app",
    title: "root layout title has no template",
    fix: "Use title: { default: 'Site', template: '%s | Site' } so page titles get a consistent suffix.",
    check: (ctx) => {
      const f = ctx.rootLayout;
      if (!f) return [];
      const t = ctx.code(f);
      return /\btitle\s*:/.test(t) && !/template\s*:/.test(t) ? [at(ctx, f, t.search(/\btitle\s*:/))] : [];
    },
  },
  {
    id: "metadata-viewport-deprecated",
    sev: "warn",
    router: "app",
    title: "themeColor/colorScheme/viewport inside metadata",
    fix: "Move them to export const viewport: Viewport (or generateViewport).",
    check: (ctx) =>
      [...ctx.layouts, ...ctx.pages].flatMap((f) => {
        const t = ctx.code(f);
        if (/export\s+(const\s+viewport\b|(async\s+)?function\s+generateViewport)/.test(t)) return [];
        const m = t.match(/\b(themeColor|colorScheme)\s*:/);
        return m ? [at(ctx, f, m.index)] : [];
      }),
  },
  {
    id: "sync-params",
    sev: "error",
    router: "app",
    title: "params read synchronously (Promise since Next 15)",
    fix: "const { slug } = await params; type params as Promise<{ slug: string }> or use PageProps<'/route'>.",
    check: (ctx) => {
      if (ctx.nextMajor < 15) return [];
      return ctx.files
        .filter((f) => ctx.inApp(f) && /\/(page|layout|opengraph-image|twitter-image|icon|apple-icon|sitemap|default)\.(tsx?|jsx?)$/.test(f))
        .flatMap((f) => {
          const t = ctx.bare(f);
          if (/\bparams\s*=\s*await\b|await\s+(props\.)?params\b|use\(\s*(props\.)?params\s*\)|params\s*\.then\(/.test(t)) return [];
          const m = t.match(/\bparams\.\w+/);
          return m ? [at(ctx, f, m.index)] : [];
        });
    },
  },
  {
    id: "next-head-in-app-router",
    sev: "error",
    router: "app",
    title: "next/head used in the app router",
    fix: "next/head does nothing in app/. Use the Metadata API (metadata / generateMetadata).",
    check: (ctx) =>
      ctx.srcFiles
        .filter((f) => ctx.inApp(f))
        .flatMap((f) => {
          const m = ctx.code(f).match(/from\s+["']next\/head["']/);
          return m ? [at(ctx, f, m.index)] : [];
        }),
  },
  {
    id: "html-lang-missing",
    sev: "warn",
    router: "app",
    title: "<html> has no lang attribute",
    fix: "Set <html lang=\"en\"> (or lang={locale} in a [lang] layout).",
    check: (ctx) =>
      ctx.layouts.flatMap((f) => {
        const t = ctx.code(f);
        return [...matches(t, /<html\b[^>]*>/)].filter((m) => !/\blang=/.test(m[0])).map((m) => at(ctx, f, m.index));
      }),
  },

  // ---------- sitemap / robots ----------
  {
    id: "sitemap-missing",
    sev: "warn",
    title: "no sitemap",
    fix: "Add app/sitemap.ts returning MetadataRoute.Sitemap computed from your content.",
    check: (ctx) => {
      const found =
        sitemapFiles(ctx).length ||
        ctx.files.some((f) => /^(src\/)?public\/sitemap[^/]*\.xml$/.test(f) || /\/sitemap(\.xml)?\/route\.(tsx?|jsx?)$/.test(f) || /^next-sitemap\.config\./.test(f));
      return found ? [] : [{ file: ctx.appDir ?? ".", line: 0 }];
    },
  },
  {
    id: "robots-missing",
    sev: "warn",
    title: "no robots.txt",
    fix: "Add app/robots.ts that allows crawling and points at the sitemap.",
    check: (ctx) => {
      const found =
        robotsFiles(ctx).length ||
        ctx.files.some((f) => /^(src\/)?public\/robots\.txt$/.test(f) || /\/robots\.txt\/route\.(tsx?|jsx?)$/.test(f) || /^next-sitemap\.config\./.test(f));
      return found ? [] : [{ file: ctx.appDir ?? ".", line: 0 }];
    },
  },
  {
    id: "sitemap-fake-lastmod",
    sev: "error",
    title: "sitemap stamps new Date() as lastModified",
    fix: "Use the content's real updated/published date, or omit lastModified. Build-time dates teach crawlers to ignore lastmod.",
    check: (ctx) =>
      sitemapFiles(ctx).flatMap((f) =>
        [...matches(ctx.code(f), /lastModified\s*:\s*(new\s+Date\(\s*\)|Date\.now\(\)|new\s+Date\(\)\.toISOString\(\))/)].map((m) => at(ctx, f, m.index)),
      ),
  },
  {
    id: "sitemap-relative-url",
    sev: "error",
    title: "sitemap url is relative",
    fix: "Sitemap URLs must be absolute: `${siteUrl}/path`. metadataBase doesn't apply to sitemaps.",
    check: (ctx) =>
      sitemapFiles(ctx).flatMap((f) => [...matches(ctx.code(f), /\burl\s*:\s*["'`]\//)].map((m) => at(ctx, f, m.index))),
  },
  {
    id: "robots-no-sitemap",
    sev: "info",
    title: "robots doesn't reference the sitemap",
    fix: "Add sitemap: `${siteUrl}/sitemap.xml` to robots.ts.",
    check: (ctx) => robotsFiles(ctx).filter((f) => !/sitemap\s*:/.test(ctx.code(f))).map((f) => ({ file: f, line: 1 })),
  },
  {
    id: "robots-leak",
    sev: "warn",
    title: "robots disallow publishes a sensitive path",
    fix: "robots.txt is public. Remove the entry and protect the route with auth instead.",
    check: (ctx) => {
      const SENSITIVE = /(admin|secret|private|internal|staging|backup|\.env|config|dashboard|hidden|debug)/i;
      const out = [];
      for (const f of [...robotsFiles(ctx), ...ctx.files.filter((x) => /^(src\/)?public\/robots\.txt$/.test(x))]) {
        const t = f.endsWith(".txt") ? ctx.read(f) : ctx.code(f);
        const re = f.endsWith(".txt") ? /^Disallow:\s*(\S+)/gim : /disallow\s*:\s*(\[[^\]]*\]|["'`][^"'`]*["'`])/gi;
        for (const m of matches(t, re)) {
          const leaked = m[1].match(/[^\s"'`,\[\]]+/g)?.filter((p) => SENSITIVE.test(p)) ?? [];
          if (leaked.length) out.push({ file: f, line: ctx.lineOf(t, m.index), msg: leaked.join(" ") });
        }
      }
      return out;
    },
  },

  // ---------- structured data ----------
  {
    id: "jsonld-unescaped",
    sev: "error",
    title: "JSON-LD serialized without escaping <",
    fix: "JSON.stringify(data).replace(/</g, \"\\\\u003c\"). Unescaped JSON-LD is an XSS sink.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) => {
        const t = ctx.code(f);
        const ld = t.search(/application\/ld\+json/);
        if (ld < 0 || !/JSON\.stringify/.test(t)) return [];
        if (/u003c|serialize-javascript|serialize\(|escapeJson|safeJson/i.test(t)) return [];
        return [at(ctx, f, ld)];
      }),
  },
  {
    id: "jsonld-next-script",
    sev: "warn",
    title: "JSON-LD rendered with next/script",
    fix: "Use a native <script type=\"application/ld+json\"> so it's in the server HTML.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) =>
        [...matches(ctx.code(f), /<Script\b[^>]*application\/ld\+json/)].map((m) => at(ctx, f, m.index)),
      ),
  },
  {
    id: "jsonld-deprecated-type",
    sev: "info",
    title: "FAQPage/HowTo schema no longer earns a Google rich result",
    fix: "Valid schema and harmless; keep only if it matches visible content. FAQ rich results ended May 7, 2026; HowTo in 2023.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) => {
        const m = ctx.code(f).match(/["'`@]type["'`]?\s*:\s*["'`](FAQPage|HowTo)["'`]/);
        return m ? [at(ctx, f, m.index, m[1])] : [];
      }),
  },
  {
    id: "jsonld-missing",
    sev: "info",
    title: "no JSON-LD structured data anywhere",
    fix: "Add a site-wide Person/Organization + WebSite graph, then per-page nodes (see the nextjs-seo skill's json-ld reference).",
    check: (ctx) => (ctx.srcFiles.some((f) => /application\/ld\+json|@context/.test(ctx.code(f))) ? [] : [{ file: ".", line: 0 }]),
  },

  // ---------- previews ----------
  {
    id: "og-image-missing",
    sev: "info",
    title: "no Open Graph image anywhere",
    fix: "Add app/opengraph-image.png (1200×630) or an opengraph-image.tsx; shared links show no preview without one.",
    check: (ctx) => {
      if (ctx.files.some((f) => /\/opengraph-image\.[a-z]+$/.test(f))) return [];
      if (ctx.srcFiles.some((f) => objectsFor(ctx.code(f), "openGraph").some((o) => /\bimages\s*:/.test(o.body)))) return [];
      return [{ file: ctx.appDir ?? ".", line: 0 }];
    },
  },

  // ---------- i18n ----------
  {
    id: "hreflang-missing",
    sev: "warn",
    router: "app",
    title: "localized routes without hreflang alternates",
    fix: "Return alternates.languages (every locale + x-default) from each page's generateMetadata.",
    check: (ctx) => {
      const localeSeg = ctx.files.find((f) => ctx.inApp(f) && /\/\[(lang|locale|lng)\]\//.test(f));
      if (!localeSeg) return [];
      const any = ctx.srcFiles.some((f) => /\blanguages\s*:/.test(ctx.code(f)));
      return any ? [] : [{ file: localeSeg.slice(0, localeSeg.indexOf("]") + 1), line: 0 }];
    },
  },
  {
    id: "hreflang-no-x-default",
    sev: "warn",
    title: "hreflang alternates without x-default",
    fix: "Add 'x-default': '/<defaultLocale><path>' to alternates.languages.",
    check: (ctx) => {
      const users = ctx.srcFiles.filter((f) => objectsFor(ctx.code(f), "languages").length);
      if (!users.length || ctx.srcFiles.some((f) => /x-default/.test(ctx.read(f)))) return [];
      return users.map((f) => at(ctx, f, ctx.code(f).search(/\blanguages\s*:/)));
    },
  },

  // ---------- performance ----------
  {
    id: "image-priority-deprecated",
    sev: "info",
    title: "next/image priority prop (deprecated in Next 16)",
    fix: "Replace priority with preload.",
    check: (ctx) =>
      ctx.nextMajor < 16
        ? []
        : ctx.srcFiles.flatMap((f) => [...matches(ctx.code(f), /<Image\b[^>]*\spriority\b/)].map((m) => at(ctx, f, m.index))),
  },
  {
    id: "google-fonts-link",
    sev: "info",
    title: "Google Fonts loaded via <link>",
    fix: "Use next/font/google: self-hosted, no layout shift, no extra connection.",
    check: (ctx) =>
      ctx.srcFiles.flatMap((f) => [...matches(ctx.code(f), /fonts\.googleapis\.com/)].map((m) => at(ctx, f, m.index))),
  },
  {
    id: "raw-img-tag",
    sev: "info",
    title: "raw <img> tags",
    fix: "next/image adds sizing (CLS), lazy loading, and modern formats. Fine for SVG icons and tiny images.",
    check: (ctx) => {
      const hits = ctx.srcFiles.flatMap((f) => [...matches(ctx.code(f), /<img\b/)].map((m) => at(ctx, f, m.index)));
      return hits.length > 3 ? [{ file: hits[0].file, line: hits[0].line, msg: `${hits.length} <img> tags in ${new Set(hits.map((h) => h.file)).size} files` }] : hits;
    },
  },
  {
    id: "next-seo-package",
    sev: "info",
    title: "next-seo package with the app router",
    fix: "The built-in Metadata API replaces next-seo in app/. Migrate page by page.",
    check: (ctx) => (ctx.appDir && ctx.deps["next-seo"] ? [{ file: "package.json", line: 0 }] : []),
  },
];
