#!/usr/bin/env node
// PreToolUse hook: blocks any tool call that would read, write, list, or load
// an env file (.env, .env.local, .env.production, .envrc, .dev.vars, ...).
// .env.example and other templates stay allowed. Exit code 2 blocks the call
// and sends the stderr message back to Claude.

import { isEnvFile, isEnvGlob, commandTouchesEnv } from "./lib/env.mjs";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // not our business if the payload is unreadable
  }

  const tool = input.tool_name ?? "";
  const ti = input.tool_input ?? {};
  const paths = [ti.file_path, ti.notebook_path, ti.path, ti.glob];
  if (tool === "Glob") paths.push(ti.pattern);

  const hit =
    paths.some((p) => typeof p === "string" && (isEnvFile(p) || isEnvGlob(p))) ||
    (tool === "Bash" && typeof ti.command === "string" && commandTouchesEnv(ti.command));

  if (hit) {
    process.stderr.write(
      "nextjs-seo env guard: blocked. Env files (.env, .env.*, .envrc, .dev.vars) may hold secrets and are off-limits. " +
        "Don't read, write, list, source, or load them, and don't ask to. .env.example is allowed. " +
        "If a value is needed, refer to the variable by name (e.g. process.env.NEXT_PUBLIC_GTM_ID) or ask the user.\n",
    );
    process.exit(2);
  }
  process.exit(0);
});
