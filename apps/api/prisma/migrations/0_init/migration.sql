-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'ELT', 'ADMIN_CALIBRATOR');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SELF_SUBMITTED', 'CALIBRATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('MINDSET', 'STRATEGY', 'BUILDING', 'ACCOUNTABILITY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "function_area" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "manager_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "opening_response" TEXT,
    "composite_level" DOUBLE PRECISION,
    "ai_narrative" TEXT,
    "scoring_failed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_scores" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "employee_response" TEXT,
    "manager_notes" TEXT,
    "ai_suggested_level" INTEGER,
    "ai_rationale" TEXT,
    "agreed_level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_calibrations" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "conducted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flagged_for_sa_builds" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_cycle_idx" ON "assessments"("cycle");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_user_id_cycle_key" ON "assessments"("user_id", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_scores_assessment_id_dimension_key" ON "dimension_scores"("assessment_id", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "manager_calibrations_assessment_id_key" ON "manager_calibrations"("assessment_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_target_id_idx" ON "audit_log"("target_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_scores" ADD CONSTRAINT "dimension_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_calibrations" ADD CONSTRAINT "manager_calibrations_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_calibrations" ADD CONSTRAINT "manager_calibrations_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

