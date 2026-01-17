/**
 * HubbleWave Customer Instance Module - Outputs
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
# Database Outputs
# -----------------------------------------------------------------------------

output "database_name" {
  description = "PostgreSQL database name"
  value       = postgresql_database.instance.name
}

output "database_user" {
  description = "PostgreSQL database user"
  value       = postgresql_role.instance.name
}

output "database_connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${postgresql_role.instance.name}:****@${var.db_host}:${var.db_port}/${postgresql_database.instance.name}?sslmode=require"
  sensitive   = true
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
# Kubernetes Resources
# -----------------------------------------------------------------------------

output "service_account_name" {
  description = "Kubernetes service account for workloads"
  value       = kubernetes_service_account.workload.metadata[0].name
}

output "connectors_service_account_name" {
  description = "Kubernetes service account for connector workloads"
  value       = kubernetes_service_account.connectors.metadata[0].name
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
# Connection Details (for Control Plane registration)
# -----------------------------------------------------------------------------

output "instance_metadata" {
  description = "Metadata for Control Plane registration"
  value = {
    instance_id      = var.instance_id
    customer_code    = var.customer_code
    customer_name    = var.customer_name
    environment      = var.environment
    namespace        = kubernetes_namespace.instance.metadata[0].name
    platform_release_id = var.platform_release_id
    resource_tier    = var.resource_tier
    database_name    = postgresql_database.instance.name
    s3_bucket        = aws_s3_bucket.instance.id
    instance_domain  = local.instance_domain
    control_plane_url = local.control_plane_url
    created_at       = kubernetes_namespace.instance.metadata[0].annotations["hubblewave.com/created-at"]
  }
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

output "instance_url" {
  description = "URL to access the instance"
  value       = "https://${local.instance_domain}"
}
