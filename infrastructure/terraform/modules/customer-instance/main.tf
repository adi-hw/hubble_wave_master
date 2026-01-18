/**
 * HubbleWave Customer Instance Module
 *
 * Provisions a complete customer instance environment including:
 * - Dedicated RDS PostgreSQL database
 * - Dedicated ElastiCache Redis cluster
 * - Kubernetes namespace and resources
 * - S3-compatible storage bucket
 * - Network policies and security groups
 *
 * Architecture: Single-Instance-Per-Customer with DEDICATED infrastructure
 */

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  instance_name        = "${var.customer_code}-${var.environment}"
  namespace            = "hw-${local.instance_name}"
  control_plane_domain = "control.${var.environment}.${var.root_domain}"
  control_plane_url    = "https://${local.control_plane_domain}"
  instance_domain      = "${var.customer_code}.${var.environment}.${var.root_domain}"
  secrets_prefix       = "hubblewave/instance/${var.environment}/${var.customer_code}/${var.instance_id}"
  db_identifier        = "hw-${local.instance_name}"
  redis_identifier     = "hw-${local.instance_name}"

  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "hubblewave.com/customer"       = var.customer_code
    "hubblewave.com/environment"    = var.environment
    "hubblewave.com/instance-id"    = var.instance_id
    "hubblewave.com/release-id"     = var.platform_release_id
  }

  resource_limits = {
    standard = {
      cpu_request    = "500m"
      cpu_limit      = "2000m"
      memory_request = "1Gi"
      memory_limit   = "4Gi"
      replicas       = 2
      db_instance    = "db.t3.micro"
      redis_node     = "cache.t3.micro"
    }
    professional = {
      cpu_request    = "1000m"
      cpu_limit      = "4000m"
      memory_request = "2Gi"
      memory_limit   = "8Gi"
      replicas       = 3
      db_instance    = "db.t3.small"
      redis_node     = "cache.t3.small"
    }
    enterprise = {
      cpu_request    = "2000m"
      cpu_limit      = "8000m"
      memory_request = "4Gi"
      memory_limit   = "16Gi"
      replicas       = 5
      db_instance    = "db.t3.medium"
      redis_node     = "cache.t3.medium"
    }
  }

  tier_config = local.resource_limits[var.resource_tier]

  aws_tags = {
    hubblewave_environment = var.environment
    hubblewave_customer    = var.customer_code
    hubblewave_instance_id = var.instance_id
    Name                   = "hw-${local.instance_name}"
  }
}

# -----------------------------------------------------------------------------
# Random Password Generation
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "db_admin_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# Dedicated RDS PostgreSQL Instance
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "instance" {
  name       = local.db_identifier
  subnet_ids = var.db_subnet_ids
  tags       = local.aws_tags
}

resource "aws_security_group" "rds" {
  name        = "${local.db_identifier}-rds"
  description = "Security group for ${local.instance_name} RDS instance"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.eks_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.aws_tags
}

resource "aws_db_instance" "instance" {
  identifier     = local.db_identifier
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = local.tier_config.db_instance

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "hubblewave"
  username = "hwadmin"
  password = random_password.db_admin_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.instance.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible    = false
  multi_az               = var.environment == "production"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${local.db_identifier}-final" : null

  backup_retention_period = var.environment == "production" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "production"

  performance_insights_enabled = var.environment == "production"

  tags = local.aws_tags

  lifecycle {
    prevent_destroy = false
  }
}

# -----------------------------------------------------------------------------
# Dedicated ElastiCache Redis Cluster
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "instance" {
  name       = local.redis_identifier
  subnet_ids = var.redis_subnet_ids
  tags       = local.aws_tags
}

resource "aws_security_group" "redis" {
  name        = "${local.redis_identifier}-redis"
  description = "Security group for ${local.instance_name} Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from EKS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.eks_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.aws_tags
}

resource "aws_elasticache_cluster" "instance" {
  cluster_id           = local.redis_identifier
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = local.tier_config.redis_node
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.instance.name
  security_group_ids = [aws_security_group.redis.id]

  snapshot_retention_limit = var.environment == "production" ? 7 : 0
  snapshot_window          = "02:00-03:00"
  maintenance_window       = "sun:03:00-sun:04:00"

  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "production"

  tags = local.aws_tags
}

# -----------------------------------------------------------------------------
# Kubernetes Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "instance" {
  metadata {
    name   = local.namespace
    labels = local.common_labels

    annotations = {
      "hubblewave.com/created-at"    = timestamp()
      "hubblewave.com/customer-name" = var.customer_name
      "hubblewave.com/release-id"    = var.platform_release_id
    }
  }

  lifecycle {
    prevent_destroy = false
  }
}

# -----------------------------------------------------------------------------
# Resource Quota
# -----------------------------------------------------------------------------

