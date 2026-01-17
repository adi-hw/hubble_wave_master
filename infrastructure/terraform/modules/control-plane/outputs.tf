/**
 * HubbleWave Control Plane Module - Outputs
 */

# -----------------------------------------------------------------------------
# Namespace
# -----------------------------------------------------------------------------

output "namespace" {
  description = "Kubernetes namespace for the Control Plane"
  value       = kubernetes_namespace.control_plane.metadata[0].name
}

# -----------------------------------------------------------------------------
# Database Outputs
# -----------------------------------------------------------------------------

output "database_name" {
  description = "PostgreSQL database name"
  value       = postgresql_database.control_plane.name
}

output "database_user" {
  description = "PostgreSQL database user"
  value       = postgresql_role.control_plane.name
}

output "database_connection_string" {
  description = "PostgreSQL connection string (masked)"
  value       = "postgresql://${var.db_username}:****@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=${local.db_ssl_mode}"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Service Outputs
# -----------------------------------------------------------------------------

output "api_service_name" {
  description = "Kubernetes service name for the API"
  value       = kubernetes_service.api.metadata[0].name
}

output "web_service_name" {
  description = "Kubernetes service name for the web dashboard"
  value       = kubernetes_service.web.metadata[0].name
}

output "api_internal_url" {
  description = "Internal URL for the Control Plane API"
  value       = "http://${kubernetes_service.api.metadata[0].name}.${kubernetes_namespace.control_plane.metadata[0].name}.svc.cluster.local"
}

# -----------------------------------------------------------------------------
# Ingress Outputs
# -----------------------------------------------------------------------------

output "control_plane_url" {
  description = "Public URL of the Control Plane"
  value       = local.control_plane_url
}

output "api_url" {
  description = "Public URL of the Control Plane API"
  value       = "${local.api_url}/api"
}

output "control_plane_domain" {
  description = "Control Plane domain"
  value       = local.control_plane_domain
}

output "api_domain" {
  description = "Control Plane API domain"
  value       = local.api_domain
}

output "database_secret_arn" {
  description = "AWS Secrets Manager ARN for Control Plane database credentials"
  value       = aws_secretsmanager_secret.database.arn
}

output "redis_secret_arn" {
  description = "AWS Secrets Manager ARN for Control Plane Redis credentials"
  value       = aws_secretsmanager_secret.redis.arn
}

output "jwt_secret_arn" {
  description = "AWS Secrets Manager ARN for Control Plane JWT secret"
  value       = aws_secretsmanager_secret.jwt.arn
}

output "license_signing_secret_arn" {
  description = "AWS Secrets Manager ARN for Control Plane license signing keys"
  value       = aws_secretsmanager_secret.license_signing.arn
}

output "billing_secret_arn" {
  description = "AWS Secrets Manager ARN for Control Plane billing secret"
  value       = var.enable_billing ? aws_secretsmanager_secret.billing[0].arn : null
}

# -----------------------------------------------------------------------------
# License Signing Keys
# -----------------------------------------------------------------------------

output "license_public_key" {
  description = "Public key for license verification (can be shared with instances)"
  value       = tls_self_signed_cert.license_signing.cert_pem
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Kubernetes Resources
# -----------------------------------------------------------------------------

output "service_account_name" {
  description = "Service account name for the Control Plane"
  value       = kubernetes_service_account.control_plane.metadata[0].name
}

output "cluster_role_name" {
  description = "Cluster role for instance management"
  value       = kubernetes_cluster_role.instance_manager.metadata[0].name
}

output "database_secret_name" {
  description = "Name of the database credentials secret"
  value       = kubernetes_secret.database.metadata[0].name
}

output "redis_secret_name" {
  description = "Name of the Redis credentials secret"
  value       = kubernetes_secret.redis.metadata[0].name
}

output "jwt_secret_name" {
  description = "Name of the JWT configuration secret"
  value       = kubernetes_secret.jwt.metadata[0].name
}

output "license_signing_secret_name" {
  description = "Name of the license signing keys secret"
  value       = kubernetes_secret.license_signing.metadata[0].name
}

output "config_map_name" {
  description = "Name of the configuration ConfigMap"
  value       = kubernetes_config_map.control_plane_config.metadata[0].name
}

# -----------------------------------------------------------------------------
# Deployment Status
# -----------------------------------------------------------------------------

output "api_deployment_name" {
  description = "Name of the API deployment"
  value       = kubernetes_deployment.api.metadata[0].name
}

output "web_deployment_name" {
  description = "Name of the web deployment"
  value       = kubernetes_deployment.web.metadata[0].name
}

output "api_image_tag" {
  description = "Image tag for the Control Plane API"
  value       = var.control_plane_image_tag
}

output "web_image_tag" {
  description = "Image tag for the Control Plane web app"
  value       = var.control_plane_web_image_tag
}

output "deployment_info" {
  description = "Deployment information summary"
  value = {
    namespace         = kubernetes_namespace.control_plane.metadata[0].name
    api_replicas      = var.api_replicas
    web_replicas      = var.web_replicas
    release_id        = var.control_plane_release_id
    image_tag         = var.control_plane_image_tag
    api_image_tag     = var.control_plane_image_tag
    web_image_tag     = var.control_plane_web_image_tag
    default_platform_release_id = var.default_platform_release_id
    environment       = var.environment
    control_plane_url = local.control_plane_url
  }
}
