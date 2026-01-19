import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Instance } from '@hubblewave/control-plane-db';

export interface TerraformWorkspaceIdentity {
  instanceName: string;
  namespace: string;
  databaseName: string;
  domain: string;
}

export interface TerraformWorkspaceRequest {
  instance: Instance;
  customerCode: string;
  customerName: string;
  licenseKey?: string | null;
  workspace?: string;
}

export interface TerraformWorkspaceResult {
  workspace: string;
  directory: string;
  identity: TerraformWorkspaceIdentity;
}

@Injectable()
export class TerraformWorkspaceService {
  private readonly workspacesRoot: string;
  private readonly modulesRoot: string;

  constructor(private readonly config: ConfigService) {
    this.workspacesRoot = this.config.get<string>(
      'TERRAFORM_WORKSPACES_ROOT',
      join(process.cwd(), 'terraform', 'workspaces')
    );
    this.modulesRoot = this.config.get<string>(
      'TERRAFORM_MODULES_ROOT',
      join(process.cwd(), 'terraform', 'modules')
    );
  }

  buildIdentity(customerCode: string, environment: string): TerraformWorkspaceIdentity {
    const rootDomain = this.requireConfig('INSTANCE_ROOT_DOMAIN');
    if (rootDomain !== 'hubblewave.com') {
      throw new Error('INSTANCE_ROOT_DOMAIN must be hubblewave.com');
    }

    const instanceName = `${customerCode}-${environment}`;
    return {
      instanceName,
      namespace: `hw-${instanceName}`,
      databaseName: `hw_${instanceName.replace(/-/g, '_')}`,
      domain: `${customerCode}.${environment}.${rootDomain}`,
    };
  }

