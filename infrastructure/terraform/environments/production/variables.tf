variable "aws_region" {
  description = "AWS region for the control plane"
  type        = string
  default     = "us-east-2"
}

variable "eks_cluster_name" {
  description = "EKS cluster name for the control plane"
  type        = string
  default     = "hubblewave-control"
}

variable "control_plane_namespace" {
  description = "Kubernetes namespace for the control plane"
  type        = string
  default     = "hubblewave-control"
}

variable "root_domain" {
  description = "Primary DNS domain"
  type        = string
  default     = "hubblewave.com"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "control_plane_ingress_hostname" {
  description = "Ingress hostname for the control plane"
  type        = string
}

variable "instance_ingress_hostname" {
  description = "Ingress hostname for customer instances"
  type        = string
}

variable "instance_terraform_state_bucket" {
  description = "S3 bucket for customer instance Terraform state"
  type        = string
}

variable "instance_terraform_state_region" {
  description = "AWS region for customer instance Terraform state"
  type        = string
  default     = ""
}

variable "instance_terraform_lock_table" {
  description = "DynamoDB table for customer instance Terraform locks"
  type        = string
}

variable "instance_terraform_state_prefix" {
  description = "S3 key prefix for customer instance Terraform state"
  type        = string
  default     = "instances"
}

variable "cors_origins" {
  description = "CORS origins for the control plane API"
  type        = string
}

variable "manage_dns" {
  description = "Whether to manage DNS records in Terraform"
  type        = bool
  default     = true
}

variable "db_host" {
  description = "PostgreSQL host address"
  type        = string
}

variable "db_admin_host" {
  description = "PostgreSQL admin host override (use localhost when tunneling)"
  type        = string
  default     = ""
}

variable "db_admin_sslmode" {
  description = "PostgreSQL sslmode for admin connection"
  type        = string
  default     = "require"
}

variable "db_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL user for the control plane"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL password for the control plane user"
  type        = string
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

variable "container_registry_host" {
  description = "Container registry hostname"
  type        = string
}

variable "control_plane_image_tag" {
  description = "Immutable image tag for the control plane API image"
  type        = string
}

variable "control_plane_web_image_tag" {
  description = "Immutable image tag for the control plane web app"
  type        = string
}

variable "control_plane_release_id" {
  description = "Release id for the control plane"
  type        = string
}

variable "default_platform_release_id" {
  description = "Default platform release id for new instances"
  type        = string
}

variable "instance_api_image_tag" {
  description = "Image tag for instance API service (defaults to empty, uses platform release id)"
  type        = string
  default     = ""
}

variable "instance_web_image_tag" {
  description = "Image tag for instance web client (defaults to empty, uses platform release id)"
  type        = string
  default     = ""
}

variable "cert_manager_issuer" {
  description = "cert-manager issuer name"
  type        = string
  default     = "letsencrypt-prod"
}

variable "enable_billing" {
  description = "Enable billing integrations"
  type        = bool
  default     = false
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "s3_bucket_pack_artifacts" {
  description = "S3 bucket for pack artifacts"
  type        = string
}

variable "db_instance_identifier" {
  description = "RDS instance identifier for the control plane database"
  type        = string
}

variable "db_subnet_group_name" {
  description = "RDS subnet group name"
  type        = string
}

variable "db_subnet_ids" {
  description = "Subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "db_security_group_ids" {
  description = "Security group IDs attached to the RDS instance"
  type        = list(string)
}

variable "db_parameter_group_name" {
  description = "RDS parameter group name"
  type        = string
}

variable "db_kms_key_id" {
  description = "KMS key ARN for RDS storage encryption"
  type        = string
}

variable "db_monitoring_role_arn" {
  description = "IAM role ARN for RDS enhanced monitoring"
  type        = string
}

variable "db_performance_insights_kms_key_id" {
  description = "KMS key ARN for RDS performance insights"
  type        = string
}

variable "db_backup_window" {
  description = "Preferred backup window for the RDS instance"
  type        = string
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window for the RDS instance"
  type        = string
}

variable "redis_replication_group_id" {
  description = "ElastiCache replication group identifier"
  type        = string
}

variable "redis_replication_group_description" {
  description = "ElastiCache replication group description"
  type        = string
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
}

variable "redis_engine_version" {
  description = "ElastiCache engine version"
  type        = string
}

variable "redis_subnet_group_name" {
  description = "ElastiCache subnet group name"
  type        = string
}

variable "redis_subnet_ids" {
  description = "Subnet IDs for the ElastiCache subnet group"
  type        = list(string)
}

variable "redis_security_group_ids" {
  description = "Security group IDs attached to ElastiCache"
  type        = list(string)
}

variable "redis_parameter_group_name" {
  description = "ElastiCache parameter group name"
  type        = string
}

variable "redis_snapshot_retention_limit" {
  description = "Snapshot retention limit for ElastiCache"
  type        = number
}

variable "redis_snapshot_window" {
  description = "Snapshot window for ElastiCache"
  type        = string
}

variable "ecr_control_plane_repository" {
  description = "ECR repository name for the control plane API"
  type        = string
}

variable "ecr_web_control_plane_repository" {
  description = "ECR repository name for the control plane web app"
  type        = string
}
