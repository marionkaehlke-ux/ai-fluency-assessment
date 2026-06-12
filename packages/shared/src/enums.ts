/** Domain enums. SCREAMING_SNAKE_CASE values (CLAUDE.md naming convention). */

export const USER_ROLES = ['EMPLOYEE', 'MANAGER', 'ELT', 'ADMIN_CALIBRATOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ASSESSMENT_STATUSES = [
  'DRAFT',
  'SELF_SUBMITTED',
  'CALIBRATED',
  'ARCHIVED',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/** Additive role precedence: ELT > MANAGER > EMPLOYEE (spec §3.2). */
export const ROLE_PRECEDENCE: Record<UserRole, number> = {
  ADMIN_CALIBRATOR: 3,
  ELT: 2,
  MANAGER: 1,
  EMPLOYEE: 0,
};

/** Audit log action constants (spec §6, appended to as the API grows). */
export const AUDIT_ACTIONS = {
  ASSESSMENT_CREATED: 'ASSESSMENT_CREATED',
  SELF_SUBMITTED: 'SELF_SUBMITTED',
  SCORE_GENERATED: 'SCORE_GENERATED',
  SCORE_FAILED: 'SCORE_FAILED',
  SCORE_AGREED: 'SCORE_AGREED',
  FLAG_CREATED: 'FLAG_CREATED',
  EXPORT_GENERATED: 'EXPORT_GENERATED',
  NARRATIVE_GENERATED: 'NARRATIVE_GENERATED',
  ASSESSMENT_ARCHIVED: 'ASSESSMENT_ARCHIVED',
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