resource "kubernetes_resource_quota" "instance" {
  metadata {
    name      = "instance-quota"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    hard = {
      "requests.cpu"    = var.resource_tier == "enterprise" ? "16" : (var.resource_tier == "professional" ? "8" : "4")
      "requests.memory" = var.resource_tier == "enterprise" ? "32Gi" : (var.resource_tier == "professional" ? "16Gi" : "8Gi")
      "limits.cpu"      = var.resource_tier == "enterprise" ? "32" : (var.resource_tier == "professional" ? "16" : "8")
      "limits.memory"   = var.resource_tier == "enterprise" ? "64Gi" : (var.resource_tier == "professional" ? "32Gi" : "16Gi")
      "pods"            = var.resource_tier == "enterprise" ? "50" : (var.resource_tier == "professional" ? "30" : "20")
      "services"        = "20"
      "secrets"         = "50"
      "configmaps"      = "50"
    }
  }
}

# -----------------------------------------------------------------------------
# Network Policy - Instance Isolation
# -----------------------------------------------------------------------------

resource "kubernetes_network_policy" "instance_isolation" {
  metadata {
    name      = "instance-isolation"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    pod_selector {}

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace.instance.metadata[0].name
          }
        }
      }
      from {
        namespace_selector {
          match_labels = {
            "name" = "ingress-nginx"
          }
        }
      }
    }

    egress {
      to {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace.instance.metadata[0].name
          }
        }
      }
    }

    egress {
      to {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = "kube-system"
          }
        }
        pod_selector {
          match_labels = {
            "k8s-app" = "kube-dns"
          }
        }
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
      ports {
        protocol = "TCP"
        port     = "53"
      }
    }

    egress {
      to {
        ip_block {
          cidr = var.vpc_cidr
        }
      }
      ports {
        protocol = "TCP"
        port     = "5432"
      }
    }

    egress {
      to {
        ip_block {
          cidr = var.vpc_cidr
        }
      }
      ports {
        protocol = "TCP"
        port     = "6379"
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Secrets Manager Payloads
# -----------------------------------------------------------------------------

locals {
  db_host = aws_db_instance.instance.address
  db_port = aws_db_instance.instance.port
  db_name = aws_db_instance.instance.db_name

  redis_host = aws_elasticache_cluster.instance.cache_nodes[0].address
  redis_port = aws_elasticache_cluster.instance.port

  database_secret_payload = {
    DB_HOST     = local.db_host
    DB_PORT     = tostring(local.db_port)
    DB_NAME     = local.db_name
    DB_USER     = aws_db_instance.instance.username
    DB_PASSWORD = random_password.db_admin_password.result
    DB_URL      = "postgresql://${aws_db_instance.instance.username}:${random_password.db_admin_password.result}@${local.db_host}:${local.db_port}/${local.db_name}?sslmode=require"
  }

  redis_secret_payload = {
    REDIS_HOST = local.redis_host
    REDIS_PORT = tostring(local.redis_port)
    REDIS_URL  = "redis://${local.redis_host}:${local.redis_port}/0"
  }

  instance_config_payload = {
    INSTANCE_ID         = var.instance_id
    CUSTOMER_CODE       = var.customer_code
    CUSTOMER_NAME       = var.customer_name
    ENVIRONMENT         = var.environment
    PLATFORM_RELEASE_ID = var.platform_release_id
    LICENSE_KEY         = var.license_key
    CONTROL_PLANE_URL   = local.control_plane_url
    INSTANCE_DOMAIN     = local.instance_domain
  }

  s3_secret_payload = {
    S3_BUCKET = aws_s3_bucket.instance.id
    S3_REGION = var.aws_region
  }
}

# -----------------------------------------------------------------------------
# AWS Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "database" {
  name = "${local.secrets_prefix}/database"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id     = aws_secretsmanager_secret.database.id
  secret_string = jsonencode(local.database_secret_payload)
}

resource "aws_secretsmanager_secret" "redis" {
  name = "${local.secrets_prefix}/redis"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode(local.redis_secret_payload)
}

resource "aws_secretsmanager_secret" "instance_config" {
  name = "${local.secrets_prefix}/instance-config"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "instance_config" {
  secret_id     = aws_secretsmanager_secret.instance_config.id
  secret_string = jsonencode(local.instance_config_payload)
}

resource "aws_secretsmanager_secret" "s3" {
  name = "${local.secrets_prefix}/s3"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "s3" {
  secret_id     = aws_secretsmanager_secret.s3.id
  secret_string = jsonencode(local.s3_secret_payload)
}

locals {
  database_secret_data        = jsondecode(aws_secretsmanager_secret_version.database.secret_string)
  redis_secret_data           = jsondecode(aws_secretsmanager_secret_version.redis.secret_string)
  instance_config_secret_data = jsondecode(aws_secretsmanager_secret_version.instance_config.secret_string)
  s3_secret_data              = jsondecode(aws_secretsmanager_secret_version.s3.secret_string)
}

# -----------------------------------------------------------------------------
# Kubernetes Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "database" {
  metadata {
    name      = "database-credentials"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    DB_HOST     = local.database_secret_data.DB_HOST
    DB_PORT     = local.database_secret_data.DB_PORT
    DB_NAME     = local.database_secret_data.DB_NAME
    DB_USER     = local.database_secret_data.DB_USER
    DB_PASSWORD = local.database_secret_data.DB_PASSWORD
    DB_URL      = local.database_secret_data.DB_URL
  }
}

resource "kubernetes_secret" "redis" {
  metadata {
    name      = "redis-credentials"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    REDIS_HOST = local.redis_secret_data.REDIS_HOST
    REDIS_PORT = local.redis_secret_data.REDIS_PORT
    REDIS_URL  = local.redis_secret_data.REDIS_URL
    REDIS_TLS  = "false"
  }
}

resource "kubernetes_secret" "instance_config" {
  metadata {
    name      = "instance-config"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    INSTANCE_ID         = local.instance_config_secret_data.INSTANCE_ID
    CUSTOMER_CODE       = local.instance_config_secret_data.CUSTOMER_CODE
    CUSTOMER_NAME       = local.instance_config_secret_data.CUSTOMER_NAME
    ENVIRONMENT         = local.instance_config_secret_data.ENVIRONMENT
    PLATFORM_RELEASE_ID = local.instance_config_secret_data.PLATFORM_RELEASE_ID
    LICENSE_KEY         = local.instance_config_secret_data.LICENSE_KEY
    CONTROL_PLANE_URL   = local.instance_config_secret_data.CONTROL_PLANE_URL
    INSTANCE_DOMAIN     = local.instance_config_secret_data.INSTANCE_DOMAIN
    JWT_SECRET          = random_password.jwt_secret.result
  }
}

# -----------------------------------------------------------------------------
# S3 Storage Bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "instance" {
  bucket = "hw-${local.instance_name}-${random_id.bucket_suffix.hex}"

  tags = merge(local.aws_tags, {
    Name = "HubbleWave Instance Storage - ${var.customer_name}"
  })
}

resource "aws_s3_bucket_versioning" "instance" {
  bucket = aws_s3_bucket.instance.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "instance" {
  bucket = aws_s3_bucket.instance.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "instance" {
  bucket = aws_s3_bucket.instance.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "instance" {
  bucket = aws_s3_bucket.instance.id

  rule {
    id     = "archive-old-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# -----------------------------------------------------------------------------
# IAM Roles for Instance Workloads (IRSA)
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "instance_storage" {
  statement {
    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
    ]
    resources = [aws_s3_bucket.instance.arn]
  }

  statement {
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListMultipartUploadParts",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.instance.arn}/*"]
  }
}

resource "aws_iam_policy" "instance_storage" {
  name   = "hw-${local.instance_name}-storage"
  policy = data.aws_iam_policy_document.instance_storage.json
}

data "aws_iam_policy_document" "workload_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.eks_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.eks_oidc_provider_host}:sub"
      values   = ["system:serviceaccount:${local.namespace}:hubblewave-workload"]
    }
    condition {
      test     = "StringEquals"
      variable = "${var.eks_oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "workload" {
  name               = "hw-${local.instance_name}-workload"
  assume_role_policy = data.aws_iam_policy_document.workload_assume.json
  tags               = local.aws_tags
}

resource "aws_iam_role_policy_attachment" "workload_storage" {
  role       = aws_iam_role.workload.name
  policy_arn = aws_iam_policy.instance_storage.arn
}

# -----------------------------------------------------------------------------
# S3 Access for Kubernetes
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "s3_credentials" {
  metadata {
    name      = "s3-credentials"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    S3_BUCKET = local.s3_secret_data.S3_BUCKET
    S3_REGION = local.s3_secret_data.S3_REGION
  }
}

# -----------------------------------------------------------------------------
# ConfigMap for Application Settings
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    NODE_ENV           = var.environment == "production" ? "production" : "development"
    LOG_LEVEL          = var.environment == "production" ? "info" : "debug"
    CORS_ORIGINS       = var.cors_origins
    API_RATE_LIMIT     = tostring(var.api_rate_limit)
    ENABLE_SWAGGER     = var.environment != "production" ? "true" : "false"
    JWT_EXPIRES_IN     = "15m"
    REFRESH_EXPIRES_IN = "7d"
  }
}

resource "cloudflare_record" "instance" {
  zone_id = var.cloudflare_zone_id
  name    = local.instance_domain
  type    = "CNAME"
  content = var.instance_ingress_hostname
  ttl     = 300
  proxied = false
}

# -----------------------------------------------------------------------------
# Service Account for Workloads
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "workload" {
  metadata {
    name      = "hubblewave-workload"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels

    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.workload.arn
    }
  }

  automount_service_account_token = true
}

