resource "aws_db_subnet_group" "control_plane" {
  name       = var.db_subnet_group_name
  subnet_ids = var.db_subnet_ids
}

resource "aws_db_instance" "control_plane" {
  identifier                    = var.db_instance_identifier
  engine                        = "postgres"
  engine_version                = "17.6"
  instance_class                = "db.t3.medium"
  allocated_storage             = 50
  max_allocated_storage         = 200
  storage_type                  = "gp3"
  iops                          = 3000
  storage_throughput            = 125
  db_name                       = var.db_name
  username                      = var.db_admin_username
  password                      = var.db_admin_password
  port                          = var.db_port
  db_subnet_group_name          = aws_db_subnet_group.control_plane.name
  vpc_security_group_ids        = var.db_security_group_ids
  parameter_group_name          = var.db_parameter_group_name
  publicly_accessible           = false
  multi_az                      = false
  storage_encrypted             = true
  kms_key_id                    = var.db_kms_key_id
  backup_retention_period       = 7
  backup_window                 = var.db_backup_window
  maintenance_window            = var.db_maintenance_window
  copy_tags_to_snapshot         = true
  monitoring_interval           = 60
  monitoring_role_arn           = var.db_monitoring_role_arn
  performance_insights_enabled  = true
  performance_insights_kms_key_id = var.db_performance_insights_kms_key_id
  performance_insights_retention_period = 7
  auto_minor_version_upgrade    = true
  deletion_protection           = false
  apply_immediately             = true
  skip_final_snapshot           = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_elasticache_subnet_group" "control_plane" {
  name       = var.redis_subnet_group_name
  subnet_ids = var.redis_subnet_ids
}

resource "aws_elasticache_replication_group" "control_plane" {
  replication_group_id = var.redis_replication_group_id
  description          = var.redis_replication_group_description
  engine                        = "redis"
  engine_version                = var.redis_engine_version
  node_type                     = var.redis_node_type
  num_cache_clusters            = 1
  port                          = var.redis_port
  parameter_group_name          = var.redis_parameter_group_name
  subnet_group_name             = aws_elasticache_subnet_group.control_plane.name
  security_group_ids            = var.redis_security_group_ids
  automatic_failover_enabled    = false
  multi_az_enabled              = false
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  snapshot_retention_limit      = var.redis_snapshot_retention_limit
  snapshot_window               = var.redis_snapshot_window
  auto_minor_version_upgrade    = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "pack_artifacts" {
  bucket = var.s3_bucket_pack_artifacts

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "pack_artifacts" {
  bucket = aws_s3_bucket.pack_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pack_artifacts" {
  bucket = aws_s3_bucket.pack_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "pack_artifacts" {
  bucket = aws_s3_bucket.pack_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_ecr_repository" "control_plane_api" {
  name                 = var.ecr_control_plane_repository
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_repository" "control_plane_web" {
  name                 = var.ecr_web_control_plane_repository
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}
