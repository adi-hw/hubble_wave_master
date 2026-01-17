terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
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
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0.0, < 5.0.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_eks_cluster" "control" {
  name = var.eks_cluster_name
}

data "aws_eks_cluster_auth" "control" {
  name = var.eks_cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.control.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.control.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.control.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.control.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.control.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.control.token
  }
}

provider "postgresql" {
  host     = local.db_admin_host
  port     = var.db_port
  username = var.db_admin_username
  password = var.db_admin_password
  sslmode  = var.db_admin_sslmode
  superuser = false
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

data "tls_certificate" "eks_oidc" {
  url = data.aws_eks_cluster.control.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  url             = data.aws_eks_cluster.control.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint]
}

locals {
  oidc_provider_host = replace(data.aws_eks_cluster.control.identity[0].oidc[0].issuer, "https://", "")
  db_admin_host      = length(var.db_admin_host) > 0 ? var.db_admin_host : var.db_host
}

data "aws_iam_policy_document" "control_plane_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:sub"
      values   = ["system:serviceaccount:${var.control_plane_namespace}:control-plane-sa"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "control_plane" {
  name               = "hubblewave-control-plane"
  assume_role_policy = data.aws_iam_policy_document.control_plane_assume.json
}

resource "aws_iam_policy" "control_plane" {
  name   = "hubblewave-control-plane"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "acm:*",
          "autoscaling:*",
          "cloudwatch:*",
          "ec2:*",
          "ecr:*",
          "eks:*",
          "elasticache:*",
          "elasticloadbalancing:*",
          "iam:*",
          "kms:*",
          "logs:*",
          "rds:*",
          "route53:*",
          "s3:*",
          "secretsmanager:*",
          "sts:*"
        ]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "control_plane" {
  role       = aws_iam_role.control_plane.name
  policy_arn = aws_iam_policy.control_plane.arn
}

module "control_plane" {
  source                      = "../../modules/control-plane"
  environment                 = "production"
  root_domain                 = var.root_domain
  cloudflare_zone_id          = var.cloudflare_zone_id
  cloudflare_api_token        = var.cloudflare_api_token
  control_plane_ingress_hostname = var.control_plane_ingress_hostname
  instance_root_domain        = var.root_domain
  instance_ingress_hostname   = var.instance_ingress_hostname
  instance_aws_region         = var.aws_region
  instance_db_host            = var.db_host
  instance_db_port            = var.db_port
  instance_db_admin_username  = var.db_admin_username
  instance_db_admin_password  = var.db_admin_password
  instance_db_admin_sslmode   = var.db_admin_sslmode
  instance_redis_host         = var.redis_host
  instance_redis_port         = var.redis_port
  instance_terraform_state_bucket = var.instance_terraform_state_bucket
  instance_terraform_state_region = var.instance_terraform_state_region
  instance_terraform_lock_table   = var.instance_terraform_lock_table
  instance_terraform_state_prefix = var.instance_terraform_state_prefix
  eks_oidc_provider_arn       = aws_iam_openid_connect_provider.eks.arn
  eks_oidc_provider_host      = local.oidc_provider_host
  cors_origins                = var.cors_origins
  manage_dns                  = var.manage_dns
  db_host                     = var.db_host
  db_port                     = var.db_port
  db_name                     = var.db_name
  db_username                 = var.db_username
  db_password                 = var.db_password
  db_admin_username           = var.db_admin_username
  db_admin_password           = var.db_admin_password
  db_admin_sslmode            = var.db_admin_sslmode
  redis_host                  = var.redis_host
  redis_port                  = var.redis_port
  redis_password              = var.redis_password
  container_registry_host     = var.container_registry_host
  control_plane_image_tag     = var.control_plane_image_tag
  control_plane_web_image_tag = var.control_plane_web_image_tag
  control_plane_release_id    = var.control_plane_release_id
  default_platform_release_id = var.default_platform_release_id
  control_plane_role_arn       = aws_iam_role.control_plane.arn
  cert_manager_issuer         = var.cert_manager_issuer
  enable_billing              = var.enable_billing
  stripe_webhook_secret       = var.stripe_webhook_secret
  aws_region                  = var.aws_region
  s3_bucket_pack_artifacts    = var.s3_bucket_pack_artifacts
}
