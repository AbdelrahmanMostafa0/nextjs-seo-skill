// Run with: node test/run.mjs
// Checks every rule against the fixtures and the env guard against sample tool calls.

import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RULES } from "../scripts/rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const check = path.join(here, "../scripts/seo-check.mjs");
const guard = path.join(here, "../scripts/env-guard.mjs");

function scan(fixture, ...flags) {
  const res = spawnSync("node", [check, path.join(here, "fixtures", fixture), "--json", ...flags], { encoding: "utf8" });
  return JSON.parse(res.stdout);
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

// ---------- scanner ----------

const bad = new Set(scan("bad-app").findings.map((f) => f.rule));
const EXPECTED_BAD = [
  "noindex-unconditional", "robots-blocks-next-assets", "metadata-base-missing", "canonical-in-layout",
  "sync-params", "sitemap-fake-lastmod", "sitemap-relative-url", "jsonld-unescaped",
  "dynamic-route-no-notfound", "og-url-in-layout", "page-metadata-missing", "page-canonical-missing",
  "metadata-viewport-deprecated", "html-lang-missing", "robots-leak", "hreflang-missing",
  "onclick-navigation", "title-template-missing", "robots-no-sitemap", "og-image-missing", "google-fonts-link",
];
for (const id of EXPECTED_BAD) test(`bad-app triggers ${id}`, () => assert.ok(bad.has(id), `${id} not reported`));

test("good-app is clean", () => assert.deepEqual(scan("good-app").findings, []));

test("rule ids are unique", () => assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length));

test("every rule has a fix", () => {
  for (const r of RULES) assert.ok(r.fix && r.title && ["error", "warn", "info"].includes(r.sev), r.id);
});

const tools = scan("bad-app", "--tools");
const toolRules = new Set(tools.findings.map((f) => f.rule));
test("tools: detects GTM and GA4", () => {
  const present = tools.integrations.filter((i) => i.present).map((i) => i.name);
  assert.ok(present.includes("Google Tag Manager") && present.includes("Google Analytics 4"), present.join(","));
});
test("tools: GA4 env var reported by name only", () =>
  assert.ok(tools.integrations.find((i) => i.name === "Google Analytics 4").evidence.some((e) => e.includes("via env NEXT_PUBLIC_GA_ID"))));
for (const id of ["analytics-before-interactive", "gtm-and-ga4", "analytics-no-consent"]) {
  test(`tools: bad-app triggers ${id}`, () => assert.ok(toolRules.has(id)));
}
test("tools: good-app finds Search Console + Vercel Analytics", () => {
  const present = scan("good-app", "--tools").integrations.filter((i) => i.present).map((i) => i.name);
  assert.ok(present.includes("Google Search Console") && present.includes("Vercel Web Analytics"), present.join(","));
});

// ---------- env guard ----------

function guarded(tool_name, tool_input) {
  const res = spawnSync("node", [guard], { input: JSON.stringify({ tool_name, tool_input }), encoding: "utf8" });
  return res.status === 2;
}

const BLOCK = [
  ["Read", { file_path: "/p/.env" }],
  ["Read", { file_path: "/p/.env.local" }],
  ["Read", { file_path: "/p/.env.production" }],
  ["Read", { file_path: "/p/.envrc" }],
  ["Read", { file_path: "/p/.dev.vars" }],
  ["Edit", { file_path: "/p/.env.development.local" }],
  ["Write", { file_path: "/p/apps/web/.env" }],
  ["Grep", { pattern: "KEY", path: "/p/.env.local" }],
  ["Grep", { pattern: "KEY", glob: ".env*" }],
  ["Glob", { pattern: "**/.env*" }],
  ["Bash", { command: "cat .env" }],
  ["Bash", { command: "grep GA_ID .env.local" }],
  ["Bash", { command: "cp .env.production /tmp/x" }],
  ["Bash", { command: "source .env && npm run build" }],
  ["Bash", { command: "node --env-file=.env.local server.js" }],
  ["Bash", { command: "npx dotenv -e .env.test -- next build" }],
  ["Bash", { command: "ls -la apps/web/.env*" }],
  ["Bash", { command: "printenv" }],
  ["Bash", { command: "env | grep KEY" }],
];
const ALLOW = [
  ["Read", { file_path: "/p/.env.example" }],
  ["Read", { file_path: "/p/.env.local.example" }],
  ["Edit", { file_path: "/p/.env.sample" }],
  ["Read", { file_path: "/p/app/layout.tsx" }],
  ["Read", { file_path: "/p/lib/env.ts" }],
  ["Read", { file_path: "/p/environment.ts" }],
  ["Grep", { pattern: "process.env.NEXT_PUBLIC_GA_ID", path: "/p/app" }],
  ["Bash", { command: "grep -rn 'process.env' app" }],
  ["Bash", { command: "cat .env.example" }],
  ["Bash", { command: "node scripts/seo-check.mjs ." }],
  ["Bash", { command: "NODE_ENV=production node x.js" }],
];
for (const [tool, input] of BLOCK) test(`guard blocks ${tool} ${JSON.stringify(input)}`, () => assert.ok(guarded(tool, input)));
for (const [tool, input] of ALLOW) test(`guard allows ${tool} ${JSON.stringify(input)}`, () => assert.ok(!guarded(tool, input)));

console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
