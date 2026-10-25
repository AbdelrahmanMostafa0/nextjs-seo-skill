# Contributing

```
.claude-plugin/       plugin + marketplace manifests, icon
skills/nextjs-seo/    the skill: SKILL.md + references/ (the knowledge)
commands/             slash commands (/nextjs-seo:<file name>)
scripts/
  seo-check.mjs       scanner entry point (CLI, output formatting)
  rules.mjs           static rules
  integrations.mjs    Search Console / GTM / analytics detection
  env-guard.mjs       PreToolUse hook that blocks env-file access
  lib/env.mjs         shared env-file detection
hooks/hooks.json      registers the env guard
test/                 fixtures + test runner
```

Run the tests with `npm test`. Zero dependencies, Node 18+.

Try your local copy in Claude Code:

```
/plugin marketplace add /path/to/nextjs-seo-skill
/plugin install nextjs-seo@nextjs-seo
```

## Add a rule

1. Append an object to `RULES` in `scripts/rules.mjs`:

   ```js
   {
     id: "kebab-case-id",          // unique, shown in output, used by --only/--skip
     sev: "warn",                  // error: breaks indexing or is a security hole
                                   // warn: likely hurts SEO; info: worth a look
     router: "app",                // omit if it applies to the pages router too
     title: "one line: what's wrong",
     fix: "one line: how to fix it",
     check: (ctx) => [{ file, line, msg? }],
   }
   ```

   `ctx` gives you `files`, `srcFiles`, `pages`, `layouts`, `rootLayout`, `deps`, `nextMajor`, `appDir`, and three views of a file's text:
   - `read(f)`: raw text
   - `code(f)`: comments blanked
   - `bare(f)`: comments and string contents blanked

   All three keep line numbers. Use `bare` when matching code constructs so prose inside strings doesn't trigger the rule.

2. Make `test/fixtures/bad-app` trigger it, keep `test/fixtures/good-app` clean, and add the id to `EXPECTED_BAD` in `test/run.mjs`.
3. Run the scanner on a real project or two. A rule that floods real projects with false positives costs more than it finds. When unsure, use `info`.

## Add an integration

Append to `TOOLS` in `scripts/integrations.mjs`. Give it a `name` plus any of `patterns` (regexes over source), `pkgs` (package names), and `files` (path regexes). Set `core: true` only for tools every site should consider; those are listed even when missing, with a `hint`.

## Add a command

Create `commands/<name>.md`. It becomes `/nextjs-seo:<name>`.

- Frontmatter needs a `description`, `argument-hint` if the command takes arguments, and `allowed-tools` kept as narrow as possible.
- To keep tokens low, put the work in a script and inject its output with `` !`node "${CLAUDE_PLUGIN_ROOT}/scripts/...` ``. Add `--exit-zero` (or `|| true`): a non-zero exit aborts the command.
- Tell Claude what to read (the flagged lines) and what not to (the whole repo).
- End with the env rule. Every command repeats it.

Add the command to the tables in `README.md` and `skills/nextjs-seo/SKILL.md`.

## Ground rules

- Never read, write, or load env files in scripts, tests, or fixtures. Don't add an env file to a fixture; test the guard with strings.
- Never start, build, or execute the user's app from a script.
- Claims about Google's behavior need a source in Google Search Central docs. Date them ("as of October 2026"), since they change.
