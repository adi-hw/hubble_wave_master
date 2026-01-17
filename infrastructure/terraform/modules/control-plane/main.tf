/**
 * HubbleWave Control Plane Infrastructure Module
 *
 * Provisions the Control Plane infrastructure including:
 * - PostgreSQL database for control plane data
 * - Redis for caching and real-time features
 * - Kubernetes deployment for control plane services
 * - Load balancer and ingress configuration
 * - Monitoring and alerting
 *
 * The Control Plane manages all customer instances and provides:
 * - Customer and instance lifecycle management
 * - License validation and enforcement
 * - Centralized monitoring and health aggregation
 * - Billing integration
 */

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">= 2.11.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = ">= 1.21.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0.0, < 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  namespace            = "hubblewave-control"
  control_plane_domain = var.environment == "production" ? "control.${var.root_domain}" : "control.${var.environment}.${var.root_domain}"
  api_domain           = var.environment == "production" ? "api.${var.root_domain}" : "api.${var.environment}.${var.root_domain}"
  control_plane_url    = "https://${local.control_plane_domain}"
  api_url              = "https://${local.api_domain}"
  secrets_prefix       = "hubblewave/control-plane/${var.environment}"
  db_ssl_mode          = var.environment == "production" ? "require" : "disable"
  db_password_value    = length(var.db_password) > 0 ? var.db_password : random_password.db_password.result
  redis_password_value = var.redis_password
  redis_url            = length(local.redis_password_value) > 0 ? "redis://:${local.redis_password_value}@${var.redis_host}:${var.redis_port}/0" : "redis://${var.redis_host}:${var.redis_port}/0"
  api_image_tag        = var.control_plane_image_tag
  web_image_tag        = var.control_plane_web_image_tag
  instance_root_domain = length(var.instance_root_domain) > 0 ? var.instance_root_domain : var.root_domain
  instance_ingress_hostname = length(var.instance_ingress_hostname) > 0 ? var.instance_ingress_hostname : var.control_plane_ingress_hostname
  instance_aws_region   = length(var.instance_aws_region) > 0 ? var.instance_aws_region : var.aws_region
  instance_db_host      = length(var.instance_db_host) > 0 ? var.instance_db_host : var.db_host
  instance_db_port      = var.instance_db_port != 0 ? var.instance_db_port : var.db_port
  instance_db_admin_username = length(var.instance_db_admin_username) > 0 ? var.instance_db_admin_username : var.db_admin_username
  instance_db_admin_password = length(var.instance_db_admin_password) > 0 ? var.instance_db_admin_password : var.db_admin_password
  instance_db_admin_sslmode = length(var.instance_db_admin_sslmode) > 0 ? var.instance_db_admin_sslmode : var.db_admin_sslmode
  instance_redis_host   = length(var.instance_redis_host) > 0 ? var.instance_redis_host : var.redis_host
  instance_redis_port   = var.instance_redis_port != 0 ? var.instance_redis_port : var.redis_port
  instance_state_region = length(var.instance_terraform_state_region) > 0 ? var.instance_terraform_state_region : var.aws_region

  common_labels = {
    "app.kubernetes.io/name"       = "hubblewave-control-plane"
    "app.kubernetes.io/part-of"    = "hubblewave"
    "app.kubernetes.io/managed-by" = "terraform"
    "app.kubernetes.io/version"    = var.control_plane_release_id
    "hubblewave.com/release-id"     = var.control_plane_release_id
    "hubblewave.com/image-tag"      = local.api_image_tag
  }

  service_labels = {
    api = merge(local.common_labels, {
      "app.kubernetes.io/component" = "api"
    })
    web = merge(local.common_labels, {
      "app.kubernetes.io/component" = "web"
      "hubblewave.com/image-tag"    = local.web_image_tag
    })
    worker = merge(local.common_labels, {
      "app.kubernetes.io/component" = "worker"
    })
  }

  aws_tags = {
    hubblewave_environment = var.environment
    hubblewave_service     = "control-plane"
  }
}

