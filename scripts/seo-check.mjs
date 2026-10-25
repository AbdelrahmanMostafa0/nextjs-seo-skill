#!/usr/bin/env node
// Static SEO scanner for Next.js projects. Zero dependencies.
//
// Reads source files as text and matches patterns. It never executes project
// code, never starts the app, and never opens env files. Output is one line
// per finding so Claude can act on it without reading the codebase.
//
// Usage: node seo-check.mjs [dir] [--tools] [--json] [--only a,b] [--skip a,b]
//                           [--max N] [--list-rules] [--exit-zero]
// Exit codes: 0 clean (or --exit-zero), 1 error-level findings, 2 not a Next.js project.

import fs from "node:fs";
import path from "node:path";
import { isEnvFile } from "./lib/env.mjs";
import { RULES } from "./rules.mjs";
import { detectIntegrations } from "./integrations.mjs";

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--only", "--skip", "--max"]);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));
const root = path.resolve(positional[0] ?? ".");
const only = val("--only")?.split(",");
const skip = val("--skip")?.split(",") ?? [];
const max = Number(val("--max") ?? 8);

if (has("--list-rules")) {
  for (const r of RULES) console.log(`${r.id.padEnd(30)} ${r.sev.padEnd(5)} ${r.title}`);
  process.exit(0);
}

// ---------- project loading ----------

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", "coverage",
  ".turbo", ".vercel", ".netlify", ".output", ".cache", "storybook-static",
]);
const READABLE = /\.(tsx?|jsx?|mjs|cjs|mdx|json|txt|xml|html)$/;
const MAX_BYTES = 400_000;

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(abs, out);
    } else if (e.isFile() && !isEnvFile(e.name)) {
      out.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  }
  return out;
}

const cache = new Map();
function read(rel) {
  if (cache.has(rel)) return cache.get(rel);
  let text = "";
  if (!isEnvFile(rel) && READABLE.test(rel)) {
    try {
      const abs = path.join(root, rel);
      if (fs.statSync(abs).size <= MAX_BYTES) text = fs.readFileSync(abs, "utf8");
    } catch {}
  }
  cache.set(rel, text);
  return text;
}

// Blank out comments but keep offsets and line numbers intact.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])(\/\/[^\n]*)/gm, (_, pre, c) => pre + " ".repeat(c.length));
}
const codeCache = new Map();
function code(rel) {
  if (!codeCache.has(rel)) codeCache.set(rel, stripComments(read(rel)));
  return codeCache.get(rel);
}

// Code with single/double-quoted string contents blanked, for rules that
// match code constructs and must not fire on prose inside strings.
const bareCache = new Map();
function bare(rel) {
  if (!bareCache.has(rel)) {
    bareCache.set(rel, code(rel).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m[0] + " ".repeat(m.length - 2) + m[0]));
  }
  return bareCache.get(rel);
}

function readJson(rel) {
  try {
    return JSON.parse(read(rel));
  } catch {
    return null;
  }
}

const files = walk(root, []);
const pkg = readJson("package.json") ?? {};
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

if (!deps.next) {
  console.log(`nextjs-seo: no "next" dependency in ${path.join(root, "package.json")}. Run from a Next.js project root.`);
  process.exit(2);
}

let nextVersion = String(deps.next);
try {
  nextVersion = JSON.parse(fs.readFileSync(path.join(root, "node_modules/next/package.json"), "utf8")).version;
} catch {}
const nextMajor = Number(String(nextVersion).match(/\d+/)?.[0] ?? 0);

const appDir = ["app", "src/app"].find((d) => files.some((f) => f.startsWith(d + "/")));
const pagesDir = ["pages", "src/pages"].find((d) => files.some((f) => f.startsWith(d + "/")));
const inApp = (f) => appDir && f.startsWith(appDir + "/");
// MDX is mostly prose and code samples; only route files (page.mdx) are checked.
const SRC = /\.(tsx?|jsx?|mjs|cjs)$/;
const srcFiles = files.filter((f) => SRC.test(f));
const routeFile = (name) => (f) => inApp(f) && new RegExp(`/${name}\\.(tsx?|jsx?|mdx)$`).test(f);

const layouts = files.filter(routeFile("layout"));
const pages = files.filter(routeFile("page"));
const rootLayout = layouts
  .filter((f) => code(f).includes("<html"))
  .sort((a, b) => a.length - b.length)[0];

const ctx = {
  root, files, srcFiles, read, code, bare, pkg, deps, nextMajor, appDir, pagesDir,
  layouts, pages, rootLayout, inApp,
  lineOf: (text, idx) => text.slice(0, idx).split("\n").length,
};

// ---------- run ----------

const results = [];

if (has("--tools")) {
  const { found, findings } = detectIntegrations(ctx);
  results.push(...findings);
  if (has("--json")) {
    console.log(JSON.stringify({ next: nextVersion, integrations: found, findings }, null, 2));
    process.exit(0);
  }
  console.log(`nextjs-seo tools · next ${nextVersion} · ${srcFiles.length} source files`);
  console.log("");
  for (const i of found) {
    const mark = i.present ? "✓" : "✗";
    console.log(`${mark} ${i.name}`);
    for (const e of i.evidence.slice(0, 4)) console.log(`    ${e}`);
    if (!i.present && i.hint) console.log(`    → ${i.hint}`);
  }
  printFindings(findings);
  process.exit(0);
}

const active = RULES.filter(
  (r) => (!only || only.includes(r.id)) && !skip.includes(r.id) && (r.router !== "app" || appDir),
);
for (const rule of active) {
  let hits = [];
  try {
    hits = rule.check(ctx) ?? [];
  } catch (err) {
    hits = [{ file: "-", line: 0, msg: `rule crashed: ${err.message}` }];
  }
  for (const h of hits) results.push({ rule: rule.id, sev: rule.sev, fix: rule.fix, ...h });
}

if (has("--json")) {
  console.log(JSON.stringify({ next: nextVersion, appDir, pagesDir, findings: results }, null, 2));
} else {
  const router = appDir ? `app router (${appDir})` : pagesDir ? `pages router (${pagesDir}): app-router rules skipped` : "no router dir found";
  console.log(`nextjs-seo check · next ${nextVersion} · ${router} · ${srcFiles.length} source files · ${active.length} rules`);
  printFindings(results);
}
// --exit-zero: slash commands treat a non-zero exit as a failed command.
process.exit(results.some((r) => r.sev === "error") && !has("--exit-zero") ? 1 : 0);

function printFindings(list) {
  if (!list.length) {
    console.log("\nno findings");
    return;
  }
  const order = { error: 0, warn: 1, info: 2 };
  const byRule = new Map();
  for (const r of [...list].sort((a, b) => order[a.sev] - order[b.sev])) {
    if (!byRule.has(r.rule)) byRule.set(r.rule, []);
    byRule.get(r.rule).push(r);
  }
  const counts = { error: 0, warn: 0, info: 0 };
  for (const r of list) counts[r.sev]++;
  console.log(`\n${list.length} findings in ${byRule.size} rules: ${counts.error} error · ${counts.warn} warn · ${counts.info} info\n`);
  for (const [id, hits] of byRule) {
    const { sev, fix } = hits[0];
    console.log(`[${sev}] ${id}`);
    for (const h of hits.slice(0, max)) {
      console.log(`  ${h.file}${h.line ? ":" + h.line : ""}${h.msg ? "  " + h.msg : ""}`);
    }
    if (hits.length > max) console.log(`  … ${hits.length - max} more (--only ${id} --max 999)`);
    if (fix) console.log(`  fix: ${fix}`);
  }
}
