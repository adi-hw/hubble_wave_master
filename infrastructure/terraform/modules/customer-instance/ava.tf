/**
 * HubbleWave Customer Instance Module - AVA Service Deployment
 *
 * AI Virtual Assistant connecting to instance-local vLLM
 * Provides chat, insights, and intelligent automation capabilities
 */

# -----------------------------------------------------------------------------
# Local Variables for AVA
# -----------------------------------------------------------------------------

locals {
  ava_name = "ava-service"
  ava_labels = merge(local.common_labels, {
    "app.kubernetes.io/component" = "ava"
  })
  ava_port = 3004

  # vLLM URL - points to local vLLM service if GPU enabled
  vllm_base_url = local.gpu_enabled_effective ? "http://vllm-service:8000/v1" : ""
}

# -----------------------------------------------------------------------------
# AVA ConfigMap
# -----------------------------------------------------------------------------

resource "kubernetes_config_map_v1" "ava_config" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = "ava-config"
    namespace = "default"
    labels    = local.ava_labels
  }

  data = {
    NODE_ENV  = var.environment == "production" ? "production" : "development"
    PORT      = tostring(local.ava_port)
    LOG_LEVEL = var.environment == "production" ? "info" : "debug"

    # LLM Configuration
    LLM_PROVIDER         = "vllm"
    VLLM_BASE_URL        = local.vllm_base_url
    VLLM_DEFAULT_MODEL   = "llama-3.1-8b"
    VLLM_EMBEDDING_MODEL = "llama-3.1-8b"
    LLM_MAX_TOKENS       = "4096"
    LLM_TEMPERATURE      = "0.7"
    LLM_TIMEOUT_MS       = "60000"

    # Instance Configuration
    INSTANCE_ID   = var.instance_id
    CUSTOMER_CODE = var.customer_code

    # AVA Governance
    AVA_ENABLED                       = "true"
    AVA_CAN_CREATE_RECORDS            = "true"
    AVA_CAN_UPDATE_RECORDS            = "true"
    AVA_CAN_DELETE_RECORDS            = "false"
    AVA_CAN_EXECUTE_WORKFLOWS         = "true"
    AVA_REQUIRE_CONFIRMATION          = "true"
    AVA_MAX_ACTIONS_PER_CONVERSATION  = "10"

    # Embedding Configuration
    EMBEDDING_QUEUE_CONCURRENCY = "5"
    EMBEDDING_BATCH_SIZE        = "100"

    # CORS
    CORS_ORIGINS = var.cors_origins
  }

  depends_on = [module.eks]
}

# -----------------------------------------------------------------------------
# AVA Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment_v1" "ava" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = local.ava_name
    namespace = "default"
    labels    = local.ava_labels
  }

  spec {
    replicas = var.ava_replicas

    selector {
      match_labels = {
        "hubblewave.com/instance-id"  = var.instance_id
        "app.kubernetes.io/component" = "ava"
      }
    }

    template {
      metadata {
        labels = local.ava_labels
      }

      spec {
        service_account_name = kubernetes_service_account_v1.workload.metadata[0].name

        # Schedule on standard nodes (AVA calls vLLM via HTTP, no GPU needed)
        node_selector = {
          "hubblewave.com/node-type" = "standard"
        }

        container {
          name  = "ava"
          image = "${var.container_registry_host}/hubblewave/instance/svc-ava:${var.ava_image_tag != "" ? var.ava_image_tag : var.instance_api_image_tag}"

          port {
            container_port = local.ava_port
            name           = "http"
          }

          port {
            container_port = 9090
            name           = "metrics"
          }

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.database.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.redis.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.instance_config.metadata[0].name
            }
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map_v1.ava_config[0].metadata[0].name
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
              port = local.ava_port
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = local.ava_port
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }

  wait_for_rollout = false

  depends_on = [
    kubernetes_deployment_v1.vllm,
    kubernetes_service_v1.vllm,
  ]
}

# -----------------------------------------------------------------------------
# AVA Service
# -----------------------------------------------------------------------------

resource "kubernetes_service_v1" "ava" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = local.ava_name
    namespace = "default"
    labels    = local.ava_labels
  }

  spec {
    selector = {
      "hubblewave.com/instance-id"  = var.instance_id
      "app.kubernetes.io/component" = "ava"
    }

    port {
      name        = "http"
      port        = 80
      target_port = local.ava_port
    }

    port {
      name        = "metrics"
      port        = 9090
      target_port = 9090
    }

    type = "ClusterIP"
  }

  depends_on = [module.eks]
}
