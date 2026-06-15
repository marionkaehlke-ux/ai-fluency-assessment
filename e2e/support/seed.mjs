// Seeds the E2E database with the records the manager-calibration paths need:
// a manager, two reports, and two SELF_SUBMITTED assessments (one AI-scored, one with
// scoring failed). Users are keyed by email, matching the X-Userinfo identities so the
// app's login upsert reuses these rows. Run by Playwright globalSetup.
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DIMENSIONS = ['MINDSET', 'STRATEGY', 'BUILDING', 'ACCOUNTABILITY'];
const IDS = {
  manager: '00000000-0000-4000-8000-000000000001',
  employeeForMgr: '00000000-0000-4000-8000-000000000002',
  assessmentAi: '00000000-0000-4000-8000-000000000003',
  employee2: '00000000-0000-4000-8000-000000000004',
  assessmentNoAi: '00000000-0000-4000-8000-000000000005',
};
const CYCLE = '2026-H1';
const long = (s) => s.padEnd(90, ' ') + 'xxxxxxxxxxxxxxxxxxxx';

export async function seed(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      'TRUNCATE "audit_log","manager_calibrations","dimension_scores","assessments","users" RESTART IDENTITY CASCADE',
    );

    const user = (id, email, name, role, managerId) =>
      client.query(
        `INSERT INTO users (id,email,name,role,function_area,manager_id,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
        [id, email, name, role, 'Engineering', managerId],
      );

    await user(IDS.manager, 'mgr.e2e@phrase.com', 'E2E Manager', 'MANAGER', null);
    await user(IDS.employeeForMgr, 'emp.e2e@phrase.com', 'E2E Report One', 'EMPLOYEE', IDS.manager);
    await user(IDS.employee2, 'emp2.e2e@phrase.com', 'E2E Report Two', 'EMPLOYEE', IDS.manager);

    const assessment = (id, userId, scoringFailed) =>
      client.query(
        `INSERT INTO assessments (id,user_id,cycle,status,opening_response,scoring_failed,created_at,updated_at)
         VALUES ($1,$2,$3,'SELF_SUBMITTED',$4,$5,now(),now())`,
        [id, userId, CYCLE, long('opening reflection for e2e'), scoringFailed],
      );

    await assessment(IDS.assessmentAi, IDS.employeeForMgr, false);
    await assessment(IDS.assessmentNoAi, IDS.employee2, true);

    for (const dim of DIMENSIONS) {
      // AI-scored assessment: suggestions present, awaiting calibration.
      await client.query(
        `INSERT INTO dimension_scores (id,assessment_id,dimension,employee_response,ai_suggested_level,ai_rationale,created_at,updated_at)
         VALUES ($1,$2,$3,$4,2,$5,now(),now())`,
        [randomUUID(), IDS.assessmentAi, dim, long(`response ${dim}`), `rationale ${dim}`],
      );
      // Scoring-failed assessment: no AI suggestion → manual calibration path.
      await client.query(
        `INSERT INTO dimension_scores (id,assessment_id,dimension,employee_response,created_at,updated_at)
         VALUES ($1,$2,$3,$4,now(),now())`,
        [randomUUID(), IDS.assessmentNoAi, dim, long(`response ${dim}`)],
      );
    }
  } finally {
    await client.end();
  }
}
