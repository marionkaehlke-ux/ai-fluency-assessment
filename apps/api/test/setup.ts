// Minimal env so config.ts loads during unit tests. No real services are contacted —
// Prisma/Redis/Anthropic are mocked in the suites that touch them.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.CLAUDE_MODEL = 'claude-sonnet-4-5';
process.env.ELT_EMAILS = 'elt@phrase.com,marion.kaehlke@phrase.com';
process.env.ADMIN_CALIBRATOR_GROUP = 'phrase-people-ops';
process.env.CURRENT_CYCLE = '2026-H1';
