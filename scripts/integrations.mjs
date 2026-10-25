// Detects search-console verification, tag managers, and analytics tools
// from source code. IDs that live in env vars are reported by variable name
// only. Env files are never opened.
//
// To add a tool: append to TOOLS. `core: true` tools are always listed (as
// missing when absent, with a hint); the rest only show when found.

const TOOLS = [
  {
    name: "Google Search Console",
    core: true,
    patterns: [/google-site-verification/, /verification\s*:\s*\{[^}]*\bgoogle\s*:/],
    files: [/^(src\/)?public\/google[0-9a-f]+\.html$/],
    hint: "Not visible in code. It may be verified via DNS (best: a Domain property), or through a GA/GTM account. Otherwise add verification: { google: '<token>' } to the root layout metadata. Then submit /sitemap.xml in Search Console.",
  },
  {
    name: "Bing Webmaster Tools",
    core: true,
    patterns: [/msvalidate\.01/],
    files: [/^(src\/)?public\/BingSiteAuth\.xml$/],
    hint: "Optional. Import the site from Search Console in Bing Webmaster Tools (no code), or add verification: { other: { 'msvalidate.01': '<token>' } }. Bing's index also feeds ChatGPT search and DuckDuckGo.",
  },
  {
    name: "Google Tag Manager",
    core: true,
    patterns: [/\bGTM-[A-Z0-9]{4,}\b/, /googletagmanager\.com\/gtm\.js/, /<GoogleTagManager\b/, /\bsendGTMEvent\b/, /NEXT_PUBLIC_\w*GTM\w*/],
    hint: "Optional. Use <GoogleTagManager gtmId=... /> from @next/third-parties/google in the root layout.",
  },
  {
    name: "Google Analytics 4",
    core: true,
    patterns: [/\bG-[A-Z0-9]{6,12}\b/, /googletagmanager\.com\/gtag\/js/, /<GoogleAnalytics\b/, /\bgtag\s*\(/, /NEXT_PUBLIC_\w*(GA|GTAG|MEASUREMENT|ANALYTICS)_?\w*/],
    pkgs: ["react-ga4", "react-ga"],
    hint: "Optional. Use <GoogleAnalytics gaId=... /> from @next/third-parties/google, or configure GA4 inside GTM (not both).",
  },
  { name: "Vercel Web Analytics", pkgs: ["@vercel/analytics"] },
  { name: "Vercel Speed Insights", pkgs: ["@vercel/speed-insights"] },
  { name: "Plausible", patterns: [/plausible\.io\/js/], pkgs: ["next-plausible"] },
  { name: "Umami", patterns: [/umami\.is|umami\.track|data-website-id/] },
  { name: "Fathom", patterns: [/usefathom\.com/], pkgs: ["fathom-client"] },
  { name: "PostHog", pkgs: ["posthog-js", "posthog-node"] },
  { name: "Microsoft Clarity", patterns: [/clarity\.ms\/tag/], pkgs: ["@microsoft/clarity"] },
  { name: "Hotjar", patterns: [/static\.hotjar\.com|hotjar\.com\/c\/hotjar/], pkgs: ["@hotjar/browser"] },
  { name: "Meta Pixel", patterns: [/connect\.facebook\.net\/[^"'`]*fbevents|\bfbq\s*\(/], pkgs: ["react-facebook-pixel"] },
  { name: "Cloudflare Web Analytics", patterns: [/static\.cloudflareinsights\.com/] },
  { name: "Mixpanel", pkgs: ["mixpanel-browser"] },
  { name: "Amplitude", pkgs: ["@amplitude/analytics-browser"] },
  { name: "Segment", pkgs: ["@segment/analytics-next"] },
  { name: "Matomo", patterns: [/matomo\.(js|php)|piwik\.(js|php)/], pkgs: ["@socialgouv/matomo-next"] },
  { name: "Yandex Webmaster", patterns: [/yandex-verification|verification\s*:\s*\{[^}]*\byandex\s*:/] },
  { name: "Other site verification", patterns: [/p:domain_verify|facebook-domain-verification|verification\s*:\s*\{[^}]*\b(yahoo|me)\s*:/] },
  { name: "IndexNow", patterns: [/indexnow/i] },
];

const snippet = (line) => line.trim().replace(/\s+/g, " ").slice(0, 70);

export function detectIntegrations(ctx) {
  const found = [];
  const hitsByTool = new Map();

  for (const tool of TOOLS) {
    const evidence = [];
    for (const p of tool.pkgs ?? []) if (ctx.deps[p]) evidence.push(`package.json  ${p}@${ctx.deps[p]}`);
    for (const re of tool.files ?? []) for (const f of ctx.files) if (re.test(f)) evidence.push(`${f}  (verification file)`);
    const hits = [];
    for (const f of ctx.srcFiles) {
      const t = ctx.code(f);
      for (const re of tool.patterns ?? []) {
        const m = t.match(re);
        if (!m) continue;
        const line = ctx.lineOf(t, m.index);
        const text = t.split("\n")[line - 1] ?? "";
        const envVar = text.match(/process\.env\.(\w+)|["'`]((?:NEXT_PUBLIC_)?[A-Z][A-Z0-9_]*_(?:ID|TOKEN|KEY|VERIFICATION))["'`]/)?.slice(1).find(Boolean);
        evidence.push(`${f}:${line}  ${envVar ? `via env ${envVar} (value not read)` : snippet(text)}`);
        hits.push({ file: f, line });
        break;
      }
    }
    hitsByTool.set(tool.name, hits);
    const present = evidence.length > 0;
    if (present || tool.core) found.push({ name: tool.name, present, evidence, hint: tool.hint });
  }

  // ---------- integration problems ----------
  const findings = [];
  const add = (rule, sev, file, line, msg, fix) => findings.push({ rule, sev, file, line, msg, fix });
  const GOOGLE_TAG = /googletagmanager\.com|GTM-|gtag|GoogleTagManager|GoogleAnalytics/;

  for (const f of ctx.srcFiles) {
    const t = ctx.code(f);
    if (!GOOGLE_TAG.test(t)) continue;
    const bi = t.search(/strategy\s*=\s*\{?\s*["']beforeInteractive["']/);
    if (bi >= 0) {
      add("analytics-before-interactive", "warn", f, ctx.lineOf(t, bi), "", "Load tags with strategy=\"afterInteractive\" or @next/third-parties. beforeInteractive blocks hydration and hurts LCP/INP.");
    }
    const raw = t.search(/<script\b[^>]*src=[^>]*googletagmanager\.com/);
    if (raw >= 0) {
      add("analytics-raw-script", "info", f, ctx.lineOf(t, raw), "", "Use @next/third-parties/google (GoogleTagManager / GoogleAnalytics) or next/script with afterInteractive.");
    }
  }

  const gtm = hitsByTool.get("Google Tag Manager");
  const ga = hitsByTool.get("Google Analytics 4");
  if (gtm.length && ga.length) {
    add("gtm-and-ga4", "warn", ga[0].file, ga[0].line, "GA4 loaded directly and GTM present", "If GA4 is also set up inside the GTM container, page views count twice. Keep one.");
  }

  const tracking = found.filter((i) => i.present && !/Search Console|Webmaster|verification|IndexNow|Speed Insights/i.test(i.name));
  const consentTools = /consent|cookiebot|onetrust|klaro|cookieyes|usercentrics|iubenda/i;
  if (tracking.length && !ctx.srcFiles.some((f) => consentTools.test(ctx.code(f))) && !Object.keys(ctx.deps).some((d) => consentTools.test(d))) {
    add("analytics-no-consent", "info", "-", 0, tracking.map((i) => i.name).join(", "), "No consent handling found. Visitors from the EU/UK need a consent banner (and Google Consent Mode v2 for Google tags). Ignore for cookieless tools like Plausible or Vercel Analytics.");
  }

  const verifs = found.filter((i) => i.name === "Google Search Console" && !i.present);
  if (verifs.length && !gtm.length && !ga.length) {
    add("gsc-not-detected", "info", "-", 0, "", "No Search Console verification and no GA/GTM found in code. Confirm the site is verified (DNS is invisible to this scan).");
  }

  return { found, findings };
}
