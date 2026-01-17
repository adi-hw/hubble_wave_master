/**
 * HubbleWave Customer Instance Module - Variables
 */

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "instance_id" {
  description = "Unique identifier for this instance (UUID)"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.instance_id))
    error_message = "Instance ID must be a valid UUID."
  }
}

variable "customer_code" {
  description = "Short customer identifier (alphanumeric, lowercase)"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,20}$", var.customer_code))
    error_message = "Customer code must be 3-21 lowercase alphanumeric characters, starting with a letter."
  }
}

variable "customer_name" {
  description = "Full customer name for display purposes"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "license_key" {
  description = "HubbleWave license key for this instance"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Resource Configuration
# -----------------------------------------------------------------------------

variable "resource_tier" {
  description = "Resource tier for this instance"
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "professional", "enterprise"], var.resource_tier)
    error_message = "Resource tier must be one of: standard, professional, enterprise."
  }
}

variable "platform_release_id" {
  description = "HubbleWave platform release id to deploy (YYYYMMDD-sha)"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{8}-[0-9a-f]{7,64}$", var.platform_release_id))
    error_message = "platform_release_id must be a release id in the form YYYYMMDD-sha."
  }
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "db_host" {
  description = "PostgreSQL host address"
  type        = string
}

variable "db_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_host" {
  description = "Redis host address"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

# -----------------------------------------------------------------------------
# AWS Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for S3 bucket"
  type        = string
  default     = "us-west-1"
}

variable "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN for IRSA"
  type        = string

  validation {
    condition     = length(var.eks_oidc_provider_arn) > 0
    error_message = "eks_oidc_provider_arn must be set."
  }
}

variable "eks_oidc_provider_host" {
  description = "EKS OIDC provider host (without https://)"
  type        = string

  validation {
    condition     = length(var.eks_oidc_provider_host) > 0
    error_message = "eks_oidc_provider_host must be set."
  }
}

# -----------------------------------------------------------------------------
# Control Plane Configuration
# -----------------------------------------------------------------------------

variable "root_domain" {
  description = "Base DNS domain for Control Plane and instances"
  type        = string

  validation {
    condition     = var.root_domain == "hubblewave.com"
    error_message = "root_domain must be hubblewave.com per platform DNS canon."
  }
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for hubblewave.com"
  type        = string
}

variable "instance_ingress_hostname" {
  description = "External ingress hostname for customer instances"
  type        = string

  validation {
    condition     = length(var.instance_ingress_hostname) > 0
    error_message = "instance_ingress_hostname must be set."
  }
}

# -----------------------------------------------------------------------------
# Application Configuration
# -----------------------------------------------------------------------------

variable "cors_origins" {
  description = "Allowed CORS origins (comma-separated)"
  type        = string
  default     = "*"
}

variable "api_rate_limit" {
  description = "API rate limit per minute"
  type        = number
  default     = 1000
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_ava" {
  description = "Enable AVA AI assistant"
  type        = bool
  default     = true
}

variable "enable_audit_logs" {
  description = "Enable comprehensive audit logging"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}
