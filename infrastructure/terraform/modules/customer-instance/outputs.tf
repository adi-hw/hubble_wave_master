/**
 * HubbleWave Customer Instance Module - Outputs
 *
 * Dedicated infrastructure per instance model
 */

# -----------------------------------------------------------------------------
# Instance Identifiers
# -----------------------------------------------------------------------------

output "instance_id" {
  description = "Instance UUID"
  value       = var.instance_id
}

output "namespace" {
  description = "Kubernetes namespace for this instance"
  value       = kubernetes_namespace.instance.metadata[0].name
}

output "instance_name" {
  description = "Computed instance name (customer_code-environment)"
  value       = local.instance_name
}

output "instance_domain" {
  description = "Customer instance domain"
  value       = local.instance_domain
}

# -----------------------------------------------------------------------------
# Database Outputs (Dedicated RDS)
# -----------------------------------------------------------------------------

output "db_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.instance.id
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.instance.arn
}

output "db_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = aws_db_instance.instance.endpoint
}

output "db_host" {
  description = "RDS instance hostname"
  value       = aws_db_instance.instance.address
}

output "db_port" {
  description = "RDS instance port"
  value       = aws_db_instance.instance.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.instance.db_name
}

output "db_username" {
  description = "Database admin username"
  value       = aws_db_instance.instance.username
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Redis Outputs (Dedicated ElastiCache)
# -----------------------------------------------------------------------------

output "redis_cluster_id" {
  description = "ElastiCache cluster identifier"
  value       = aws_elasticache_cluster.instance.cluster_id
}

output "redis_endpoint" {
  description = "ElastiCache cluster endpoint"
  value       = aws_elasticache_cluster.instance.cache_nodes[0].address
}

output "redis_port" {
  description = "ElastiCache port"
  value       = aws_elasticache_cluster.instance.port
}

# -----------------------------------------------------------------------------
# Storage Outputs
# -----------------------------------------------------------------------------

output "s3_bucket_name" {
  description = "S3 bucket name for instance storage"
  value       = aws_s3_bucket.instance.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.instance.arn
}

output "s3_bucket_region" {
  description = "S3 bucket region"
  value       = var.aws_region
}

# -----------------------------------------------------------------------------
# Secrets Manager Outputs
# -----------------------------------------------------------------------------

output "database_secret_arn" {
  description = "AWS Secrets Manager ARN for instance database credentials"
  value       = aws_secretsmanager_secret.database.arn
}

output "redis_secret_arn" {
  description = "AWS Secrets Manager ARN for instance Redis credentials"
  value       = aws_secretsmanager_secret.redis.arn
}

output "instance_config_secret_arn" {
  description = "AWS Secrets Manager ARN for instance configuration"
  value       = aws_secretsmanager_secret.instance_config.arn
}

output "s3_secret_arn" {
  description = "AWS Secrets Manager ARN for instance S3 config"
  value       = aws_secretsmanager_secret.s3.arn
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------

output "rds_security_group_id" {
  description = "Security group ID for RDS instance"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster"
  value       = aws_security_group.redis.id
}

# -----------------------------------------------------------------------------
# IAM Outputs
# -----------------------------------------------------------------------------

output "workload_role_arn" {
  description = "IAM role ARN for workload service account"
  value       = aws_iam_role.workload.arn
}

output "workload_role_name" {
  description = "IAM role name for workload service account"
  value       = aws_iam_role.workload.name
}

# -----------------------------------------------------------------------------
# Kubernetes Resources
# -----------------------------------------------------------------------------

output "service_account_name" {
  description = "Kubernetes service account for workloads"
  value       = kubernetes_service_account.workload.metadata[0].name
}

output "database_secret_name" {
  description = "Name of the Kubernetes secret containing database credentials"
  value       = kubernetes_secret.database.metadata[0].name
}

output "redis_secret_name" {
  description = "Name of the Kubernetes secret containing Redis credentials"
  value       = kubernetes_secret.redis.metadata[0].name
}

output "config_secret_name" {
  description = "Name of the Kubernetes secret containing instance config"
  value       = kubernetes_secret.instance_config.metadata[0].name
}

output "s3_secret_name" {
  description = "Name of the Kubernetes secret containing S3 config"
  value       = kubernetes_secret.s3_credentials.metadata[0].name
}

output "app_config_name" {
  description = "Name of the Kubernetes ConfigMap for application settings"
  value       = kubernetes_config_map.app_config.metadata[0].name
}

# -----------------------------------------------------------------------------
# Resource Configuration
# -----------------------------------------------------------------------------

output "resource_tier" {
  description = "Resource tier for this instance"
  value       = var.resource_tier
}

output "tier_config" {
  description = "Resource configuration for the selected tier"
  value       = local.tier_config
}

# -----------------------------------------------------------------------------
# Deployment Outputs
# -----------------------------------------------------------------------------

output "api_deployment_name" {
  description = "Name of the API deployment"
  value       = kubernetes_deployment.api.metadata[0].name
}

output "web_deployment_name" {
  description = "Name of the web client deployment"
  value       = kubernetes_deployment.web.metadata[0].name
}

output "api_service_name" {
  description = "Name of the API service"
  value       = kubernetes_service.api.metadata[0].name
}

output "web_service_name" {
  description = "Name of the web client service"
  value       = kubernetes_service.web.metadata[0].name
}

output "ingress_name" {
  description = "Name of the instance ingress"
  value       = kubernetes_ingress_v1.instance.metadata[0].name
}

# -----------------------------------------------------------------------------
# Connection URLs
# -----------------------------------------------------------------------------

output "instance_url" {
  description = "URL to access the instance"
  value       = "https://${local.instance_domain}"
}

output "api_url" {
  description = "URL to access the instance API"
  value       = "https://${local.instance_domain}/api"
}

# -----------------------------------------------------------------------------
# Metadata for Control Plane Registration
# -----------------------------------------------------------------------------

output "instance_metadata" {
  description = "Metadata for Control Plane registration"
  value = {
    instance_id         = var.instance_id
    customer_code       = var.customer_code
    customer_name       = var.customer_name
    environment         = var.environment
    namespace           = kubernetes_namespace.instance.metadata[0].name
    platform_release_id = var.platform_release_id
    resource_tier       = var.resource_tier
    db_instance_id      = aws_db_instance.instance.id
    db_endpoint         = aws_db_instance.instance.endpoint
    redis_cluster_id    = aws_elasticache_cluster.instance.cluster_id
    redis_endpoint      = aws_elasticache_cluster.instance.cache_nodes[0].address
    s3_bucket           = aws_s3_bucket.instance.id
    instance_domain     = local.instance_domain
    control_plane_url   = local.control_plane_url
    created_at          = kubernetes_namespace.instance.metadata[0].annotations["hubblewave.com/created-at"]
    gpu_enabled         = local.gpu_enabled_effective
  }
}

# -----------------------------------------------------------------------------
# GPU / vLLM Outputs
# -----------------------------------------------------------------------------

output "gpu_enabled" {
  description = "Whether GPU/vLLM is enabled for this instance"
  value       = local.gpu_enabled_effective
}

output "gpu_node_group_name" {
  description = "Name of the GPU node group"
  value       = local.gpu_enabled_effective ? aws_eks_node_group.gpu[0].node_group_name : null
}

output "gpu_node_group_arn" {
  description = "ARN of the GPU node group"
  value       = local.gpu_enabled_effective ? aws_eks_node_group.gpu[0].arn : null
}

output "vllm_service_url" {
  description = "Internal URL for vLLM service"
  value       = local.gpu_enabled_effective ? "http://vllm-service.${kubernetes_namespace.instance.metadata[0].name}.svc.cluster.local:8000" : null
}

output "vllm_deployment_name" {
  description = "Name of the vLLM deployment"
  value       = local.gpu_enabled_effective ? kubernetes_deployment.vllm[0].metadata[0].name : null
}

output "ava_service_url" {
  description = "Internal URL for AVA service"
  value       = local.gpu_enabled_effective ? "http://ava-service.${kubernetes_namespace.instance.metadata[0].name}.svc.cluster.local:80" : null
}

output "ava_deployment_name" {
  description = "Name of the AVA deployment"
  value       = local.gpu_enabled_effective ? kubernetes_deployment.ava[0].metadata[0].name : null
}

output "ava_external_url" {
  description = "External URL for AVA API"
  value       = local.gpu_enabled_effective ? "https://${local.instance_domain}/api/ava" : null
}