  async ensureWorkspace(request: TerraformWorkspaceRequest): Promise<TerraformWorkspaceResult> {
    const workspaceName = this.normalizeWorkspaceName(
      request.workspace || `${request.customerCode}-${request.instance.environment}`
    );
    const workspaceDir = join(this.workspacesRoot, workspaceName);
    await fs.mkdir(workspaceDir, { recursive: true });

    const identity = this.buildIdentity(request.customerCode, request.instance.environment);
    const existing = await this.workspaceFilesPresent(workspaceDir);
    if (!request.licenseKey && existing) {
      return { workspace: workspaceName, directory: workspaceDir, identity };
    }
    if (!request.licenseKey) {
      throw new Error('licenseKey is required to create a Terraform workspace');
    }

    const stateBucket = this.requireConfig('INSTANCE_TERRAFORM_STATE_BUCKET');
    const stateRegion = this.config.get<string>('INSTANCE_TERRAFORM_STATE_REGION')
      || this.config.get<string>('AWS_REGION');
    const lockTable = this.requireConfig('INSTANCE_TERRAFORM_LOCK_TABLE');
    const statePrefix = this.config.get<string>('INSTANCE_TERRAFORM_STATE_PREFIX', 'instances');
    const normalizedPrefix = statePrefix.replace(/\/+$/, '');
    const stateKey = `${normalizedPrefix}/${workspaceName}/terraform.tfstate`;

    const awsRegion = this.config.get<string>('INSTANCE_AWS_REGION')
      || this.config.get<string>('AWS_REGION');

    // VPC and subnet configuration for dedicated RDS/ElastiCache
    const vpcId = this.requireConfig('INSTANCE_VPC_ID');
    const vpcCidr = this.requireConfig('INSTANCE_VPC_CIDR');
    const dbSubnetIds = this.requireConfig('INSTANCE_DB_SUBNET_IDS');
    const redisSubnetIds = this.requireConfig('INSTANCE_REDIS_SUBNET_IDS');
    const eksSecurityGroupIds = this.requireConfig('INSTANCE_EKS_SECURITY_GROUP_IDS');

    const cloudflareZoneId = this.requireConfig('INSTANCE_CLOUDFLARE_ZONE_ID');
    const ingressHostname = this.requireConfig('INSTANCE_INGRESS_HOSTNAME');
    const eksOidcProviderArn = this.requireConfig('INSTANCE_EKS_OIDC_PROVIDER_ARN');
    const eksOidcProviderHost = this.requireConfig('INSTANCE_EKS_OIDC_PROVIDER_HOST');

    if (!awsRegion) {
      throw new Error('INSTANCE_AWS_REGION or AWS_REGION must be set');
    }
    if (!stateRegion) {
      throw new Error('INSTANCE_TERRAFORM_STATE_REGION or AWS_REGION must be set');
    }
    if (!request.instance.version) {
      throw new Error('instance version is required for provisioning');
    }

    const moduleSource = `${this.modulesRoot.replace(/\\\\/g, '/')}/customer-instance`;
    const containerRegistry = this.requireConfig('INSTANCE_CONTAINER_REGISTRY');
    const instanceApiImageTag = this.config.get<string>('INSTANCE_API_IMAGE_TAG')
      || request.instance.version;
    const instanceWebImageTag = this.config.get<string>('INSTANCE_WEB_IMAGE_TAG')
      || request.instance.version;
    const certManagerIssuer = this.config.get<string>('INSTANCE_CERT_MANAGER_ISSUER', 'letsencrypt-prod');

    // GPU/vLLM Configuration
    const gpuEnabled = request.instance.gpuEnabled || false;
    const gpuInstanceType = request.instance.gpuInstanceType || 'g4dn.xlarge';
    const vllmModel = request.instance.vllmModel || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
    const huggingfaceToken = this.config.get<string>('INSTANCE_HUGGINGFACE_TOKEN', '');
    const eksClusterName = this.config.get<string>('INSTANCE_EKS_CLUSTER_NAME', '');
    const gpuSubnetIds = this.config.get<string>('INSTANCE_GPU_SUBNET_IDS', '');
    const avaImageTag = this.config.get<string>('INSTANCE_AVA_IMAGE_TAG')
      || request.instance.version;
    const vllmImageTag = this.config.get<string>('INSTANCE_VLLM_IMAGE_TAG', 'v0.6.4.post1');

    const hclString = (value: string) => JSON.stringify(value);
    const hclBool = (value: boolean) => value ? 'true' : 'false';
    const hclList = (value: string) => {
      if (!value) return '[]';
      const items = value.split(',').map(s => s.trim()).filter(Boolean);
      return `[${items.map(s => JSON.stringify(s)).join(', ')}]`;
    };

    // Build GPU configuration block (only if GPU is enabled)
    const gpuConfig = gpuEnabled ? `
  # GPU / vLLM Configuration
  gpu_enabled = ${hclBool(gpuEnabled)}
  gpu_instance_type = ${hclString(gpuInstanceType)}
  vllm_model = ${hclString(vllmModel)}
  huggingface_token = ${hclString(huggingfaceToken)}
  eks_cluster_name = ${hclString(eksClusterName)}
  gpu_subnet_ids = ${hclList(gpuSubnetIds)}
  ava_image_tag = ${hclString(avaImageTag)}
  vllm_image_tag = ${hclString(vllmImageTag)}` : '';

    const mainTf = `module "instance" {
  source = ${hclString(moduleSource)}

  instance_id = ${hclString(request.instance.id)}
  customer_code = ${hclString(request.customerCode)}
  customer_name = ${hclString(request.customerName)}
  environment = ${hclString(request.instance.environment)}
  license_key = ${hclString(request.licenseKey)}
  resource_tier = ${hclString(request.instance.resourceTier || 'standard')}
  platform_release_id = ${hclString(request.instance.version)}

  # Infrastructure configuration
  aws_region = ${hclString(awsRegion)}
  vpc_id = ${hclString(vpcId)}
  vpc_cidr = ${hclString(vpcCidr)}
  db_subnet_ids = ${hclList(dbSubnetIds)}
  redis_subnet_ids = ${hclList(redisSubnetIds)}
  eks_security_group_ids = ${hclList(eksSecurityGroupIds)}

  # Domain and routing
  root_domain = ${hclString('hubblewave.com')}
  cloudflare_zone_id = ${hclString(cloudflareZoneId)}
  instance_ingress_hostname = ${hclString(ingressHostname)}
  eks_oidc_provider_arn = ${hclString(eksOidcProviderArn)}
  eks_oidc_provider_host = ${hclString(eksOidcProviderHost)}

  # Container deployment configuration
  container_registry_host = ${hclString(containerRegistry)}
  instance_api_image_tag = ${hclString(instanceApiImageTag)}
  instance_web_image_tag = ${hclString(instanceWebImageTag)}
  cert_manager_issuer = ${hclString(certManagerIssuer)}${gpuConfig}
}
`;

    const providersTf = `terraform {
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
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

provider "aws" {
  region = ${hclString(awsRegion)}
}

provider "kubernetes" {
  host                   = "https://kubernetes.default.svc"
  token                  = file("/var/run/secrets/kubernetes.io/serviceaccount/token")
  cluster_ca_certificate = file("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
}

provider "cloudflare" {}
`;

    const backendTf = `terraform {
  backend "s3" {
    bucket         = ${hclString(stateBucket)}
    key            = ${hclString(stateKey)}
    region         = ${hclString(stateRegion)}
    dynamodb_table = ${hclString(lockTable)}
    encrypt        = true
  }
}
`;

    await this.writeFileIfChanged(join(workspaceDir, 'main.tf'), mainTf);
    await this.writeFileIfChanged(join(workspaceDir, 'providers.tf'), providersTf);
    await this.writeFileIfChanged(join(workspaceDir, 'backend.tf'), backendTf);

    return { workspace: workspaceName, directory: workspaceDir, identity };
  }

  private normalizeWorkspaceName(value: string): string {
    const name = value.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('workspace name must be lowercase alphanumeric with dashes');
    }
    return name;
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value || !value.trim()) {
      throw new Error(`${key} must be set`);
    }
    return value.trim();
  }

  private async writeFileIfChanged(path: string, contents: string): Promise<void> {
    try {
      const existing = await fs.readFile(path, 'utf8');
      if (existing === contents) {
        return;
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    await fs.writeFile(path, contents, 'utf8');
  }

  private async workspaceFilesPresent(workspaceDir: string): Promise<boolean> {
    const files = ['main.tf', 'providers.tf', 'backend.tf'];
    for (const file of files) {
      try {
        await fs.access(join(workspaceDir, file));
      } catch {
        return false;
      }
    }
    return true;
  }
}
