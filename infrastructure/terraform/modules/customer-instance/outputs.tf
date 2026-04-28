/**
 * HubbleWave Customer Instance Module - Outputs
 *
 * Cluster-per-Customer architecture with dedicated VPC and EKS cluster
 */

# -----------------------------------------------------------------------------
# Instance Identifiers
# -----------------------------------------------------------------------------

output "instance_id" {
  description = "Instance UUID"
  value       = var.instance_id
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
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "Customer instance VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "Customer instance VPC CIDR block"
  value       = local.vpc_cidr
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "vpc_peering_connection_id" {
  description = "VPC peering connection ID to control plane"
  value       = aws_vpc_peering_connection.to_control_plane.id
}

# -----------------------------------------------------------------------------
# EKS Cluster Outputs
# -----------------------------------------------------------------------------

output "eks_cluster_name" {
  description = "Customer instance EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_arn" {
  description = "Customer instance EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "eks_cluster_endpoint" {
  description = "Customer instance EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = module.eks.cluster_version
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN for IRSA"
  value       = module.eks.oidc_provider_arn
}

output "eks_node_security_group_id" {
  description = "EKS node security group ID"
  value       = module.eks.node_security_group_id
}

# -----------------------------------------------------------------------------
# Kubeconfig & Control Plane Access
# -----------------------------------------------------------------------------

output "kubeconfig_secret_arn" {
  description = "ARN of the Secrets Manager secret containing kubeconfig"
  value       = aws_secretsmanager_secret.kubeconfig.arn
}

output "control_plane_access_role_arn" {
  description = "IAM role ARN for control plane to assume for cluster access"
  value       = aws_iam_role.control_plane_access.arn
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
  description = "ElastiCache replication group identifier"
  value       = aws_elasticache_replication_group.instance.replication_group_id
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint (write address)"
  value       = aws_elasticache_replication_group.instance.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "ElastiCache reader endpoint (multi-AZ read replicas)"
  value       = aws_elasticache_replication_group.instance.reader_endpoint_address
}

output "redis_port" {
  description = "ElastiCache port"
  value       = aws_elasticache_replication_group.instance.port
}

output "redis_auth_token" {
  description = "ElastiCache AUTH token (TLS-only, sensitive)"
  value       = random_password.redis_auth.result
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
  value       = kubernetes_service_account_v1.workload.metadata[0].name
}

output "database_secret_name" {
  description = "Name of the Kubernetes secret containing database credentials"
  value       = kubernetes_secret_v1.database.metadata[0].name
}

output "redis_secret_name" {
  description = "Name of the Kubernetes secret containing Redis credentials"
  value       = kubernetes_secret_v1.redis.metadata[0].name
}

output "config_secret_name" {
  description = "Name of the Kubernetes secret containing instance config"
  value       = kubernetes_secret_v1.instance_config.metadata[0].name
}

output "s3_secret_name" {
  description = "Name of the Kubernetes secret containing S3 config"
  value       = kubernetes_secret_v1.s3_credentials.metadata[0].name
}

output "app_config_name" {
  description = "Name of the Kubernetes ConfigMap for application settings"
  value       = kubernetes_config_map_v1.app_config.metadata[0].name
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
  value       = kubernetes_deployment_v1.api.metadata[0].name
}

output "web_deployment_name" {
  description = "Name of the web client deployment"
  value       = kubernetes_deployment_v1.web.metadata[0].name
}

output "api_service_name" {
  description = "Name of the API service"
  value       = kubernetes_service_v1.api.metadata[0].name
}

output "web_service_name" {
  description = "Name of the web client service"
  value       = kubernetes_service_v1.web.metadata[0].name
}

output "ingress_name" {
  description = "Name of the instance ingress"
  value       = kubernetes_ingress_v1.instance.metadata[0].name
}

# -----------------------------------------------------------------------------
# ALB Outputs
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "ALB DNS name for the instance"
  value       = kubernetes_ingress_v1.instance.status[0].load_balancer[0].ingress[0].hostname
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN for the instance domain"
  value       = aws_acm_certificate.instance.arn
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
    instance_id               = var.instance_id
    customer_code             = var.customer_code
    customer_name             = var.customer_name
    environment               = var.environment
    platform_release_id       = var.platform_release_id
    resource_tier             = var.resource_tier
    vpc_id                    = module.vpc.vpc_id
    vpc_cidr                  = local.vpc_cidr
    eks_cluster_name          = module.eks.cluster_name
    eks_cluster_arn           = module.eks.cluster_arn
    kubeconfig_secret_arn     = aws_secretsmanager_secret.kubeconfig.arn
    control_plane_access_role = aws_iam_role.control_plane_access.arn
    db_instance_id            = aws_db_instance.instance.id
    db_endpoint               = aws_db_instance.instance.endpoint
    redis_cluster_id          = aws_elasticache_replication_group.instance.replication_group_id
    redis_endpoint            = aws_elasticache_replication_group.instance.primary_endpoint_address
    s3_bucket                 = aws_s3_bucket.instance.id
    instance_domain           = local.instance_domain
    control_plane_url         = local.control_plane_url
    gpu_enabled               = local.gpu_enabled_effective
  }
}

# -----------------------------------------------------------------------------
# GPU / vLLM Outputs
# -----------------------------------------------------------------------------

output "gpu_enabled" {
  description = "Whether GPU/vLLM is enabled for this instance"
  value       = local.gpu_enabled_effective
}

output "vllm_service_url" {
  description = "Internal URL for vLLM service"
  value       = local.gpu_enabled_effective ? "http://vllm-service.default.svc.cluster.local:8000" : null
}

output "vllm_deployment_name" {
  description = "Name of the vLLM deployment"
  value       = local.gpu_enabled_effective ? kubernetes_deployment_v1.vllm[0].metadata[0].name : null
}

output "ava_service_url" {
  description = "Internal URL for AVA service"
  value       = local.gpu_enabled_effective ? "http://ava-service.default.svc.cluster.local:80" : null
}

output "ava_deployment_name" {
  description = "Name of the AVA deployment"
  value       = local.gpu_enabled_effective ? kubernetes_deployment_v1.ava[0].metadata[0].name : null
}

output "ava_external_url" {
  description = "External URL for AVA API"
  value       = local.gpu_enabled_effective ? "https://${local.instance_domain}/api/ava" : null
}
