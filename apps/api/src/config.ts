import { z } from 'zod';

/**
 * All configuration comes from environment variables (12-factor / CLAUDE.md).
 * Nothing environment-specific is hard-coded — including the Claude model string.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().min(1), // pinned, never floated (spec §7.4)
  ANTHROPIC_VERSION: z.string().default('2023-06-01'),
  // Optional SDK baseURL override. Unset in production (SDK default). Used by E2E tests
  // to point the SDK at a local mock so scoring is deterministic and offline.
  ANTHROPIC_BASE_URL: z.string().optional(),
  SCORING_PROMPT_VERSION: z.string().default('v1'),

  SCORING_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SLACK_NOTIFICATIONS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Auth: Okta injects X-Userinfo at the gateway in prod. Dev bypass for local only.
  AUTH_DEV_BYPASS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  AUTH_DEV_EMAIL: z.string().optional(),
  AUTH_DEV_NAME: z.string().optional(),
  AUTH_DEV_GROUPS: z.string().optional(),

  PERSONIO_CLIENT_ID: z.string().optional(),
  PERSONIO_API_KEY: z.string().optional(),

  ELT_EMAILS: z.string().default(''),
  ADMIN_CALIBRATOR_GROUP: z.string().default('phrase-people-ops'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('ai-fluency@phrase.com'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),

  // Production: Fastify serves the built React SPA from this directory (CLAUDE.md).
  // Unset in local dev (Vite dev server serves the frontend and proxies /api).
  STATIC_DIR: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast on misconfiguration — never start with invalid config.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  if (env.NODE_ENV === 'production' && env.AUTH_DEV_BYPASS) {
    throw new Error('AUTH_DEV_BYPASS must never be enabled in production.');
  }

  const eltEmails = new Set(
    env.ELT_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

  return { ...env, eltEmails };
}

export type AppConfig = ReturnType<typeof loadConfig>;
export const config = loadConfig();
