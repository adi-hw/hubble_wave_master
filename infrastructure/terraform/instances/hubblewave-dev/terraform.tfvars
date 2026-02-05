# HubbleWave Dev Instance Configuration

aws_region              = "us-east-2"
eks_cluster_name        = "hubblewave-control"
control_plane_role_name = "hubblewave-control-plane"

# Instance identifiers
instance_id         = "f8df6a32-1d27-4608-ab50-7bf2ec53c7b1"
customer_code       = "hubblewave"
customer_name       = "HubbleWave"
environment         = "dev"
license_key         = "dev-license-key-placeholder"
platform_release_id = "20260118-2be29e0"
resource_tier       = "standard"

# Database
db_engine_version        = "16.11"
db_allocated_storage     = 20
db_max_allocated_storage = 100

# Redis
redis_engine_version = "7.1"

# DNS
root_domain          = "hubblewave.com"
cloudflare_zone_id   = "f8508c6f0028592bb117233ec936f99f"
cloudflare_api_token = "fu5C_DPDlQHNUvGk4rwINZzuwhJMIuGLFi0VTKEe"

# Application
cors_origins   = "https://hubblewave.dev.hubblewave.com,https://*.dev.hubblewave.com"
api_rate_limit = 1000

# Container images
container_registry_host = "687904696003.dkr.ecr.us-east-2.amazonaws.com"
instance_api_image_tag  = "2be29e0"
instance_web_image_tag  = "2be29e0"

# Deployment
api_replicas = 1
web_replicas = 1

# GPU / vLLM (Llama 3.1 8B)
gpu_enabled       = true
gpu_instance_type = "g4dn.xlarge"
vllm_model        = "meta-llama/Meta-Llama-3.1-8B-Instruct"
vllm_image_tag    = "v0.6.4.post1"
huggingface_token = "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"
ava_replicas      = 1