# -----------------------------------------------------------------------------
# Random Secrets
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "license_signing_key" {
  length  = 64
  special = false
}

# -----------------------------------------------------------------------------
# TLS Certificate for License Signing
# -----------------------------------------------------------------------------

resource "tls_private_key" "license_signing" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P384"
}

resource "tls_self_signed_cert" "license_signing" {
  private_key_pem = tls_private_key.license_signing.private_key_pem

  subject {
    common_name  = "HubbleWave License Authority"
    organization = "HubbleWave"
  }

  validity_period_hours = 87600 # 10 years
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "digital_signature",
    "key_encipherment",
  ]
}

# -----------------------------------------------------------------------------
# Kubernetes Namespace
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "control_plane" {
  metadata {
    name   = local.namespace
    labels = local.common_labels

    annotations = {
      "hubblewave.com/purpose" = "control-plane"
    }
  }
}

# -----------------------------------------------------------------------------
# PostgreSQL Database
# -----------------------------------------------------------------------------

resource "postgresql_database" "control_plane" {
  name              = var.db_name
  owner             = postgresql_role.control_plane.name
  template          = "template0"
  lc_collate        = "en_US.UTF-8"
  lc_ctype          = "en_US.UTF-8"
  connection_limit  = 100
  allow_connections = true
}

resource "postgresql_role" "control_plane" {
  name     = var.db_username
  login    = true
  password = local.db_password_value

  connection_limit = 100

  lifecycle {
    ignore_changes = [
      create_database,
      create_role,
      roles,
    ]
  }
}

check "billing_webhook_secret" {
  assert {
    condition     = var.enable_billing ? length(var.stripe_webhook_secret) > 0 : true
    error_message = "stripe_webhook_secret must be set when billing is enabled."
  }
}

resource "postgresql_grant" "control_plane" {
  database    = postgresql_database.control_plane.name
  role        = postgresql_role.control_plane.name
  schema      = "public"
  object_type = "database"
  privileges  = ["ALL"]
}

# -----------------------------------------------------------------------------
# Secrets Manager Payloads
# -----------------------------------------------------------------------------

