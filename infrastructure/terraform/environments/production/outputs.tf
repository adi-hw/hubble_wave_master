output "control_plane_url" {
  description = "Control plane web URL"
  value       = module.control_plane.control_plane_url
}

output "control_plane_api_url" {
  description = "Control plane API URL"
  value       = module.control_plane.api_url
}

output "control_plane_role_arn" {
  description = "IAM role ARN for the control plane service account"
  value       = aws_iam_role.control_plane.arn
}

output "control_plane_namespace" {
  description = "Kubernetes namespace for the control plane"
  value       = module.control_plane.namespace
}
