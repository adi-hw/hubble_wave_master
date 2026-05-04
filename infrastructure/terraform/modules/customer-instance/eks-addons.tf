/**
 * HubbleWave Customer Instance Module - EKS Add-ons
 *
 * Additional Kubernetes add-ons for customer instances:
 * - Cluster Autoscaler (scales node groups based on pod demand)
 * - NVIDIA Device Plugin (GPU instances only)
 * - Metrics Server (for HPA)
 */

# -----------------------------------------------------------------------------
# Cluster Autoscaler IRSA Role
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "cluster_autoscaler" {
  statement {
    sid = "ClusterAutoscalerDescribe"
    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeScalingActivities",
      "autoscaling:DescribeTags",
      "ec2:DescribeImages",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplateVersions",
      "ec2:GetInstanceTypesFromInstanceRequirements",
      "eks:DescribeNodegroup",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ClusterAutoscalerScale"
    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/kubernetes.io/cluster/${local.cluster_name}"
      values   = ["owned"]
    }
  }
}

resource "aws_iam_policy" "cluster_autoscaler" {
  name   = "hw-${local.instance_name}-cluster-autoscaler"
  policy = data.aws_iam_policy_document.cluster_autoscaler.json
  tags   = local.aws_tags
}

data "aws_iam_policy_document" "cluster_autoscaler_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:sub"
      values   = ["system:serviceaccount:kube-system:cluster-autoscaler"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster_autoscaler" {
  name               = "hw-${local.instance_name}-cluster-autoscaler"
  assume_role_policy = data.aws_iam_policy_document.cluster_autoscaler_assume.json
  tags               = local.aws_tags
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  role       = aws_iam_role.cluster_autoscaler.name
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
}

# -----------------------------------------------------------------------------
# Cluster Autoscaler Helm Release
# -----------------------------------------------------------------------------

resource "helm_release" "cluster_autoscaler" {
  provider   = helm.instance
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  version    = "9.37.0"

  set = [
    {
      name  = "autoDiscovery.clusterName"
      value = local.cluster_name
    },
    {
      name  = "awsRegion"
      value = var.aws_region
    },
    {
      name  = "rbac.serviceAccount.create"
      value = "true"
    },
    {
      name  = "rbac.serviceAccount.name"
      value = "cluster-autoscaler"
    },
    {
      name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = aws_iam_role.cluster_autoscaler.arn
    },
    # Scale down settings for cost optimization
    {
      name  = "extraArgs.scale-down-enabled"
      value = "true"
    },
    {
      name  = "extraArgs.scale-down-delay-after-add"
      value = "5m"
    },
    {
      name  = "extraArgs.scale-down-delay-after-delete"
      value = "1m"
    },
    {
      name  = "extraArgs.scale-down-unneeded-time"
      value = "5m"
    },
    {
      name  = "extraArgs.skip-nodes-with-local-storage"
      value = "false"
    },
    {
      name  = "extraArgs.skip-nodes-with-system-pods"
      value = "false"
    },
    {
      name  = "extraArgs.balance-similar-node-groups"
      value = "true"
    },
    # Resource limits
    {
      name  = "resources.requests.cpu"
      value = "50m"
    },
    {
      name  = "resources.requests.memory"
      value = "64Mi"
    },
    {
      name  = "resources.limits.cpu"
      value = "100m"
    },
    {
      name  = "resources.limits.memory"
      value = "128Mi"
    },
    # Schedule on standard nodes
    {
      name  = "nodeSelector.hubblewave\\.com/node-type"
      value = "standard"
    },
  ]

  depends_on = [module.eks]
}

# -----------------------------------------------------------------------------
# NVIDIA Device Plugin (GPU instances only)
# -----------------------------------------------------------------------------

resource "kubernetes_daemon_set_v1" "nvidia_device_plugin" {
  provider = kubernetes.instance
  count    = local.gpu_enabled_effective ? 1 : 0

  metadata {
    name      = "nvidia-device-plugin-daemonset"
    namespace = "kube-system"
    labels = {
      "app.kubernetes.io/name"       = "nvidia-device-plugin"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }

  spec {
    selector {
      match_labels = {
        name = "nvidia-device-plugin-ds"
      }
    }

    strategy {
      type = "RollingUpdate"
    }

    template {
      metadata {
        labels = {
          name = "nvidia-device-plugin-ds"
        }
      }

      spec {
        priority_class_name = "system-node-critical"

        # Tolerate GPU taints
        toleration {
          key      = "nvidia.com/gpu"
          operator = "Exists"
          effect   = "NoSchedule"
        }

        # Run on all nodes (including GPU nodes)
        toleration {
          operator = "Exists"
        }

        container {
          name  = "nvidia-device-plugin-ctr"
          image = "nvcr.io/nvidia/k8s-device-plugin:v0.14.5"

          env {
            name  = "FAIL_ON_INIT_ERROR"
            value = "false"
          }

          security_context {
            allow_privilege_escalation = false
            capabilities {
              drop = ["ALL"]
            }
          }

          volume_mount {
            name       = "device-plugin"
            mount_path = "/var/lib/kubelet/device-plugins"
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        }

        volume {
          name = "device-plugin"
          host_path {
            path = "/var/lib/kubelet/device-plugins"
          }
        }

        # Ensure it runs on nodes with NVIDIA GPUs
        node_selector = {
          "kubernetes.io/os" = "linux"
        }
      }
    }
  }

  depends_on = [module.eks]
}

# -----------------------------------------------------------------------------
# Metrics Server (for HPA)
# -----------------------------------------------------------------------------

resource "helm_release" "metrics_server" {
  provider   = helm.instance
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server"
  chart      = "metrics-server"
  namespace  = "kube-system"
  version    = "3.12.0"

  set = [
    {
      name  = "args[0]"
      value = "--kubelet-preferred-address-types=InternalIP"
    },
    {
      name  = "resources.requests.cpu"
      value = "50m"
    },
    {
      name  = "resources.requests.memory"
      value = "64Mi"
    },
    {
      name  = "resources.limits.cpu"
      value = "100m"
    },
    {
      name  = "resources.limits.memory"
      value = "128Mi"
    }
  ]

  depends_on = [module.eks]
}
