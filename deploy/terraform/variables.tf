# ═══════════════════════════════════════════════════════════════════════════
# Input Variables — fill these in terraform.tfvars before running
# ═══════════════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "neuraline"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL (min 8 chars, letters+numbers)"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Auth token for Redis (min 16 chars)"
  type        = string
  sensitive   = true
}

variable "github_repo_url" {
  description = "Git clone URL for your Neuraline repo"
  type        = string
  default     = "https://github.com/your-org/NeuralineBase.git"
}

variable "your_public_ip" {
  description = "Your home/office public IP for SSH access (e.g. 203.45.67.89)"
  type        = string
}
