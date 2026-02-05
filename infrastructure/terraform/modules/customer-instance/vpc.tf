/**
 * HubbleWave Customer Instance Module - Dedicated VPC
 *
 * Creates a dedicated VPC for each customer instance with:
 * - Public and private subnets across 2 AZs
 * - NAT Gateway for private subnet internet access
 * - VPC Peering to control plane for internal communication
 */

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# Local Variables for VPC
# -----------------------------------------------------------------------------

locals {
  # Auto-assign CIDR based on instance index if not provided
  # Uses 10.{100+index}.0.0/16 to avoid conflict with control plane (10.0.0.0/16)
  vpc_cidr = var.instance_vpc_cidr != "" ? var.instance_vpc_cidr : "10.${100 + local.instance_index}.0.0/16"

  # Use first 2 AZs in the region
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  # Subnet CIDR allocation (/20 subnets from /16 VPC)
  public_subnets = [
    cidrsubnet(local.vpc_cidr, 4, 0), # 10.X.0.0/20
    cidrsubnet(local.vpc_cidr, 4, 1), # 10.X.16.0/20
  ]

  private_subnets = [
    cidrsubnet(local.vpc_cidr, 4, 2), # 10.X.32.0/20
    cidrsubnet(local.vpc_cidr, 4, 3), # 10.X.48.0/20
  ]

  # Instance index derived from UUID (first 8 hex chars as decimal mod 100)
  instance_index = parseint(substr(var.instance_id, 0, 8), 16) % 100
}

# -----------------------------------------------------------------------------
# VPC Module
# -----------------------------------------------------------------------------

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "hw-${local.instance_name}"
  cidr = local.vpc_cidr

  azs             = local.azs
  public_subnets  = local.public_subnets
  private_subnets = local.private_subnets

  # NAT Gateway configuration
  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  one_nat_gateway_per_az = var.environment == "production"

  # DNS configuration
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Subnet tags for Kubernetes
  public_subnet_tags = {
    "kubernetes.io/role/elb"                              = 1
    "kubernetes.io/cluster/hw-${local.instance_name}"     = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"                     = 1
    "kubernetes.io/cluster/hw-${local.instance_name}"     = "shared"
  }

  tags = local.aws_tags
}

# -----------------------------------------------------------------------------
# VPC Peering to Control Plane
# -----------------------------------------------------------------------------

resource "aws_vpc_peering_connection" "to_control_plane" {
  vpc_id      = module.vpc.vpc_id
  peer_vpc_id = var.control_plane_vpc_id
  auto_accept = true

  accepter {
    allow_remote_vpc_dns_resolution = true
  }

  requester {
    allow_remote_vpc_dns_resolution = true
  }

  tags = merge(local.aws_tags, {
    Name = "hw-${local.instance_name}-to-control-plane"
  })
}

# Route from instance VPC private subnets to control plane VPC
resource "aws_route" "instance_to_control_plane" {
  count                     = length(module.vpc.private_route_table_ids)
  route_table_id            = module.vpc.private_route_table_ids[count.index]
  destination_cidr_block    = var.control_plane_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.to_control_plane.id
}

# Route from control plane VPC to instance VPC
resource "aws_route" "control_plane_to_instance" {
  count                     = length(var.control_plane_route_table_ids)
  route_table_id            = var.control_plane_route_table_ids[count.index]
  destination_cidr_block    = local.vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.to_control_plane.id
}
