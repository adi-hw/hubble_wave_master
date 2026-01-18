/**
 * HubbleWave Customer Instance Module - GPU Node Group
 *
 * Dedicated GPU node group for vLLM inference
 * Provisions a g4dn.xlarge with NVIDIA T4 GPU (16GB VRAM)
 */

# -----------------------------------------------------------------------------
# Local Variables for GPU Node Group
# -----------------------------------------------------------------------------

locals {
  gpu_node_group_name = "hw-${local.instance_name}-gpu"

  gpu_labels = {
    "hubblewave.com/gpu-instance" = var.instance_id
    "hubblewave.com/customer"     = var.customer_code
    "hubblewave.com/node-type"    = "gpu"
    "nvidia.com/gpu.present"      = "true"
  }

  gpu_taints = [
    {
      key    = "hubblewave.com/instance"
      value  = var.instance_id
      effect = "NO_SCHEDULE"
    },
    {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  ]
}

# -----------------------------------------------------------------------------
# IAM Role for GPU Node Group
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "gpu_node_assume" {
  count = local.gpu_enabled_effective ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "gpu_node" {
  count              = local.gpu_enabled_effective ? 1 : 0
  name               = "hw-${local.instance_name}-gpu-node"
  assume_role_policy = data.aws_iam_policy_document.gpu_node_assume[0].json
  tags               = local.aws_tags
}

resource "aws_iam_role_policy_attachment" "gpu_node_worker" {
  count      = local.gpu_enabled_effective ? 1 : 0
  role       = aws_iam_role.gpu_node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "gpu_node_cni" {
  count      = local.gpu_enabled_effective ? 1 : 0
  role       = aws_iam_role.gpu_node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "gpu_node_ecr" {
  count      = local.gpu_enabled_effective ? 1 : 0
  role       = aws_iam_role.gpu_node[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# -----------------------------------------------------------------------------
# EKS Managed Node Group for GPU
# -----------------------------------------------------------------------------

resource "aws_eks_node_group" "gpu" {
  count           = local.gpu_enabled_effective ? 1 : 0
  cluster_name    = var.eks_cluster_name
  node_group_name = local.gpu_node_group_name
  node_role_arn   = aws_iam_role.gpu_node[0].arn
  subnet_ids      = length(var.gpu_subnet_ids) > 0 ? var.gpu_subnet_ids : var.db_subnet_ids

  scaling_config {
    desired_size = 1
    max_size     = 1
    min_size     = 1
  }

  instance_types = [var.gpu_instance_type]
  ami_type       = "AL2_x86_64_GPU"
  capacity_type  = "ON_DEMAND"
  disk_size      = 100 # Larger disk for model storage

  labels = local.gpu_labels

  dynamic "taint" {
    for_each = local.gpu_taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }

  tags = merge(local.aws_tags, {
    Name                     = local.gpu_node_group_name
    "hubblewave.com/purpose" = "gpu-inference"
  })

  depends_on = [
    aws_iam_role_policy_attachment.gpu_node_worker,
    aws_iam_role_policy_attachment.gpu_node_cni,
    aws_iam_role_policy_attachment.gpu_node_ecr,
  ]

  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }

  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }
}
