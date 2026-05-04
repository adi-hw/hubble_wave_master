/**
 * HubbleWave Dev Instance
 *
 * Terraform configuration for the hubblewave-dev instance
 */

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_eks_cluster" "control_plane" {
  name = var.eks_cluster_name
}

data "aws_vpc" "control_plane" {
  id = data.aws_eks_cluster.control_plane.vpc_config[0].vpc_id
}

data "aws_route_table" "control_plane" {
  for_each = toset(data.aws_eks_cluster.control_plane.vpc_config[0].subnet_ids)
  subnet_id = each.value
}

data "aws_iam_role" "control_plane" {
  name = var.control_plane_role_name
}

locals {
  control_plane_route_table_ids = sort(
    distinct([for route_table in values(data.aws_route_table.control_plane) : route_table.id])
  )
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "instance" {
  source = "../../modules/customer-instance"

  # Instance identifiers
  instance_id         = var.instance_id
  customer_code       = var.customer_code
  customer_name       = var.customer_name
  environment         = var.environment
  license_key         = var.license_key
  platform_release_id = var.platform_release_id
  resource_tier       = var.resource_tier

  # Control plane peering
  control_plane_vpc_id          = data.aws_vpc.control_plane.id
  control_plane_vpc_cidr        = data.aws_vpc.control_plane.cidr_block
  control_plane_route_table_ids = local.control_plane_route_table_ids
  control_plane_role_arn        = data.aws_iam_role.control_plane.arn
  instance_vpc_cidr             = var.instance_vpc_cidr

  # Database
  db_engine_version        = var.db_engine_version
  db_allocated_storage     = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage

  # Redis
  redis_engine_version = var.redis_engine_version

  # AWS
  aws_region = var.aws_region

  # DNS
  root_domain        = var.root_domain
  cloudflare_zone_id = var.cloudflare_zone_id

  # Application
  cors_origins   = var.cors_origins
  api_rate_limit = var.api_rate_limit

  # Container images
  container_registry_host = var.container_registry_host
  instance_api_image_tag  = var.instance_api_image_tag
  instance_web_image_tag  = var.instance_web_image_tag

  # Deployment
  api_replicas = var.api_replicas
  web_replicas = var.web_replicas

  # GPU / vLLM
  gpu_enabled       = var.gpu_enabled
  gpu_instance_type = var.gpu_instance_type
  vllm_model        = var.vllm_model
  vllm_image_tag    = var.vllm_image_tag
  huggingface_token = var.huggingface_token
  ava_image_tag     = var.ava_image_tag
  ava_replicas      = var.ava_replicas
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "instance_url" {
  value = module.instance.instance_url
}

output "db_endpoint" {
  value = module.instance.db_endpoint
}

output "redis_endpoint" {
  value = module.instance.redis_endpoint
}

output "namespace" {
  value = "default"
}