locals {
  database_secret_payload = {
    CONTROL_PLANE_DB_HOST     = var.db_host
    CONTROL_PLANE_DB_PORT     = tostring(var.db_port)
    CONTROL_PLANE_DB_NAME     = var.db_name
    CONTROL_PLANE_DB_USER     = var.db_username
    CONTROL_PLANE_DB_PASSWORD = local.db_password_value
    DATABASE_URL              = "postgresql://${var.db_username}:${local.db_password_value}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=${local.db_ssl_mode}"
  }
  redis_secret_payload = {
    REDIS_HOST     = var.redis_host
    REDIS_PORT     = tostring(var.redis_port)
    REDIS_PASSWORD = local.redis_password_value
    REDIS_URL      = local.redis_url
  }
  jwt_secret_payload = {
    JWT_SECRET          = random_password.jwt_secret.result
    JWT_ACCESS_EXPIRES  = "15m"
    JWT_REFRESH_EXPIRES = "7d"
  }
  license_secret_payload = {
    LICENSE_PRIVATE_KEY = tls_private_key.license_signing.private_key_pem
    LICENSE_PUBLIC_KEY  = tls_self_signed_cert.license_signing.cert_pem
    LICENSE_SIGNING_KEY = random_password.license_signing_key.result
    CONTROL_PLANE_LICENSE_SECRET = random_password.license_signing_key.result
  }
  instance_provisioning_secret_payload = {
    INSTANCE_DB_ADMIN_PASSWORD = local.instance_db_admin_password
    CLOUDFLARE_API_TOKEN       = var.cloudflare_api_token
  }
  billing_secret_payload = var.enable_billing ? {
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
  } : {}
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

resource "aws_secretsmanager_secret" "jwt" {
  name = "${local.secrets_prefix}/jwt"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = jsonencode(local.jwt_secret_payload)
}

resource "aws_secretsmanager_secret" "license_signing" {
  name = "${local.secrets_prefix}/license-signing"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "license_signing" {
  secret_id     = aws_secretsmanager_secret.license_signing.id
  secret_string = jsonencode(local.license_secret_payload)
}

resource "aws_secretsmanager_secret" "instance_provisioning" {
  name = "${local.secrets_prefix}/instance-provisioning"
  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "instance_provisioning" {
  secret_id     = aws_secretsmanager_secret.instance_provisioning.id
  secret_string = jsonencode(local.instance_provisioning_secret_payload)
}

resource "aws_secretsmanager_secret" "billing" {
  count = var.enable_billing ? 1 : 0
  name  = "${local.secrets_prefix}/billing"
  tags  = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "billing" {
  count         = var.enable_billing ? 1 : 0
  secret_id     = aws_secretsmanager_secret.billing[0].id
  secret_string = jsonencode(local.billing_secret_payload)
}

locals {
  database_secret_data = jsondecode(aws_secretsmanager_secret_version.database.secret_string)
  redis_secret_data    = jsondecode(aws_secretsmanager_secret_version.redis.secret_string)
  jwt_secret_data      = jsondecode(aws_secretsmanager_secret_version.jwt.secret_string)
  license_secret_data  = jsondecode(aws_secretsmanager_secret_version.license_signing.secret_string)
  instance_provisioning_secret_data = jsondecode(aws_secretsmanager_secret_version.instance_provisioning.secret_string)
  billing_secret_data  = var.enable_billing ? jsondecode(aws_secretsmanager_secret_version.billing[0].secret_string) : {}
}

# -----------------------------------------------------------------------------
# Kubernetes Secrets
# -----------------------------------------------------------------------------

resource "kubernetes_secret" "database" {
  metadata {
    name      = "control-plane-database"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    CONTROL_PLANE_DB_HOST     = local.database_secret_data.CONTROL_PLANE_DB_HOST
    CONTROL_PLANE_DB_PORT     = local.database_secret_data.CONTROL_PLANE_DB_PORT
    CONTROL_PLANE_DB_NAME     = local.database_secret_data.CONTROL_PLANE_DB_NAME
    CONTROL_PLANE_DB_USER     = local.database_secret_data.CONTROL_PLANE_DB_USER
    CONTROL_PLANE_DB_PASSWORD = local.database_secret_data.CONTROL_PLANE_DB_PASSWORD
    DATABASE_URL              = local.database_secret_data.DATABASE_URL
  }
}

resource "kubernetes_secret" "redis" {
  metadata {
    name      = "control-plane-redis"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    REDIS_HOST     = local.redis_secret_data.REDIS_HOST
    REDIS_PORT     = local.redis_secret_data.REDIS_PORT
    REDIS_PASSWORD = local.redis_secret_data.REDIS_PASSWORD
    REDIS_URL      = local.redis_secret_data.REDIS_URL
  }
}

resource "kubernetes_secret" "jwt" {
  metadata {
    name      = "control-plane-jwt"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    JWT_SECRET          = local.jwt_secret_data.JWT_SECRET
    JWT_ACCESS_EXPIRES  = local.jwt_secret_data.JWT_ACCESS_EXPIRES
    JWT_REFRESH_EXPIRES = local.jwt_secret_data.JWT_REFRESH_EXPIRES
  }
}

resource "kubernetes_secret" "license_signing" {
  metadata {
    name      = "license-signing-keys"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    LICENSE_PRIVATE_KEY = local.license_secret_data.LICENSE_PRIVATE_KEY
    LICENSE_PUBLIC_KEY  = local.license_secret_data.LICENSE_PUBLIC_KEY
    LICENSE_SIGNING_KEY = local.license_secret_data.LICENSE_SIGNING_KEY
    CONTROL_PLANE_LICENSE_SECRET = local.license_secret_data.CONTROL_PLANE_LICENSE_SECRET
  }
}

resource "kubernetes_secret" "instance_provisioning" {
  metadata {
    name      = "control-plane-instance-provisioning"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    INSTANCE_DB_ADMIN_PASSWORD = local.instance_provisioning_secret_data.INSTANCE_DB_ADMIN_PASSWORD
    CLOUDFLARE_API_TOKEN       = local.instance_provisioning_secret_data.CLOUDFLARE_API_TOKEN
  }
}

resource "kubernetes_secret" "billing" {
  count = var.enable_billing ? 1 : 0

  metadata {
    name      = "control-plane-billing"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    STRIPE_WEBHOOK_SECRET = local.billing_secret_data.STRIPE_WEBHOOK_SECRET
  }
}

# -----------------------------------------------------------------------------
# ConfigMap for Application Configuration
# -----------------------------------------------------------------------------

resource "kubernetes_config_map" "control_plane_config" {
  metadata {
    name      = "control-plane-config"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    NODE_ENV                    = var.environment == "production" ? "production" : "development"
    LOG_LEVEL                   = var.environment == "production" ? "info" : "debug"
    AWS_REGION                  = var.aws_region
    S3_REGION                   = var.aws_region
    S3_BUCKET_PACK_ARTIFACTS    = var.s3_bucket_pack_artifacts
    CONTROL_PLANE_URL           = local.control_plane_url
    CONTROL_PLANE_PORT          = "3003"
    CONTROL_PLANE_CORS_ORIGINS  = var.cors_origins
    DB_SSL                      = var.environment == "production" ? "true" : "false"

    # Health Check Configuration
    HEALTH_CHECK_INTERVAL       = "60000"
    HEALTH_CHECK_TIMEOUT        = "10000"
    HEALTH_CHECK_RETRIES        = "3"

    # Instance Provisioning
    INSTANCE_PROVISION_TIMEOUT  = "600000"
    DEFAULT_PLATFORM_RELEASE_ID = var.default_platform_release_id
    INSTANCE_ROOT_DOMAIN        = local.instance_root_domain
    INSTANCE_INGRESS_HOSTNAME   = local.instance_ingress_hostname
    INSTANCE_CLOUDFLARE_ZONE_ID = var.cloudflare_zone_id
    INSTANCE_AWS_REGION         = local.instance_aws_region
    INSTANCE_DB_HOST            = local.instance_db_host
    INSTANCE_DB_PORT            = tostring(local.instance_db_port)
    INSTANCE_DB_ADMIN_HOST      = local.instance_db_host
    INSTANCE_DB_ADMIN_USERNAME  = local.instance_db_admin_username
    INSTANCE_DB_ADMIN_SSLMODE   = local.instance_db_admin_sslmode
    INSTANCE_REDIS_HOST         = local.instance_redis_host
    INSTANCE_REDIS_PORT         = tostring(local.instance_redis_port)
    INSTANCE_TERRAFORM_STATE_BUCKET = var.instance_terraform_state_bucket
    INSTANCE_TERRAFORM_STATE_REGION = local.instance_state_region
    INSTANCE_TERRAFORM_LOCK_TABLE   = var.instance_terraform_lock_table
    INSTANCE_TERRAFORM_STATE_PREFIX = var.instance_terraform_state_prefix
    INSTANCE_EKS_OIDC_PROVIDER_ARN  = var.eks_oidc_provider_arn
    INSTANCE_EKS_OIDC_PROVIDER_HOST = var.eks_oidc_provider_host
    TERRAFORM_WORKSPACES_ROOT       = "/app/terraform/workspaces"
    TERRAFORM_MODULES_ROOT          = "/app/terraform/modules"
    TERRAFORM_BINARY                = "/usr/local/bin/terraform"

    # Billing Integration
    ENABLE_BILLING              = var.enable_billing ? "true" : "false"

    # Monitoring
    ENABLE_METRICS              = "true"
    METRICS_PORT                = "9090"
  }
}

resource "kubernetes_job_v1" "control_plane_migrations" {
  metadata {
    name      = "control-plane-migrations-${var.control_plane_release_id}"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels = merge(local.common_labels, {
      "app.kubernetes.io/component" = "migrations"
    })
  }

  spec {
    backoff_limit = 1
    ttl_seconds_after_finished = 3600

    template {
      metadata {
        labels = merge(local.common_labels, {
          "app.kubernetes.io/component" = "migrations"
        })
      }

      spec {
        restart_policy       = "OnFailure"
        service_account_name = kubernetes_service_account.control_plane.metadata[0].name

        container {
          name    = "migrations"
          image   = "${var.container_registry_host}/hubblewave/control/svc-control-plane:${var.control_plane_image_tag}"
          command = ["node"]
          args = [
            "./node_modules/typeorm/cli.js",
            "migration:run",
            "-d",
            "dist/scripts/datasource-control-plane.js"
          ]

          env_from {
            secret_ref {
              name = kubernetes_secret.database.metadata[0].name
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }
          env {
            name  = "TERRAFORM_WORKER_ENABLED"
            value = "false"
          }
          env {
            name  = "CONTROL_PLANE_HTTP_ENABLED"
            value = "true"
          }
          env {
            name  = "AUDIT_PRUNE_ENABLED"
            value = "true"
          }

          env {
            name  = "CONTROL_PLANE_MIGRATIONS_GLOB"
            value = "dist/migrations/control-plane/*.js"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Service Account
# -----------------------------------------------------------------------------

resource "kubernetes_service_account" "control_plane" {
  metadata {
    name      = "control-plane-sa"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels

    annotations = {
      "eks.amazonaws.com/role-arn" = var.control_plane_role_arn
    }
  }

  automount_service_account_token = true
}

# -----------------------------------------------------------------------------
# RBAC - Cluster Role for Instance Management
# -----------------------------------------------------------------------------

resource "kubernetes_cluster_role" "instance_manager" {
  metadata {
    name   = "hubblewave-instance-manager"
    labels = local.common_labels
  }

  # Namespace management for customer instances
  rule {
    api_groups = [""]
    resources  = ["namespaces"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Secret management
  rule {
    api_groups = [""]
    resources  = ["secrets", "configmaps"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Deployment management
  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "statefulsets", "replicasets"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Service management
  rule {
    api_groups = [""]
    resources  = ["services"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Ingress management
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # HPA management
  rule {
    api_groups = ["autoscaling"]
    resources  = ["horizontalpodautoscalers"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Network policies
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Resource quotas
  rule {
    api_groups = [""]
    resources  = ["resourcequotas"]
    verbs      = ["create", "delete", "get", "list", "watch", "patch", "update"]
  }

  # Pod status for health checks
  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding" "instance_manager" {
  metadata {
    name   = "hubblewave-instance-manager"
    labels = local.common_labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.instance_manager.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.control_plane.metadata[0].name
    namespace = kubernetes_namespace.control_plane.metadata[0].name
  }
}

# -----------------------------------------------------------------------------
# API Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "control-plane-api"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.service_labels.api
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/component" = "api"
      }
    }

    template {
      metadata {
        labels = local.service_labels.api
      }

      spec {
        service_account_name = kubernetes_service_account.control_plane.metadata[0].name

        container {
          name  = "api"
          image = "${var.container_registry_host}/hubblewave/control/svc-control-plane:${var.control_plane_image_tag}"

          port {
            container_port = 3003
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
              name = kubernetes_secret.jwt.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.license_signing.metadata[0].name
            }
          }
          env_from {
            secret_ref {
              name = kubernetes_secret.instance_provisioning.metadata[0].name
            }
          }
          dynamic "env_from" {
            for_each = var.enable_billing ? [kubernetes_secret.billing[0].metadata[0].name] : []
            content {
              secret_ref {
                name = env_from.value
              }
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "2000m"
              memory = "2Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3003
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3003
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
}

# -----------------------------------------------------------------------------
# Terraform Worker Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "terraform_worker" {
  metadata {
    name      = "control-plane-terraform-worker"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.service_labels.worker
  }

  spec {
    replicas = var.terraform_worker_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/component" = "worker"
      }
    }

    template {
      metadata {
        labels = local.service_labels.worker
      }

      spec {
        service_account_name = kubernetes_service_account.control_plane.metadata[0].name

        container {
          name  = "worker"
          image = "${var.container_registry_host}/hubblewave/control/svc-control-plane:${var.control_plane_image_tag}"

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
              name = kubernetes_secret.jwt.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.license_signing.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.instance_provisioning.metadata[0].name
            }
          }

          dynamic "env_from" {
            for_each = var.enable_billing ? [kubernetes_secret.billing[0].metadata[0].name] : []
            content {
              secret_ref {
                name = env_from.value
              }
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.control_plane_config.metadata[0].name
            }
          }

          env {
            name  = "TERRAFORM_WORKER_ENABLED"
            value = "true"
          }
          env {
            name  = "CONTROL_PLANE_HTTP_ENABLED"
            value = "false"
          }
          env {
            name  = "AUDIT_PRUNE_ENABLED"
            value = "false"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "2Gi"
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# API Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "api" {
  metadata {
    name      = "control-plane-api"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.service_labels.api
  }

  spec {
    selector = {
      "app.kubernetes.io/component" = "api"
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3003
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
# Web Dashboard Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment" "web" {
  metadata {
    name      = "control-plane-web"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.service_labels.web
  }

  spec {
    replicas = var.web_replicas

    selector {
      match_labels = {
        "app.kubernetes.io/component" = "web"
      }
    }

    template {
      metadata {
        labels = local.service_labels.web
      }

      spec {
        container {
          name  = "web"
          image = "${var.container_registry_host}/hubblewave/control/web-control-plane:${var.control_plane_web_image_tag}"

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
# Web Service
# -----------------------------------------------------------------------------

resource "kubernetes_service" "web" {
  metadata {
    name      = "control-plane-web"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.service_labels.web
  }

  spec {
    selector = {
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
# Ingress
# -----------------------------------------------------------------------------

resource "kubernetes_ingress_v1" "control_plane_api" {
  metadata {
    name      = "control-plane-api-ingress"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels

    annotations = {
      "kubernetes.io/ingress.class"                 = "nginx"
      "cert-manager.io/cluster-issuer"              = var.cert_manager_issuer
      "nginx.ingress.kubernetes.io/ssl-redirect"    = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size" = "50m"
    }
  }

  spec {
    tls {
      hosts       = [local.api_domain]
      secret_name = "api-hubblewave-tls"
    }

    rule {
      host = local.api_domain

      http {
        path {
          path      = "/"
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
      }
    }
  }
}

resource "kubernetes_ingress_v1" "control_plane_web" {
  metadata {
    name      = "control-plane-web-ingress"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels

    annotations = {
      "kubernetes.io/ingress.class"                 = "nginx"
      "cert-manager.io/cluster-issuer"              = var.cert_manager_issuer
      "nginx.ingress.kubernetes.io/ssl-redirect"    = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size" = "50m"
    }
  }

  spec {
    tls {
      hosts       = [local.control_plane_domain]
      secret_name = "control-hubblewave-tls"
    }

    rule {
      host = local.control_plane_domain

      http {
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
}

resource "cloudflare_record" "control_plane" {
  count   = var.manage_dns ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = local.control_plane_domain
  type    = "CNAME"
  content = var.control_plane_ingress_hostname
  ttl     = 300
  proxied = false
}

resource "cloudflare_record" "control_plane_api" {
  count   = var.manage_dns ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = local.api_domain
  type    = "CNAME"
  content = var.control_plane_ingress_hostname
  ttl     = 300
  proxied = false
}

# -----------------------------------------------------------------------------
# Horizontal Pod Autoscaler
# -----------------------------------------------------------------------------

resource "kubernetes_horizontal_pod_autoscaler_v2" "api" {
  metadata {
    name      = "control-plane-api-hpa"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.api.metadata[0].name
    }

    min_replicas = var.api_replicas
    max_replicas = var.api_replicas * 3

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
# Pod Disruption Budget
# -----------------------------------------------------------------------------

resource "kubernetes_pod_disruption_budget_v1" "api" {
  metadata {
    name      = "control-plane-api-pdb"
    namespace = kubernetes_namespace.control_plane.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    min_available = 1

    selector {
      match_labels = {
        "app.kubernetes.io/component" = "api"
      }
    }
  }
}
