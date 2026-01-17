/**
 * HubbleWave Control Plane Module - Variables
 */

# -----------------------------------------------------------------------------
# Environment Configuration
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "control_plane_image_tag" {
  description = "Immutable image tag for the Control Plane API image (git sha or release id)"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{7,64}$", var.control_plane_image_tag)) || can(regex("^[0-9]{8}-[0-9a-f]{7,64}$", var.control_plane_image_tag))
    error_message = "control_plane_image_tag must be a git sha or a release id in the form YYYYMMDD-sha."
  }
}

variable "control_plane_web_image_tag" {
  description = "Immutable image tag for the Control Plane web image (git sha or release id)"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{7,64}$", var.control_plane_web_image_tag)) || can(regex("^[0-9]{8}-[0-9a-f]{7,64}$", var.control_plane_web_image_tag))
    error_message = "control_plane_web_image_tag must be a git sha or a release id in the form YYYYMMDD-sha."
  }
}

variable "control_plane_release_id" {
  description = "Release id used for Control Plane metadata (YYYYMMDD-sha)"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{8}-[0-9a-f]{7,64}$", var.control_plane_release_id))
    error_message = "control_plane_release_id must be a release id in the form YYYYMMDD-sha."
  }
}

variable "default_platform_release_id" {
  description = "Default platform release id for new instances (YYYYMMDD-sha)"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{8}-[0-9a-f]{7,64}$", var.default_platform_release_id))
    error_message = "default_platform_release_id must be a release id in the form YYYYMMDD-sha."
  }
}

# -----------------------------------------------------------------------------
# Domain and URL Configuration
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

variable "control_plane_ingress_hostname" {
  description = "External ingress hostname for the Control Plane"
  type        = string

  validation {
    condition     = length(var.control_plane_ingress_hostname) > 0
    error_message = "control_plane_ingress_hostname must be set."
  }
}

# -----------------------------------------------------------------------------
# Instance Provisioning Configuration
# -----------------------------------------------------------------------------

variable "instance_root_domain" {
  description = "Root domain for customer instances"
  type        = string
  default     = ""
}

variable "instance_ingress_hostname" {
  description = "External ingress hostname for customer instances"
  type        = string
  default     = ""
}

variable "instance_aws_region" {
  description = "AWS region for customer instance resources"
  type        = string
  default     = ""
}

variable "instance_db_host" {
  description = "PostgreSQL host for customer instances"
  type        = string
  default     = ""
}

variable "instance_db_port" {
  description = "PostgreSQL port for customer instances"
  type        = number
  default     = 0
}

variable "instance_db_admin_username" {
  description = "PostgreSQL admin username for instance provisioning"
  type        = string
  default     = ""
}

variable "instance_db_admin_password" {
  description = "PostgreSQL admin password for instance provisioning"
  type        = string
  default     = ""
  sensitive   = true
}

variable "instance_db_admin_sslmode" {
  description = "PostgreSQL sslmode for instance provisioning"
  type        = string
  default     = ""
}

variable "instance_redis_host" {
  description = "Redis host for customer instances"
  type        = string
  default     = ""
}

variable "instance_redis_port" {
  description = "Redis port for customer instances"
  type        = number
  default     = 0
}

variable "instance_terraform_state_bucket" {
  description = "S3 bucket for customer instance Terraform state"
  type        = string

  validation {
    condition     = length(var.instance_terraform_state_bucket) > 0
    error_message = "instance_terraform_state_bucket must be set."
  }
}

variable "instance_terraform_state_region" {
  description = "AWS region for customer instance Terraform state"
  type        = string
  default     = ""
}

variable "instance_terraform_lock_table" {
  description = "DynamoDB table for customer instance Terraform locks"
  type        = string

  validation {
    condition     = length(var.instance_terraform_lock_table) > 0
    error_message = "instance_terraform_lock_table must be set."
  }
}

variable "instance_terraform_state_prefix" {
  description = "S3 key prefix for customer instance Terraform state"
  type        = string
  default     = "instances"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for instance DNS management"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.cloudflare_api_token) > 0
    error_message = "cloudflare_api_token must be set."
  }
}

variable "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN for instance IRSA"
  type        = string

  validation {
    condition     = length(var.eks_oidc_provider_arn) > 0
    error_message = "eks_oidc_provider_arn must be set."
  }
}

variable "eks_oidc_provider_host" {
  description = "EKS OIDC provider host for instance IRSA"
  type        = string

  validation {
    condition     = length(var.eks_oidc_provider_host) > 0
    error_message = "eks_oidc_provider_host must be set."
  }
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = string
}

variable "manage_dns" {
  description = "Whether to manage DNS records for the control plane"
  type        = bool
  default     = true
}

variable "aws_region" {
  description = "AWS region for control plane runtime services"
  type        = string
}

variable "s3_bucket_pack_artifacts" {
  description = "S3 bucket for control plane pack artifacts"
  type        = string
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

variable "db_name" {
  description = "PostgreSQL database name for control plane"
  type        = string
  default     = "hubblewave_control_plane"
}

variable "db_username" {
  description = "PostgreSQL user for control plane"
  type        = string
  default     = "hubblewave_cp_user"
}

variable "db_password" {
  description = "PostgreSQL password for control plane user"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_admin_username" {
  description = "PostgreSQL admin username"
  type        = string
}

variable "db_admin_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "db_admin_sslmode" {
  description = "PostgreSQL sslmode for admin connection"
  type        = string
  default     = "require"
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

variable "redis_password" {
  description = "Redis password (leave empty when auth is disabled)"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Container Registry
# -----------------------------------------------------------------------------

variable "container_registry_host" {
  description = "AWS ECR registry hostname"
  type        = string

  validation {
    condition     = length(var.container_registry_host) > 0
    error_message = "container_registry_host must be set."
  }
}

# -----------------------------------------------------------------------------
# Replica Configuration
# -----------------------------------------------------------------------------

variable "api_replicas" {
  description = "Number of API replicas"
  type        = number
  default     = 3
}

variable "web_replicas" {
  description = "Number of web dashboard replicas"
  type        = number
  default     = 2
}

variable "terraform_worker_replicas" {
  description = "Number of Terraform worker replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# AWS / IAM Configuration
# -----------------------------------------------------------------------------

variable "control_plane_role_arn" {
  description = "IAM role ARN for the Control Plane service account"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# TLS / Certificate Configuration
# -----------------------------------------------------------------------------

variable "cert_manager_issuer" {
  description = "cert-manager ClusterIssuer name"
  type        = string
}

# -----------------------------------------------------------------------------
# Billing Integration
# -----------------------------------------------------------------------------

variable "enable_billing" {
  description = "Enable Stripe billing integration"
  type        = bool
  default     = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Monitoring Configuration
# -----------------------------------------------------------------------------

variable "enable_prometheus" {
  description = "Enable Prometheus metrics endpoint"
  type        = bool
  default     = true
}

variable "prometheus_namespace" {
  description = "Namespace where Prometheus is installed"
  type        = string
  default     = "monitoring"
}
