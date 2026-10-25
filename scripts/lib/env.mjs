// Shared env-file detection. Used by the scanner (to never open these files)
// and by the env-guard hook (to block Claude from touching them).

import path from "node:path";

// Template files hold no secrets and stay accessible.
const TEMPLATE = /\.(example|sample|template|dist|defaults)$/i;

// .env, .env.local, .env.production, .envrc, .dev.vars (Cloudflare)
const ENV_NAME = /^(\.env(rc|\..+)?|\.dev\.vars(\..+)?)$/i;

export function isEnvFile(p) {
  const base = path.basename(String(p).replace(/[\\/]+$/, ""));
  return ENV_NAME.test(base) && !TEMPLATE.test(base);
}

// A glob such as `.env*` or `**/.env.*` can expand to a real env file.
export function isEnvGlob(p) {
  const base = path.basename(String(p));
  if (!/[*?[{]/.test(base)) return false;
  return /^\.env|^\.dev\.vars/.test(base) && !TEMPLATE.test(base);
}

// Commands that load env files without naming them.
const ENV_LOADERS = [
  /(^|[\s;&|(])dotenv(-cli)?(\s|$)/,
  /--env-file(=|\s)/,
  /(^|[\s;&|(])(source|\.)\s+\S*\.env\b/,
  /(^|[\s;&|(])direnv\s+(allow|exec|export)/,
  /(^|[\s;&|(])printenv(\s|$)/,
  /(^|[\s;&|(])env(\s*$|\s*[|>;&])/,
];

export function commandTouchesEnv(command) {
  const cmd = String(command);
  if (ENV_LOADERS.some((re) => re.test(cmd))) return true;
  const tokens = cmd.split(/[\s'"`=<>|;&(),:]+/).filter(Boolean);
  return tokens.some((t) => isEnvFile(t) || isEnvGlob(t));
}
