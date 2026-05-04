/**
 * HubbleWave Customer Instance Module - Variables
 *
 * Cluster-per-Customer architecture with dedicated VPC and EKS cluster
 */

# -----------------------------------------------------------------------------
# Required Variables - Instance Identity
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
  description = "Resource tier for this instance (determines node size, RDS/Redis size)"
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "professional", "enterprise", "enterprise_gpu"], var.resource_tier)
    error_message = "Resource tier must be one of: standard, professional, enterprise, enterprise_gpu."
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
# Control Plane Connection (for VPC Peering)
# -----------------------------------------------------------------------------

variable "control_plane_vpc_id" {
  description = "Control plane VPC ID for VPC peering"
  type        = string
}

variable "control_plane_vpc_cidr" {
  description = "Control plane VPC CIDR block for routing"
  type        = string
}

variable "control_plane_route_table_ids" {
  description = "Control plane private route table IDs for peering routes"
  type        = list(string)
}

variable "control_plane_role_arn" {
  description = "Control plane IAM role ARN (for assuming customer cluster access)"
  type        = string
}

# -----------------------------------------------------------------------------
# Customer VPC Configuration
# -----------------------------------------------------------------------------

variable "instance_vpc_cidr" {
  description = "CIDR block for customer VPC (auto-assigned from instance ID if empty)"
  type        = string
  default     = ""

  validation {
    condition     = var.instance_vpc_cidr == "" || can(cidrhost(var.instance_vpc_cidr, 0))
    error_message = "instance_vpc_cidr must be a valid CIDR block or empty for auto-assignment."
  }
}

# -----------------------------------------------------------------------------
# AWS Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-2"
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "17.6"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage in GB (for autoscaling)"
  type        = number
  default     = 100
}

# -----------------------------------------------------------------------------
# Redis Configuration
# -----------------------------------------------------------------------------

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

# -----------------------------------------------------------------------------
# DNS / Domain Configuration
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
# Container Registry Configuration
# -----------------------------------------------------------------------------

variable "container_registry_host" {
  description = "Container registry host (e.g., 687904696003.dkr.ecr.us-east-2.amazonaws.com)"
  type        = string
}

variable "instance_api_image_tag" {
  description = "Image tag for the instance API service"
  type        = string
}

variable "instance_web_image_tag" {
  description = "Image tag for the instance web client"
  type        = string
}

# -----------------------------------------------------------------------------
# Deployment Configuration
# -----------------------------------------------------------------------------

variable "api_replicas" {
  description = "Number of API replicas"
  type        = number
  default     = 1
}

variable "web_replicas" {
  description = "Number of web client replicas"
  type        = number
  default     = 1
}

# -----------------------------------------------------------------------------
# GPU / vLLM Configuration
# -----------------------------------------------------------------------------

variable "gpu_enabled" {
  description = "Enable GPU node and vLLM deployment for this instance"
  type        = bool
  default     = false
}

variable "gpu_instance_type" {
  description = "EC2 instance type for GPU nodes"
  type        = string
  default     = "g4dn.xlarge"

  validation {
    condition     = contains(["g4dn.xlarge", "g4dn.2xlarge", "g5.xlarge", "g5.2xlarge"], var.gpu_instance_type)
    error_message = "GPU instance type must be a supported NVIDIA GPU instance."
  }
}

variable "vllm_model" {
  description = "Hugging Face model ID for vLLM"
  type        = string
  default     = "meta-llama/Meta-Llama-3.1-8B-Instruct"
}

variable "vllm_image_tag" {
  description = "vLLM container image tag"
  type        = string
  default     = "v0.6.4.post1"
}

variable "huggingface_token" {
  description = "Hugging Face API token for model download (required for gated models like Llama)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ava_image_tag" {
  description = "Image tag for the AVA service"
  type        = string
  default     = ""
}

variable "ava_replicas" {
  description = "Number of AVA service replicas"
  type        = number
  default     = 1
}
