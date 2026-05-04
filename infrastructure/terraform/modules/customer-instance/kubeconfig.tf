/**
 * HubbleWave Customer Instance Module - Kubeconfig Management
 *
 * Stores kubeconfig in Secrets Manager for control plane access
 * and configures IAM role for cross-account cluster management.
 */

# -----------------------------------------------------------------------------
# Kubeconfig Secret
# -----------------------------------------------------------------------------

locals {
  kubeconfig = yamlencode({
    apiVersion = "v1"
    kind       = "Config"
    clusters = [{
      name = module.eks.cluster_name
      cluster = {
        server                     = module.eks.cluster_endpoint
        certificate-authority-data = module.eks.cluster_certificate_authority_data
      }
    }]
    contexts = [{
      name = module.eks.cluster_name
      context = {
        cluster = module.eks.cluster_name
        user    = module.eks.cluster_name
      }
    }]
    current-context = module.eks.cluster_name
    users = [{
      name = module.eks.cluster_name
      user = {
        exec = {
          apiVersion = "client.authentication.k8s.io/v1beta1"
          command    = "aws"
          args = [
            "--region", var.aws_region,
            "eks", "get-token",
            "--cluster-name", module.eks.cluster_name,
            "--output", "json"
          ]
        }
      }
    }]
  })
}

resource "aws_secretsmanager_secret" "kubeconfig" {
  name        = "hubblewave/instance/${var.environment}/${var.customer_code}/${var.instance_id}/kubeconfig"
  description = "Kubeconfig for customer instance EKS cluster: ${local.cluster_name}"

  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = local.aws_tags
}

resource "aws_secretsmanager_secret_version" "kubeconfig" {
  secret_id     = aws_secretsmanager_secret.kubeconfig.id
  secret_string = local.kubeconfig
}

# -----------------------------------------------------------------------------
# Control Plane Access Role
# -----------------------------------------------------------------------------

resource "aws_iam_role" "control_plane_access" {
  name        = "hw-${local.instance_name}-control-plane-access"
  description = "Role for control plane to access customer EKS cluster"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        AWS = var.control_plane_role_arn
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = var.instance_id
        }
      }
    }]
  })

  tags = local.aws_tags
}

resource "aws_iam_role_policy" "control_plane_eks_access" {
  name = "eks-access"
  role = aws_iam_role.control_plane_access.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EKSDescribe"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters",
          "eks:DescribeNodegroup",
          "eks:ListNodegroups"
        ]
        Resource = [
          module.eks.cluster_arn,
          "${module.eks.cluster_arn}/nodegroup/*"
        ]
      },
      {
        Sid    = "GetKubeconfig"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.kubeconfig.arn
      },
      {
        Sid    = "EKSAuth"
        Effect = "Allow"
        Action = [
          "eks:AccessKubernetesApi"
        ]
        Resource = module.eks.cluster_arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# EKS Access Entry for Control Plane Role
# -----------------------------------------------------------------------------

resource "aws_eks_access_entry" "control_plane" {
  cluster_name  = module.eks.cluster_name
  principal_arn = aws_iam_role.control_plane_access.arn
  type          = "STANDARD"

  tags = local.aws_tags
}

resource "aws_eks_access_policy_association" "control_plane" {
  cluster_name  = module.eks.cluster_name
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
  principal_arn = aws_iam_role.control_plane_access.arn

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.control_plane]
}
