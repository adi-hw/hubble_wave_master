/**
 * HubbleWave Customer Instance Module - Dedicated EKS Cluster
 *
 * Creates a dedicated EKS cluster for each customer instance with:
 * - Managed node group (standard or GPU based on tier)
 * - Core add-ons (CoreDNS, kube-proxy, VPC CNI, EBS CSI)
 * - IRSA enabled for workload IAM
 */

# -----------------------------------------------------------------------------
# Local Variables for EKS
# -----------------------------------------------------------------------------

locals {
  cluster_name = "hw-${local.instance_name}"

  # Standard node configuration (always present)
  standard_node_instance_type = local.tier_config.node_instance
  standard_node_disk_size     = 50
  standard_node_ami_type      = "AL2023_x86_64_STANDARD"

  # GPU node configuration (only when GPU enabled)
  gpu_node_disk_size = 100
  gpu_node_ami_type  = "AL2023_x86_64_NVIDIA"
}

# -----------------------------------------------------------------------------
# EKS Cluster
# -----------------------------------------------------------------------------

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = local.cluster_name
  cluster_version = "1.31"

  # Network configuration
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Cluster endpoint access
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Control plane logging
  cluster_enabled_log_types = var.environment == "production" ? ["api", "audit", "authenticator", "controllerManager", "scheduler"] : ["api", "audit"]

  # OIDC for IRSA
  enable_irsa = true

  # Cluster access management
  enable_cluster_creator_admin_permissions = true
  authentication_mode                      = "API_AND_CONFIG_MAP"

  # Core add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
      configuration_values = jsonencode({
        replicaCount = 1
        resources = {
          limits = {
            cpu    = "100m"
            memory = "150Mi"
          }
          requests = {
            cpu    = "50m"
            memory = "100Mi"
          }
        }
      })
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa_role.iam_role_arn
    }
  }

  # Managed node groups - standard always present, GPU added when enabled
  eks_managed_node_groups = merge(
    {
      # Standard node group for API, Web, and general workloads
      # Always keeps at least 1 node running
      standard = {
        name                 = "${local.instance_name}-std"
        iam_role_name        = "hw-${local.instance_name}-std"
        iam_role_use_name_prefix = false
        instance_types = [local.standard_node_instance_type]
        ami_type       = local.standard_node_ami_type
        capacity_type  = "ON_DEMAND"

        min_size     = 1
        max_size     = 3
        desired_size = 1

        disk_size = local.standard_node_disk_size

        labels = {
          "hubblewave.com/instance"  = var.instance_id
          "hubblewave.com/customer"  = var.customer_code
          "hubblewave.com/tier"      = var.resource_tier
          "hubblewave.com/node-type" = "standard"
        }

        tags = {
          "hubblewave.com/instance"                                                  = var.instance_id
          "hubblewave.com/customer"                                                  = var.customer_code
          "hubblewave.com/node-type"                                                 = "standard"
          "k8s.io/cluster-autoscaler/enabled"                                        = "true"
          "k8s.io/cluster-autoscaler/${local.cluster_name}"                          = "owned"
          "k8s.io/cluster-autoscaler/node-template/label/hubblewave.com/node-type"   = "standard"
        }
      }
    },
    # GPU node group - only created when GPU is enabled
    # Scales to zero when no GPU pods are pending (cost optimization)
    local.gpu_enabled_effective ? {
      gpu = {
        name                     = "${local.instance_name}-gpu"
        iam_role_name            = "hw-${local.instance_name}-gpu"
        iam_role_use_name_prefix = false
        instance_types = [var.gpu_instance_type]
        ami_type       = local.gpu_node_ami_type
        capacity_type  = "ON_DEMAND"

        min_size     = 0
        max_size     = 1
        desired_size = 0

        disk_size = local.gpu_node_disk_size

        labels = {
          "hubblewave.com/instance"  = var.instance_id
          "hubblewave.com/customer"  = var.customer_code
          "hubblewave.com/tier"      = var.resource_tier
          "hubblewave.com/node-type" = "gpu"
          "nvidia.com/gpu"           = "true"
        }

        taints = [
          {
            key    = "nvidia.com/gpu"
            value  = "true"
            effect = "NO_SCHEDULE"
          }
        ]

        tags = {
          "hubblewave.com/instance"                                = var.instance_id
          "hubblewave.com/customer"                                = var.customer_code
          "hubblewave.com/node-type"                               = "gpu"
          "k8s.io/cluster-autoscaler/enabled"                      = "true"
          "k8s.io/cluster-autoscaler/${local.cluster_name}"        = "owned"
          "k8s.io/cluster-autoscaler/node-template/label/hubblewave.com/node-type" = "gpu"
          "k8s.io/cluster-autoscaler/node-template/label/nvidia.com/gpu"           = "true"
          "k8s.io/cluster-autoscaler/node-template/taint/nvidia.com/gpu"           = "true:NoSchedule"
        }
      }
    } : {}
  )

  # Node security group additional rules
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
    egress_all = {
      description      = "Node all egress"
      protocol         = "-1"
      from_port        = 0
      to_port          = 0
      type             = "egress"
      cidr_blocks      = ["0.0.0.0/0"]
      ipv6_cidr_blocks = ["::/0"]
    }
  }

  tags = local.aws_tags
}

# -----------------------------------------------------------------------------
# EBS CSI Driver IRSA Role
# -----------------------------------------------------------------------------

module "ebs_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "hw-${local.instance_name}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.aws_tags
}

# -----------------------------------------------------------------------------
# Kubernetes and Helm Provider Configuration
# -----------------------------------------------------------------------------

provider "kubernetes" {
  alias = "instance"

  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.aws_region]
  }
}

provider "helm" {
  alias = "instance"

  kubernetes = {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.aws_region]
    }
  }
}

# -----------------------------------------------------------------------------
# gp3 Storage Class (default)
# -----------------------------------------------------------------------------

resource "kubernetes_storage_class_v1" "gp3" {
  provider = kubernetes.instance

  metadata {
    name = "gp3"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "true"
    }
  }

  storage_provisioner    = "ebs.csi.aws.com"
  volume_binding_mode    = "WaitForFirstConsumer"
  allow_volume_expansion = true

  parameters = {
    type      = "gp3"
    encrypted = "true"
    fsType    = "ext4"
  }

  depends_on = [module.eks]
}
