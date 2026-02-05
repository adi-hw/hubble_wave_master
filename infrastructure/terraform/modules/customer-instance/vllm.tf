/**
 * HubbleWave Customer Instance Module - vLLM Deployment
 *
 * Serves Llama 3.1 8B (or configured model) with OpenAI-compatible API
 * Runs on dedicated EKS cluster with GPU node (g4dn.xlarge with NVIDIA T4)
 */

# -----------------------------------------------------------------------------
# Local Variables for vLLM
# -----------------------------------------------------------------------------

locals {
  vllm_name = "vllm"
  vllm_labels = merge(local.common_labels, {
    "app.kubernetes.io/component" = "vllm"
  })
  vllm_port = 8000

  # Sanitize model name for filesystem (replace / with --)
  vllm_model_path = replace(var.vllm_model, "/", "--")
}

# -----------------------------------------------------------------------------
# Kubernetes Secret for Hugging Face Token
# -----------------------------------------------------------------------------

resource "kubernetes_secret_v1" "huggingface" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective && length(var.huggingface_token) > 0 ? 1 : 0

  metadata {
    name      = "huggingface-token"
    namespace = "default"
    labels    = local.common_labels
  }

  type = "Opaque"

  data = {
    HF_TOKEN = var.huggingface_token
  }

  depends_on = [module.eks]
}

# -----------------------------------------------------------------------------
# PersistentVolumeClaim for Model Cache
# -----------------------------------------------------------------------------

resource "kubernetes_persistent_volume_claim_v1" "vllm_cache" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = "vllm-model-cache"
    namespace = "default"
    labels    = local.vllm_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "50Gi"
      }
    }
    storage_class_name = "gp3"
  }

  wait_until_bound = false

  depends_on = [kubernetes_storage_class_v1.gp3]
}

# -----------------------------------------------------------------------------
# vLLM Deployment
# -----------------------------------------------------------------------------

resource "kubernetes_deployment_v1" "vllm" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = local.vllm_name
    namespace = "default"
    labels    = local.vllm_labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate" # GPU workloads need Recreate strategy
    }

    selector {
      match_labels = {
        "hubblewave.com/instance-id"  = var.instance_id
        "app.kubernetes.io/component" = "vllm"
      }
    }

    template {
      metadata {
        labels = local.vllm_labels
        annotations = {
          "hubblewave.com/model" = var.vllm_model
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.workload.metadata[0].name

        # Schedule exclusively on GPU nodes
        node_selector = {
          "hubblewave.com/node-type" = "gpu"
        }

        toleration {
          key      = "nvidia.com/gpu"
          operator = "Equal"
          value    = "true"
          effect   = "NoSchedule"
        }

        # Init container to download model from Hugging Face
        init_container {
          name  = "model-downloader"
          image = "vllm/vllm-openai:${var.vllm_image_tag}"

          command = ["/bin/bash", "-c"]
          args = [<<-EOF
            set -e
            echo "Checking for model at /models/${local.vllm_model_path}..."
            if [ -d "/models/${local.vllm_model_path}" ] && [ "$(ls -A /models/${local.vllm_model_path})" ]; then
              echo "Model already exists, skipping download"
            else
              echo "Downloading model ${var.vllm_model}..."
              python -c "
from huggingface_hub import snapshot_download
import os
token = os.environ.get('HF_TOKEN', '')
snapshot_download(
  repo_id='${var.vllm_model}',
  local_dir='/models/${local.vllm_model_path}',
  token=token if token else None
)
print('Model download complete')
"
            fi
            EOF
          ]

          env {
            name  = "HF_HOME"
            value = "/models"
          }

          env {
            name  = "HF_TOKEN"
            value = var.huggingface_token
          }

          volume_mount {
            name       = "model-cache"
            mount_path = "/models"
          }

          resources {
            requests = {
              cpu    = "1"
              memory = "4Gi"
            }
            limits = {
              cpu    = "2"
              memory = "8Gi"
            }
          }
        }

        container {
          name  = "vllm"
          image = "vllm/vllm-openai:${var.vllm_image_tag}"

          args = [
            "--model", "/models/${local.vllm_model_path}",
            "--host", "0.0.0.0",
            "--port", tostring(local.vllm_port),
            "--dtype", "half",
            "--max-model-len", "8192",
            "--gpu-memory-utilization", "0.9",
            "--served-model-name", "llama-3.1-8b",
          ]

          port {
            container_port = local.vllm_port
            name           = "http"
            protocol       = "TCP"
          }

          env {
            name  = "HF_HOME"
            value = "/models"
          }

          volume_mount {
            name       = "model-cache"
            mount_path = "/models"
          }

          volume_mount {
            name       = "shm"
            mount_path = "/dev/shm"
          }

          resources {
            requests = {
              cpu              = "2"
              memory           = "12Gi"
              "nvidia.com/gpu" = "1"
            }
            limits = {
              cpu              = "4"
              memory           = "14Gi"
              "nvidia.com/gpu" = "1"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = local.vllm_port
            }
            initial_delay_seconds = 300 # Model loading takes time
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = local.vllm_port
            }
            initial_delay_seconds = 300
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }
        }

        volume {
          name = "model-cache"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.vllm_cache[0].metadata[0].name
          }
        }

        volume {
          name = "shm"
          empty_dir {
            medium     = "Memory"
            size_limit = "8Gi"
          }
        }

        restart_policy = "Always"
      }
    }
  }

  wait_for_rollout = false

  depends_on = [
    module.eks,
    kubernetes_daemon_set_v1.nvidia_device_plugin,
    kubernetes_persistent_volume_claim_v1.vllm_cache,
  ]

  timeouts {
    create = "30m"
    update = "30m"
  }
}

# -----------------------------------------------------------------------------
# vLLM Service
# -----------------------------------------------------------------------------

resource "kubernetes_service_v1" "vllm" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = "vllm-service"
    namespace = "default"
    labels    = local.vllm_labels
  }

  spec {
    selector = {
      "hubblewave.com/instance-id"  = var.instance_id
      "app.kubernetes.io/component" = "vllm"
    }

    port {
      name        = "http"
      port        = 8000
      target_port = local.vllm_port
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }

  depends_on = [module.eks]
}
