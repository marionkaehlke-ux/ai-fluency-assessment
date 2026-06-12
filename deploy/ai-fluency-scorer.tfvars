# Provisioning request for Phrase Launchpad (provision-infra skill).
# Target path in the infra repo: Phrase-Launchpad/platform-launchpad-services
#   vars/marion.kaehlke/ai-fluency-scorer.tfvars
#
# Apply by opening a PR against the infra repo (the provision-infra skill automates this).
# Creates: GitHub repo, K8s namespace (launchpad-ai-fluency-scorer), ECR repo (.../app),
# GitHub-OIDC + IRSA roles, and an RDS PostgreSQL instance (Secrets Manager: github/ai-fluency-scorer/database).
#
# NOTE: Redis (for BullMQ) is NOT provisioned by this skill — arrange a Redis/ElastiCache
# endpoint with the platform team and supply it as the REDIS_URL deploy secret.

owner                      = "marion.kaehlke"
name                       = "ai-fluency-scorer"
description                = "Internal Phrase application for AI fluency assessment"
repo_owner_github_username = "marionkaehlke-ux"

ecr_images = {
  "app" = {}
}

# PostgreSQL for assessment data (spec §5.4).
rds_enabled = true