# -----------------------------------------------------------------------------
# ConfigMap for HPA Settings
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "hpa_config" {
  metadata {
    name      = "hpa-config"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    min_replicas        = tostring(local.tier_config.replicas)
    max_replicas        = tostring(local.tier_config.replicas * 3)
    cpu_target          = "70"
    memory_target       = "80"
    scale_up_cooldown   = "60"
    scale_down_cooldown = "300"
  }
}

# -----------------------------------------------------------------------------
# Instance API Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "instance-api"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = {
        "hubblewave.com/instance-id"  = var.instance_id
        "app.kubernetes.io/component" = "api"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/component" = "api"
        })
      }

      spec {
        service_account_name = kubernetes_service_account.workload.metadata[0].name

        container {
          name  = "api"
          image = "${var.container_registry_host}/hubblewave/instance/svc-instance-api:${var.instance_api_image_tag}"

          port {
            container_port = 3000
            name           = "http"
          }

          port {
            container_port = 9090
            name           = "metrics"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.database.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.redis.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.instance_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.s3_credentials.metadata[0].name
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = local.tier_config.cpu_request
              memory = local.tier_config.memory_request
            }
            limits = {
              cpu    = local.tier_config.cpu_limit
              memory = local.tier_config.memory_limit
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }

  depends_on = [
    aws_db_instance.instance,
    aws_elasticache_cluster.instance,
    kubernetes_secret.database,
    kubernetes_secret.redis,
    kubernetes_secret.instance_config,
  ]
}

# -----------------------------------------------------------------------------
# Instance Web Client Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "web" {
  metadata {
    name      = "instance-web"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "web"
    })
  }

  spec {
    replicas = var.web_replicas

    selector {
      match_labels = {
        "hubblewave.com/instance-id"  = var.instance_id
        "app.kubernetes.io/component" = "web"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/component" = "web"
        })
      }

      spec {
        container {
          name  = "web"
          image = "${var.container_registry_host}/hubblewave/instance/web-client:${var.instance_web_image_tag}"

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Instance API Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "api" {
  metadata {
    name      = "instance-api"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "api"
    })
  }

  spec {
    selector = {
      "hubblewave.com/instance-id"  = var.instance_id
      "app.kubernetes.io/component" = "api"
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3000
    }

    port {
      name        = "metrics"
      port        = 9090
      target_port = 9090
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Instance Web Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "web" {
  metadata {
    name      = "instance-web"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "web"
    })
  }

  spec {
    selector = {
      "hubblewave.com/instance-id"  = var.instance_id
      "app.kubernetes.io/component" = "web"
    }

    port {
      name        = "http"
      port        = 80
      target_port = 80
    }

    type = "ClusterIP"
  }
}

# -----------------------------------------------------------------------------
# Ingress for Instance
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "instance" {
  metadata {
    name      = "instance-ingress"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels

    annotations = {
      "kubernetes.io/ingress.class"                    = "nginx"
      "cert-manager.io/cluster-issuer"                 = var.cert_manager_issuer
      "nginx.ingress.kubernetes.io/ssl-redirect"       = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size"    = "50m"
      "nginx.ingress.kubernetes.io/proxy-read-timeout" = "300"
    }
  }

  spec {
    tls {
      hosts       = [local.instance_domain]
      secret_name = "instance-tls-${var.customer_code}"
    }

    rule {
      host = local.instance_domain

      http {
        path {
          path      = "/api"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.api.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }

        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.web.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [cloudflare_record.instance]
}

# -----------------------------------------------------------------------------
# Horizontal Pod Autoscaler for API
# -----------------------------------------------------------------------------

resource "kubernetes_horizontal_pod_autoscaler_v2" "api" {
  metadata {
    name      = "instance-api-hpa"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.api.metadata[0].name
    }

    min_replicas = var.api_replicas
    max_replicas = local.tier_config.replicas * 3

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }

    behavior {
      scale_up {
        stabilization_window_seconds = 60
        select_policy                = "Max"
        policy {
          type           = "Pods"
          value          = 2
          period_seconds = 60
        }
      }
      scale_down {
        stabilization_window_seconds = 300
        select_policy                = "Min"
        policy {
          type           = "Pods"
          value          = 1
          period_seconds = 120
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Pod Disruption Budget for API
# -----------------------------------------------------------------------------

resource "kubernetes_pod_disruption_budget_v1" "api" {
  metadata {
    name      = "instance-api-pdb"
    namespace = kubernetes_namespace.instance.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    min_available = 1

    selector {
      match_labels = {
        "hubblewave.com/instance-id"  = var.instance_id
        "app.kubernetes.io/component" = "api"
      }
    }
  }
}
