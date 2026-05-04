/**
 * HubbleWave Dev Instance - Variables
 */

variable "aws_region" {
  type    = string
  default = "us-east-2"
}

variable "eks_cluster_name" {
  type    = string
  default = "hubblewave-control"
}

variable "control_plane_role_name" {
  type    = string
  default = "hubblewave-control-plane"
}

# Instance identifiers
variable "instance_id" {
  type = string
}

variable "customer_code" {
  type = string
}

variable "customer_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "license_key" {
  type      = string
  sensitive = true
}

variable "platform_release_id" {
  type = string
}

variable "resource_tier" {
  type    = string
  default = "standard"
}

# Instance VPC
variable "instance_vpc_cidr" {
  type    = string
  default = ""
}

# Database
variable "db_engine_version" {
  type    = string
  default = "16.11"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

# Redis
variable "redis_engine_version" {
  type    = string
  default = "7.1"
}

# DNS
variable "root_domain" {
  type    = string
  default = "hubblewave.com"
}

variable "cloudflare_zone_id" {
  type = string
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

# Application
variable "cors_origins" {
  type    = string
  default = "*"
}

variable "api_rate_limit" {
  type    = number
  default = 1000
}

# Container images
variable "container_registry_host" {
  type = string
}

variable "instance_api_image_tag" {
  type = string
}

variable "instance_web_image_tag" {
  type = string
}

# Deployment
variable "api_replicas" {
  type    = number
  default = 1
}

variable "web_replicas" {
  type    = number
  default = 1
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
  description = "Image tag for the AVA service (defaults to instance_api_image_tag if empty)"
  type        = string
  default     = ""
}

variable "ava_replicas" {
  description = "Number of AVA service replicas"
  type        = number
  default     = 1
}
